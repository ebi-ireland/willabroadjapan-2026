// =====================
// templates.js
// パス: /routes/templates.js
// 用途: テンプレートAPI
// =====================

const express = require('express')
const router = express.Router()
const db = require('../db/connection')

// テンプレート一覧
router.get('/', (req, res) => {
  db.query(
    'SELECT * FROM templates WHERE is_active = 1 ORDER BY sort_order ASC',
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results)
    }
  )
})

module.exports = router