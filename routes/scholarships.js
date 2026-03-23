// =====================
// scholarships.js
// パス: /routes/scholarships.js
// 用途: 奨学金API
// =====================

const express = require('express')
const router = express.Router()
const db = require('../db/connection')

// 日本時間で今日の日付を取得
function getTodayJST() {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  jst.setUTCHours(0, 0, 0, 0)
  return jst
}

function getOneMonthBefore(deadline) {
  const d = new Date(deadline)
  const before = new Date(d)
  before.setMonth(before.getMonth() - 1)
  if (before.getDate() !== d.getDate()) before.setDate(0)
  return before
}

function calcStatus(deadline) {
  if (!deadline) return 'upcoming'
  const today = getTodayJST()
  const deadlineDate = new Date(deadline)
  deadlineDate.setHours(0, 0, 0, 0)
  const oneMonthBefore = getOneMonthBefore(deadlineDate)
  const dayAfterDeadline = new Date(deadlineDate)
  dayAfterDeadline.setDate(dayAfterDeadline.getDate() + 1)
  if (today >= dayAfterDeadline) return 'closed'
  if (today >= oneMonthBefore) return 'active'
  return 'upcoming'
}

// 大学奨学金一覧
router.get('/university', (req, res) => {
  db.query('SELECT * FROM university_scholarships ORDER BY name ASC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(results)
  })
})

// 閲覧記録
router.post('/university/:id/view', (req, res) => {
  db.query(
    'INSERT INTO view_logs (type, target_id) VALUES (?, ?)',
    ['university', req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ ok: true })
    }
  )
})

// お気に入り登録
router.post('/university/:id/favorite', express.json(), (req, res) => {
  const { user_id } = req.body
  if (!user_id) return res.status(400).json({ error: 'user_id required' })
  db.query(
    'INSERT IGNORE INTO university_favorites (user_id, university_id) VALUES (?, ?)',
    [user_id, req.params.id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message })
      if (result.affectedRows > 0) {
        db.query('INSERT INTO favorite_logs (user_id, university_id) VALUES (?, ?)', [user_id, req.params.id], () => {})
      }
      res.json({ ok: true, added: result.affectedRows > 0 })
    }
  )
})

// お気に入り解除
router.delete('/university/:id/favorite', express.json(), (req, res) => {
  const { user_id } = req.body
  db.query(
    'DELETE FROM university_favorites WHERE user_id = ? AND university_id = ?',
    [user_id, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ ok: true })
    }
  )
})

// お気に入り一覧取得
router.get('/university/favorites/:user_id', (req, res) => {
  db.query(`
    SELECT u.* FROM university_scholarships u
    INNER JOIN university_favorites f ON u.id = f.university_id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `, [req.params.user_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(results)
  })
})

// 財団奨学金一覧
router.get('/foundation', (req, res) => {
  const search = req.query.search ? `%${req.query.search}%` : '%'
  const target = req.query.target || ''
  const targetFilter = target ? 'AND target LIKE ?' : ''
  const params = target ? [search, search, `%${target}%`] : [search, search]
  db.query(`
    SELECT * FROM foundation_scholarships
    WHERE (name LIKE ? OR other_requirements LIKE ?) ${targetFilter}
    ORDER BY deadline ASC
  `, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(results.map(s => ({ ...s, status: calcStatus(s.deadline) })))
  })
})

// プログラム奨学金一覧
router.get('/program', (req, res) => {
  const search = req.query.search ? `%${req.query.search}%` : '%'
  const target = req.query.target || ''
  const targetFilter = target ? 'AND target LIKE ?' : ''
  const params = target ? [search, search, `%${target}%`] : [search, search]
  db.query(`
    SELECT * FROM program_scholarships
    WHERE (name LIKE ? OR content LIKE ?) ${targetFilter}
    ORDER BY application_deadline ASC
  `, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(results.map(s => ({ ...s, status: calcStatus(s.application_deadline) })))
  })
})

module.exports = router