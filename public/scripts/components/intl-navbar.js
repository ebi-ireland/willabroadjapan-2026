// =====================
// intl-navbar.js
// パス: /public/scripts/components/intl-navbar.js
// 使用: /public/international-student/ 以下の全ページ
// 用途: 日本在住留学生向けセクションのナビゲーションバー（英語）
// =====================

;(function () {
  const path = window.location.pathname

  const links = [
    { label: 'Home',  href: '/student-international.html' },
    { label: 'About', href: '/student-international/about.html' },
    {
      label: 'Scholarships',
      href: '#',
      group: [
        { label: 'University Scholarships',  href: '/student-international/scholarships.html#university' },
        { label: 'Japanese Foundations',     href: '/student-international/scholarships.html#foundation' },
      ]
    },
  ]

  function isActive(href) {
    const base = href.split('#')[0]
    return base !== '#' && (path === base || path.startsWith('/student-international/') && base.startsWith('/student-international/')) ? 'ng-nav__link--active' : ''
  }

  const listItems = links.map(l => {
    if (l.group) {
      return `
        <li class="ng-nav__item ng-nav__item--drop">
          <span class="ng-nav__link ng-nav__link--drop">${l.label} ▾</span>
          <ul class="ng-nav__drop">
            ${l.group.map(g => `
              <li><a href="${g.href}" class="ng-nav__drop-link">${g.label}</a></li>
            `).join('')}
          </ul>
        </li>`
    }
    return `
      <li class="ng-nav__item">
        <a href="${l.href}" class="ng-nav__link ${isActive(l.href)}">${l.label}</a>
      </li>`
  }).join('')

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
          <a href="/student-international/contact.html" class="ng-nav__cta">Contact</a>
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
