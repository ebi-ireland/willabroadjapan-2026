// =====================
// contact.js
// パス: /routes/contact.js
// 用途: お問い合わせAPI
// =====================

const express = require('express')
const router = express.Router()
const db = require('../db/connection')
const fetch = require('node-fetch')

router.post('/', express.json(), async (req, res) => {
  const { name, email, job, title, message } = req.body

  // DBに保存
  db.query(
    'INSERT INTO contacts (name, email, job, title, message) VALUES (?, ?, ?, ?, ?)',
    [name, email, job, title, message],
    async (err) => {
      if (err) return res.status(500).json({ error: err.message })

      // Discord通知
      const payload = {
        embeds: [{
          title: '📩 新しいお問い合わせが届きました',
          color: 0xff8040,
          fields: [
            { name: '名前',     value: name,    inline: true },
            { name: 'メール',   value: email,   inline: true },
            { name: '職業',     value: job,     inline: true },
            { name: 'タイトル', value: title,   inline: false },
            { name: '内容',     value: message, inline: false },
          ],
          timestamp: new Date().toISOString(),
        }]
      }

      try {
        await fetch(process.env.DISCORD_CONTACT_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } catch (err) {
        console.error('Discord通知エラー:', err)
      }

      res.json({ ok: true })
    }
  )
})

module.exports = router