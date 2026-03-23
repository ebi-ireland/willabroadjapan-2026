// =====================
// footer.js
// パス: /public/scripts/components/footer.js
// 使用: 全ページ共通
// 用途: フッターの生成
// =====================

function createFooter() {
  const footer = document.createElement('footer')
  footer.className = 'site-footer'
  footer.innerHTML = `
    <div class="site-footer__inner">
      <div class="site-footer__copyright">© <span id="year"></span> willabroad japan</div>
      <div class="site-footer__social">
        <a href="https://x.com/kaigaijuku" target="_blank" class="site-footer__social-link">
          <img src="/images/logo/twitter.png" alt="X (Twitter)" class="site-footer__social-icon">
        </a>
      </div>
    </div>
  `
  document.body.appendChild(footer)
}

createFooter()