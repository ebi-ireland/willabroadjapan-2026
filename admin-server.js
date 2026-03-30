// =====================
// admin-server.js
// 用途: 管理画面サーバー（port 4000）
// =====================

require('dotenv').config()
const express = require('express')
const session = require('express-session')
const path    = require('path')
const fs      = require('fs')
const db      = require('./db/connection')
const helmet    = require('helmet')
const logger    = require('./middleware/logger')
const { adminLoginLimiter, generalLimiter } = require('./middleware/rateLimiter')
const { runBackup, listBackups } = require('./services/backup')
const multer  = require('multer')

const app = express()
app.use(express.json({ limit: '2mb' }))
app.use(helmet({ contentSecurityPolicy: false }))
app.use('/admin/api/', generalLimiter)
app.use(express.static(path.join(__dirname, 'admin')))

// ── セキュリティヘルパー ────────────────────────────────────
function safeId(id) {
  const n = parseInt(id, 10)
  if (!Number.isInteger(n) || n <= 0 || String(n) !== String(id).trim()) {
    const err = new Error('無効なIDです'); err.status = 400; throw err
  }
  return n
}
function safeStr(v, max = 500) {
  if (v == null || v === '') return null
  const s = String(v).trim()
  if (s.length > max) { const err = new Error(`最大${max}文字です`); err.status = 400; throw err }
  return s
}
function safeEnum(v, allowed) {
  if (!allowed.includes(v)) { const err = new Error('不正な値です'); err.status = 400; throw err }
  return v
}
function handleErr(res, err) {
  const status = err.status || 500
  res.status(status).json({ error: err.message })
}

