// =====================
// foundation.js
// パス: /public/scripts/pages/foundation.js
// 使用: /public/student-japan/foundation.html
// 用途: 財団奨学金ページ
// =====================

const path = window.location.pathname

if (path === '/student-japan/foundation.html') {

  function formatDate(dateStr) {
    if (!dateStr) return 'なし'
    const d = new Date(dateStr)
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  }

  function renderCard(s) {
    return `
      <a href="${s.url || '#'}" target="_blank" class="scholarship__card">
        <div class="scholarship__card-header">
          <div class="scholarship__card-name">${s.name}</div>
          <span class="scholarship__card-status scholarship__card-status--${s.status}">${s.status === 'active' ? '応募中' : s.status === 'upcoming' ? 'もうすぐ' : '終了'}</span>
        </div>
        <div class="scholarship__card-body">
          <div class="scholarship__card-row"><span class="scholarship__card-label">💰 支給額</span><span class="scholarship__card-value">${s.amount || 'なし'}</span></div>
          <div class="scholarship__card-row"><span class="scholarship__card-label">👥 採用人数</span><span class="scholarship__card-value">${s.num_recipients || 'なし'}</span></div>
          <div class="scholarship__card-row"><span class="scholarship__card-label">📅 締切日</span><span class="scholarship__card-value">${formatDate(s.deadline)}</span></div>
          <div class="scholarship__card-row"><span class="scholarship__card-label">⏱ 支給年数</span><span class="scholarship__card-value">${s.duration || 'なし'}</span></div>
          <div class="scholarship__card-row"><span class="scholarship__card-label">🌏 対象国</span><span class="scholarship__card-value">${s.target_countries || 'なし'}</span></div>
          <div class="scholarship__card-row"><span class="scholarship__card-label">🗣 語学条件</span><span class="scholarship__card-value">${s.language_requirement || 'なし'}</span></div>
          ${s.other_requirements ? `<div class="scholarship__card-row"><span class="scholarship__card-label">📋 その他条件</span><span class="scholarship__card-value">${s.other_requirements}</span></div>` : ''}
          ${s.target ? `<div class="scholarship__card-tags">${s.target.split(',').map(t => `<span class="scholarship__card-tag">${t.trim()}</span>`).join('')}</div>` : ''}
        </div>
      </a>`
  }

  function renderCards(data) {
    const active   = data.filter(s => s.status === 'active')
    const upcoming = data.filter(s => s.status === 'upcoming')
    const closed   = data.filter(s => s.status === 'closed')
    document.getElementById('foundation-active-count').textContent   = `${active.length}件`
    document.getElementById('foundation-upcoming-count').textContent = `${upcoming.length}件`
    document.getElementById('foundation-closed-count').textContent   = `${closed.length}件`
    document.getElementById('foundation-active').innerHTML   = active.length   ? active.map(renderCard).join('')   : '<p class="scholarship__empty">該当する奨学金はありません</p>'
    document.getElementById('foundation-upcoming').innerHTML = upcoming.length ? upcoming.map(renderCard).join('') : '<p class="scholarship__empty">該当する奨学金はありません</p>'
    document.getElementById('foundation-closed').innerHTML   = closed.length   ? closed.map(renderCard).join('')   : '<p class="scholarship__empty">該当する奨学金はありません</p>'
  }

  let search = '', target = ''

  async function fetchData() {
    const res = await fetch(`/api/scholarships/foundation?search=${encodeURIComponent(search)}&target=${encodeURIComponent(target)}`)
    renderCards(await res.json())
  }

  document.getElementById('foundation-search-btn').addEventListener('click', () => {
    search = document.getElementById('foundation-search').value.trim()
    fetchData()
  })
  document.getElementById('foundation-search').addEventListener('keydown', e => {
    if (e.key === 'Enter') { search = document.getElementById('foundation-search').value.trim(); fetchData() }
  })
  document.querySelectorAll('#foundation-target-filter .scholarship__target-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#foundation-target-filter .scholarship__target-btn').forEach(b => b.classList.remove('scholarship__target-btn--active'))
      btn.classList.add('scholarship__target-btn--active')
      target = btn.dataset.target
      fetchData()
    })
  })

  // TOPボタン
  const scrollTopBtn = document.getElementById('scrollTopBtn')
  window.addEventListener('scroll', () => {
    scrollTopBtn.classList.toggle('visible', window.scrollY > 300)
  })

  fetchData()
}