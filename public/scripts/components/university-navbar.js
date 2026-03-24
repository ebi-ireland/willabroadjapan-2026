// =====================
// university-navbar.js
// パス: /public/scripts/components/university-navbar.js
// 使用: /public/university.html・/public/university/ 以下の全ページ
// 用途: 海外大学向けセクションのナビゲーションバー（英語）
// =====================

;(function () {
  const path = window.location.pathname

  const links = [
    { label: 'Home',  href: '/university.html' },
    { label: 'About', href: '/university/about.html' },
  ]
  const ctaHref  = '/university/contact.html'
  const ctaLabel = 'Contact Us'

  function isActive(href) {
    return path === href ? 'ng-nav__link--active' : ''
  }

  const listItems = links.map(l => `
    <li class="ng-nav__item">
      <a href="${l.href}" class="ng-nav__link ${isActive(l.href)}">${l.label}</a>
    </li>
  `).join('')

  const nav = document.createElement('nav')
  nav.className = 'ng-nav'
  nav.id = 'ngNav'
  nav.innerHTML = `
    <div class="ng-nav__inner">
      <a href="/index.html" class="ng-nav__logo">
        <img src="/images/logo/logo.jpg" alt="Will Abroad">
        <span>Will <em>Abroad</em></span>
      </a>
      <ul class="ng-nav__links" id="ngLinks">
        ${listItems}
        <li class="ng-nav__item">
          <a href="${ctaHref}" class="ng-nav__cta">${ctaLabel}</a>
        </li>
      </ul>
      <button class="ng-nav__burger" id="ngBurger" aria-label="Open menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  `
  document.body.prepend(nav)

  const burger = document.getElementById('ngBurger')
  const navLinks = document.getElementById('ngLinks')
  burger.addEventListener('click', () => {
    navLinks.classList.toggle('ng-nav__links--open')
  })

  let lastY = window.scrollY
  window.addEventListener('scroll', () => {
    const y = window.scrollY
    document.getElementById('ngNav').classList.toggle('ng-nav--hidden', y > lastY && y > 80)
    lastY = y
  }, { passive: true })

  const yr = document.getElementById('ngYear')
  if (yr) yr.textContent = new Date().getFullYear()
})()