// ── MySQL 永続セッションストア ────────────────────────────────
// express-session の Store を継承して MySQL に保存
// → サーバー再起動後もセッションが維持される
const SessionStore = session.Store
class AdminSessionStore extends SessionStore {
  constructor(pool) {
    super()
    this.pool = pool
    // テーブルが存在しない場合は自動作成
    pool.query(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        sid     VARCHAR(255) PRIMARY KEY,
        sess    TEXT        NOT NULL,
        expired DATETIME    NOT NULL,
        INDEX idx_expired (expired)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `, (err) => { if (err) console.error('[Session] テーブル作成エラー:', err.message) })
    // 1時間ごとに期限切れセッションを削除
    setInterval(() => {
      pool.query('DELETE FROM admin_sessions WHERE expired < NOW()')
    }, 60 * 60 * 1000)
  }
  get(sid, cb) {
    this.pool.query(
      'SELECT sess FROM admin_sessions WHERE sid = ? AND expired > NOW()',
      [sid],
      (err, rows) => {
        if (err) return cb(err)
        if (!rows.length) return cb(null, null)
        try { cb(null, JSON.parse(rows[0].sess)) } catch { cb(null, null) }
      }
    )
  }
  set(sid, sess, cb) {
    // サーバー側TTL: 24時間（クッキーはセッションクッキーのままでブラウザを閉じると消える）
    const exp = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const s   = JSON.stringify(sess)
    this.pool.query(
      'INSERT INTO admin_sessions (sid, sess, expired) VALUES (?,?,?) ON DUPLICATE KEY UPDATE sess=?, expired=?',
      [sid, s, exp, s, exp],
      (err) => { if (cb) cb(err) }
    )
  }
  destroy(sid, cb) {
    this.pool.query('DELETE FROM admin_sessions WHERE sid = ?', [sid], (err) => { if (cb) cb(err) })
  }
}

app.use(session({
  store: new AdminSessionStore(db),
  secret: process.env.SESSION_SECRET || 'admin_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    // maxAge を指定しない = セッションクッキー（ブラウザを閉じると自動削除）
  },
}))

const ADMIN_PASS   = process.env.ADMIN_PASSWORD || 'willadmin'
const DATASET_PASS = process.env.DATASET_PASSWORD || ''

function requireAuth(req, res, next) {
  if (req.session.admin) return next()
  res.status(401).json({ error: 'Unauthorized' })
}

// データセットファイル専用の二段階認証
function requireDatasetAuth(req, res, next) {
  if (!req.session.admin)        return res.status(401).json({ error: 'Unauthorized' })
  if (!req.session.datasetAuth)  return res.status(403).json({ error: 'DATASET_AUTH_REQUIRED' })
  next()
}

// ── 認証 ─────────────────────────────────────────────────
app.post('/admin/api/login', adminLoginLimiter, (req, res) => {
  if (req.body.password === ADMIN_PASS) {
    req.session.admin = true
    res.json({ ok: true })
  } else {
    res.status(401).json({ error: 'パスワードが違います' })
  }
})
app.post('/admin/api/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }) })

// セッション確認（ページリロード時に呼び出す）
app.get('/admin/api/auth-check', (req, res) => {
  res.json({ authenticated: !!req.session.admin })
})

// ── お知らせ ──────────────────────────────────────────────
app.get('/admin/api/notices', requireAuth, (req, res) => {
  db.query('SELECT * FROM notices ORDER BY published_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows)
  })
})
app.post('/admin/api/notices', requireAuth, (req, res) => {
  const { title, body, category } = req.body
  db.query('INSERT INTO notices (title, body, category) VALUES (?,?,?)', [title, body, category || 'info'],
    (err, r) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true, id: r.insertId }) })
})
app.delete('/admin/api/notices/:id', requireAuth, (req, res) => {
  db.query('DELETE FROM notices WHERE id = ?', [req.params.id],
    (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
})

// ── 記事メディアアップロード ───────────────────────────────
const ARTICLE_UPLOAD_DIR = path.join(__dirname, 'public', 'uploads', 'articles')
if (!fs.existsSync(ARTICLE_UPLOAD_DIR)) fs.mkdirSync(ARTICLE_UPLOAD_DIR, { recursive: true })

const ALLOWED_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'])
const ALLOWED_FILE_EXT  = new Set(['.pdf', '.docx', '.xlsx', '.pptx', '.zip', '.txt', '.csv'])
const MAX_UPLOAD_MB = 20

const articleUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, ARTICLE_UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase()
      const base = path.basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9\u3000-\u9fff_-]/g, '_').slice(0, 60)
      cb(null, `${Date.now()}_${base}${ext}`)
    }
  }),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ALLOWED_IMAGE_EXT.has(ext) || ALLOWED_FILE_EXT.has(ext)) return cb(null, true)
    cb(new Error(`許可されていない拡張子: ${ext}`))
  }
})

// 画像アップロード → Markdown用URL返却
app.post('/admin/api/articles/upload/image', requireAuth, articleUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ファイルが見つかりません' })
  const ext = path.extname(req.file.originalname).toLowerCase()
  if (!ALLOWED_IMAGE_EXT.has(ext)) {
    fs.unlinkSync(req.file.path)
    return res.status(400).json({ error: '画像ファイルのみアップロードできます' })
  }
  res.json({ url: `/uploads/articles/${req.file.filename}`, name: req.file.originalname })
})

// ファイルアップロード → Markdown用URL返却
app.post('/admin/api/articles/upload/file', requireAuth, articleUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ファイルが見つかりません' })
  res.json({ url: `/uploads/articles/${req.file.filename}`, name: req.file.originalname })
})

// アップロード済みメディア一覧
app.get('/admin/api/articles/uploads', requireAuth, (req, res) => {
  fs.readdir(ARTICLE_UPLOAD_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: err.message })
    const list = files.map(f => {
      const ext  = path.extname(f).toLowerCase()
      const stat = fs.statSync(path.join(ARTICLE_UPLOAD_DIR, f))
      return { filename: f, url: `/uploads/articles/${f}`, isImage: ALLOWED_IMAGE_EXT.has(ext), size: stat.size, mtime: stat.mtime }
    }).sort((a, b) => b.mtime - a.mtime)
    res.json(list)
  })
})

// アップロード済みメディア削除
app.delete('/admin/api/articles/uploads/:filename', requireAuth, (req, res) => {
  const filename = path.basename(req.params.filename)   // パストラバーサル防止
  const filepath = path.join(ARTICLE_UPLOAD_DIR, filename)
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'ファイルが見つかりません' })
  fs.unlink(filepath, err => {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ ok: true })
  })
})

// ── 記事 ──────────────────────────────────────────────────
app.get('/admin/api/articles', requireAuth, (req, res) => {
  db.query('SELECT id, title, summary, status, updated_at FROM articles ORDER BY updated_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows)
  })
})
app.post('/admin/api/articles', requireAuth, (req, res) => {
  const { title, summary, body, status } = req.body
  db.query('INSERT INTO articles (title, summary, content, status) VALUES (?,?,?,?)',
    [title, summary, body, status || 'draft'],
    (err, r) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true, id: r.insertId }) })
})
app.patch('/admin/api/articles/:id/publish', requireAuth, (req, res) => {
  const { status } = req.body
  db.query('UPDATE articles SET status = ? WHERE id = ?', [status, req.params.id],
    (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
})
app.delete('/admin/api/articles/:id', requireAuth, (req, res) => {
  db.query('DELETE FROM articles WHERE id = ?', [req.params.id],
    (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
})

// ── 体験談 ────────────────────────────────────────────────
app.get('/admin/api/experiences', requireAuth, (req, res) => {
  const status = req.query.status || 'pending'
  db.query('SELECT id, country, university, author_name, rating, summary, status, created_at FROM experiences WHERE status = ? ORDER BY created_at DESC',
    [status], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(rows)
    })
})
app.get('/admin/api/experiences/:id', requireAuth, (req, res) => {
  db.query('SELECT * FROM experiences WHERE id = ?', [req.params.id],
    (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows[0] || null) })
})
app.patch('/admin/api/experiences/:id/approve', requireAuth, (req, res) => {
  db.query("UPDATE experiences SET status = 'published' WHERE id = ?", [req.params.id],
    (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
})
app.patch('/admin/api/experiences/:id/reject', requireAuth, (req, res) => {
  db.query("UPDATE experiences SET status = 'rejected' WHERE id = ?", [req.params.id],
    (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
})
app.delete('/admin/api/experiences/:id', requireAuth, (req, res) => {
  db.query('DELETE FROM experiences WHERE id = ?', [req.params.id],
    (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
})
// 体験談通報
app.get('/admin/api/experience-reports', requireAuth, (req, res) => {
  db.query(`SELECT er.id, er.experience_id, er.user_id, er.reason, er.created_at,
              e.university, e.country, e.author_name, e.status as exp_status
            FROM experience_reports er
            LEFT JOIN experiences e ON er.experience_id = e.id
            ORDER BY er.created_at DESC LIMIT 100`,
    (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})
app.delete('/admin/api/experience-reports/:id', requireAuth, (req, res) => {
  db.query('DELETE FROM experience_reports WHERE id = ?', [req.params.id],
    (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
})

// ── スレッド ──────────────────────────────────────────────
app.get('/admin/api/threads', requireAuth, (req, res) => {
  db.query(`SELECT t.id, t.title, t.content, t.view_count, t.created_at,
              u.username, COUNT(r.id) as reply_count
            FROM threads t
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN thread_replies r ON t.id = r.thread_id
            GROUP BY t.id ORDER BY t.created_at DESC LIMIT 200`,
    (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})
app.get('/admin/api/threads/reports', requireAuth, (req, res) => {
  db.query('SELECT * FROM thread_reports ORDER BY created_at DESC LIMIT 100',
    (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})
app.delete('/admin/api/threads/:id', requireAuth, (req, res) => {
  db.query('DELETE FROM threads WHERE id = ?', [req.params.id],
    (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
})
// スレッド通報を却下（通報レコードのみ削除）
app.delete('/admin/api/thread-reports/:id', requireAuth, (req, res) => {
  db.query('DELETE FROM thread_reports WHERE id = ?', [req.params.id],
    (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
})
// 返信を個別削除
app.delete('/admin/api/thread-replies/:id', requireAuth, (req, res) => {
  db.query('DELETE FROM thread_replies WHERE id = ?', [req.params.id],
    (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
})

// ── テンプレート ──────────────────────────────────────────
app.get('/admin/api/templates', requireAuth, (req, res) => {
  db.query('SELECT * FROM templates ORDER BY sort_order ASC',
    (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})
app.post('/admin/api/templates', requireAuth, (req, res) => {
  const { title, body, sort_order } = req.body
  db.query('INSERT INTO templates (title, body, sort_order, is_active) VALUES (?,?,?,1)',
    [title, body, sort_order || 0],
    (err, r) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true, id: r.insertId }) })
})
app.patch('/admin/api/templates/:id/toggle', requireAuth, (req, res) => {
  db.query('UPDATE templates SET is_active = NOT is_active WHERE id = ?', [req.params.id],
    (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
})
app.delete('/admin/api/templates/:id', requireAuth, (req, res) => {
  db.query('DELETE FROM templates WHERE id = ?', [req.params.id],
    (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
})

// ── 財団奨学金 ────────────────────────────────────────────
app.get('/admin/api/foundation-scholarships', requireAuth, (req, res) => {
  db.query('SELECT * FROM foundation_scholarships ORDER BY created_at DESC',
    (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})
app.post('/admin/api/foundation-scholarships', requireAuth, (req, res) => {
  const { name, url, deadline, amount, num_recipients, duration, target_countries, language_requirement, other_requirements, target } = req.body
  db.query(`INSERT INTO foundation_scholarships
    (name, url, deadline, amount, num_recipients, duration, target_countries, language_requirement, other_requirements, target, status)
    VALUES (?,?,?,?,?,?,?,?,?,?,'active')`,
    [name, url || null, deadline || null, amount || null, num_recipients || null,
     duration || null, target_countries || null, language_requirement || null, other_requirements || null, target || null],
    (err, r) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true, id: r.insertId }) })
})
app.delete('/admin/api/foundation-scholarships/:id', requireAuth, (req, res) => {
  db.query('DELETE FROM foundation_scholarships WHERE id = ?', [req.params.id],
    (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
})

// ── プログラム奨学金 ──────────────────────────────────────
app.get('/admin/api/program-scholarships', requireAuth, (req, res) => {
  db.query('SELECT * FROM program_scholarships ORDER BY created_at DESC',
    (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})
app.post('/admin/api/program-scholarships', requireAuth, (req, res) => {
  const { name, sponsor, url, country, application_deadline, content, target } = req.body
  db.query(`INSERT INTO program_scholarships (name, sponsor, url, country, application_deadline, content, target)
    VALUES (?,?,?,?,?,?,?)`,
    [name, sponsor || null, url || null, country || null, application_deadline || null, content || null, target || null],
    (err, r) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true, id: r.insertId }) })
})
app.delete('/admin/api/program-scholarships/:id', requireAuth, (req, res) => {
  db.query('DELETE FROM program_scholarships WHERE id = ?', [req.params.id],
    (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
})

// ── お問い合わせ ──────────────────────────────────────────
app.get('/admin/api/contacts', requireAuth, (req, res) => {
  db.query('SELECT * FROM contacts ORDER BY created_at DESC LIMIT 100',
    (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})
app.get('/admin/api/supporter-contacts', requireAuth, (req, res) => {
  db.query('SELECT * FROM supporter_contacts ORDER BY created_at DESC LIMIT 100',
    (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})

// ── 留学生奨学金 ──────────────────────────────────────────
app.get('/admin/api/intl-scholarships', requireAuth, (req, res) => {
  db.query('SELECT * FROM intl_scholarships ORDER BY created_at DESC',
    (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})
app.post('/admin/api/intl-scholarships', requireAuth, (req, res) => {
  const { provider_type, provider_name, name, url, deadline_month, amount, amount_type, num_recipients, nationality_req, language_req, other_req } = req.body
  db.query(`INSERT INTO intl_scholarships
    (provider_type,provider_name,name,url,deadline_month,amount,amount_type,num_recipients,nationality_req,language_req,other_req)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [provider_type, provider_name, name, url||null, deadline_month||null, amount||null,
     amount_type||null, num_recipients||null, nationality_req||null, language_req||null, other_req||null],
    (err, r) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true, id: r.insertId }) })
})
app.delete('/admin/api/intl-scholarships/:id', requireAuth, (req, res) => {
  db.query('DELETE FROM intl_scholarships WHERE id = ?', [req.params.id],
    (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
})

// ── 大学奨学金 ──────────────────────────────────────────────
app.get('/admin/api/university-scholarships', requireAuth, (req, res) => {
  db.query('SELECT id, name, country, city, url FROM university_scholarships ORDER BY country ASC, name ASC LIMIT 500',
    (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})
app.post('/admin/api/university-scholarships', requireAuth, (req, res) => {
  const { name, country, city, url, lat, lng, currency } = req.body
  if (!name || !country) return res.status(400).json({ error: '大学名と国は必須です' })
  db.query('INSERT INTO university_scholarships (name, country, city, url, lat, lng, currency) VALUES (?,?,?,?,?,?,?)',
    [name, country, city||null, url||null, lat||null, lng||null, currency||null],
    (err, r) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true, id: r.insertId }) })
})
app.delete('/admin/api/university-scholarships/:id', requireAuth, (req, res) => {
  db.query('DELETE FROM university_scholarships WHERE id = ?', [req.params.id],
    (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
})

// ── Supporter 報告書 ────────────────────────────────────────
app.get('/admin/api/supporter-reports', requireAuth, (req, res) => {
  db.query('SELECT * FROM supporter_reports ORDER BY sort_order DESC, created_at DESC',
    (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})
app.post('/admin/api/supporter-reports', requireAuth, (req, res) => {
  const { type, title, date_label, file_url, sort_order } = req.body
  if (!type || !title || !file_url) return res.status(400).json({ error: '種別・タイトル・URLは必須です' })
  db.query('INSERT INTO supporter_reports (type, title, date_label, file_url, sort_order) VALUES (?,?,?,?,?)',
    [type, title, date_label||'', file_url, sort_order||0],
    (err, r) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true, id: r.insertId }) })
})
app.delete('/admin/api/supporter-reports/:id', requireAuth, (req, res) => {
  db.query('DELETE FROM supporter_reports WHERE id = ?', [req.params.id],
    (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
})

// ── インポート ─────────────────────────────────────────────
// university_scholarships: JSON配列（日本語キー or 英語キー）
app.post('/admin/api/import/university-scholarships', requireAuth, (req, res) => {
  const rows = req.body.data
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'dataが空です' })
  const values = rows.map(r => [
    r.name || r['大学名'] || '',
    r.country || r['国'] || '',
    r.city || r['都市'] || null,
    r.url || r['URL'] || null,
    r.lat || r['緯度'] || null,
    r.lng || r['経度'] || null,
    r.currency || r['通貨定義'] || null,
  ]).filter(v => v[0] && v[1])
  if (values.length === 0) return res.status(400).json({ error: '有効なデータがありません' })
  db.query(
    'INSERT INTO university_scholarships (name, country, city, url, lat, lng, currency) VALUES ?',
    [values],
    (err, r) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true, inserted: r.affectedRows }) }
  )
})
// foundation_scholarships: JSON配列（英語キー）
app.post('/admin/api/import/foundation-scholarships', requireAuth, (req, res) => {
  const rows = req.body.data
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'dataが空です' })
  const values = rows.filter(r => r.name).map(r => [
    r.name, r.url||null, r.deadline||null, r.amount||null, r.num_recipients||null,
    r.duration||null, r.target_countries||null, r.language_requirement||null,
    r.other_requirements||null, r.target||null, 'active'
  ])
  if (values.length === 0) return res.status(400).json({ error: '有効なデータがありません' })
  db.query(
    'INSERT INTO foundation_scholarships (name,url,deadline,amount,num_recipients,duration,target_countries,language_requirement,other_requirements,target,status) VALUES ?',
    [values],
    (err, r) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true, inserted: r.affectedRows }) }
  )
})
// program_scholarships: JSON配列（英語キー）
app.post('/admin/api/import/program-scholarships', requireAuth, (req, res) => {
  const rows = req.body.data
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'dataが空です' })
  const values = rows.filter(r => r.name).map(r => [
    r.name, r.sponsor||null, r.url||null, r.country||null,
    r.application_deadline||null, r.content||null, r.target||null
  ])
  if (values.length === 0) return res.status(400).json({ error: '有効なデータがありません' })
  db.query(
    'INSERT INTO program_scholarships (name,sponsor,url,country,application_deadline,content,target) VALUES ?',
    [values],
    (err, r) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true, inserted: r.affectedRows }) }
  )
})
// intl_scholarships: JSON配列（英語キー）
app.post('/admin/api/import/intl-scholarships', requireAuth, (req, res) => {
  const rows = req.body.data
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'dataが空です' })
  const values = rows.filter(r => r.provider_name && r.name).map(r => [
    r.provider_type||'university', r.provider_name, r.name, r.url||null,
    r.deadline_month||null, r.amount||null, r.amount_type||null,
    r.num_recipients||null, r.nationality_req||null, r.language_req||null, r.other_req||null
  ])
  if (values.length === 0) return res.status(400).json({ error: '有効なデータがありません' })
  db.query(
    'INSERT INTO intl_scholarships (provider_type,provider_name,name,url,deadline_month,amount,amount_type,num_recipients,nationality_req,language_req,other_req) VALUES ?',
    [values],
    (err, r) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true, inserted: r.affectedRows }) }
  )
})

