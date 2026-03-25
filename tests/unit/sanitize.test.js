// =====================
// tests/unit/sanitize.test.js
// middleware/sanitize.js のユニットテスト
// =====================

const { sanitizeHtml, sanitizeText, safeInt, safeId, safeStr } = require('../../middleware/sanitize')

// ─────────────────────────────────────────────────────────────
// safeId
// ─────────────────────────────────────────────────────────────
describe('safeId()', () => {
  test('正の整数文字列 → 数値を返す', () => {
    expect(safeId('5')).toBe(5)
    expect(safeId('100')).toBe(100)
  })

  test('正の整数数値 → 数値を返す', () => {
    expect(safeId(10)).toBe(10)
  })

  test('0 → null を返す（IDは1以上）', () => {
    expect(safeId('0')).toBeNull()
    expect(safeId(0)).toBeNull()
  })

  test('負の値 → null を返す', () => {
    expect(safeId('-1')).toBeNull()
    expect(safeId(-99)).toBeNull()
  })

  test('非数値文字列 → null を返す', () => {
    expect(safeId('abc')).toBeNull()
    expect(safeId('id_1')).toBeNull()
  })

  test('null / undefined → null を返す', () => {
    expect(safeId(null)).toBeNull()
    expect(safeId(undefined)).toBeNull()
  })

  test('小数文字列は整数部を使う（3.9 → 3）', () => {
    expect(safeId('3.9')).toBe(3)
  })

  test('SQLインジェクション文字列 → parseInt で先頭の数値部分のみ取り出す', () => {
    // parseInt('1 OR 1=1', 10) = 1 → safeId は 1 を返す（SQL保護はパラメータ化クエリで行う）
    expect(safeId('1 OR 1=1')).toBe(1)
    expect(safeId('1; DROP TABLE users')).toBe(1)
    // 文字列から始まる場合は null
    expect(safeId('abc; DROP TABLE')).toBeNull()
  })

  test('空文字列 → null を返す', () => {
    expect(safeId('')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────
// safeStr
// ─────────────────────────────────────────────────────────────
describe('safeStr()', () => {
  test('通常文字列 → トリムして返す', () => {
    expect(safeStr('  hello  ')).toBe('hello')
  })

  test('最大長を超える文字列 → 切り捨て（デフォルト500文字）', () => {
    const long = 'a'.repeat(600)
    expect(safeStr(long)).toHaveLength(500)
  })

  test('カスタム最大長 → その長さに切り捨て', () => {
    expect(safeStr('hello world', 5)).toBe('hello')
  })

  test('数値 → 空文字列を返す', () => {
    expect(safeStr(123)).toBe('')
  })

  test('null → 空文字列を返す', () => {
    expect(safeStr(null)).toBe('')
  })

  test('undefined → 空文字列を返す', () => {
    expect(safeStr(undefined)).toBe('')
  })

  test('空文字列 → 空文字列を返す', () => {
    expect(safeStr('')).toBe('')
  })

  test('日本語文字列はそのまま返す', () => {
    expect(safeStr('東京大学')).toBe('東京大学')
  })
})

// ─────────────────────────────────────────────────────────────
// safeInt
// ─────────────────────────────────────────────────────────────
describe('safeInt()', () => {
  test('範囲内の値 → そのまま返す', () => {
    expect(safeInt('50', 0, 100)).toBe(50)
    expect(safeInt(50, 0, 100)).toBe(50)
  })

  test('最小値未満 → 最小値にクランプ', () => {
    expect(safeInt('-5', 0, 100)).toBe(0)
    expect(safeInt('0', 10, 100)).toBe(10)
  })

  test('最大値超過 → 最大値にクランプ', () => {
    expect(safeInt('200', 0, 100)).toBe(100)
  })

  test('NaN → null を返す', () => {
    expect(safeInt('abc')).toBeNull()
  })

  test('null → null を返す', () => {
    expect(safeInt(null)).toBeNull()
  })

  test('undefined → null を返す', () => {
    expect(safeInt(undefined)).toBeNull()
  })

  test('デフォルト範囲は 0〜2147483647', () => {
    expect(safeInt('999999999')).toBe(999999999)
    expect(safeInt('-1')).toBe(0)
  })

  test('境界値（min ちょうど）→ min を返す', () => {
    expect(safeInt('0', 0, 100)).toBe(0)
  })

  test('境界値（max ちょうど）→ max を返す', () => {
    expect(safeInt('100', 0, 100)).toBe(100)
  })
})

// ─────────────────────────────────────────────────────────────
// sanitizeText
// ─────────────────────────────────────────────────────────────
describe('sanitizeText()', () => {
  test('HTMLタグを全て除去する', () => {
    expect(sanitizeText('<b>太字</b>')).toBe('太字')
    expect(sanitizeText('<p>段落</p>')).toBe('段落')
  })

  test('scriptタグ（XSS）を除去する', () => {
    const result = sanitizeText('<script>alert("xss")</script>テキスト')
    expect(result).not.toContain('<script>')
    expect(result).toContain('テキスト')
  })

  test('ネストされたタグも除去する', () => {
    expect(sanitizeText('<b><i>text</i></b>')).toBe('text')
  })

  test('空文字列 → 空文字列を返す', () => {
    expect(sanitizeText('')).toBe('')
  })

  test('null / undefined → 空文字列を返す', () => {
    expect(sanitizeText(null)).toBe('')
    expect(sanitizeText(undefined)).toBe('')
  })

  test('プレーンテキストはそのまま通す', () => {
    expect(sanitizeText('普通のテキスト 123')).toBe('普通のテキスト 123')
  })

  test('前後の空白はトリムされる', () => {
    expect(sanitizeText('  hello  ')).toBe('hello')
  })
})

// ─────────────────────────────────────────────────────────────
// sanitizeHtml
// ─────────────────────────────────────────────────────────────
describe('sanitizeHtml()', () => {
  test('許可タグ（b, i, strong, em）はそのまま残す', () => {
    const result = sanitizeHtml('<b>太字</b>と<i>斜体</i>')
    expect(result).toContain('<b>太字</b>')
    expect(result).toContain('<i>斜体</i>')
  })

  test('scriptタグを除去する', () => {
    const result = sanitizeHtml('<script>alert("xss")</script>')
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('alert')
  })

  test('onclickなど危険な属性を除去する', () => {
    const result = sanitizeHtml('<b onclick="evil()">text</b>')
    expect(result).not.toContain('onclick')
    expect(result).toContain('text')
  })

  test('javascript: プロトコルを除去する', () => {
    const result = sanitizeHtml('<a href="javascript:void(0)">リンク</a>')
    expect(result).not.toContain('javascript:')
  })

  test('a タグの href 属性は残す', () => {
    const result = sanitizeHtml('<a href="https://example.com">リンク</a>')
    expect(result).toContain('href="https://example.com"')
  })

  test('ul/ol/li タグを残す', () => {
    const result = sanitizeHtml('<ul><li>項目1</li><li>項目2</li></ul>')
    expect(result).toContain('<ul>')
    expect(result).toContain('<li>項目1</li>')
  })

  test('許可されていないタグ（div, span）は除去する', () => {
    const result = sanitizeHtml('<div class="danger">内容</div>')
    expect(result).not.toContain('<div')
    expect(result).toContain('内容')
  })

  test('空文字列 → 空文字列を返す', () => {
    expect(sanitizeHtml('')).toBe('')
  })

  test('null / undefined → 空文字列を返す', () => {
    expect(sanitizeHtml(null)).toBe('')
    expect(sanitizeHtml(undefined)).toBe('')
  })
})
