const BLOCKED_UA_PATTERNS = [
  /python-requests/i, /scrapy/i, /wget\/\d/i,
  /go-http-client/i, /java\/\d/i, /libwww/i,
  /curl\/\d/i, /axios\/\d/i, /node-fetch/i,
  /okhttp/i, /apache-httpclient/i
]

// API用ボット検知ミドルウェア
function botProtection(req, res, next) {
  const ua = req.headers['user-agent'] || ''
  if (!ua) return res.status(403).json({ error: 'アクセスが拒否されました' })
  if (BLOCKED_UA_PATTERNS.some(p => p.test(ua))) {
    return res.status(403).json({ error: 'アクセスが拒否されました' })
  }
  next()
}

// データAPIの過剰取得検知（100件以上の連続リクエスト警告）
const requestCounts = new Map()
function antiScraping(req, res, next) {
  const ip = req.ip
  const now = Date.now()
  const entry = requestCounts.get(ip) || { count: 0, windowStart: now }

  if (now - entry.windowStart > 60 * 1000) {
    entry.count = 1
    entry.windowStart = now
  } else {
    entry.count++
  }
  requestCounts.set(ip, entry)

  if (entry.count > 60) {
    return res.status(429).json({ error: 'アクセスが制限されました' })
  }
  next()
}

module.exports = { botProtection, antiScraping }