// ── エクスポート ───────────────────────────────────────────
app.get('/admin/api/export/university-scholarships', requireAuth, (req, res) => {
  db.query('SELECT id, name, country, city, url, lat, lng, currency FROM university_scholarships ORDER BY country ASC, name ASC',
    (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})
app.get('/admin/api/export/foundation-scholarships', requireAuth, (req, res) => {
  db.query('SELECT * FROM foundation_scholarships ORDER BY created_at DESC',
    (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})
app.get('/admin/api/export/program-scholarships', requireAuth, (req, res) => {
  db.query('SELECT * FROM program_scholarships ORDER BY created_at DESC',
    (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})
app.get('/admin/api/export/intl-scholarships', requireAuth, (req, res) => {
  db.query('SELECT * FROM intl_scholarships ORDER BY created_at DESC',
    (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})

// ── 日本人学生向け 大学独自奨学金 ──────────────────────────
app.get('/admin/api/university-own-scholarships', requireAuth, (req, res) => {
  db.query('SELECT * FROM university_own_scholarships ORDER BY university_name ASC, name ASC',
    (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})
app.post('/admin/api/university-own-scholarships', requireAuth, (req, res) => {
  try {
    const name            = safeStr(req.body.name, 255)
    const university_name = safeStr(req.body.university_name, 255)
    if (!name || !university_name) return res.status(400).json({ error: '大学名と奨学金名は必須です' })
    const url             = safeStr(req.body.url, 500)
    const deadline        = safeStr(req.body.deadline, 100)
    const amount          = safeStr(req.body.amount, 100)
    const num_recipients  = safeStr(req.body.num_recipients, 100)
    const target_country  = safeStr(req.body.target_country, 255)
    const duration        = safeStr(req.body.duration, 100)
    const conditions      = safeStr(req.body.conditions, 2000)
    const target          = safeStr(req.body.target, 100)
    db.query(
      'INSERT INTO university_own_scholarships (university_name,name,url,deadline,amount,num_recipients,target_country,duration,conditions,target) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [university_name, name, url, deadline, amount, num_recipients, target_country, duration, conditions, target],
      (err, r) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true, id: r.insertId }) }
    )
  } catch(e) { return handleErr(res, e) }
})
app.patch('/admin/api/university-own-scholarships/:id/toggle', requireAuth, (req, res) => {
  try {
    const id = safeId(req.params.id)
    db.query('UPDATE university_own_scholarships SET status = IF(status=\'active\',\'inactive\',\'active\') WHERE id = ?', [id],
      (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
  } catch(e) { return handleErr(res, e) }
})
app.delete('/admin/api/university-own-scholarships/:id', requireAuth, (req, res) => {
  try {
    const id = safeId(req.params.id)
    db.query('DELETE FROM university_own_scholarships WHERE id = ?', [id],
      (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
  } catch(e) { return handleErr(res, e) }
})

// ── 海外大学独自奨学金 (input_data.json 読み書き) ─────────────
const INPUT_DATA_PATH = path.join(__dirname, 'GetData', 'CreateTable', 'input_data.json')

app.get('/admin/api/input-data', requireAuth, (req, res) => {
  try {
    const data = fs.existsSync(INPUT_DATA_PATH)
      ? JSON.parse(fs.readFileSync(INPUT_DATA_PATH, 'utf8'))
      : []
    res.json(Array.isArray(data) ? data : [])
  } catch(e) { handleErr(res, e) }
})

app.post('/admin/api/input-data', requireAuth, (req, res) => {
  try {
    const incoming = req.body
    const name = incoming && String(incoming['大学名'] || '').trim()
    if (!name) return res.status(400).json({ error: '大学名は必須です' })
    let data = []
    if (fs.existsSync(INPUT_DATA_PATH)) {
      data = JSON.parse(fs.readFileSync(INPUT_DATA_PATH, 'utf8'))
      if (!Array.isArray(data)) data = []
    }
    const idx = data.findIndex(u => u['大学名'] === name)
    if (idx >= 0) {
      data[idx] = { ...data[idx], ...incoming }
    } else {
      data.push(incoming)
    }
    fs.writeFileSync(INPUT_DATA_PATH, JSON.stringify(data, null, 2), 'utf8')
    res.json({ ok: true })
  } catch(e) { handleErr(res, e) }
})

// ── 診断 大学設定 ──────────────────────────────────────────
app.get('/admin/api/diagnosis/colleges', requireAuth, (req, res) => {
  db.query('SELECT * FROM diagnosis_colleges ORDER BY score DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message }); res.json(rows)
  })
})
app.post('/admin/api/diagnosis/colleges', requireAuth, (req, res) => {
  try {
    const name      = safeStr(req.body.name, 255)
    if (!name) return res.status(400).json({ error: '大学名は必須です' })
    const score     = parseInt(req.body.score, 10) || 10000
    const need_based = req.body.need_based ? 1 : 0
    const country   = safeStr(req.body.country, 100)
    db.query('INSERT INTO diagnosis_colleges (name, score, need_based, country) VALUES (?,?,?,?)',
      [name, score, need_based, country],
      (err, r) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true, id: r.insertId }) })
  } catch(e) { return handleErr(res, e) }
})
app.patch('/admin/api/diagnosis/colleges/:id', requireAuth, (req, res) => {
  try {
    const id    = safeId(req.params.id)
    const score = parseInt(req.body.score, 10)
    const need_based = req.body.need_based ? 1 : 0
    if (isNaN(score) || score <= 0) return res.status(400).json({ error: '有効なスコアを入力してください' })
    db.query('UPDATE diagnosis_colleges SET score = ?, need_based = ? WHERE id = ?', [score, need_based, id],
      (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
  } catch(e) { return handleErr(res, e) }
})
app.delete('/admin/api/diagnosis/colleges/:id', requireAuth, (req, res) => {
  try {
    const id = safeId(req.params.id)
    db.query('DELETE FROM diagnosis_colleges WHERE id = ?', [id],
      (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
  } catch(e) { return handleErr(res, e) }
})

// ── 診断 大学一括インポート ────────────────────────────────
// body: { colleges: [{name, score, country, need_based}] }
app.post('/admin/api/diagnosis/colleges/bulk', requireAuth, (req, res) => {
  try {
    const list = req.body.colleges
    if (!Array.isArray(list) || list.length === 0)
      return res.status(400).json({ error: 'colleges配列が必要です' })

    const valid = list
      .map(c => ({
        name:      safeStr(String(c.name || ''), 255).trim(),
        score:     Math.max(0, parseInt(c.score, 10) || 10000),
        country:   safeStr(String(c.country || ''), 100).trim(),
        need_based: c.need_based ? 1 : 0,
      }))
      .filter(c => c.name.length > 0)

    if (valid.length === 0)
      return res.status(400).json({ error: '有効な大学名がありません' })

    // 既存大学名を取得して重複チェック
    db.query('SELECT name FROM diagnosis_colleges', (err, existing) => {
      if (err) return res.status(500).json({ error: err.message })
      const existSet = new Set(existing.map(r => r.name.toLowerCase()))

      const toInsert = valid.filter(c => !existSet.has(c.name.toLowerCase()))
      const skipped  = valid.length - toInsert.length

      if (toInsert.length === 0)
        return res.json({ ok: true, inserted: 0, skipped })

      const values = toInsert.map(c => [c.name, c.score, c.need_based, c.country])
      db.query(
        'INSERT INTO diagnosis_colleges (name, score, need_based, country) VALUES ?',
        [values],
        (err2) => {
          if (err2) return res.status(500).json({ error: err2.message })
          res.json({ ok: true, inserted: toInsert.length, skipped })
        }
      )
    })
  } catch(e) { return handleErr(res, e) }
})

// ── 診断 キーワード ────────────────────────────────────────
app.get('/admin/api/diagnosis/keywords', requireAuth, (req, res) => {
  db.query('SELECT * FROM diagnosis_keywords ORDER BY points DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message }); res.json(rows)
  })
})
app.post('/admin/api/diagnosis/keywords', requireAuth, (req, res) => {
  try {
    const keyword  = safeStr(req.body.keyword, 100)
    if (!keyword) return res.status(400).json({ error: 'キーワードは必須です' })
    const points   = parseInt(req.body.points, 10) || 200
    const category = safeStr(req.body.category, 50)
    db.query('INSERT INTO diagnosis_keywords (keyword, points, category) VALUES (?,?,?)',
      [keyword, points, category],
      (err, r) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true, id: r.insertId }) })
  } catch(e) { return handleErr(res, e) }
})
app.delete('/admin/api/diagnosis/keywords/:id', requireAuth, (req, res) => {
  try {
    const id = safeId(req.params.id)
    db.query('DELETE FROM diagnosis_keywords WHERE id = ?', [id],
      (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
  } catch(e) { return handleErr(res, e) }
})

// ── 診断 スコアリング ──────────────────────────────────────
app.get('/admin/api/diagnosis/scoring', requireAuth, (req, res) => {
  db.query('SELECT * FROM diagnosis_scoring ORDER BY item_type, sort_order', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message }); res.json(rows)
  })
})
app.post('/admin/api/diagnosis/scoring', requireAuth, (req, res) => {
  try {
    const ALLOWED_TYPES = ['gpa','sat','act','toefl','ielts','duolingo','classrank']
    const item_type = safeEnum(req.body.item_type, ALLOWED_TYPES)
    const pts       = parseInt(req.body.pts, 10)
    if (isNaN(pts)) return res.status(400).json({ error: 'ptsは数値が必要です' })
    const sort_order = parseInt(req.body.sort_order, 10) || 0
    if (item_type === 'classrank') {
      const key_val = safeStr(req.body.key_val, 20)
      db.query('INSERT INTO diagnosis_scoring (item_type, key_val, pts, sort_order) VALUES (?,?,?,?)',
        [item_type, key_val, pts, sort_order],
        (err, r) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true, id: r.insertId }) })
    } else {
      const min_val = parseFloat(req.body.min_val)
      const max_val = parseFloat(req.body.max_val)
      if (isNaN(min_val) || isNaN(max_val)) return res.status(400).json({ error: 'min/maxは数値が必要です' })
      db.query('INSERT INTO diagnosis_scoring (item_type, min_val, max_val, pts, sort_order) VALUES (?,?,?,?,?)',
        [item_type, min_val, max_val, pts, sort_order],
        (err, r) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true, id: r.insertId }) })
    }
  } catch(e) { return handleErr(res, e) }
})
app.delete('/admin/api/diagnosis/scoring/:id', requireAuth, (req, res) => {
  try {
    const id = safeId(req.params.id)
    db.query('DELETE FROM diagnosis_scoring WHERE id = ?', [id],
      (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
  } catch(e) { return handleErr(res, e) }
})

// ── 診断 全体設定 ──────────────────────────────────────────
app.get('/admin/api/diagnosis/config', requireAuth, (req, res) => {
  db.query('SELECT * FROM diagnosis_config', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message }); res.json(rows)
  })
})
app.put('/admin/api/diagnosis/config', requireAuth, (req, res) => {
  try {
    const ALLOWED_KEYS = [
      // 既存
      'pass_threshold', 'maybe_threshold', 'max_selections',
      // 重み係数
      'weight_gpa', 'weight_sat', 'weight_act',
      'weight_lang', 'weight_classrank', 'weight_keywords',
      // 上限pts
      'cap_gpa', 'cap_sat', 'cap_lang', 'cap_classrank', 'cap_keywords',
    ]
    const { cfg_key, cfg_val, cfg_label, upsert } = req.body
    if (!ALLOWED_KEYS.includes(cfg_key))
      return res.status(400).json({ error: `許可されていないキー: ${cfg_key}` })
    const val   = safeStr(String(cfg_val ?? ''), 50)
    const label = safeStr(String(cfg_label || cfg_key), 100)
    if (upsert) {
      // INSERT ... ON DUPLICATE KEY UPDATE（初回登録 or 更新）
      db.query(
        'INSERT INTO diagnosis_config (cfg_key, cfg_val, label) VALUES (?,?,?) ON DUPLICATE KEY UPDATE cfg_val=?',
        [cfg_key, val, label, val],
        (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) }
      )
    } else {
      db.query('UPDATE diagnosis_config SET cfg_val=? WHERE cfg_key=?', [val, cfg_key],
        (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
    }
  } catch(e) { return handleErr(res, e) }
})

// ── 解析 ──────────────────────────────────────────────────
app.get('/admin/api/analytics/overview', requireAuth, (req, res) => {
  const queries = {
    users:       'SELECT COUNT(*) as n FROM users',
    threads:     'SELECT COUNT(*) as n FROM threads',
    experiences: "SELECT COUNT(*) as n FROM experiences WHERE status='published'",
    exp_pending: "SELECT COUNT(*) as n FROM experiences WHERE status='pending'",
    contacts:    'SELECT COUNT(*) as n FROM contacts',
    universities:'SELECT COUNT(*) as n FROM university_scholarships',
    total_views: 'SELECT COUNT(*) as n FROM view_logs',
    total_favs:  'SELECT COUNT(*) as n FROM favorite_logs',
  }
  const results = {}
  const keys = Object.keys(queries)
  let done = 0
  keys.forEach(key => {
    db.query(queries[key], (err, rows) => {
      results[key] = err ? 0 : rows[0].n
      if (++done === keys.length) res.json(results)
    })
  })
})

// 閲覧数（時間/日/週/月/年 — 全期間永久保存）
app.get('/admin/api/analytics/views', requireAuth, (req, res) => {
  const period = req.query.period || 'day'
  const FORMAT_MAP = {
    hour:  "DATE_FORMAT(viewed_at, '%Y-%m-%d %H:00:00')",
    day:   "DATE(viewed_at)",
    week:  "DATE_FORMAT(DATE_SUB(viewed_at, INTERVAL WEEKDAY(viewed_at) DAY), '%Y-%m-%d')",
    month: "DATE_FORMAT(viewed_at, '%Y-%m')",
    year:  "CAST(YEAR(viewed_at) AS CHAR)",
  }
  const fmt = FORMAT_MAP[period]
  if (!fmt) return res.status(400).json({ error: '不正なperiodです' })
  db.query(
    `SELECT ${fmt} as period, COUNT(*) as views FROM view_logs GROUP BY period ORDER BY period ASC`,
    (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) }
  )
})

