const { JSDOM } = require('jsdom')
const createDOMPurify = require('dompurify')

const window = new JSDOM('').window
const DOMPurify = createDOMPurify(window)

// HTML許可タグあり（記事等）
function sanitizeHtml(dirty) {
  if (!dirty) return ''
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'u', 'ul', 'ol', 'li', 'p', 'br', 'a', 'strong', 'em'],
    ALLOWED_ATTR: ['href', 'target']
  })
}

// プレーンテキストのみ（タグを全削除）
function sanitizeText(dirty) {
  if (!dirty) return ''
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim()
}

// 数値バリデーション
function safeInt(val, min = 0, max = 2147483647) {
  const n = parseInt(val, 10)
  if (isNaN(n)) return null
  return Math.max(min, Math.min(max, n))
}

// ID バリデーション
function safeId(val) {
  const n = parseInt(val, 10)
  return (!isNaN(n) && n > 0) ? n : null
}

// 文字列長チェック
function safeStr(val, maxLen = 500) {
  if (typeof val !== 'string') return ''
  return val.slice(0, maxLen).trim()
}

module.exports = { sanitizeHtml, sanitizeText, safeInt, safeId, safeStr }
