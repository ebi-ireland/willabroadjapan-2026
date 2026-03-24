// =====================
// contact.js
// パス: /routes/contact.js
// 用途: お問い合わせAPI（大学向け / 留学生向け）
// =====================

const express = require('express')
const router  = express.Router()
const db      = require('../db/connection')
const fetch   = require('node-fetch')

// type → Discord Webhook URL のマッピング
const WEBHOOKS = {
  education:            process.env.DISCORD_CONTACT_EDUCATION_WEBHOOK,
  student_international: process.env.DISCORD_CONTACT_STUDENT_INTERNATIONAL_WEBHOOK,
}

// type → Discord embed の色と見出し
const EMBED_META = {
  education: {
    color: 0x1F4E79,
    label: '🎓 大学パートナーシップ お問い合わせ',
  },
  student_international: {
    color: 0xC8932A,
    label: '🌏 留学生向け お問い合わせ',
  },
}

async function sendDiscord(webhook, meta, body) {
  if (!webhook) return
  const { name, email, job, title, message } = body
  const payload = {
    embeds: [{
      title:  meta.label,
      color:  meta.color,
      fields: [
        { name: '名前',    value: name  || '—', inline: true  },
        { name: 'メール',  value: email || '—', inline: true  },
        { name: 'ステータス / 役職', value: job || '—', inline: true },
        { name: '件名',    value: title || '—', inline: false },
        { name: 'メッセージ', value: message || '—', inline: false },
      ],
      timestamp: new Date().toISOString(),
    }]
  }
  try {
    await fetch(webhook, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
  } catch (err) {
    console.error('[Discord通知エラー]', err.message)
  }
}

router.post('/', express.json(), async (req, res) => {
  const { name, email, job, title, message, type } = req.body

  if (!name || !email || !message) {
    return res.status(400).json({ error: '必須項目が不足しています' })
  }

  db.query(
    'INSERT INTO contacts (name, email, job, title, message) VALUES (?, ?, ?, ?, ?)',
    [name, email, job || '', title || '', message],
    async (err) => {
      if (err) return res.status(500).json({ error: err.message })

      const webhook = WEBHOOKS[type] || WEBHOOKS.education
      const meta    = EMBED_META[type] || EMBED_META.education
      await sendDiscord(webhook, meta, { name, email, job, title, message })

      res.json({ ok: true })
    }
  )
})

module.exports = router