// お問い合わせ数（時間/日/週/月/年 — 全期間永久保存）
app.get('/admin/api/analytics/contacts', requireAuth, (req, res) => {
  const period = req.query.period || 'day'
  const FORMAT_MAP = {
    hour:  "DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00')",
    day:   "DATE(created_at)",
    week:  "DATE_FORMAT(DATE_SUB(created_at, INTERVAL WEEKDAY(created_at) DAY), '%Y-%m-%d')",
    month: "DATE_FORMAT(created_at, '%Y-%m')",
    year:  "CAST(YEAR(created_at) AS CHAR)",
  }
  const fmt = FORMAT_MAP[period]
  if (!fmt) return res.status(400).json({ error: '不正なperiodです' })
  db.query(
    `SELECT ${fmt} as period, COUNT(*) as cnt FROM contacts GROUP BY period ORDER BY period ASC`,
    (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) }
  )
})

app.get('/admin/api/analytics/top-universities', requireAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 500)
  const period = req.query.period || 'all'
  const INTERVAL_MAP = { week: '7 DAY', month: '30 DAY', year: '365 DAY' }
  const interval = INTERVAL_MAP[period]
  const dateFilter = interval ? `AND vl.viewed_at >= DATE_SUB(NOW(), INTERVAL ${interval})` : ''
  const favFilter  = interval ? `AND fl.created_at >= DATE_SUB(NOW(), INTERVAL ${interval})` : ''
  db.query(`
    SELECT u.name, u.country,
           COUNT(DISTINCT vl.id) as views,
           COUNT(DISTINCT fl.id) as favorites
    FROM university_scholarships u
    LEFT JOIN view_logs vl     ON u.id = vl.target_id AND vl.type = 'university' ${dateFilter}
    LEFT JOIN favorite_logs fl ON u.id = fl.university_id ${favFilter}
    GROUP BY u.id
    ORDER BY views DESC
    LIMIT ?
  `, [limit], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})

