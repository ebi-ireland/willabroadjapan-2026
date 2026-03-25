// =====================
// server.js
// パス: /server.js
// 用途: Expressサーバー本体
// =====================

require('dotenv').config()
const express  = require('express')
const session  = require('express-session')
const passport = require('passport')
const helmet         = require('helmet')
const logger         = require('./middleware/logger')
const { generalLimiter, authLimiter, contactLimiter } = require('./middleware/rateLimiter')
const { botProtection, antiScraping } = require('./middleware/botProtection')
const { sanitizeText } = require('./middleware/sanitize')

// Winstonロガーにdb注入（エラーをDBに記録）
const db = require('./db/connection')
logger.addDBTransport(db)

const app = express()

app.use(express.json())

// ── セキュリティヘッダー ──────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "api.mapbox.com", "events.mapbox.com", "js.stripe.com"],
      styleSrc:    ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "fonts.googleapis.com", "api.mapbox.com"],
      fontSrc:     ["'self'", "fonts.gstatic.com", "cdn.jsdelivr.net"],
      imgSrc:      ["'self'", "data:", "blob:", "*.mapbox.com", "*.googleapis.com", "*.googleusercontent.com"],
      connectSrc:  ["'self'", "api.mapbox.com", "events.mapbox.com", "*.mapbox.com", "api.stripe.com"],
      workerSrc:   ["'self'", "blob:"],
      childSrc:    ["blob:"],
      frameSrc:    ["js.stripe.com"],
    }
  },
  crossOriginEmbedderPolicy: false
}))

// ── レート制限 ────────────────────────────────────────────────
app.use('/api/', generalLimiter)
app.use('/api/auth', authLimiter)
app.use('/api/contact', contactLimiter)

// ── スクレイピング対策（データAPI） ──────────────────────────
app.use('/api/scholarships', botProtection, antiScraping)
app.use('/api/ranking',      botProtection, antiScraping)

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
app.use('/api/support',    require('./routes/support'))
app.use('/api/simulator',  require('./routes/simulator'))
app.use('/api/checklist',  require('./routes/checklist'))
app.use('/api/deadlines',  require('./routes/deadlines'))
app.use('/api/recommend',  require('./routes/recommend'))

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

// ── グローバルエラーハンドラー ────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(err.message, {
    stack: err.stack,
    meta: { path: req.path, method: req.method, userId: req.user?.id, ip: req.ip, userAgent: req.headers['user-agent'] }
  })
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV !== 'production' ? err.message : 'サーバーエラーが発生しました'
  })
})

app.listen(3000, () => console.log('👤 User → http://localhost:3000'))