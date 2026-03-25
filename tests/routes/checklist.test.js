// =====================
// tests/routes/checklist.test.js
// routes/checklist.js の統合テスト
// =====================

const express = require('express')
const request = require('supertest')

jest.mock('../../db/connection')
const mockDb = require('../../db/connection')

/** ログイン済みユーザーを注入するミドルウェア */
function authAs(userId = 1) {
  return (req, _res, next) => { req.user = { id: userId }; next() }
}

/** 認証済みテストアプリ */
function createApp(userId = 1) {
  const app = express()
  app.use(express.json())
  app.use(authAs(userId))
  app.use('/api/checklist', require('../../routes/checklist'))
  return app
}

/** 未認証テストアプリ */
function createUnauthApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/checklist', require('../../routes/checklist'))
  return app
}

// ─────────────────────────────────────────────────────────────
// GET /api/checklist
// ─────────────────────────────────────────────────────────────
describe('GET /api/checklist', () => {
  test('{ universities, nextId } 形式で返す', async () => {
    mockDb.query.mockImplementation((sql, params, cb) => {
      cb(null, [
        { id: 101, college_name: 'MIT', college_id: null,
          status: 'not_started', note: '', custom_name: null,
          template_id: 1, item_name: '成績証明書' },
        { id: 102, college_name: 'MIT', college_id: null,
          status: 'in_progress', note: 'メモ', custom_name: null,
          template_id: 2, item_name: '推薦状' },
      ])
    })

    const res = await request(createApp()).get('/api/checklist')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('universities')
    expect(res.body).toHaveProperty('nextId')
    expect(Array.isArray(res.body.universities)).toBe(true)
  })

  test('同じ大学のアイテムを1つのグループにまとめる', async () => {
    mockDb.query.mockImplementation((sql, params, cb) => {
      cb(null, [
        { id: 1, college_name: 'Stanford', college_id: null, status: 'not_started', note: '', custom_name: null, template_id: 1, item_name: '書類A' },
        { id: 2, college_name: 'Stanford', college_id: null, status: 'completed',   note: '', custom_name: null, template_id: 2, item_name: '書類B' },
        { id: 3, college_name: 'Yale',     college_id: null, status: 'not_started', note: '', custom_name: null, template_id: 1, item_name: '書類A' },
      ])
    })

    const res = await request(createApp()).get('/api/checklist')
    expect(res.status).toBe(200)
    expect(res.body.universities).toHaveLength(2) // Stanford と Yale
    const stanford = res.body.universities.find(u => u.name === 'Stanford')
    expect(stanford.items).toHaveLength(2)
  })

  test('DBステータスをHTML用ステータスに変換して返す', async () => {
    mockDb.query.mockImplementation((sql, params, cb) => {
      cb(null, [
        { id: 1, college_name: 'Yale', college_id: null, status: 'not_started', note: '', custom_name: null, template_id: 1, item_name: '書類A' },
        { id: 2, college_name: 'Yale', college_id: null, status: 'in_progress', note: '', custom_name: null, template_id: 2, item_name: '書類B' },
        { id: 3, college_name: 'Yale', college_id: null, status: 'completed',   note: '', custom_name: null, template_id: 3, item_name: '書類C' },
      ])
    })

    const res = await request(createApp()).get('/api/checklist')
    const items = res.body.universities[0].items
    expect(items[0].status).toBe('none')     // not_started → none
    expect(items[1].status).toBe('progress') // in_progress → progress
    expect(items[2].status).toBe('done')     // completed   → done
  })

  test('未ログイン → 401 を返す', async () => {
    const res = await request(createUnauthApp()).get('/api/checklist')
    expect(res.status).toBe(401)
  })

  test('DBエラー → 500 を返す', async () => {
    mockDb.query.mockImplementation((sql, params, cb) => cb(new Error('DB error'), null))
    const res = await request(createApp()).get('/api/checklist')
    expect(res.status).toBe(500)
  })
})

