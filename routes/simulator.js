const express = require('express')
const router  = express.Router()
const db      = require('../db/connection')
const { safeId, safeInt } = require('../middleware/sanitize')

// 対応国一覧
router.get('/countries', (req, res) => {
  db.query(
    'SELECT DISTINCT country, tuition_currency FROM university_scholarships WHERE country IS NOT NULL ORDER BY country',
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(rows)
    }
  )
})

// 為替レート一覧（HTML側が期待する {rates: {USD: 155, ...}} 形式で返す）
router.get('/exchange-rates', (req, res) => {
  // DBにない通貨のフォールバック
  const FALLBACK = { USD: 150, GBP: 190, EUR: 165, AUD: 98, CAD: 111, SGD: 112, KRW: 0.11, NZD: 90 }
  db.query('SELECT currency_code, rate_to_jpy FROM exchange_rates ORDER BY currency_code', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    const rates = { ...FALLBACK }
    rows.forEach(r => { rates[r.currency_code] = parseFloat(r.rate_to_jpy) })
    res.json({ rates })
  })
})

// 試算実行
router.post('/calculate', (req, res) => {
  const {
    tuition_per_year, currency, years = 4,
    living_per_year, living_currency,
    scholarship_per_year = 0, scholarship_currency,
    exchange_rate_manual
  } = req.body

  const tuition  = safeInt(tuition_per_year,  0, 999999999) || 0
  const living   = safeInt(living_per_year,   0, 999999999) || 0
  const schol    = safeInt(scholarship_per_year, 0, 999999999) || 0
  const numYears = Math.min(8, Math.max(1, safeInt(years, 1, 8) || 4))

  // 為替レートを取得して計算
  db.query('SELECT currency_code, rate_to_jpy FROM exchange_rates', (err, rates) => {
    if (err) return res.status(500).json({ error: err.message })

    const rateMap = {}
    rates.forEach(r => { rateMap[r.currency_code] = parseFloat(r.rate_to_jpy) })

    // 手動入力レートがあればそれを使用
    if (exchange_rate_manual) rateMap[currency] = parseFloat(exchange_rate_manual)

    const tRate = rateMap[currency] || rateMap['USD'] || 155
    const lRate = rateMap[living_currency] || rateMap[currency] || rateMap['USD'] || 155
    const sRate = rateMap[scholarship_currency] || rateMap[currency] || rateMap['USD'] || 155

    const tuitionJpy  = Math.round(tuition * tRate)
    const livingJpy   = Math.round(living  * lRate)
    const scholJpy    = Math.round(schol   * sRate)

    const annualGross = tuitionJpy + livingJpy
    const annualNet   = Math.max(0, annualGross - scholJpy)
    const totalGross  = annualGross * numYears
    const totalNet    = annualNet   * numYears
    const totalSchol  = scholJpy    * numYears

    // HTML側が期待するフラット形式で返す
    res.json({
      annualGross,
      annualNet,
      totalGross,
      totalNet,
      breakdown: Array.from({ length: numYears }, (_, i) => ({
        year: i + 1,
        tuition:     tuitionJpy,
        living:      livingJpy,
        scholarship: scholJpy,
        gross:       annualGross,
        net:         annualNet,
      })),
    })
  })
})

module.exports = router
