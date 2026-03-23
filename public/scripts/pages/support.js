// =====================
// support.js
// パス: /public/scripts/pages/support.js
// 使用: /public/student-japan/support.html
// 用途: サポート一覧ページ
// =====================

const path = window.location.pathname

if (path === '/student-japan/support.html') {

  async function renderSupport() {
    const res = await fetch('/api/support')
    const services = await res.json()

    // カテゴリでグループ化
    const grouped = {}
    services.forEach(s => {
      if (!grouped[s.category]) grouped[s.category] = []
      grouped[s.category].push(s)
    })

    document.getElementById('support-list').innerHTML = Object.entries(grouped).map(([category, items]) => `
      <div class="support__group">
        <h2 class="support__category">${category}</h2>
        <div class="support__grid">
          ${items.map(s => `
            <a href="${s.url || '#'}" target="_blank" class="support__card">
              <div class="support__icon">${s.icon}</div>
              <div class="support__content">
                <div class="support__title">${s.title}</div>
                <div class="support__desc">${s.description}</div>
              </div>
              <div class="support__arrow">→</div>
            </a>
          `).join('')}
        </div>
      </div>
    `).join('')
  }

  renderSupport()
}