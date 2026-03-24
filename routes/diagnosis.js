// =====================
// diagnosis.js
// パス: /routes/diagnosis.js
// 用途: 大学合格診断API
// =====================

const express = require('express')
const router = express.Router()
const db = require('../db/connection')
const fetch = require('node-fetch')

// 大学一覧
router.get('/colleges', (req, res) => {
  db.query(
    'SELECT id, name, score, need_based, country FROM diagnosis_colleges ORDER BY score DESC',
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results)
    }
  )
})

// キーワード一覧
router.get('/keywords', (req, res) => {
  db.query(
    'SELECT keyword, points, category FROM diagnosis_keywords ORDER BY points DESC',
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results)
    }
  )
})

// スコアリングテーブル（フロントエンドで使用）
router.get('/scoring', (req, res) => {
  db.query(
    'SELECT item_type, min_val, max_val, key_val, pts FROM diagnosis_scoring ORDER BY item_type, sort_order ASC',
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results)
    }
  )
})

// 全体設定
router.get('/config', (req, res) => {
  db.query('SELECT cfg_key, cfg_val, label FROM diagnosis_config', (err, results) => {
    if (err) return res.status(500).json({ error: err.message })
    const cfg = {}
    results.forEach(r => { cfg[r.cfg_key] = r.cfg_val })
    res.json(cfg)
  })
})

// Discord通知
router.post('/notify', express.json(), async (req, res) => {
  const { step1, step2, results } = req.body

  const step1Text = [
    `**GPA:** ${step1.gpa || 'なし'}`,
    `**クラスランク:** ${step1.classrank || 'なし'}`,
    `**SAT:** ${step1.sat || 'なし'}`,
    `**ACT:** ${step1.act || 'なし'}`,
    `**英語資格:** ${step1.lang || 'なし'}`,
    `**Need-based希望:** ${step1.needBased === 'yes' ? 'あり' : 'なし'}`,
    `**課外活動1:** ${step1.act1 || 'なし'}`,
    `**課外活動2:** ${step1.act2 || 'なし'}`,
    `**課外活動3:** ${step1.act3 || 'なし'}`,
  ].join('\n')

  const resultsText = results.map(r =>
    `**${r.name}** → ${r.verdict} (${r.pct}%)`
  ).join('\n')

  const payload = {
    embeds: [{
      title: '🎓 合否診断が実行されました',
      color: 0xff8040,
      fields: [
        { name: '📝 STEP1 入力内容', value: step1Text },
        { name: '🏫 選択大学と結果', value: resultsText },
      ],
      timestamp: new Date().toISOString(),
    }]
  }

  try {
    await fetch(process.env.DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    res.json({ ok: true })
  } catch (err) {
    console.error('Discord通知エラー:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
