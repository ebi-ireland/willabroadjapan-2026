// =====================
// tests/routes/simulator.test.js
// routes/simulator.js の統合テスト
// =====================

const express = require('express')
const request = require('supertest')

// DB接続をモック
jest.mock('../../db/connection')
const mockDb = require('../../db/connection')

/** テスト用アプリを生成 */
function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/simulator', require('../../routes/simulator'))
  return app
}

// ─────────────────────────────────────────────────────────────
// GET /api/simulator/exchange-rates
// ─────────────────────────────────────────────────────────────
describe('GET /api/simulator/exchange-rates', () => {
  test('DBの為替レートを {rates: {...}} 形式で返す', async () => {
    mockDb.query.mockImplementation((sql, cb) => {
      cb(null, [
        { currency_code: 'USD', rate_to_jpy: 155 },
        { currency_code: 'GBP', rate_to_jpy: 195 },
        { currency_code: 'EUR', rate_to_jpy: 168 },
      ])
    })

    const res = await request(createApp()).get('/api/simulator/exchange-rates')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('rates')
    expect(res.body.rates.USD).toBe(155)
    expect(res.body.rates.GBP).toBe(195)
    expect(res.body.rates.EUR).toBe(168)
  })

  test('DBが空のとき → フォールバック値を返す', async () => {
    mockDb.query.mockImplementation((sql, cb) => cb(null, []))

    const res = await request(createApp()).get('/api/simulator/exchange-rates')
    expect(res.status).toBe(200)
    // フォールバック定義値の確認
    expect(res.body.rates.USD).toBe(150)
    expect(res.body.rates.GBP).toBe(190)
    expect(res.body.rates.EUR).toBe(165)
    expect(res.body.rates.AUD).toBe(98)
    expect(res.body.rates.SGD).toBe(112)
    expect(res.body.rates.KRW).toBe(0.11)
  })

  test('DBの値がフォールバックを上書きする', async () => {
    mockDb.query.mockImplementation((sql, cb) => {
      cb(null, [{ currency_code: 'USD', rate_to_jpy: 160 }])
    })

    const res = await request(createApp()).get('/api/simulator/exchange-rates')
    expect(res.body.rates.USD).toBe(160) // DB値優先
    expect(res.body.rates.GBP).toBe(190) // フォールバックのまま
  })

  test('DBエラー → 500 + error メッセージを返す', async () => {
    mockDb.query.mockImplementation((sql, cb) => cb(new Error('DB接続タイムアウト'), null))

    const res = await request(createApp()).get('/api/simulator/exchange-rates')
    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error')
  })
})

