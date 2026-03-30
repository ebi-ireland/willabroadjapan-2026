// =====================
// article.js
// パス: /public/scripts/pages/article.js
// 使用: /public/student-japan/article.html
// 用途: 記事詳細ページ
// =====================

// パス判定ではなく要素の存在で判定（より確実）
const _articleContainer = document.getElementById('article-container')

if (_articleContainer) {

  const params = new URLSearchParams(window.location.search)
  const articleId = params.get('id')

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).replace(/\//g, '.')
  }

  async function renderArticle() {
    const container = _articleContainer

    if (!articleId) {
      container.innerHTML = `
        <div class="article-detail__error">
          <p class="articles__empty">記事IDが指定されていません</p>
          <a href="/student-japan/articles.html" class="article-detail__back">← 記事一覧に戻る</a>
        </div>
      `
      return
    }

    try {
      const res = await fetch(`/api/articles/${articleId}`)

      if (res.status === 404) {
        container.innerHTML = `
          <div class="article-detail__error">
            <p class="articles__empty">記事が見つかりませんでした</p>
            <a href="/student-japan/articles.html" class="article-detail__back">← 記事一覧に戻る</a>
          </div>
        `
        return
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const article = await res.json()

      // marked.js でMarkdownをHTMLに変換
      const bodyHtml = (window.marked && typeof window.marked.parse === 'function')
        ? window.marked.parse(article.content || '')
        : (article.content || '').replace(/\n/g, '<br>')

      // ページタイトルを更新
      document.title = `${article.title} | Will Abroad Japan`

      container.innerHTML = `
        <a href="/student-japan/articles.html" class="article-detail__back">← 記事一覧に戻る</a>
        <article class="article-detail__card">
          <header class="article-detail__header">
            <h1 class="article-detail__title">${article.title}</h1>
            <p class="article-detail__summary">${article.summary}</p>
            <div class="article-detail__meta">
              <span class="article-detail__date">📅 ${formatDate(article.updated_at)}</span>
            </div>
          </header>
          <hr class="article-detail__divider">
          <div class="article-detail__body markdown-body">
            ${bodyHtml}
          </div>
        </article>
        <a href="/student-japan/articles.html" class="article-detail__back article-detail__back--bottom">← 記事一覧に戻る</a>
      `
    } catch (err) {
      console.error('[article.js] renderArticle error:', err)
      container.innerHTML = `
        <div class="article-detail__error">
          <p class="articles__empty">記事の読み込みに失敗しました（${err.message}）</p>
          <a href="/student-japan/articles.html" class="article-detail__back">← 記事一覧に戻る</a>
        </div>
      `
    }
  }

  renderArticle()
}
