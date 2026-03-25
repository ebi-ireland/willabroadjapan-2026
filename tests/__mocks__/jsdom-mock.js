// =====================
// tests/__mocks__/jsdom-mock.js
// jsdom の Jest 用モック
//
// jsdom@29 の依存パッケージ (@exodus/bytes) が ESM のみのため
// Jest（CommonJS環境）では直接読み込めない。
// このモックが jsdom の代わりに使われる（dompurify-mock.js で完全に実装するため最小限でよい）
// =====================

class JSDOM {
  constructor() {
    this.window = {
      Node: {},
      Element: {},
      HTMLElement: {},
      document: {
        createElement: () => ({ innerHTML: '' }),
        createNodeIterator: () => ({ nextNode: () => null }),
        createTreeWalker: () => ({ nextNode: () => null }),
      },
    }
  }
}

module.exports = { JSDOM }
