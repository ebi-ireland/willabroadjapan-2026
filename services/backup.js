const cron = require('node-cron')
const { exec } = require('child_process')
const path = require('path')
const fs = require('fs')

const BACKUP_DIR = path.join(__dirname, '../backups')
const KEEP_DAYS = 90

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })

function runBackup(cb) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0]
  const filename = `backup_${ts}.sql`
  const filepath = path.join(BACKUP_DIR, filename)

  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env
  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
    console.error('[Backup] DB環境変数が未設定です')
    if (cb) cb(new Error('DB env not set'))
    return
  }

  const cmd = `mysqldump -h ${DB_HOST} -u ${DB_USER} -p${DB_PASSWORD} ${DB_NAME} > "${filepath}"`
  exec(cmd, (err) => {
    if (err) {
      console.error('[Backup] 失敗:', err.message)
      if (cb) cb(err)
      return
    }
    console.log(`[Backup] 完了: ${filename}`)
    cleanOldBackups()
    if (cb) cb(null, filename)
  })
}

function cleanOldBackups() {
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000
  try {
    fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.sql'))
      .forEach(file => {
        const fp = path.join(BACKUP_DIR, file)
        if (fs.statSync(fp).mtimeMs < cutoff) {
          fs.unlinkSync(fp)
          console.log(`[Backup] 古いファイルを削除: ${file}`)
        }
      })
  } catch (e) {
    console.error('[Backup] クリーンアップエラー:', e.message)
  }
}

function listBackups() {
  try {
    return fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.sql'))
      .map(f => {
        const fp = path.join(BACKUP_DIR, f)
        const stat = fs.statSync(fp)
        return { name: f, size: stat.size, created_at: stat.mtime }
      })
      .sort((a, b) => b.created_at - a.created_at)
  } catch { return [] }
}

// 毎日午前3時に自動バックアップ
cron.schedule('0 3 * * *', () => runBackup())

module.exports = { runBackup, listBackups }
