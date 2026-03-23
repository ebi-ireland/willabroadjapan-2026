// =====================
// experience-detail.js
// パス: /public/scripts/pages/experience-detail.js
// 使用: /public/student-japan/experience.html
// 用途: 留学体験記詳細ページ
// =====================

const path = window.location.pathname

if (path === '/student-japan/experience.html') {

  const params = new URLSearchParams(window.location.search)
  const experienceId = params.get('id')
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

  function renderStars(rating) {
    return '★'.repeat(rating) + '☆'.repeat(10 - rating)
  }

  async function renderExperience() {
    if (!experienceId) {
      document.getElementById('experience-detail').innerHTML = '<p class="thread__empty">体験記が見つかりません</p>'
      return
    }

    const res = await fetch(`/api/experiences/${experienceId}`)
    const e = await res.json()

    document.getElementById('experience-detail').innerHTML = `
      <div class="exp-detail__card">
        <div class="exp-detail__header">
          <div class="experience__tags">
            <span class="experience__tag experience__tag--country">🌏 ${e.country}</span>
            <span class="experience__tag experience__tag--univ">🏫 ${e.university}</span>
            ${e.major !== '匿名' ? `<span class="experience__tag">📚 ${e.major}</span>` : ''}
          </div>
          <button class="thread__report-btn" onclick="reportExperience(${e.id})">通報</button>
        </div>
        <div class="exp-detail__rating">
          <span class="exp-detail__stars">${renderStars(e.rating)}</span>
          <span class="exp-detail__rating-num">${e.rating} / 10</span>
        </div>
        <div class="exp-detail__author">✏️ ${e.author_name} ・ ${new Date(e.created_at).toLocaleDateString('ja-JP')}</div>
        <div class="exp-detail__section">
          <h2 class="exp-detail__section-title">📝 要約</h2>
          <p class="exp-detail__text">${e.summary}</p>
        </div>
        ${e.good ? `
        <div class="exp-detail__section exp-detail__section--good">
          <h2 class="exp-detail__section-title">✅ 大学の良かったこと</h2>
          <p class="exp-detail__text">${e.good}</p>
        </div>` : ''}
        ${e.bad ? `
        <div class="exp-detail__section exp-detail__section--bad">
          <h2 class="exp-detail__section-title">❌ 大学の悪かったこと</h2>
          <p class="exp-detail__text">${e.bad}</p>
        </div>` : ''}
        ${e.fun ? `
        <div class="exp-detail__section exp-detail__section--fun">
          <h2 class="exp-detail__section-title">🎉 大学生活で楽しかったこと</h2>
          <p class="exp-detail__text">${e.fun}</p>
        </div>` : ''}
        <div class="exp-detail__footer">
          <button class="exp-detail__like-btn" id="likeBtn" onclick="likeExperience(${e.id})">
            👍 ${e.like_count} いいね
          </button>
        </div>
      </div>
    `
  }

  window.likeExperience = async (id) => {
    if (!currentUserId) {
      alert('いいねするにはログインが必要です')
      window.location.href = '/student-japan/login.html'
      return
    }
    const res = await fetch(`/api/experiences/${id}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUserId })
    })
    const data = await res.json()
    if (data.added) {
      const btn = document.getElementById('likeBtn')
      const current = parseInt(btn.textContent.replace('👍 ', '').replace(' いいね', ''))
      btn.textContent = `👍 ${current + 1} いいね`
      btn.classList.add('exp-detail__like-btn--active')
    }
  }

  window.reportExperience = async (id) => {
    const reason = prompt('通報理由を入力してください（任意）')
    if (reason === null) return
    await fetch(`/api/experiences/${id}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUserId, reason })
    })
    alert('通報しました。ご協力ありがとうございます。')
  }

  async function init() {
    await initUser()
    renderExperience()
  }

  init()
}