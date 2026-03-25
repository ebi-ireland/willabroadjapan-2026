const express = require('express')
const router  = express.Router()
const db      = require('../db/connection')
const { safeId } = require('../middleware/sanitize')

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'ログインが必要です' })
  next()
}

// レコメンドスコア計算
function scoreUniversity(uni, prefs, rateMap) {
  let score = 0

  // 1. 国一致（25点）
  if (prefs.target_countries && Array.isArray(prefs.target_countries)) {
    if (prefs.target_countries.includes(uni.country)) score += 25
  }

  // 2. 予算マッチ（20点）
  if (prefs.budget_jpy && uni.tuition) {
    const currency = uni.tuition_currency || 'USD'
    const rate = rateMap[currency] || 155
    const tuitionJpy = uni.tuition * rate
    const livingJpy  = (uni.living || 0) * rate
    const totalJpy   = tuitionJpy + livingJpy
    if (totalJpy <= prefs.budget_jpy) score += 20
    else if (totalJpy <= prefs.budget_jpy * 1.2) score += 10
  }

  // 3. 合格率・難易度マッチ（25点）
  if (prefs.gpa && uni.gpa) {
    const diff = Math.abs(parseFloat(prefs.gpa) - parseFloat(uni.gpa))
    if (diff <= 0.2) score += 25
    else if (diff <= 0.4) score += 15
    else if (diff <= 0.6) score += 8
  } else if (uni.acceptance_total) {
    const rate = parseFloat(uni.acceptance_total)
    if (rate >= 20 && rate <= 60) score += 15
    else if (rate > 60) score += 20
  }

  // 4. 奨学金対応（10点）
  if (prefs.scholarship_need) {
    if (uni.need_based) score += 5
    if (uni.full_tuition) score += 5
  }

  // 5. 英語スコア（20点）
  if (prefs.toefl_score && uni.toefl_total) {
    if (parseInt(prefs.toefl_score) >= parseInt(uni.toefl_total)) score += 20
    else if (parseInt(prefs.toefl_score) >= parseInt(uni.toefl_total) - 5) score += 10
  } else if (prefs.ielts_score && uni.ielts_total) {
    if (parseFloat(prefs.ielts_score) >= parseFloat(uni.ielts_total)) score += 20
    else if (parseFloat(prefs.ielts_score) >= parseFloat(uni.ielts_total) - 0.5) score += 10
  } else {
    score += 10 // スコア情報なしはニュートラル
  }

  return score
}

// レコメンド取得
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.id
  const limit  = Math.min(20, safeId(req.query.limit) || 10)

  const [prefs, rates] = await Promise.all([
    new Promise(resolve => db.query('SELECT * FROM user_preferences WHERE user_id=?', [userId], (err, r) => resolve(r?.[0] || {}))),
    new Promise(resolve => db.query('SELECT currency_code, rate_to_jpy FROM exchange_rates', (err, r) => resolve(r || []))),
  ])

  const rateMap = {}
  rates.forEach(r => { rateMap[r.currency_code] = parseFloat(r.rate_to_jpy) })

  db.query(
    `SELECT id, name, country, city, lat, lng, url, tuition, tuition_currency, living,
            acceptance_total, gpa, toefl_total, ielts_total, need_based, full_tuition
     FROM university_scholarships
     WHERE name IS NOT NULL
     ORDER BY RAND()
     LIMIT 200`,
    (err, unis) => {
      if (err) return res.status(500).json({ error: err.message })

      const scored = unis.map(u => ({
        ...u,
        match_score: scoreUniversity(u, prefs, rateMap)
      })).sort((a, b) => b.match_score - a.match_score).slice(0, limit)

      res.json({ recommendations: scored, preferences: prefs })
    }
  )
})

// プロフィール設定を保存
router.post('/preferences', requireAuth, (req, res) => {
  const userId = req.user.id
  const { target_countries, budget_jpy, major_interest, scholarship_need, gpa, toefl_score, ielts_score } = req.body

  db.query(
    `INSERT INTO user_preferences (user_id, target_countries, budget_jpy, major_interest, scholarship_need, gpa, toefl_score, ielts_score)
     VALUES (?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE target_countries=VALUES(target_countries), budget_jpy=VALUES(budget_jpy),
       major_interest=VALUES(major_interest), scholarship_need=VALUES(scholarship_need),
       gpa=VALUES(gpa), toefl_score=VALUES(toefl_score), ielts_score=VALUES(ielts_score)`,
    [
      userId,
      JSON.stringify(Array.isArray(target_countries) ? target_countries.slice(0,10) : []),
      parseInt(budget_jpy, 10) || null,
      (major_interest || '').slice(0, 200) || null,
      scholarship_need ? 1 : 0,
      parseFloat(gpa) || null,
      parseInt(toefl_score, 10) || null,
      parseFloat(ielts_score) || null,
    ],
    (err) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ ok: true })
    }
  )
})

module.exports = router
