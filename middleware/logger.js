const winston = require('winston')
require('winston-daily-rotate-file')
const path = require('path')
const fs = require('fs')

const LOG_DIR = path.join(__dirname, '../logs')
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })

const fileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(LOG_DIR, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxFiles: '30d',
  level: 'error',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json())
})

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    fileTransport
  ]
})

// DB書き込み機能（後からDB接続を注入する）
logger.addDBTransport = function(db) {
  class DBTransport extends winston.Transport {
    log(info, callback) {
      const { level, message, stack, meta = {} } = info
      const q = 'INSERT INTO error_logs (level, message, stack, path, method, user_id, ip, user_agent) VALUES (?,?,?,?,?,?,?,?)'
      db.query(q, [level, String(message).slice(0, 1000), stack ? String(stack).slice(0, 5000) : null,
        meta.path || null, meta.method || null, meta.userId || null,
        meta.ip || null, meta.userAgent ? String(meta.userAgent).slice(0, 500) : null
      ], () => callback())
    }
  }
  this.add(new DBTransport({ level: 'error' }))
}

module.exports = logger