// ── 解析: 曜日×時間帯ヒートマップ ────────────────────────────
app.get('/admin/api/analytics/heatmap', requireAuth, (req, res) => {
  db.query(
    `SELECT DAYOFWEEK(viewed_at) as dow, HOUR(viewed_at) as hour, COUNT(*) as views
     FROM view_logs GROUP BY dow, hour ORDER BY dow, hour`,
    (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) }
  )
})

// ── 解析: 国別人気 ────────────────────────────────────────────
app.get('/admin/api/analytics/top-countries', requireAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 15, 100)
  const period = req.query.period || 'all'
  const IMAP = { week: '7 DAY', month: '30 DAY', year: '365 DAY' }
  const iv = IMAP[period]
  const vf = iv ? `AND vl.viewed_at >= DATE_SUB(NOW(), INTERVAL ${iv})` : ''
  const ff = iv ? `AND fl.created_at >= DATE_SUB(NOW(), INTERVAL ${iv})` : ''
  db.query(`
    SELECT u.country, COUNT(DISTINCT vl.id) as views, COUNT(DISTINCT fl.id) as favorites
    FROM university_scholarships u
    LEFT JOIN view_logs vl ON u.id=vl.target_id AND vl.type='university' ${vf}
    LEFT JOIN favorite_logs fl ON u.id=fl.university_id ${ff}
    WHERE u.country IS NOT NULL AND u.country != ''
    GROUP BY u.country ORDER BY views DESC LIMIT ?
  `, [limit], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})

