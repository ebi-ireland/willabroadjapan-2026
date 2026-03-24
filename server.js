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

app.use(express.static('public'))

app.listen(3000, () => console.log('👤 User  → http://localhost:3000'))
app.listen(4000, () => console.log('🔧 Admin → http://localhost:4000'))