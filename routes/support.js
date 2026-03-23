// =====================
// support.js
// パス: /routes/support.js
// 用途: サポートサービスAPI
// =====================

const express = require('express')
const router = express.Router()
const db = require('../db/connection')

// サポート一覧
router.get('/', (req, res) => {
  db.query(
    'SELECT * FROM support_services WHERE is_active = 1 ORDER BY sort_order ASC',
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results)
    }
  )
})

module.exports = router