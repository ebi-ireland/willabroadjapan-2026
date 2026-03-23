// =====================
// program.js
// パス: /public/scripts/pages/program.js
// 使用: /public/student-japan/program.html
// 用途: プログラム奨学金ページ
// =====================

const path = window.location.pathname

if (path === '/student-japan/program.html') {

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
          <div class="scholarship__card-row"><span class="scholarship__card-label">🏢 スポンサー</span><span class="scholarship__card-value">${s.sponsor || 'なし'}</span></div>
          <div class="scholarship__card-row"><span class="scholarship__card-label">🌏 実施国</span><span class="scholarship__card-value">${s.country || 'なし'}</span></div>
          <div class="scholarship__card-row"><span class="scholarship__card-label">📅 開催期間</span><span class="scholarship__card-value">${formatDate(s.start_date)} 〜 ${formatDate(s.end_date)}</span></div>
          <div class="scholarship__card-row"><span class="scholarship__card-label">⏰ 応募締切</span><span class="scholarship__card-value">${formatDate(s.application_deadline)}</span></div>
          <div class="scholarship__card-row"><span class="scholarship__card-label">💡 内容</span><span class="scholarship__card-value">${s.content || 'なし'}</span></div>
          ${s.requirements ? `<div class="scholarship__card-row"><span class="scholarship__card-label">📋 条件</span><span class="scholarship__card-value">${s.requirements}</span></div>` : ''}
          ${s.target ? `<div class="scholarship__card-tags">${s.target.split(',').map(t => `<span class="scholarship__card-tag">${t.trim()}</span>`).join('')}</div>` : ''}
        </div>
      </a>`
  }

  function renderCards(data) {
    const active   = data.filter(s => s.status === 'active')
    const upcoming = data.filter(s => s.status === 'upcoming')
    const closed   = data.filter(s => s.status === 'closed')
    document.getElementById('program-active-count').textContent   = `${active.length}件`
    document.getElementById('program-upcoming-count').textContent = `${upcoming.length}件`
    document.getElementById('program-closed-count').textContent   = `${closed.length}件`
    document.getElementById('program-active').innerHTML   = active.length   ? active.map(renderCard).join('')   : '<p class="scholarship__empty">該当する奨学金はありません</p>'
    document.getElementById('program-upcoming').innerHTML = upcoming.length ? upcoming.map(renderCard).join('') : '<p class="scholarship__empty">該当する奨学金はありません</p>'
    document.getElementById('program-closed').innerHTML   = closed.length   ? closed.map(renderCard).join('')   : '<p class="scholarship__empty">該当する奨学金はありません</p>'
  }

  let search = '', target = ''

  async function fetchData() {
    const res = await fetch(`/api/scholarships/program?search=${encodeURIComponent(search)}&target=${encodeURIComponent(target)}`)
    renderCards(await res.json())
  }

  document.getElementById('program-search-btn').addEventListener('click', () => {
    search = document.getElementById('program-search').value.trim()
    fetchData()
  })
  document.getElementById('program-search').addEventListener('keydown', e => {
    if (e.key === 'Enter') { search = document.getElementById('program-search').value.trim(); fetchData() }
  })
  document.querySelectorAll('#program-target-filter .scholarship__target-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#program-target-filter .scholarship__target-btn').forEach(b => b.classList.remove('scholarship__target-btn--active'))
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