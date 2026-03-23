// =====================
// navbar.js
// パス: /public/scripts/components/navbar.js
// 使用: /public/student-japan.html・/public/student-japan/ 以下の全ページ
// 用途: ナビゲーションバーの生成・制御
// =====================

const path = window.location.pathname
const isStudentJapan = path === '/student-japan.html' || path.startsWith('/student-japan/')

if (isStudentJapan) {
  const navLinks = [
    { label: '🏠 ホーム',       href: '/student-japan.html' },
    { label: '🎓 奨学金',       href: '#', group: [
      { label: '🏫 大学奨学金',  href: '/student-japan/scholarship.html' },
      { label: '🏛️ 財団奨学金',  href: '/student-japan/foundation.html' },
      { label: '🎯 プログラム',  href: '/student-japan/program.html' },
    ]},
    { label: '📊 大学合格診断', href: '/student-japan/diagnosis.html' },
    { label: '📰 記事',         href: '/student-japan/articles.html' },
    { label: '✈️ 留学体験記',   href: '/student-japan/experiences.html' },
    { label: '🤝 サポート',     href: '/student-japan/support.html' },
    { label: '💬 スレッド',     href: '/student-japan/threads.html' },
  ]

  async function fetchUser() {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }

  async function createNavbar() {
    const user = await fetchUser()

    const listItems = navLinks.map(link => {
      if (link.group) {
        return `
          <li class="navbar__item navbar__item--group">
            <span class="navbar__link navbar__link--group">${link.label} ▾</span>
            <ul class="navbar__group">
              ${link.group.map(g => `
                <li><a href="${g.href}" class="navbar__group-link">${g.label}</a></li>
              `).join('')}
            </ul>
          </li>`
      }
      return `
        <li class="navbar__item">
          <a href="${link.href}" class="navbar__link">${link.label}</a>
        </li>`
    }).join('')

    const avatarHtml = user
      ? (user.avatar && user.avatar.startsWith('http'))
        ? `<img src="${user.avatar}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;" alt="${user.username}">`
        : `<div class="navbar__user-avatar">${user.username.charAt(0).toUpperCase()}</div>`
      : ''

    const authHtml = user
      ? `<div class="navbar__user" id="navUser">
           ${avatarHtml}
           <span class="navbar__user-name">${user.username}</span>
           <ul class="navbar__user-menu">
             <li><a href="/student-japan/profile.html" class="navbar__user-menu-link">👤 プロフィール</a></li>
             <li><button class="navbar__user-menu-link navbar__logout-btn" id="navLogoutBtn">ログアウト</button></li>
           </ul>
         </div>`
      : `<a href="/student-japan/login.html" class="navbar__login">ログイン</a>`

    const navbar = document.createElement('nav')
    navbar.className = 'navbar'
    navbar.innerHTML = `
      <div class="navbar__inner">
        <a href="/" class="navbar__logo">
          <img src="/images/logo/logo" alt="Will Abroad" width="40" height="40">
        </a>
        <div class="navbar__right">
          <a href="/student-japan/contact.html" class="navbar__contact">📩 お問い合わせ</a>
          ${authHtml}
          <button class="navbar__burger" id="navBurger" aria-label="メニューを開く">
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>
      <div class="navbar__menu" id="navMenu">
        <ul class="navbar__list">
          ${listItems}
        </ul>
      </div>
    `
    document.body.prepend(navbar)

    if (user) {
      document.getElementById('navLogoutBtn')?.addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        window.location.href = '/student-japan/login.html'
      })
    }

    initBurger()
    initScrollBehavior()
  }

  function initBurger() {
    const burger = document.getElementById('navBurger')
    const menu = document.getElementById('navMenu')
    burger?.addEventListener('click', () => {
      const isOpen = menu.classList.toggle('navbar__menu--open')
      burger.setAttribute('aria-expanded', isOpen)
    })
  }

  function initScrollBehavior() {
    let lastY = window.scrollY
    const navbar = document.querySelector('.navbar')
    window.addEventListener('scroll', () => {
      const currentY = window.scrollY
      if (currentY < lastY) {
        navbar.classList.remove('navbar--hidden')
      } else if (currentY > 60) {
        navbar.classList.add('navbar--hidden')
      }
      lastY = currentY
    })
  }

  createNavbar()
}