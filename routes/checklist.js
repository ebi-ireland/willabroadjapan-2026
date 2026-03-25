const express = require('express')
const router  = express.Router()
const db      = require('../db/connection')
const { safeId, safeStr, sanitizeText } = require('../middleware/sanitize')

// ログイン確認ミドルウェア
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'ログインが必要です' })
  next()
}

// テンプレート一覧
router.get('/templates', (req, res) => {
  db.query(
    'SELECT * FROM checklist_templates WHERE is_active = 1 ORDER BY sort_order',
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(rows)
    }
  )
})

// ユーザーのチェックリスト一覧（HTML側の { universities, nextId } 形式で返す）
router.get('/', requireAuth, (req, res) => {
  const userId = req.user.id
  // DBステータス → HTML表示ステータス変換
  const STATUS_MAP = { not_started: 'none', in_progress: 'progress', completed: 'done' }

  db.query(
    `SELECT uc.id, uc.college_name, uc.college_id, uc.status, uc.note,
            uc.custom_name, uc.template_id,
            COALESCE(ct.name, uc.custom_name) as item_name
     FROM user_checklists uc
     LEFT JOIN checklist_templates ct ON uc.template_id = ct.id
     WHERE uc.user_id = ?
     ORDER BY uc.college_name, ct.sort_order, uc.created_at`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      // 大学ごとにグループ化 → HTML期待のフォーマットに変換
      const groupMap = {}
      let maxId = 1000
      rows.forEach(row => {
        const key = row.college_name || '共通'
        if (!groupMap[key]) {
          groupMap[key] = {
            id:    row.college_id || ('g_' + encodeURIComponent(key)),
            name:  key,
            items: [],
          }
        }
        if (row.id > maxId) maxId = row.id
        groupMap[key].items.push({
          id:     row.id,
          name:   row.item_name || row.custom_name || '書類',
          status: STATUS_MAP[row.status] || 'none',
          memo:   row.note || '',
          custom: !row.template_id,
        })
      })
      res.json({ universities: Object.values(groupMap), nextId: maxId })
    }
  )
})

// 大学を追加してテンプレートからチェックリストを自動生成
// HTML側は { universityName } を送るので college_name / universityName どちらでも受け付ける
router.post('/init', requireAuth, (req, res) => {
  const userId     = req.user.id
  const collegeName = safeStr(req.body.college_name || req.body.universityName, 255)
  const collegeId  = safeId(req.body.college_id)

  if (!collegeName) return res.status(400).json({ error: 'college_nameは必須です' })

  // すでに同じ大学が登録されていないか確認
  db.query(
    'SELECT id FROM user_checklists WHERE user_id = ? AND college_name = ? LIMIT 1',
    [userId, collegeName],
    (err, existing) => {
      if (err) return res.status(500).json({ error: err.message })
      if (existing.length > 0) return res.status(409).json({ error: 'この大学はすでに追加されています' })

      // テンプレートから一括生成
      db.query('SELECT * FROM checklist_templates WHERE is_active = 1 ORDER BY sort_order', (err2, templates) => {
        if (err2) return res.status(500).json({ error: err2.message })

        const values = templates.map(t => [userId, collegeId, collegeName, t.id, null])
        if (values.length === 0) return res.json({ ok: true, created: 0 })

        db.query(
          'INSERT INTO user_checklists (user_id, college_id, college_name, template_id, custom_name) VALUES ?',
          [values],
          (err3) => {
            if (err3) return res.status(500).json({ error: err3.message })
            // HTML側が期待する { items: [{ name }] } 形式で返す
            res.json({
              ok: true,
              created: values.length,
              items: templates.map(t => ({ name: t.name, category: t.category })),
            })
          }
        )
      })
    }
  )
})

// カスタムアイテムを追加
router.post('/custom', requireAuth, (req, res) => {
  const userId     = req.user.id
  const collegeName = safeStr(req.body.college_name, 255)
  const customName = safeStr(req.body.custom_name, 200)
  if (!customName) return res.status(400).json({ error: 'custom_nameは必須です' })

  db.query(
    'INSERT INTO user_checklists (user_id, college_name, custom_name) VALUES (?,?,?)',
    [userId, collegeName || null, customName],
    (err) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ ok: true })
    }
  )
})

// ステータス更新（HTML側のキー none/progress/done もDB側のキーも両方受け付ける）
router.patch('/:id/status', requireAuth, (req, res) => {
  const id     = safeId(req.params.id)
  const userId = req.user.id
  const rawStatus = req.body.status
  if (!id) return res.status(400).json({ error: '無効なID' })
  // HTML → DB キー変換
  const STATUS_TO_DB = { none: 'not_started', progress: 'in_progress', done: 'completed' }
  const status = STATUS_TO_DB[rawStatus] || rawStatus
  const valid = ['not_started','in_progress','completed']
  if (!valid.includes(status)) return res.status(400).json({ error: '無効なステータス' })

  const completedAt = status === 'completed' ? new Date() : null
  db.query(
    'UPDATE user_checklists SET status=?, completed_at=? WHERE id=? AND user_id=?',
    [status, completedAt, id, userId],
    (err) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ ok: true })
    }
  )
})

// ──────────────────────────────────────────────────────
// PUT / : HTML側からの全体状態保存（localStorage同期）
// body: { universities: [{ id, name, items: [{ id, status, memo }] }] }
// ──────────────────────────────────────────────────────
router.put('/', requireAuth, (req, res) => {
  const userId = req.user.id
  const { universities } = req.body
  if (!Array.isArray(universities)) return res.status(400).json({ error: '無効なデータ' })

  const STATUS_TO_DB = { none: 'not_started', progress: 'in_progress', done: 'completed' }

  // 全アイテムのステータスとメモを一括更新（数値IDのものだけ）
  const updates = []
  universities.forEach(uni => {
    if (!Array.isArray(uni.items)) return
    uni.items.forEach(item => {
      const id = parseInt(item.id)
      if (!id || id > 1e9) return  // ローカルIDは除外
      updates.push([STATUS_TO_DB[item.status] || item.status || 'not_started', item.memo || '', id, userId])
    })
  })

  if (updates.length === 0) return res.json({ ok: true, updated: 0 })

  // 直列更新（簡易実装）
  let done = 0
  updates.forEach(([status, note, id, uid]) => {
    db.query(
      'UPDATE user_checklists SET status=?, note=? WHERE id=? AND user_id=?',
      [status, note.slice(0, 2000), id, uid],
      (err) => { if (!err) done++ }
    )
  })
  res.json({ ok: true, updated: updates.length })
})

// メモ更新
router.patch('/:id/note', requireAuth, (req, res) => {
  const id     = safeId(req.params.id)
  const userId = req.user.id
  const note   = sanitizeText(req.body.note || '')
  if (!id) return res.status(400).json({ error: '無効なID' })

  db.query(
    'UPDATE user_checklists SET note=? WHERE id=? AND user_id=?',
    [note.slice(0, 2000), id, userId],
    (err) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ ok: true })
    }
  )
})

// 削除
router.delete('/:id', requireAuth, (req, res) => {
  const id     = safeId(req.params.id)
  const userId = req.user.id
  if (!id) return res.status(400).json({ error: '無効なID' })

  db.query('DELETE FROM user_checklists WHERE id=? AND user_id=?', [id, userId], (err) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ ok: true })
  })
})

module.exports = router