// ── 解析: MoM 成長率 ──────────────────────────────────────────
app.get('/admin/api/analytics/growth', requireAuth, (req, res) => {
  const qs = {
    views_this:    "SELECT COUNT(*) n FROM view_logs WHERE YEAR(viewed_at)=YEAR(NOW()) AND MONTH(viewed_at)=MONTH(NOW())",
    views_last:    "SELECT COUNT(*) n FROM view_logs WHERE YEAR(viewed_at)=YEAR(DATE_SUB(NOW(),INTERVAL 1 MONTH)) AND MONTH(viewed_at)=MONTH(DATE_SUB(NOW(),INTERVAL 1 MONTH))",
    contacts_this: "SELECT COUNT(*) n FROM contacts WHERE YEAR(created_at)=YEAR(NOW()) AND MONTH(created_at)=MONTH(NOW())",
    contacts_last: "SELECT COUNT(*) n FROM contacts WHERE YEAR(created_at)=YEAR(DATE_SUB(NOW(),INTERVAL 1 MONTH)) AND MONTH(created_at)=MONTH(DATE_SUB(NOW(),INTERVAL 1 MONTH))",
    users_this:    "SELECT COUNT(*) n FROM users WHERE YEAR(created_at)=YEAR(NOW()) AND MONTH(created_at)=MONTH(NOW())",
    users_last:    "SELECT COUNT(*) n FROM users WHERE YEAR(created_at)=YEAR(DATE_SUB(NOW(),INTERVAL 1 MONTH)) AND MONTH(created_at)=MONTH(DATE_SUB(NOW(),INTERVAL 1 MONTH))",
    favs_this:     "SELECT COUNT(*) n FROM favorite_logs WHERE YEAR(created_at)=YEAR(NOW()) AND MONTH(created_at)=MONTH(NOW())",
    favs_last:     "SELECT COUNT(*) n FROM favorite_logs WHERE YEAR(created_at)=YEAR(DATE_SUB(NOW(),INTERVAL 1 MONTH)) AND MONTH(created_at)=MONTH(DATE_SUB(NOW(),INTERVAL 1 MONTH))",
  }
  const results = {}; const keys = Object.keys(qs); let done = 0
  keys.forEach(k => db.query(qs[k], (err, rows) => {
    results[k] = err ? 0 : rows[0].n
    if (++done === keys.length) res.json(results)
  }))
})

// ── 解析: お問い合わせ種別 ────────────────────────────────────
app.get('/admin/api/analytics/contact-breakdown', requireAuth, (req, res) => {
  db.query(
    `SELECT COALESCE(type,'その他') as type, COUNT(*) as count FROM contacts GROUP BY type ORDER BY count DESC`,
    (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) }
  )
})

// ── 解析: 転換率（閲覧→お気に入り）──────────────────────────
app.get('/admin/api/analytics/conversion', requireAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100)
  db.query(`
    SELECT u.name, u.country,
           COUNT(DISTINCT vl.id) as views, COUNT(DISTINCT fl.id) as favorites,
           ROUND(COUNT(DISTINCT fl.id)/NULLIF(COUNT(DISTINCT vl.id),0)*100,1) as rate
    FROM university_scholarships u
    LEFT JOIN view_logs vl ON u.id=vl.target_id AND vl.type='university'
    LEFT JOIN favorite_logs fl ON u.id=fl.university_id
    GROUP BY u.id HAVING views > 0 ORDER BY rate DESC LIMIT ?
  `, [limit], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})

