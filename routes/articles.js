// =====================
// articles.js
// パス: /routes/articles.js
// 用途: 記事API
// =====================

const express = require('express')
const router = express.Router()
const db = require('../db/connection')

// 記事一覧（ページネーション・検索）
router.get('/', (req, res) => {
  const page = parseInt(req.query.page) || 1
  const limit = 20
  const offset = (page - 1) * limit
  const search = req.query.search ? `%${req.query.search}%` : '%'

  db.query(
    'SELECT COUNT(*) as total FROM articles WHERE status = "published" AND (title LIKE ? OR summary LIKE ?)',
    [search, search],
    (err, countResult) => {
      if (err) return res.status(500).json({ error: err.message })
      const total = countResult[0].total
      db.query(
        'SELECT id, title, summary, updated_at FROM articles WHERE status = "published" AND (title LIKE ? OR summary LIKE ?) ORDER BY updated_at DESC LIMIT ? OFFSET ?',
        [search, search, limit, offset],
        (err, results) => {
          if (err) return res.status(500).json({ error: err.message })
          res.json({ total, page, limit, articles: results })
        }
      )
    }
  )
})

// 記事詳細
router.get('/:id', (req, res) => {
  db.query(
    'SELECT * FROM articles WHERE id = ? AND status = "published"',
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      if (results.length === 0) return res.status(404).json({ error: '記事が見つかりません' })
      res.json(results[0])
    }
  )
})

module.exports = router