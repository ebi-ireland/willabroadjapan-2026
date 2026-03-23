// =====================
// contact.js
// パス: /public/scripts/pages/contact.js
// 使用: /public/student-japan/contact.html
// 用途: お問い合わせページ
// =====================

const path = window.location.pathname

if (path === '/student-japan/contact.html') {

  document.getElementById('contactForm').addEventListener('submit', async function(e) {
    e.preventDefault()

    const btn = document.getElementById('contactSubmit')
    btn.disabled = true
    btn.textContent = '送信中...'

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    document.getElementById('name').value,
          email:   document.getElementById('email').value,
          job:     document.getElementById('job').value,
          title:   document.getElementById('title').value,
          message: document.getElementById('message').value,
        })
      })

      const data = await res.json()
      if (data.ok) {
        document.getElementById('formMsg').style.display = 'block'
        this.reset()
      }
    } catch (err) {
      console.error('送信エラー:', err)
    } finally {
      btn.disabled = false
      btn.textContent = '送信'
    }
  })
}