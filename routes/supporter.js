// =====================
// supporter.js
// パス: /routes/supporter.js
// 用途: Stripe寄付 + お問い合わせ
// =====================

const express = require('express')
const router  = express.Router()
const db      = require('../db/connection')
const fetch   = require('node-fetch')

// ── Stripe初期化（環境変数がある場合のみ）
let stripe = null
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
}

// ────────────────────────────────────────
// Stripe Checkout セッション作成
// POST /api/supporter/checkout
// body: { amount: 1000 }  ← 円
// ────────────────────────────────────────
router.post('/checkout', express.json(), async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in .env' })
  }

  const amount = parseInt(req.body.amount, 10)
  if (!amount || amount < 100) {
    return res.status(400).json({ error: '最低寄付額は100円です' })
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'jpy',
          product_data: {
            name: 'Will Abroad へのご支援',
            description: '留学を目指す学生のための非営利支援活動への寄付',
          },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.BASE_URL || 'http://localhost:3000'}/supporter.html?donated=true`,
      cancel_url:  `${process.env.BASE_URL || 'http://localhost:3000'}/supporter.html`,
      metadata: { source: 'supporter_page' },
    })
    res.json({ url: session.url })
  } catch (err) {
    console.error('[Stripe]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ────────────────────────────────────────
// お問い合わせ送信
// POST /api/supporter/contact
// ────────────────────────────────────────
router.post('/contact', express.json(), (req, res) => {
  const { name, email, subject, message } = req.body
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'お名前・メール・メッセージは必須です' })
  }

  db.query(
    `INSERT INTO supporter_contacts (name, email, subject, message) VALUES (?, ?, ?, ?)`,
    [name, email, subject || '', message],
    async (err) => {
      if (err) return res.status(500).json({ error: err.message })

      // Discord通知（ハイフン入りキー名なのでブラケット記法で参照）
      const webhook = process.env.DISCORD_CONTACT_SUPPORTER_WEBHOOK
      if (webhook) {
        const payload = {
          embeds: [{
            title: '💛 サポーター お問い合わせ',
            color: 0xF4C842,
            fields: [
              { name: '名前',    value: name    || '—', inline: true  },
              { name: 'メール',  value: email   || '—', inline: true  },
              { name: '件名',    value: subject || '—', inline: false },
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
        } catch (e) {
          console.error('[Discord通知エラー]', e.message)
        }
      }

      res.json({ ok: true })
    }
  )
})

module.exports = router
