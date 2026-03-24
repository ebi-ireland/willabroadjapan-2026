// =====================
// server.js
// パス: /server.js
// 用途: Expressサーバー本体
// =====================

require('dotenv').config()
const express  = require('express')
const session  = require('express-session')
const passport = require('passport')

const app = express()

app.use(express.json())

app.use(session({
  secret: process.env.SESSION_SECRET || 'willabroadjapan_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}))

app.use(passport.initialize())
app.use(passport.session())

app.use(require('./routes/logo'))
app.use('/api/auth',        require('./routes/auth'))
app.use('/api/notices',     require('./routes/notices'))
app.use('/api/ranking',     require('./routes/ranking'))
app.use('/api/diagnosis',   require('./routes/diagnosis'))
app.use('/api/articles',    require('./routes/articles'))
app.use('/api/contact',     require('./routes/contact'))
app.use('/api/threads',     require('./routes/threads'))
app.use('/api/experiences', require('./routes/experiences'))
app.use('/api/templates',   require('./routes/templates'))
app.use('/api/scholarships',require('./routes/scholarships'))
app.use('/api/supporter',  require('./routes/supporter'))

app.get('/api/mapbox-token', (req, res) => {
  res.json({ token: process.env.MAPBOX_TOKEN })
})

app.get('/api/supporter-reports', (req, res) => {
  const db = require('./db/connection')
  db.query('SELECT * FROM supporter_reports ORDER BY sort_order DESC, created_at DESC',
    (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})

app.use(express.static('public'))

// ── 安全対策: ドットファイルへの直接アクセスを拒否 ─────────
app.use((req, res, next) => {
  if (req.path.startsWith('/.')) return res.status(403).end()
  next()
})

// ── 本番エラーハンドラー（スタックトレースを外部に見せない）──
app.use((err, req, res, next) => {
  const isDev = process.env.NODE_ENV !== 'production'
  console.error('[ERROR]', err.message)
  res.status(err.status || 500).json({
    error: isDev ? err.message : 'サーバーエラーが発生しました'
  })
})

app.listen(3000, () => console.log('👤 User → http://localhost:3000'))