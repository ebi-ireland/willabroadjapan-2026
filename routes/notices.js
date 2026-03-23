// =====================
// notices.js
// パス: /routes/notices.js
// 用途: お知らせAPI
// =====================

const express = require('express')
const router = express.Router()
const db = require('../db/connection')

// ホーム用（最新5件）
router.get('/recent', (req, res) => {
  db.query(
    'SELECT id, title, published_at FROM notices ORDER BY published_at DESC LIMIT 5',
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results)
    }
  )
})

// お知らせ一覧（ページネーション・50件ずつ）
router.get('/', (req, res) => {
  const page = parseInt(req.query.page) || 1
  const limit = 50
  const offset = (page - 1) * limit
  db.query('SELECT COUNT(*) as total FROM notices', (err, countResult) => {
    if (err) return res.status(500).json({ error: err.message })
    const total = countResult[0].total
    db.query(
      'SELECT id, title, published_at FROM notices ORDER BY published_at DESC LIMIT ? OFFSET ?',
      [limit, offset],
      (err, results) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ total, page, limit, notices: results })
      }
    )
  })
})

module.exports = router