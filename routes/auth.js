// =====================
// auth.js
// パス: /routes/auth.js
// 用途: 認証API（Google OAuth）
// =====================

const express  = require('express')
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const db = require('../db/connection')
const router = express.Router()

passport.serializeUser((user, done) => done(null, user.id))

passport.deserializeUser((id, done) => {
  db.query('SELECT * FROM users WHERE id = ?', [id], (err, results) => {
    if (err) return done(err)
    done(null, results[0] || null)
  })
})

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  `${process.env.DOMAIN || 'http://localhost:3000'}/api/auth/google/callback`
  }, (accessToken, refreshToken, profile, done) => {
    const email    = profile.emails?.[0]?.value || ''
    const username = profile.displayName || ''
    const avatar   = profile.photos?.[0]?.value || ''
    const googleId = profile.id

    db.query('SELECT * FROM users WHERE google_id = ?', [googleId], (err, results) => {
      if (err) return done(err)
      if (results.length > 0) return done(null, results[0])
      db.query(
        'INSERT INTO users (username, email, avatar, google_id, email_verified) VALUES (?, ?, ?, ?, 1)',
        [username, email, avatar, googleId],
        (err, result) => {
          if (err) return done(err)
          db.query('SELECT * FROM users WHERE id = ?', [result.insertId], (err, rows) => {
            if (err) return done(err)
            return done(null, rows[0])
          })
        }
      )
    })
  }))
} else {
  console.warn('[AUTH] Google OAuth キーが未設定です。')
}

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }))

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/student-japan/login.html' }),
  (req, res) => { res.redirect('/student-japan/profile.html') }
)

router.post('/logout', (req, res) => {
  req.logout(err => {
    if (err) return res.status(500).json({ error: err.message })
    req.session.destroy(() => { res.json({ ok: true }) })
  })
})

router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      id:       req.user.id,
      username: req.user.username,
      email:    req.user.email,
      avatar:   req.user.avatar,
    })
  } else {
    res.status(401).json({ error: 'not logged in' })
  }
})

router.put('/me', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'not logged in' })
  const { username } = req.body
  if (!username) return res.status(400).json({ error: 'usernameが必要です' })
  db.query('UPDATE users SET username = ? WHERE id = ?', [username, req.user.id], (err) => {
    if (err) return res.status(500).json({ error: err.message })
    req.user.username = username
    res.json({ ok: true, username })
  })
})

module.exports = router