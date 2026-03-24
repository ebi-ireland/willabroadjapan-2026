// =====================
// admin-server.js
// 用途: 管理画面サーバー（port 4000）
// =====================

require('dotenv').config()
const express = require('express')
const session = require('express-session')
const path    = require('path')
const db      = require('./db/connection')

const app = express()
app.use(express.json({ limit: '2mb' }))
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

app.use(session({
  secret: process.env.SESSION_SECRET || 'admin_secret',
  resave: false,
  saveUninitialized: false,
}))

const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'willadmin'

function requireAuth(req, res, next) {
  if (req.session.admin) return next()
  res.status(401).json({ error: 'Unauthorized' })
}

// ── 認証 ─────────────────────────────────────────────────
app.post('/admin/api/login', (req, res) => {
  if (req.body.password === ADMIN_PASS) {
    req.session.admin = true
    res.json({ ok: true })
  } else {
    res.status(401).json({ error: 'パスワードが違います' })
  }
})
app.post('/admin/api/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }) })

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

// ── 記事 ──────────────────────────────────────────────────
app.get('/admin/api/articles', requireAuth, (req, res) => {
  db.query('SELECT id, title, summary, status, updated_at FROM articles ORDER BY updated_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows)
  })
})
app.post('/admin/api/articles', requireAuth, (req, res) => {
  const { title, summary, body, status } = req.body
  db.query('INSERT INTO articles (title, summary, body, status) VALUES (?,?,?,?)',
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
    const ALLOWED_KEYS = ['pass_threshold','maybe_threshold','max_selections']
    const { cfg_key, cfg_val } = req.body
    safeEnum(cfg_key, ALLOWED_KEYS)
    const val = safeStr(cfg_val, 50)
    if (!val) return res.status(400).json({ error: '値は必須です' })
    db.query('UPDATE diagnosis_config SET cfg_val = ? WHERE cfg_key = ?', [val, cfg_key],
      (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true }) })
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

app.get('/admin/api/analytics/views-daily', requireAuth, (req, res) => {
  db.query(`
    SELECT DATE(viewed_at) as day, COUNT(*) as views
    FROM view_logs
    WHERE viewed_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    GROUP BY DATE(viewed_at)
    ORDER BY day ASC
  `, (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})

app.get('/admin/api/analytics/top-universities', requireAuth, (req, res) => {
  db.query(`
    SELECT u.name, u.country,
           COUNT(DISTINCT vl.id) as views,
           COUNT(DISTINCT fl.id) as favorites
    FROM university_scholarships u
    LEFT JOIN view_logs vl      ON u.id = vl.target_id AND vl.type = 'university'
    LEFT JOIN favorite_logs fl  ON u.id = fl.university_id
    GROUP BY u.id
    ORDER BY views DESC
    LIMIT 20
  `, (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})

app.get('/admin/api/analytics/contacts-daily', requireAuth, (req, res) => {
  db.query(`
    SELECT DATE(created_at) as day, COUNT(*) as cnt
    FROM contacts
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    GROUP BY DATE(created_at)
    ORDER BY day ASC
  `, (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows) })
})

// ── SPA fallback ──────────────────────────────────────────
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'))
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
