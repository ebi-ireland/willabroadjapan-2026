// =====================
// logo.js
// パス: /routes/logo.js
// 用途: ロゴ画像のルート
// =====================

const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')

router.get('/images/logo/logo', (req, res) => {
  const logoDir = path.join(__dirname, '../public/images/logo')
  const extensions = ['.png', '.jpg', '.jpeg', '.svg', '.webp']
  for (const ext of extensions) {
    const filePath = path.join(logoDir, `logo${ext}`)
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath)
    }
  }
  res.status(404).send('Logo not found')
})

module.exports = router