// =====================
// articles.js
// パス: /public/scripts/pages/articles.js
// 使用: /public/student-japan/articles.html
// 用途: 記事一覧ページ
// =====================

const path = window.location.pathname

if (path === '/student-japan/articles.html') {

  let currentPage = 1
  let currentSearch = ''

  async function fetchArticles(page, search) {
    const res = await fetch(`/api/articles?page=${page}&search=${encodeURIComponent(search)}`)
    return await res.json()
  }

  async function renderArticles() {
    const data = await fetchArticles(currentPage, currentSearch)
    const totalPages = Math.ceil(data.total / data.limit)

    // 記事一覧
    document.getElementById('articles-list').innerHTML = data.articles.length
      ? data.articles.map(a => {
          const date = new Date(a.updated_at).toLocaleDateString('ja-JP', {
            year: 'numeric', month: '2-digit', day: '2-digit'
          }).replace(/\//g, '.')
          return `
            <li class="articles__item">
              <a href="/student-japan/article.html?id=${a.id}" class="articles__link">
                <div class="articles__title">${a.title}</div>
                <div class="articles__summary">${a.summary}</div>
                <div class="articles__meta">最終更新: ${date}</div>
              </a>
            </li>
          `
        }).join('')
      : '<li class="articles__empty">記事が見つかりませんでした</li>'

    // ページネーション
    document.getElementById('articles-pagination').innerHTML = totalPages > 1 ? `
      <div class="pagination">
        <button class="pagination__btn ${currentPage === 1 ? 'pagination__btn--disabled' : ''}" id="articles-prev" ${currentPage === 1 ? 'disabled' : ''}>← 前へ</button>
        <span class="pagination__info">${currentPage} / ${totalPages}</span>
        <button class="pagination__btn ${currentPage === totalPages ? 'pagination__btn--disabled' : ''}" id="articles-next" ${currentPage === totalPages ? 'disabled' : ''}>次へ →</button>
      </div>
    ` : ''

    if (currentPage > 1) {
      document.getElementById('articles-prev')?.addEventListener('click', () => {
        currentPage--
        renderArticles()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
    }

    if (currentPage < totalPages) {
      document.getElementById('articles-next')?.addEventListener('click', () => {
        currentPage++
        renderArticles()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
    }
  }

  // 検索
  function initSearch() {
    const input = document.getElementById('articles-search')
    const btn = document.getElementById('articles-search-btn')

    btn.addEventListener('click', () => {
      currentSearch = input.value.trim()
      currentPage = 1
      renderArticles()
    })

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        currentSearch = input.value.trim()
        currentPage = 1
        renderArticles()
      }
    })
  }

  initSearch()
  renderArticles()
}