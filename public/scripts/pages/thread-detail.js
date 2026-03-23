// =====================
// thread-detail.js
// パス: /public/scripts/pages/thread-detail.js
// 使用: /public/student-japan/thread.html
// 用途: スレッド詳細ページ
// =====================

const path = window.location.pathname

if (path === '/student-japan/thread.html') {

  const params = new URLSearchParams(window.location.search)
  const threadId = params.get('id')
  let currentUserId = 0

  async function initUser() {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const user = await res.json()
        currentUserId = user.id || 0
      }
    } catch {}
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
    if (avatar && avatar.startsWith('http')) {
      return `<img src="${avatar}" class="thread__avatar-img" alt="${username}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    }
    return `<div class="thread__avatar-placeholder">${(username || '?').charAt(0).toUpperCase()}</div>`
  }

  async function renderThread() {
    if (!threadId) {
      document.getElementById('thread-detail').innerHTML = '<p class="thread__empty">スレッドが見つかりません</p>'
      return
    }

    const res = await fetch(`/api/threads/${threadId}`)
    const data = await res.json()

    document.getElementById('thread-detail').innerHTML = `
      <div class="thread__detail-card">
        <div class="thread__header">
          <div class="thread__user">
            <div class="thread__avatar">${getAvatar(data.username, data.avatar)}</div>
            <span class="thread__username">${data.username}</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <span class="thread__time">${timeAgo(data.created_at)}</span>
            <button class="thread__report-btn" onclick="reportThread(${data.id})">通報</button>
          </div>
        </div>
        <h1 class="thread__detail-title">${data.title}</h1>
        <p class="thread__detail-content">${data.content}</p>
        <div class="thread__footer" style="margin-top:16px;">
          <span class="thread__stat">💬 ${data.replies.length} 件の回答</span>
          <span class="thread__stat">👁 ${data.view_count}</span>
          <button class="thread__favorite-btn" id="favoriteBtn" onclick="toggleFavorite(${data.id})">
            ⭐ お気に入り
          </button>
        </div>
      </div>
    `

    const repliesSection = document.getElementById('replies-section')
    const repliesList    = document.getElementById('replies-list')
    const replyFormWrap  = document.getElementById('reply-form-wrap')
    repliesSection.style.display = 'block'
    replyFormWrap.style.display  = 'block'

    repliesList.innerHTML = data.replies.length
      ? data.replies.map(r => `
          <li class="reply__item">
            <div class="reply__header">
              <div class="thread__user">
                <div class="thread__avatar">${getAvatar(r.username, r.avatar)}</div>
                <span class="thread__username">${r.username}</span>
              </div>
              <div style="display:flex;align-items:center;gap:12px;">
                <span class="thread__time">${timeAgo(r.created_at)}</span>
                <button class="thread__report-btn" onclick="reportReply(${r.id})">通報</button>
              </div>
            </div>
            <p class="reply__content">${r.content}</p>
            <div class="reply__footer">
              <button class="reply__like-btn" onclick="likeReply(${r.id}, this)">
                👍 ${r.like_count}
              </button>
            </div>
          </li>
        `).join('')
      : '<li class="thread__empty">まだ回答がありません。最初に回答しましょう！</li>'

    // 回答ボタンのイベントを毎回上書き
    const replySubmit = document.getElementById('replySubmit')
    replySubmit.onclick = async () => {
      if (!currentUserId) {
        alert('回答するにはログインが必要です')
        window.location.href = '/student-japan/login.html'
        return
      }
      const content = document.getElementById('replyContent').value.trim()
      if (!content) return
      replySubmit.disabled = true
      replySubmit.textContent = '投稿中...'
      try {
        const res = await fetch(`/api/threads/${threadId}/replies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: currentUserId, content })
        })
        const data = await res.json()
        if (data.ok) {
          document.getElementById('replyContent').value = ''
          renderThread()
        }
      } finally {
        replySubmit.disabled = false
        replySubmit.textContent = '回答を投稿する'
      }
    }
  }

  window.likeReply = async (replyId, btn) => {
    if (!currentUserId) {
      alert('いいねするにはログインが必要です')
      window.location.href = '/student-japan/login.html'
      return
    }
    const res = await fetch(`/api/threads/replies/${replyId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUserId })
    })
    const data = await res.json()
    if (data.ok) {
      const current = parseInt(btn.textContent.replace('👍 ', ''))
      btn.textContent = `👍 ${current + 1}`
    }
  }

  window.toggleFavorite = async (id) => {
    if (!currentUserId) {
      alert('お気に入り登録にはログインが必要です')
      window.location.href = '/student-japan/login.html'
      return
    }
    const res = await fetch(`/api/threads/${id}/favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUserId })
    })
    const data = await res.json()
    const btn = document.getElementById('favoriteBtn')
    if (data.added) {
      btn.textContent = '⭐ お気に入り済み'
      btn.classList.add('thread__favorite-btn--active')
    }
  }

  window.reportThread = async (id) => {
    const reason = prompt('通報理由を入力してください（任意）')
    if (reason === null) return
    await fetch('/api/threads/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'thread', target_id: id, user_id: currentUserId, reason })
    })
    alert('通報しました。ご協力ありがとうございます。')
  }

  window.reportReply = async (id) => {
    const reason = prompt('通報理由を入力してください（任意）')
    if (reason === null) return
    await fetch('/api/threads/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'reply', target_id: id, user_id: currentUserId, reason })
    })
    alert('通報しました。ご協力ありがとうございます。')
  }

  async function init() {
    await initUser()
    renderThread()
  }

  init()
}