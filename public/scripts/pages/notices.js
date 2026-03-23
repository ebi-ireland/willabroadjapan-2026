// =====================
// notices.js
// パス: /public/scripts/pages/notices.js
// 使用: /public/student-japan/notices.html
// 用途: お知らせ一覧ページ
// =====================

const path = window.location.pathname

if (path === '/student-japan/notices.html') {

  let currentPage = 1

  async function fetchNotices(page) {
    const res = await fetch(`/api/notices?page=${page}`)
    return await res.json()
  }

  async function renderNotices(page) {
    const data = await fetchNotices(page)
    const totalPages = Math.ceil(data.total / data.limit)

    document.getElementById('notices-list').innerHTML = data.notices.map(n => {
      const date = new Date(n.published_at).toLocaleDateString('ja-JP', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).replace(/\//g, '.')
      return `
        <li class="notices__item">
          <span class="notices__date">${date}</span>
          <span class="notices__text">${n.title}</span>
        </li>
      `
    }).join('')

    // ページネーション
    document.getElementById('pagination').innerHTML = `
      <div class="pagination">
        ${page > 1
          ? `<button class="pagination__btn" id="prev">← 前へ</button>`
          : `<button class="pagination__btn pagination__btn--disabled" disabled>← 前へ</button>`
        }
        <span class="pagination__info">${page} / ${totalPages}</span>
        ${page < totalPages
          ? `<button class="pagination__btn" id="next">次へ →</button>`
          : `<button class="pagination__btn pagination__btn--disabled" disabled>次へ →</button>`
        }
      </div>
    `

    if (page > 1) {
      document.getElementById('prev').addEventListener('click', () => {
        currentPage--
        renderNotices(currentPage)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
    }

    if (page < totalPages) {
      document.getElementById('next').addEventListener('click', () => {
        currentPage++
        renderNotices(currentPage)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
    }
  }

  renderNotices(currentPage)
}