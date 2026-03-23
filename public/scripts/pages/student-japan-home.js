// =====================
// student-japan-home.js
// パス: /public/scripts/pages/student-japan-home.js
// 使用: /public/student-japan.html
// 用途: ホームページのランキング・お知らせセクション
// =====================

const path = window.location.pathname

if (path === '/student-japan.html') {

  let currentPeriod = 'week'

  // =====================
  // お知らせ
  // =====================
  async function renderNotices() {
    const res = await fetch('/api/notices/recent')
    const notices = await res.json()

    document.getElementById('notices-list').innerHTML = notices.map(n => {
      const date = new Date(n.published_at).toLocaleDateString('ja-JP', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).replace(/\//g, '.')
      return `
        <li class="notices__item">
          <span class="notices__date">${date}</span>
          <a href="/student-japan/notices.html" class="notices__text">${n.title}</a>
        </li>
      `
    }).join('')
  }

  // =====================
  // ランキング
  // =====================
  async function fetchRanking(endpoint, period) {
    const res = await fetch(`${endpoint}?period=${period}`)
    return await res.json()
  }

  function getNumLabel(i) {
    const medals = ['🥇', '🥈', '🥉']
    return i < 3
      ? `<span class="ranking__num ranking__num--top3">${medals[i]}</span>`
      : `<span class="ranking__num">${i + 1}</span>`
  }

  async function renderRankings(period) {
    const [univFav, univView, scholView, progView] = await Promise.all([
      fetchRanking('/api/ranking/universities/favorite', period),
      fetchRanking('/api/ranking/universities/view', period),
      fetchRanking('/api/ranking/scholarships/view', period),
      fetchRanking('/api/ranking/programs/view', period),
    ])

    document.getElementById('ranking-univ-fav').innerHTML = univFav.map((u, i) => `
      <li class="ranking__item">
        ${getNumLabel(i)}
        <span class="ranking__name">${u.name}</span>
        <span class="ranking__country">${u.country}</span>
        <span class="ranking__count">⭐ ${u.favorite_count}</span>
      </li>
    `).join('')

    document.getElementById('ranking-univ-view').innerHTML = univView.map((u, i) => `
      <li class="ranking__item">
        ${getNumLabel(i)}
        <span class="ranking__name">${u.name}</span>
        <span class="ranking__country">${u.country}</span>
        <span class="ranking__count">👁 ${u.view_count}</span>
      </li>
    `).join('')

    document.getElementById('ranking-schol-view').innerHTML = scholView.map((s, i) => `
      <li class="ranking__item">
        ${getNumLabel(i)}
        <span class="ranking__name">${s.name}</span>
        <span class="ranking__provider">${s.provider}</span>
        <span class="ranking__count">👁 ${s.view_count}</span>
      </li>
    `).join('')

    document.getElementById('ranking-prog-view').innerHTML = progView.map((p, i) => `
      <li class="ranking__item">
        ${getNumLabel(i)}
        <span class="ranking__name">${p.name}</span>
        <span class="ranking__count">👁 ${p.view_count}</span>
      </li>
    `).join('')
  }

  // タブ切り替え
  function initTabs() {
    const tabs = document.querySelectorAll('.ranking__tab')
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('ranking__tab--active'))
        tab.classList.add('ranking__tab--active')
        currentPeriod = tab.dataset.period
        renderRankings(currentPeriod)
      })
    })
  }

  renderNotices()
  initTabs()
  renderRankings(currentPeriod)
}