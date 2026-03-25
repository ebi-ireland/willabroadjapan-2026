const express = require('express')
const router  = express.Router()
const db      = require('../db/connection')
const { safeId, safeStr, sanitizeText } = require('../middleware/sanitize')

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'ログインが必要です' })
  next()
}

const VALID_CATS = ['application','test','document','interview','other']

// ユーザー個人 + 公式締め切りをマージして返す
router.get('/', requireAuth, (req, res) => {
  const userId = req.user.id
  const [pUser, pOfficial] = [
    new Promise((resolve) => db.query(
      'SELECT *, "personal" as source FROM user_deadlines WHERE user_id = ? ORDER BY deadline_date ASC',
      [userId], (err, rows) => resolve(err ? [] : rows)
    )),
    new Promise((resolve) => db.query(
      'SELECT *, "official" as source FROM official_deadlines WHERE is_active = 1 ORDER BY deadline_date ASC',
      [], (err, rows) => resolve(err ? [] : rows)
    )),
  ]
  Promise.all([pUser, pOfficial]).then(([personal, official]) => {
    const merged = [...personal, ...official].sort((a, b) => new Date(a.deadline_date) - new Date(b.deadline_date))
    res.json(merged)
  })
})

// 直近30日（ダッシュボード用）
router.get('/upcoming', requireAuth, (req, res) => {
  const userId = req.user.id
  const days = Math.min(90, safeId(req.query.days) || 30)
  const [pUser, pOfficial] = [
    new Promise((resolve) => db.query(
      'SELECT *, "personal" as source FROM user_deadlines WHERE user_id=? AND is_done=0 AND deadline_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY) ORDER BY deadline_date',
      [userId, days], (err, rows) => resolve(err ? [] : rows)
    )),
    new Promise((resolve) => db.query(
      'SELECT *, "official" as source FROM official_deadlines WHERE is_active=1 AND deadline_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY) ORDER BY deadline_date',
      [days], (err, rows) => resolve(err ? [] : rows)
    )),
  ]
  Promise.all([pUser, pOfficial]).then(([p, o]) => {
    res.json([...p, ...o].sort((a, b) => new Date(a.deadline_date) - new Date(b.deadline_date)))
  })
})

// 個人締め切りを追加
router.post('/', requireAuth, (req, res) => {
  const userId = req.user.id
  const { title, deadline_date, category, college_name, url, note, reminder_days } = req.body
  if (!title || !deadline_date) return res.status(400).json({ error: 'title・deadline_dateは必須です' })

  db.query(
    'INSERT INTO user_deadlines (user_id, title, deadline_date, category, college_name, url, note, reminder_days) VALUES (?,?,?,?,?,?,?,?)',
    [
      userId,
      safeStr(title, 200),
      deadline_date,
      VALID_CATS.includes(category) ? category : 'other',
      safeStr(college_name || '', 255) || null,
      safeStr(url || '', 500) || null,
      sanitizeText(note || '').slice(0, 1000) || null,
      Math.min(30, Math.max(0, safeId(reminder_days) || 7))
    ],
    (err) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ ok: true })
    }
  )
})

// 更新
router.patch('/:id', requireAuth, (req, res) => {
  const id     = safeId(req.params.id)
  const userId = req.user.id
  if (!id) return res.status(400).json({ error: '無効なID' })
  const { title, deadline_date, category, college_name, url, note, reminder_days, is_done } = req.body

  db.query(
    'UPDATE user_deadlines SET title=?, deadline_date=?, category=?, college_name=?, url=?, note=?, reminder_days=?, is_done=? WHERE id=? AND user_id=?',
    [
      safeStr(title || '', 200),
      deadline_date,
      VALID_CATS.includes(category) ? category : 'other',
      safeStr(college_name || '', 255) || null,
      safeStr(url || '', 500) || null,
      sanitizeText(note || '').slice(0, 1000) || null,
      Math.min(30, Math.max(0, safeId(reminder_days) || 7)),
      is_done ? 1 : 0,
      id, userId
    ],
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
  db.query('DELETE FROM user_deadlines WHERE id=? AND user_id=?', [id, userId], (err) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ ok: true })
  })
})

module.exports = router