// ─────────────────────────────────────────────────────────────
// POST /api/checklist/init
// ─────────────────────────────────────────────────────────────
describe('POST /api/checklist/init', () => {
  /**
   * 3段階DBクエリのモック: 既存確認→テンプレート取得→INSERT
   *
   * checklist.js の POST /init は以下の順でクエリを発行する:
   *   1. SELECT ... (sql, [userId, collegeName], cb)  ← 3引数
   *   2. SELECT * FROM checklist_templates ... (sql, cb)  ← 2引数!
   *   3. INSERT ... VALUES ? (sql, [values], cb)  ← 3引数
   *
   * db.query は (sql, params, cb) の3引数と (sql, cb) の2引数の両方で呼ばれるため
   * モックは typeof で振り分ける必要がある。
   */
  function mockInitQueries(existingRows = [], templates = [
    { id: 1, name: '成績証明書', category: '書類' },
    { id: 2, name: '推薦状',     category: '書類' },
    { id: 3, name: '英語資格',   category: '語学' },
  ]) {
    let call = 0
    mockDb.query.mockImplementation((sql, paramsOrCb, cb) => {
      // 2引数呼び出し (sql, callback) と 3引数呼び出し (sql, params, callback) を両対応
      const callback = typeof paramsOrCb === 'function' ? paramsOrCb : cb
      call++
      if (call === 1) callback(null, existingRows)
      else if (call === 2) callback(null, templates)
      else callback(null, { affectedRows: templates.length })
    })
  }

  test('大学を追加してテンプレートから items を生成して返す', async () => {
    mockInitQueries()

    const res = await request(createApp())
      .post('/api/checklist/init')
      .send({ universityName: 'Harvard' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.items).toHaveLength(3)
    expect(res.body.items[0]).toHaveProperty('name')
    expect(res.body.items[0].name).toBe('成績証明書')
  })

  test('universityName でも college_name でも受け付ける', async () => {
    mockInitQueries()
    const res1 = await request(createApp())
      .post('/api/checklist/init')
      .send({ universityName: 'Cornell' })
    expect(res1.status).toBe(200)

    mockInitQueries()
    const res2 = await request(createApp())
      .post('/api/checklist/init')
      .send({ college_name: 'Cornell' })
    expect(res2.status).toBe(200)
  })

  test('同じ大学が既に登録済み → 409 を返す', async () => {
    mockDb.query.mockImplementation((sql, params, cb) => {
      cb(null, [{ id: 999 }]) // 既存あり
    })

    const res = await request(createApp())
      .post('/api/checklist/init')
      .send({ universityName: 'MIT' })
    expect(res.status).toBe(409)
    expect(res.body).toHaveProperty('error')
  })

  test('大学名なし → 400 を返す', async () => {
    const res = await request(createApp())
      .post('/api/checklist/init')
      .send({})
    expect(res.status).toBe(400)
  })

  test('未ログイン → 401 を返す', async () => {
    const res = await request(createUnauthApp())
      .post('/api/checklist/init')
      .send({ universityName: 'MIT' })
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────
// PATCH /api/checklist/:id/status
// ─────────────────────────────────────────────────────────────
describe('PATCH /api/checklist/:id/status', () => {
  beforeEach(() => {
    // 2引数・3引数両対応モック
    mockDb.query.mockImplementation((sql, paramsOrCb, cb) => {
      const callback = typeof paramsOrCb === 'function' ? paramsOrCb : cb
      callback(null, { affectedRows: 1 })
    })
  })

  const statusMap = [
    ['none',     'not_started'],
    ['progress', 'in_progress'],
    ['done',     'completed'  ],
  ]

  test.each(statusMap)(
    'HTMLステータス "%s" → DBステータス "%s" に変換して保存',
    async (htmlStatus, dbStatus) => {
      const res = await request(createApp())
        .patch('/api/checklist/1/status')
        .send({ status: htmlStatus })

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      // UPDATE クエリに正しい DB ステータスが渡されているか確認
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.arrayContaining([dbStatus]),
        expect.any(Function)
      )
    }
  )

  test('無効なステータス値 → 400 を返す', async () => {
    const res = await request(createApp())
      .patch('/api/checklist/1/status')
      .send({ status: 'unknown_status' })
    expect(res.status).toBe(400)
  })

  test('ID が "abc"（非数値）→ 400 を返す', async () => {
    const res = await request(createApp())
      .patch('/api/checklist/abc/status')
      .send({ status: 'none' })
    expect(res.status).toBe(400)
  })

  test('未ログイン → 401 を返す', async () => {
    const res = await request(createUnauthApp())
      .patch('/api/checklist/1/status')
      .send({ status: 'none' })
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────
// PATCH /api/checklist/:id/note
// ─────────────────────────────────────────────────────────────
describe('PATCH /api/checklist/:id/note', () => {
  test('メモを保存して 200 を返す', async () => {
    mockDb.query.mockImplementation((sql, paramsOrCb, cb) => {
      const callback = typeof paramsOrCb === 'function' ? paramsOrCb : cb
      callback(null, { affectedRows: 1 })
    })
    const res = await request(createApp())
      .patch('/api/checklist/1/note')
      .send({ note: '3月15日までに郵送' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  test('無効なID → 400 を返す', async () => {
    const res = await request(createApp())
      .patch('/api/checklist/0/note')
      .send({ note: 'メモ' })
    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────
// DELETE /api/checklist/:id
// ─────────────────────────────────────────────────────────────
describe('DELETE /api/checklist/:id', () => {
  test('アイテムを削除して 200 を返す', async () => {
    mockDb.query.mockImplementation((sql, paramsOrCb, cb) => {
      const callback = typeof paramsOrCb === 'function' ? paramsOrCb : cb
      callback(null, { affectedRows: 1 })
    })
    const res = await request(createApp()).delete('/api/checklist/1')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  test('ID が 0 → 400 を返す', async () => {
    const res = await request(createApp()).delete('/api/checklist/0')
    expect(res.status).toBe(400)
  })

  test('ID が文字列 → 400 を返す', async () => {
    const res = await request(createApp()).delete('/api/checklist/abc')
    expect(res.status).toBe(400)
  })

  test('未ログイン → 401 を返す', async () => {
    const res = await request(createUnauthApp()).delete('/api/checklist/1')
    expect(res.status).toBe(401)
  })
})
