// =====================
// template.js
// パス: /public/scripts/pages/template.js
// 使用: /public/student-japan/support/template.html
// 用途: テンプレート一覧ページ
// =====================

const path = window.location.pathname

if (path === '/student-japan/support/template.html') {

  function getFileIcon(fileType) {
    switch (fileType?.toLowerCase()) {
      case 'word':          return '📝'
      case 'excel':         return '📊'
      case 'pdf':           return '📕'
      case 'google docs':   return '📝'
      case 'google sheets': return '📊'
      case 'google slides': return '📽️'
      default:              return '📄'
    }
  }

  function getFileLabel(fileType) {
    switch (fileType?.toLowerCase()) {
      case 'word':          return 'Word'
      case 'excel':         return 'Excel'
      case 'pdf':           return 'PDF'
      case 'google docs':   return 'Google Docs'
      case 'google sheets': return 'Google Sheets'
      case 'google slides': return 'Google Slides'
      default:              return 'ファイル'
    }
  }

  async function renderTemplates() {
    const res = await fetch('/api/templates')
    const templates = await res.json()

    document.getElementById('template-list').innerHTML = templates.length
      ? templates.map(t => `
          <a href="${t.file_url}" target="_blank" class="support__card">
            <div class="support__icon">${getFileIcon(t.file_type)}</div>
            <div class="support__content">
              <div class="support__title">${t.title}</div>
              <div class="support__desc">${t.description}</div>
              <div class="template__badge">${getFileLabel(t.file_type)}</div>
            </div>
            <div class="support__arrow">↓</div>
          </a>
        `).join('')
      : '<p style="color: var(--color-text-faint);">テンプレートがありません</p>'
  }

  renderTemplates()
}