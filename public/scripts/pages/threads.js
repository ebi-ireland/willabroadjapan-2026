// =====================
// threads.js
// パス: /public/scripts/pages/threads.js
// 使用: /public/student-japan/threads.html
// 用途: スレッド一覧ページ
// =====================

const path = window.location.pathname

if (path === '/student-japan/threads.html') {

  let currentPage = 1
  let currentSearch = ''
  let currentUserId = 0

  // ログイン確認
  async function initUser() {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const user = await res.json()
        currentUserId = user.id || 0
      }
    } catch {}
  }

  async function fetchThreads(page, search) {
    const res = await fetch(`/api/threads?page=${page}&search=${encodeURIComponent(search)}&user_id=${currentUserId}`)
    return await res.json()
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const min  = Math.floor(diff / 60000)
    const hour = Math.floor(diff / 3600000)
    const day  = Math.floor(diff / 86400000)
    if (min < 1)   return 'たった今'
    if (min < 60)  return `${min}分前`
    if (hour < 24) return `${hour}時間前`
    return `${day}日前`
  }

  function getAvatar(username, avatar) {
    if (avatar) return `<img src="${avatar}" class="thread__avatar-img" alt="${username}">`
    return `<div class="thread__avatar-placeholder">${username.charAt(0)}</div>`
  }

  async function renderThreads() {
    const data = await fetchThreads(currentPage, currentSearch)
    const totalPages = Math.ceil(data.total / data.limit)

    document.getElementById('threads-list').innerHTML = data.threads.length
      ? data.threads.map(t => `
          <li class="thread__item ${t.is_mine ? 'thread__item--mine' : ''}">
            <a href="/student-japan/thread.html?id=${t.id}" class="thread__link">
              <div class="thread__header">
                <div class="thread__user">
                  <div class="thread__avatar">${getAvatar(t.username, t.avatar)}</div>
                  <span class="thread__username">${t.username}</span>
                  ${t.is_mine ? '<span class="thread__mine-badge">自分の投稿</span>' : ''}
                </div>
                <span class="thread__time">${timeAgo(t.created_at)}</span>
              </div>
              <div class="thread__title">${t.title}</div>
              <div class="thread__preview">${t.content.length > 80 ? t.content.slice(0, 80) + '...' : t.content}</div>
              <div class="thread__footer">
                <span class="thread__stat">💬 ${t.reply_count} 件の回答</span>
                <span class="thread__stat">👁 ${t.view_count}</span>
              </div>
            </a>
          </li>
        `).join('')
      : '<li class="thread__empty">スレッドが見つかりませんでした</li>'

    document.getElementById('threads-pagination').innerHTML = totalPages > 1 ? `
      <div class="pagination">
        <button class="pagination__btn ${currentPage === 1 ? 'pagination__btn--disabled' : ''}" id="threads-prev" ${currentPage === 1 ? 'disabled' : ''}>← 前へ</button>
        <span class="pagination__info">${currentPage} / ${totalPages}</span>
        <button class="pagination__btn ${currentPage === totalPages ? 'pagination__btn--disabled' : ''}" id="threads-next" ${currentPage === totalPages ? 'disabled' : ''}>次へ →</button>
      </div>
    ` : ''

    if (currentPage > 1) {
      document.getElementById('threads-prev')?.addEventListener('click', () => {
        currentPage--
        renderThreads()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
    }
    if (currentPage < totalPages) {
      document.getElementById('threads-next')?.addEventListener('click', () => {
        currentPage++
        renderThreads()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
    }
  }

  function initSearch() {
    const input = document.getElementById('threads-search')
    const btn   = document.getElementById('threads-search-btn')
    btn.addEventListener('click', () => {
      currentSearch = input.value.trim()
      currentPage = 1
      renderThreads()
    })
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        currentSearch = input.value.trim()
        currentPage = 1
        renderThreads()
      }
    })
  }

  function initModal() {
    const postBtn   = document.getElementById('postBtn')
    const modal     = document.getElementById('postModal')
    const overlay   = document.getElementById('modalOverlay')
    const closeBtn  = document.getElementById('modalClose')
    const submitBtn = document.getElementById('postSubmit')

    postBtn.addEventListener('click', () => {
      if (!currentUserId) {
        alert('投稿するにはログインが必要です')
        window.location.href = '/student-japan/login.html'
        return
      }
      modal.style.display = 'flex'
      document.body.style.overflow = 'hidden'
    })

    function closeModal() {
      modal.style.display = 'none'
      document.body.style.overflow = ''
    }

    overlay.addEventListener('click', closeModal)
    closeBtn.addEventListener('click', closeModal)
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal()
    })

    submitBtn.addEventListener('click', async () => {
      const title   = document.getElementById('postTitle').value.trim()
      const content = document.getElementById('postContent').value.trim()
      if (!title || !content) { alert('タイトルと内容を入力してください'); return }
      submitBtn.disabled = true
      submitBtn.textContent = '投稿中...'
      try {
        const res = await fetch('/api/threads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: currentUserId, title, content })
        })
        const data = await res.json()
        if (data.ok) {
          closeModal()
          document.getElementById('postTitle').value = ''
          document.getElementById('postContent').value = ''
          renderThreads()
        }
      } catch (err) {
        console.error('投稿エラー:', err)
      } finally {
        submitBtn.disabled = false
        submitBtn.textContent = '投稿する'
      }
    })
  }

  async function init() {
    await initUser()
    initSearch()
    initModal()
    renderThreads()
  }

  init()
}