// ── 解析: スレッド人気 ────────────────────────────────────────
app.get('/admin/api/analytics/top-threads', requireAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100)
  db.query(`
    SELECT t.title, t.view_count, t.created_at, COUNT(r.id) as reply_count
    FROM threads t LEFT JOIN thread_replies r ON t.id=r.thread_id
    GROUP BY t.id ORDER BY t.view_count DESC LIMIT ?
  `, [limit], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})

// ── 解析: 体験談 国別分布 ────────────────────────────────────
app.get('/admin/api/analytics/experience-dist', requireAuth, (req, res) => {
  db.query(`
    SELECT country, COUNT(*) as count, ROUND(AVG(rating),1) as avg_rating
    FROM experiences WHERE status='published'
    GROUP BY country ORDER BY count DESC LIMIT 30
  `, (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})

// ── バックアップ ──────────────────────────────────────────────
app.post('/admin/api/backup/run', requireAuth, (req, res) => {
  runBackup((err, filename) => {
    if (err) return res.status(500).json({ error: 'バックアップ失敗: ' + err.message })
    res.json({ ok: true, message: `バックアップ完了: ${filename}` })
  })
})

app.get('/admin/api/backup/list', requireAuth, (req, res) => {
  res.json(listBackups())
})

// ── ユーザー管理 ──────────────────────────────────────────────
app.get('/admin/api/users', requireAuth, (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page, 10) || 1)
  const limit  = Math.min(50, parseInt(req.query.limit, 10) || 20)
  const offset = (page - 1) * limit
  const q      = req.query.q ? `%${req.query.q.slice(0, 100)}%` : null
  const status = ['active','suspended','banned','deleted'].includes(req.query.status) ? req.query.status : null

  let where = 'WHERE 1=1'
  const params = []
  if (q)      { where += ' AND (name LIKE ? OR email LIKE ?)'; params.push(q, q) }
  if (status) { where += ' AND status = ?'; params.push(status) }

  db.query(`SELECT COUNT(*) as total FROM users ${where}`, params, (err, countRows) => {
    if (err) return res.status(500).json({ error: err.message })
    db.query(
      `SELECT id, name, email, role, status, nationality, target_country, last_login_at, created_at FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
      (err2, rows) => {
        if (err2) return res.status(500).json({ error: err2.message })
        res.json({ users: rows, total: countRows[0].total, page, limit })
      }
    )
  })
})

app.get('/admin/api/users/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (!id) return res.status(400).json({ error: '無効なID' })
  db.query('SELECT id, name, email, role, status, bio, nationality, target_country, target_university, enrollment_year, last_login_at, created_at FROM users WHERE id = ?', [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    if (!rows[0]) return res.status(404).json({ error: 'ユーザーが見つかりません' })
    res.json(rows[0])
  })
})

app.patch('/admin/api/users/:id/status', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10)
  const { status } = req.body
  if (!id) return res.status(400).json({ error: '無効なID' })
  if (!['active','suspended','banned','deleted'].includes(status)) return res.status(400).json({ error: '無効なステータス' })
  db.query('UPDATE users SET status = ? WHERE id = ?', [status, id], (err) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ ok: true })
  })
})

app.patch('/admin/api/users/:id/role', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10)
  const { role } = req.body
  if (!id) return res.status(400).json({ error: '無効なID' })
  if (!['student','supporter','admin'].includes(role)) return res.status(400).json({ error: '無効なロール' })
  db.query('UPDATE users SET role = ? WHERE id = ?', [role, id], (err) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ ok: true })
  })
})

app.get('/admin/api/users/stats/summary', requireAuth, (req, res) => {
  const queries = {
    total:    'SELECT COUNT(*) n FROM users WHERE status != "deleted"',
    active:   'SELECT COUNT(*) n FROM users WHERE status = "active"',
    banned:   'SELECT COUNT(*) n FROM users WHERE status IN ("banned","suspended")',
    thisMonth:'SELECT COUNT(*) n FROM users WHERE YEAR(created_at)=YEAR(NOW()) AND MONTH(created_at)=MONTH(NOW())',
  }
  const results = {}
  const keys = Object.keys(queries)
  let done = 0
  keys.forEach(k => db.query(queries[k], (err, rows) => {
    results[k] = err ? 0 : rows[0].n
    if (++done === keys.length) res.json(results)
  }))
})

// ── SEO管理 ──────────────────────────────────────────────────
app.get('/admin/api/seo', requireAuth, (req, res) => {
  db.query('SELECT * FROM seo_meta ORDER BY page_path', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows)
  })
})

app.post('/admin/api/seo', requireAuth, (req, res) => {
  const { page_path, title, description, og_title, og_description, og_image, canonical, robots } = req.body
  if (!page_path) return res.status(400).json({ error: 'page_pathは必須です' })
  db.query(
    'INSERT INTO seo_meta (page_path, title, description, og_title, og_description, og_image, canonical, robots) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), og_title=VALUES(og_title), og_description=VALUES(og_description), og_image=VALUES(og_image), canonical=VALUES(canonical), robots=VALUES(robots)',
    [page_path.slice(0,500), title||null, description||null, og_title||null, og_description||null, og_image||null, canonical||null, robots||'index, follow'],
    (err) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ ok: true })
    }
  )
})

app.delete('/admin/api/seo/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (!id) return res.status(400).json({ error: '無効なID' })
  db.query('DELETE FROM seo_meta WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ ok: true })
  })
})

// ── エラーログ管理 ────────────────────────────────────────────
app.get('/admin/api/logs', requireAuth, (req, res) => {
  const level  = ['error','warn','info'].includes(req.query.level) ? req.query.level : null
  const limit  = Math.min(200, parseInt(req.query.limit, 10) || 50)
  let where = 'WHERE 1=1'; const params = []
  if (level) { where += ' AND level = ?'; params.push(level) }
  db.query(`SELECT id, level, message, path, method, ip, created_at FROM error_logs ${where} ORDER BY created_at DESC LIMIT ?`,
    [...params, limit], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(rows)
    })
})

app.get('/admin/api/logs/:id/detail', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (!id) return res.status(400).json({ error: '無効なID' })
  db.query('SELECT * FROM error_logs WHERE id = ?', [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows[0] || {})
  })
})

app.delete('/admin/api/logs/old', requireAuth, (req, res) => {
  db.query('DELETE FROM error_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)', (err, result) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ ok: true, deleted: result.affectedRows })
  })
})

// ── 公式締め切り管理 ──────────────────────────────────────────
app.get('/admin/api/official-deadlines', requireAuth, (req, res) => {
  db.query('SELECT * FROM official_deadlines ORDER BY deadline_date ASC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows)
  })
})

app.post('/admin/api/official-deadlines', requireAuth, (req, res) => {
  const { title, deadline_date, category, description, url, target_country } = req.body
  if (!title || !deadline_date) return res.status(400).json({ error: 'title・deadline_dateは必須です' })
  const cats = ['application','test','document','scholarship','other']
  db.query(
    'INSERT INTO official_deadlines (title, deadline_date, category, description, url, target_country) VALUES (?,?,?,?,?,?)',
    [title.slice(0,200), deadline_date, cats.includes(category) ? category : 'other', description||null, url||null, target_country||null],
    (err) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ ok: true })
    }
  )
})

app.patch('/admin/api/official-deadlines/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (!id) return res.status(400).json({ error: '無効なID' })
  const { title, deadline_date, category, description, url, target_country, is_active } = req.body
  const cats = ['application','test','document','scholarship','other']
  db.query(
    'UPDATE official_deadlines SET title=?, deadline_date=?, category=?, description=?, url=?, target_country=?, is_active=? WHERE id=?',
    [title?.slice(0,200), deadline_date, cats.includes(category) ? category : 'other', description||null, url||null, target_country||null, is_active ? 1 : 0, id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ ok: true })
    }
  )
})

app.delete('/admin/api/official-deadlines/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (!id) return res.status(400).json({ error: '無効なID' })
  db.query('DELETE FROM official_deadlines WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ ok: true })
  })
})

// ── SPA fallback ──────────────────────────────────────────
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'))
})

// ── データセット専用パスワード認証 ────────────────────────────────────────
app.post('/admin/api/dataset-files/auth', requireAuth, express.json(), (req, res) => {
  if (!DATASET_PASS) return res.status(500).json({ error: '.env に DATASET_PASSWORD が設定されていません' })
  if (req.body.password !== DATASET_PASS) return res.status(401).json({ error: 'パスワードが違います' })
  req.session.datasetAuth = true
  res.json({ ok: true })
})

app.post('/admin/api/dataset-files/auth/logout', requireAuth, (req, res) => {
  req.session.datasetAuth = false
  res.json({ ok: true })
})

// ── データセットファイル管理（奨学金リスト・ランキングPDF）────────────────
const DATA_LISTING_DIR = path.join(
  'C:/Users/user/OneDrive/Desktop/willabroadjapan/GetData/CreateTable/data_listing'
)

// 許可するプレフィックスと表示名
const DATASET_PREFIXES = {
  yanai:              { label: '柳井正財団',                 ext: 'txt' },
  sasakawa:           { label: '笹川平和財団',               ext: 'txt' },
  grew:               { label: 'グルーバンクロフト基金',     ext: 'txt' },
  YouAreWelcomeHere:  { label: 'YouAreWelcomeHere',          ext: 'txt' },
  toshin:             { label: '東進海外進学支援制度',       ext: 'txt' },
  Laidlaw:            { label: 'Laidlaw Scholars',           ext: 'txt' },
  stamps:             { label: 'Stamps Scholar Program',     ext: 'txt' },
  ezo_art:            { label: '江副（芸術指定校）',         ext: 'pdf' },
}

// multer: メモリに受け取ってからディスクへ保存（安全チェック後）
const datasetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },  // 2MB
})

// ファイル名バリデーション: {prefix}_{YYYY}.{ext} のみ許可
function parseDatasetFilename(filename) {
  const m = filename.match(/^([A-Za-z0-9_]+)_(\d{4})\.(txt|pdf)$/)
  if (!m) return null
  const [, prefix, year, ext] = m
  const meta = DATASET_PREFIXES[prefix]
  if (!meta) return null
  if (meta.ext !== ext) return null
  const y = parseInt(year, 10)
  if (y < 2025 || y > 2040) return null
  return { prefix, year: y, ext, label: meta.label }
}

// ファイル一覧
app.get('/admin/api/dataset-files', requireDatasetAuth, (req, res) => {
  try {
    if (!fs.existsSync(DATA_LISTING_DIR)) return res.json([])
    const files = fs.readdirSync(DATA_LISTING_DIR)
      .filter(f => parseDatasetFilename(f))
      .map(f => {
        const parsed  = parseDatasetFilename(f)
        const fpath   = path.join(DATA_LISTING_DIR, f)
        const stat    = fs.statSync(fpath)
        return {
          filename: f,
          prefix:   parsed.prefix,
          label:    parsed.label,
          year:     parsed.year,
          ext:      parsed.ext,
          size:     stat.size,
          mtime:    stat.mtime,
        }
      })
      .sort((a, b) => a.prefix.localeCompare(b.prefix) || b.year - a.year)
    res.json(files)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ファイル内容取得（txtのみ）
app.get('/admin/api/dataset-files/:filename/content', requireDatasetAuth, (req, res) => {
  const parsed = parseDatasetFilename(req.params.filename)
  if (!parsed) return res.status(400).json({ error: '無効なファイル名です' })
  if (parsed.ext !== 'txt') return res.status(400).json({ error: 'テキストファイルのみ参照できます' })
  const fpath = path.join(DATA_LISTING_DIR, req.params.filename)
  if (!fs.existsSync(fpath)) return res.status(404).json({ error: 'ファイルが見つかりません' })
  try {
    const content = fs.readFileSync(fpath, 'utf8')
    res.json({ content })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ファイルアップロード（旧年度ファイルは archive/ へ自動移動）
app.post('/admin/api/dataset-files/upload', requireDatasetAuth, datasetUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ファイルが選択されていません' })
  const filename = req.file.originalname
  const parsed   = parseDatasetFilename(filename)
  if (!parsed) return res.status(400).json({
    error: `ファイル名は {prefix}_{年度}.{ext} の形式にしてください。\n許可プレフィックス: ${Object.keys(DATASET_PREFIXES).join(', ')}`
  })

  try {
    if (!fs.existsSync(DATA_LISTING_DIR)) fs.mkdirSync(DATA_LISTING_DIR, { recursive: true })

    // 同プレフィックスの既存ファイルをすべて archive/ へ移動
    const archiveDir = path.join(DATA_LISTING_DIR, 'archive')
    const archived   = []
    const existing   = fs.readdirSync(DATA_LISTING_DIR)
      .filter(f => {
        const p = parseDatasetFilename(f)
        return p && p.prefix === parsed.prefix && f !== filename
      })
    for (const old of existing) {
      if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true })
      const src  = path.join(DATA_LISTING_DIR, old)
      const dest = path.join(archiveDir, old)
      fs.renameSync(src, dest)
      archived.push(old)
    }

    // 新ファイルを保存
    fs.writeFileSync(path.join(DATA_LISTING_DIR, filename), req.file.buffer)

    res.json({ ok: true, filename, label: parsed.label, year: parsed.year, archived })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ファイル削除
app.delete('/admin/api/dataset-files/:filename', requireDatasetAuth, (req, res) => {
  const parsed = parseDatasetFilename(req.params.filename)
  if (!parsed) return res.status(400).json({ error: '無効なファイル名です' })
  const fpath = path.join(DATA_LISTING_DIR, req.params.filename)
  if (!fs.existsSync(fpath)) return res.status(404).json({ error: 'ファイルが見つかりません' })
  try {
    fs.unlinkSync(fpath)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── 本番エラーハンドラー ───────────────────────────────────
app.use((err, req, res, next) => {
  const isDev = process.env.NODE_ENV !== 'production'
  console.error('[ADMIN ERROR]', err.message)
  res.status(err.status || 500).json({
    error: isDev ? err.message : 'サーバーエラーが発生しました'
  })
})

app.listen(4000, () => console.log('🔧 Admin → http://localhost:4000'))
