// =====================
// copyright.js
// パス: /public/scripts/helpers/copyright.js
// 使用: 全ページ共通 - フッターの年を自動更新
// =====================

// フッターがDOMに追加された後に実行されるよう少し待つ
document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year')
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear()
  }
})