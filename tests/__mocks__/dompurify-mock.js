// =====================
// tests/__mocks__/dompurify-mock.js
// DOMPurify の Jest 用モック
//
// 本番と同等のサニタイズ動作を正規表現ベースで再現。
// テスト環境でも sanitize.js の動作を正しく検証できる。
// =====================

/**
 * createDOMPurify(window) の形式を模倣したファクトリ関数。
 * sanitize.js は `createDOMPurify(window)` → `.sanitize(dirty, opts)` と呼び出す。
 */
function createDOMPurify() {
  return {
    /**
     * @param {string} dirty       - サニタイズ対象の文字列
     * @param {object} options
     *   ALLOWED_TAGS  {string[]} - 許可するHTMLタグ名（空配列 = タグ全除去）
     *   ALLOWED_ATTR  {string[]} - 許可するHTML属性名
     */
    sanitize(dirty, options = {}) {
      if (!dirty) return ''

      const allowedTags = options.ALLOWED_TAGS || []
      const allowedAttr = options.ALLOWED_ATTR || []

      let result = dirty

      // ── 危険コンテンツを先に除去 ──────────────────────────
      // <script> タグとその中身を除去
      result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // <style> タグとその中身を除去
      result = result.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      // javascript: URI を除去
      result = result.replace(/(\s+href\s*=\s*["'])javascript:[^"']*(["'])/gi, '$1#$2')

      if (allowedTags.length === 0) {
        // タグを全て除去してプレーンテキストに
        result = result.replace(/<[^>]*>/g, '')
        return result.trim()
      }

      // ── 許可タグ以外のタグ部分を除去（テキスト内容は保持）────
      const allowedSet = new Set(allowedTags.map(t => t.toLowerCase()))

      result = result.replace(/<(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\s*([^>]*)>/g, (match, slash, tag, attrs) => {
        if (!allowedSet.has(tag.toLowerCase())) {
          return '' // 許可外タグのタグ記号を除去（テキストは保持済み）
        }

        if (slash) return `</${tag.toLowerCase()}>` // 閉じタグ

        // 開きタグ: 許可属性のみ残す・イベントハンドラ除去
        let safeAttrs = ''
        if (allowedAttr.length > 0) {
          const attrAllowedSet = new Set(allowedAttr.map(a => a.toLowerCase()))
          // 属性を個別にパース
          const attrPattern = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g
          let attrMatch
          while ((attrMatch = attrPattern.exec(attrs)) !== null) {
            const attrName = attrMatch[1].toLowerCase()
            const attrVal  = attrMatch[3] ?? attrMatch[4] ?? ''
            // onXxx 系イベントハンドラを除去
            if (attrName.startsWith('on')) continue
            // javascript: を除去
            if (/javascript:/i.test(attrVal)) continue
            if (attrAllowedSet.has(attrName)) {
              safeAttrs += ` ${attrName}="${attrVal}"`
            }
          }
        }

        return `<${tag.toLowerCase()}${safeAttrs}>`
      })

      return result
    },
  }
}

module.exports = createDOMPurify
