// =====================
// ranking.js
// パス: /routes/ranking.js
// 用途: ランキングAPI
// =====================

const express = require('express')
const router = express.Router()
const db = require('../db/connection')

function getPeriodFilter(period) {
  switch (period) {
    case 'week':     return 'AND vl.viewed_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)'
    case 'month':    return 'AND vl.viewed_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)'
    case 'year':     return 'AND vl.viewed_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)'
    case 'trending': return 'AND vl.viewed_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)'
    default:         return 'AND vl.viewed_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)'
  }
}

function getFavPeriodFilter(period) {
  switch (period) {
    case 'week':     return 'AND fl.created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)'
    case 'month':    return 'AND fl.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)'
    case 'year':     return 'AND fl.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)'
    case 'trending': return 'AND fl.created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)'
    default:         return 'AND fl.created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)'
  }
}

// 人気大学（お気に入り数順）
router.get('/universities/favorite', (req, res) => {
  const period = req.query.period || 'week'
  const filter = getFavPeriodFilter(period)
  db.query(`
    SELECT u.id, u.name, u.country, COUNT(fl.id) as favorite_count
    FROM university_scholarships u
    LEFT JOIN favorite_logs fl ON u.id = fl.university_id
    WHERE 1=1 ${filter}
    GROUP BY u.id
    ORDER BY favorite_count DESC
    LIMIT 10
  `, (err, results) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(results)
  })
})

// 閲覧数の多い大学
router.get('/universities/view', (req, res) => {
  const period = req.query.period || 'week'
  if (period === 'trending') {
    db.query(`
      SELECT u.id, u.name, u.country,
        COUNT(DISTINCT vl.id) as view_count,
        COUNT(DISTINCT vl.id) - COUNT(DISTINCT vl2.id) as trend_diff
      FROM university_scholarships u
      LEFT JOIN view_logs vl ON u.id = vl.target_id AND vl.type = 'university'
        AND vl.viewed_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)
      LEFT JOIN view_logs vl2 ON u.id = vl2.target_id AND vl2.type = 'university'
        AND vl2.viewed_at >= DATE_SUB(NOW(), INTERVAL 2 WEEK)
        AND vl2.viewed_at < DATE_SUB(NOW(), INTERVAL 1 WEEK)
      GROUP BY u.id
      ORDER BY trend_diff DESC
      LIMIT 10
    `, (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results)
    })
  } else {
    const filter = getPeriodFilter(period)
    db.query(`
      SELECT u.id, u.name, u.country, COUNT(vl.id) as view_count
      FROM university_scholarships u
      LEFT JOIN view_logs vl ON u.id = vl.target_id AND vl.type = 'university'
      WHERE 1=1 ${filter}
      GROUP BY u.id
      ORDER BY view_count DESC
      LIMIT 10
    `, (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results)
    })
  }
})

// 閲覧数の多い財団奨学金
router.get('/scholarships/view', (req, res) => {
  const period = req.query.period || 'week'
  if (period === 'trending') {
    db.query(`
      SELECT s.id, s.name, '' as provider,
        COUNT(DISTINCT vl.id) as view_count,
        COUNT(DISTINCT vl.id) - COUNT(DISTINCT vl2.id) as trend_diff
      FROM foundation_scholarships s
      LEFT JOIN view_logs vl ON s.id = vl.target_id AND vl.type = 'scholarship'
        AND vl.viewed_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)
      LEFT JOIN view_logs vl2 ON s.id = vl2.target_id AND vl2.type = 'scholarship'
        AND vl2.viewed_at >= DATE_SUB(NOW(), INTERVAL 2 WEEK)
        AND vl2.viewed_at < DATE_SUB(NOW(), INTERVAL 1 WEEK)
      GROUP BY s.id
      ORDER BY trend_diff DESC
      LIMIT 10
    `, (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results)
    })
  } else {
    const filter = getPeriodFilter(period)
    db.query(`
      SELECT s.id, s.name, '' as provider, COUNT(vl.id) as view_count
      FROM foundation_scholarships s
      LEFT JOIN view_logs vl ON s.id = vl.target_id AND vl.type = 'scholarship'
      WHERE 1=1 ${filter}
      GROUP BY s.id
      ORDER BY view_count DESC
      LIMIT 10
    `, (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results)
    })
  }
})

// 閲覧数の多いプログラム
router.get('/programs/view', (req, res) => {
  const period = req.query.period || 'week'
  if (period === 'trending') {
    db.query(`
      SELECT p.id, p.name,
        COUNT(DISTINCT vl.id) as view_count,
        COUNT(DISTINCT vl.id) - COUNT(DISTINCT vl2.id) as trend_diff
      FROM program_scholarships p
      LEFT JOIN view_logs vl ON p.id = vl.target_id AND vl.type = 'program'
        AND vl.viewed_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)
      LEFT JOIN view_logs vl2 ON p.id = vl2.target_id AND vl2.type = 'program'
        AND vl2.viewed_at >= DATE_SUB(NOW(), INTERVAL 2 WEEK)
        AND vl2.viewed_at < DATE_SUB(NOW(), INTERVAL 1 WEEK)
      GROUP BY p.id
      ORDER BY trend_diff DESC
      LIMIT 10
    `, (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results)
    })
  } else {
    const filter = getPeriodFilter(period)
    db.query(`
      SELECT p.id, p.name, COUNT(vl.id) as view_count
      FROM program_scholarships p
      LEFT JOIN view_logs vl ON p.id = vl.target_id AND vl.type = 'program'
      WHERE 1=1 ${filter}
      GROUP BY p.id
      ORDER BY view_count DESC
      LIMIT 10
    `, (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results)
    })
  }
})

module.exports = router