// ─────────────────────────────────────────────────────────────
// POST /api/simulator/calculate
// ─────────────────────────────────────────────────────────────
describe('POST /api/simulator/calculate', () => {
  // 全テストでUSD=155を返す
  beforeEach(() => {
    mockDb.query.mockImplementation((sql, cb) => {
      cb(null, [
        { currency_code: 'USD', rate_to_jpy: 155 },
        { currency_code: 'GBP', rate_to_jpy: 195 },
        { currency_code: 'AUD', rate_to_jpy: 98  },
      ])
    })
  })

  test('必須フィールドを返す（annualGross, annualNet, totalGross, totalNet, breakdown）', async () => {
    const res = await request(createApp())
      .post('/api/simulator/calculate')
      .send({
        tuition_per_year: 30000, currency: 'USD',
        years: 4,
        living_per_year: 15000, living_currency: 'USD',
      })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('annualGross')
    expect(res.body).toHaveProperty('annualNet')
    expect(res.body).toHaveProperty('totalGross')
    expect(res.body).toHaveProperty('totalNet')
    expect(res.body).toHaveProperty('breakdown')
    expect(Array.isArray(res.body.breakdown)).toBe(true)
  })

  test('円換算の計算値が正確（USD/¥155レート）', async () => {
    const res = await request(createApp())
      .post('/api/simulator/calculate')
      .send({
        tuition_per_year:     30000, currency: 'USD',       // 30000 * 155 = 4,650,000
        years: 4,
        living_per_year:      15000, living_currency: 'USD', // 15000 * 155 = 2,325,000
        scholarship_per_year: 10000, scholarship_currency: 'USD', // 10000 * 155 = 1,550,000
      })

    expect(res.status).toBe(200)
    // annualGross = (30000 + 15000) * 155 = 6,975,000
    expect(res.body.annualGross).toBe(6975000)
    // annualNet = 6975000 - 1550000 = 5,425,000
    expect(res.body.annualNet).toBe(5425000)
    // totalGross = 6975000 * 4 = 27,900,000
    expect(res.body.totalGross).toBe(27900000)
    // totalNet = 5425000 * 4 = 21,700,000
    expect(res.body.totalNet).toBe(21700000)
  })

  test('奨学金が年間費用を超えても annualNet は 0 以上', async () => {
    const res = await request(createApp())
      .post('/api/simulator/calculate')
      .send({
        tuition_per_year: 10000, currency: 'USD',
        years: 4,
        living_per_year: 5000, living_currency: 'USD',
        scholarship_per_year: 999999, scholarship_currency: 'USD',
      })

    expect(res.status).toBe(200)
    expect(res.body.annualNet).toBeGreaterThanOrEqual(0)
    expect(res.body.totalNet).toBeGreaterThanOrEqual(0)
  })

  test('breakdown の各年が正しい構造（year/tuition/living/scholarship/gross/net）', async () => {
    const res = await request(createApp())
      .post('/api/simulator/calculate')
      .send({
        tuition_per_year: 20000, currency: 'USD',
        years: 3,
        living_per_year: 10000, living_currency: 'USD',
      })

    expect(res.status).toBe(200)
    expect(res.body.breakdown).toHaveLength(3)
    res.body.breakdown.forEach((yr, i) => {
      expect(yr.year).toBe(i + 1)
      expect(yr).toHaveProperty('tuition')
      expect(yr).toHaveProperty('living')
      expect(yr).toHaveProperty('scholarship')
      expect(yr).toHaveProperty('gross')
      expect(yr).toHaveProperty('net')
    })
  })

  test('手動為替レートが DB レートより優先される', async () => {
    const res = await request(createApp())
      .post('/api/simulator/calculate')
      .send({
        tuition_per_year: 1000, currency: 'USD',
        years: 1,
        living_per_year: 0, living_currency: 'USD',
        exchange_rate_manual: 200, // 手動: 200円/USD
      })

    expect(res.status).toBe(200)
    // 1000 * 200 = 200,000（DBのUSD=155ではなく200を使用）
    expect(res.body.annualGross).toBe(200000)
  })

  test('years が 8 を超えても最大 8 年に制限される', async () => {
    const res = await request(createApp())
      .post('/api/simulator/calculate')
      .send({
        tuition_per_year: 10000, currency: 'USD',
        years: 99,
        living_per_year: 5000, living_currency: 'USD',
      })

    expect(res.status).toBe(200)
    expect(res.body.breakdown).toHaveLength(8)
  })

  test('years が 1 未満でも最低 1 年として計算', async () => {
    const res = await request(createApp())
      .post('/api/simulator/calculate')
      .send({
        tuition_per_year: 10000, currency: 'USD',
        years: 0,
        living_per_year: 5000, living_currency: 'USD',
      })

    expect(res.status).toBe(200)
    expect(res.body.breakdown).toHaveLength(1)
  })

  test('異なる通貨（AUD）で計算できる', async () => {
    const res = await request(createApp())
      .post('/api/simulator/calculate')
      .send({
        tuition_per_year: 40000, currency: 'AUD', // 40000 * 98 = 3,920,000
        years: 1,
        living_per_year: 0, living_currency: 'AUD',
      })

    expect(res.status).toBe(200)
    expect(res.body.annualGross).toBe(3920000)
  })

  test('DBエラー → 500 を返す', async () => {
    mockDb.query.mockImplementation((sql, cb) => cb(new Error('DB error'), null))
    const res = await request(createApp())
      .post('/api/simulator/calculate')
      .send({ tuition_per_year: 10000, currency: 'USD', years: 4 })
    expect(res.status).toBe(500)
  })
})
