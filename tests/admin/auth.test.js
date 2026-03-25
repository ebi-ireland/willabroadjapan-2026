// =====================
// tests/admin/auth.test.js
// 管理画面 認証フロー のテスト
//
// admin-server.js はMySQLセッションストアを持つため、
// 認証ロジック部分を再現したテスト用アプリで検証する。
// =====================

const express = require('express')
const session = require('express-session')
const request = require('supertest')

const ADMIN_PASSWORD = 'test_admin_password' // tests/setup.js の値と一致

/** テスト用の管理サーバー（admin-server.js の認証部分を再現）*/
function createAdminApp(password = ADMIN_PASSWORD) {
  const app = express()
  app.use(express.json())

  // テスト用はメモリストア（本番はMySQL）
  app.use(session({
    secret: 'test_session_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true },
  }))

  function requireAuth(req, res, next) {
    if (req.session.admin) return next()
    res.status(401).json({ error: 'Unauthorized' })
  }

  // ── ログイン
  app.post('/admin/api/login', (req, res) => {
    if (req.body.password === password) {
      req.session.admin = true
      res.json({ ok: true })
    } else {
      res.status(401).json({ error: 'パスワードが違います' })
    }
  })

  // ── ログアウト
  app.post('/admin/api/logout', (req, res) => {
    req.session.destroy()
    res.json({ ok: true })
  })

  // ── セッション確認（リロード対応）
  app.get('/admin/api/auth-check', (req, res) => {
    res.json({ authenticated: !!req.session.admin })
  })

  // ── 認証が必要なルート（テスト用）
  app.get('/admin/api/protected', requireAuth, (req, res) => {
    res.json({ data: 'secret data' })
  })

  app.get('/admin/api/notices', requireAuth, (req, res) => {
    res.json([{ id: 1, title: 'テストお知らせ' }])
  })

  return app
}

// ─────────────────────────────────────────────────────────────
// POST /admin/api/login
// ─────────────────────────────────────────────────────────────
describe('POST /admin/api/login', () => {
  test('正しいパスワード → 200 + { ok: true }', async () => {
    const res = await request(createAdminApp())
      .post('/admin/api/login')
      .send({ password: ADMIN_PASSWORD })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  test('間違ったパスワード → 401 + error メッセージ', async () => {
    const res = await request(createAdminApp())
      .post('/admin/api/login')
      .send({ password: 'wrong_password' })

    expect(res.status).toBe(401)
    expect(res.body).toHaveProperty('error')
  })

  test('パスワード空文字列 → 401', async () => {
    const res = await request(createAdminApp())
      .post('/admin/api/login')
      .send({ password: '' })

    expect(res.status).toBe(401)
  })

  test('パスワードフィールドなし → 401', async () => {
    const res = await request(createAdminApp())
      .post('/admin/api/login')
      .send({})

    expect(res.status).toBe(401)
  })

  test('ログイン成功時に Set-Cookie ヘッダーが返る', async () => {
    const res = await request(createAdminApp())
      .post('/admin/api/login')
      .send({ password: ADMIN_PASSWORD })

    expect(res.headers['set-cookie']).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────
// GET /admin/api/auth-check
// ─────────────────────────────────────────────────────────────
describe('GET /admin/api/auth-check', () => {
  test('未ログイン状態 → { authenticated: false }', async () => {
    const res = await request(createAdminApp()).get('/admin/api/auth-check')

    expect(res.status).toBe(200)
    expect(res.body.authenticated).toBe(false)
  })

  test('ログイン後 → { authenticated: true }（セッション維持確認）', async () => {
    const app   = createAdminApp()
    const agent = request.agent(app)

    await agent.post('/admin/api/login').send({ password: ADMIN_PASSWORD })
    const res = await agent.get('/admin/api/auth-check')

    expect(res.status).toBe(200)
    expect(res.body.authenticated).toBe(true)
  })

  test('ページリロード相当（同一セッションで再リクエスト）→ ログイン維持', async () => {
    const app   = createAdminApp()
    const agent = request.agent(app)

    await agent.post('/admin/api/login').send({ password: ADMIN_PASSWORD })

    // リロード相当（複数回）
    const res1 = await agent.get('/admin/api/auth-check')
    const res2 = await agent.get('/admin/api/auth-check')

    expect(res1.body.authenticated).toBe(true)
    expect(res2.body.authenticated).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
// POST /admin/api/logout
// ─────────────────────────────────────────────────────────────
describe('POST /admin/api/logout', () => {
  test('ログアウト → 200 + { ok: true }', async () => {
    const app   = createAdminApp()
    const agent = request.agent(app)

    await agent.post('/admin/api/login').send({ password: ADMIN_PASSWORD })
    const res = await agent.post('/admin/api/logout')

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  test('ログアウト後は auth-check が false を返す', async () => {
    const app   = createAdminApp()
    const agent = request.agent(app)

    await agent.post('/admin/api/login').send({ password: ADMIN_PASSWORD })
    await agent.post('/admin/api/logout')
    const res = await agent.get('/admin/api/auth-check')

    expect(res.body.authenticated).toBe(false)
  })

  test('ログアウト後は保護されたルートが 401 を返す', async () => {
    const app   = createAdminApp()
    const agent = request.agent(app)

    await agent.post('/admin/api/login').send({ password: ADMIN_PASSWORD })
    await agent.post('/admin/api/logout')
    const res = await agent.get('/admin/api/protected')

    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────
// requireAuth ミドルウェアの動作確認
// ─────────────────────────────────────────────────────────────
describe('requireAuth（認証保護ルート）', () => {
  test('未ログイン → 401 を返す', async () => {
    const res = await request(createAdminApp()).get('/admin/api/protected')
    expect(res.status).toBe(401)
    expect(res.body).toHaveProperty('error')
  })

  test('ログイン後 → 200 + データを返す', async () => {
    const app   = createAdminApp()
    const agent = request.agent(app)

    await agent.post('/admin/api/login').send({ password: ADMIN_PASSWORD })
    const res = await agent.get('/admin/api/protected')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('data')
  })

  test('異なるセッション（別エージェント）はアクセスできない', async () => {
    const app    = createAdminApp()
    const agent1 = request.agent(app)
    const agent2 = request.agent(app) // 別セッション

    await agent1.post('/admin/api/login').send({ password: ADMIN_PASSWORD })

    // agent2 はログインしていないので 401
    const res = await agent2.get('/admin/api/protected')
    expect(res.status).toBe(401)
  })
})
