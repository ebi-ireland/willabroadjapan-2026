// =====================
// tests/routes/diagnosis.test.js
// routes/diagnosis.js の統合テスト
// =====================

const express = require('express')
const request = require('supertest')

jest.mock('../../db/connection')
const mockDb = require('../../db/connection')

// Discord通知用の node-fetch をモック
jest.mock('node-fetch', () =>
  jest.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  }))
)

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/diagnosis', require('../../routes/diagnosis'))
  return app
}

// ─────────────────────────────────────────────────────────────
// GET /api/diagnosis/colleges
// ─────────────────────────────────────────────────────────────
describe('GET /api/diagnosis/colleges', () => {
  test('大学一覧をスコア降順で返す', async () => {
    mockDb.query.mockImplementation((sql, cb) => {
      cb(null, [
        { id: 1, name: 'MIT',       score: 200, need_based: 1, country: 'アメリカ' },
        { id: 2, name: 'Yale',      score: 180, need_based: 0, country: 'アメリカ' },
        { id: 3, name: 'UCL',       score: 150, need_based: 0, country: 'イギリス' },
      ])
    })

    const res = await request(createApp()).get('/api/diagnosis/colleges')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(3)
    expect(res.body[0].name).toBe('MIT')
    expect(res.body[0].score).toBe(200)
    expect(res.body[0]).toHaveProperty('need_based')
    expect(res.body[0]).toHaveProperty('country')
  })

  test('DB が空 → 空配列を返す', async () => {
    mockDb.query.mockImplementation((sql, cb) => cb(null, []))
    const res = await request(createApp()).get('/api/diagnosis/colleges')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  test('DBエラー → 500 を返す', async () => {
    mockDb.query.mockImplementation((sql, cb) => cb(new Error('DB error'), null))
    const res = await request(createApp()).get('/api/diagnosis/colleges')
    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error')
  })
})

// ─────────────────────────────────────────────────────────────
// GET /api/diagnosis/config
// ─────────────────────────────────────────────────────────────
describe('GET /api/diagnosis/config', () => {
  test('設定をキーバリューオブジェクトで返す', async () => {
    mockDb.query.mockImplementation((sql, cb) => {
      cb(null, [
        { cfg_key: 'pass_threshold',  cfg_val: '90',  label: '合格閾値' },
        { cfg_key: 'maybe_threshold', cfg_val: '70',  label: '要検討閾値' },
        { cfg_key: 'max_selections',  cfg_val: '5',   label: '最大選択数' },
        { cfg_key: 'weight_gpa',      cfg_val: '1.5', label: 'GPA重み' },
        { cfg_key: 'cap_gpa',         cfg_val: '50',  label: 'GPA上限' },
      ])
    })

    const res = await request(createApp()).get('/api/diagnosis/config')
    expect(res.status).toBe(200)
    expect(res.body.pass_threshold).toBe('90')
    expect(res.body.maybe_threshold).toBe('70')
    expect(res.body.max_selections).toBe('5')
    expect(res.body.weight_gpa).toBe('1.5')
    expect(res.body.cap_gpa).toBe('50')
  })

  test('設定が空 → 空オブジェクトを返す', async () => {
    mockDb.query.mockImplementation((sql, cb) => cb(null, []))
    const res = await request(createApp()).get('/api/diagnosis/config')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({})
  })

  test('DBエラー → 500 を返す', async () => {
    mockDb.query.mockImplementation((sql, cb) => cb(new Error('DB error'), null))
    const res = await request(createApp()).get('/api/diagnosis/config')
    expect(res.status).toBe(500)
  })
})

// ─────────────────────────────────────────────────────────────
// GET /api/diagnosis/keywords
// ─────────────────────────────────────────────────────────────
describe('GET /api/diagnosis/keywords', () => {
  test('キーワード一覧をポイント降順で返す', async () => {
    mockDb.query.mockImplementation((sql, cb) => {
      cb(null, [
        { keyword: 'リーダーシップ', points: 15, category: '活動' },
        { keyword: 'ボランティア',   points: 10, category: '活動' },
        { keyword: 'スポーツ',       points:  5, category: '課外' },
      ])
    })

    const res = await request(createApp()).get('/api/diagnosis/keywords')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(3)
    expect(res.body[0].keyword).toBe('リーダーシップ')
    expect(res.body[0].points).toBe(15)
    expect(res.body[0]).toHaveProperty('category')
  })
})

// ─────────────────────────────────────────────────────────────
// GET /api/diagnosis/scoring
// ─────────────────────────────────────────────────────────────
describe('GET /api/diagnosis/scoring', () => {
  test('スコアリングテーブルを返す', async () => {
    mockDb.query.mockImplementation((sql, cb) => {
      cb(null, [
        { item_type: 'gpa', min_val: '3.7', max_val: '4.0', key_val: null, pts: 40 },
        { item_type: 'gpa', min_val: '3.3', max_val: '3.69', key_val: null, pts: 30 },
        { item_type: 'classrank', min_val: null, max_val: null, key_val: 'top10', pts: 15 },
      ])
    })

    const res = await request(createApp()).get('/api/diagnosis/scoring')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(3)
    expect(res.body[0]).toHaveProperty('item_type')
    expect(res.body[0]).toHaveProperty('pts')
  })
})

// ─────────────────────────────────────────────────────────────
// POST /api/diagnosis/notify
// ─────────────────────────────────────────────────────────────
describe('POST /api/diagnosis/notify', () => {
  const validPayload = {
    step1: {
      gpa: '3.8', classrank: 'top10',
      sat: '1500', act: '',
      lang: 'TOEFL 105',
      needBased: 'yes',
      act1: 'ロボコン', act2: 'ボランティア', act3: '',
    },
    results: [
      { name: 'MIT',  verdict: '合格見込み', pct: 95 },
      { name: 'Yale', verdict: '要検討',     pct: 72 },
    ],
  }

  test('正常なペイロード → 200 を返す', async () => {
    const res = await request(createApp())
      .post('/api/diagnosis/notify')
      .send(validPayload)
    expect(res.status).toBe(200)
  })

  test('results が空配列でも 200 を返す', async () => {
    const res = await request(createApp())
      .post('/api/diagnosis/notify')
      .send({ ...validPayload, results: [] })
    expect(res.status).toBe(200)
  })

  test('Discord Webhook が失敗したとき → 500 を返す', async () => {
    const fetch = require('node-fetch')
    fetch.mockRejectedValueOnce(new Error('Network error'))

    const res = await request(createApp())
      .post('/api/diagnosis/notify')
      .send(validPayload)
    // routes/diagnosis.js の実装: fetch 失敗時は 500 を返す
    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error')
  })
})
