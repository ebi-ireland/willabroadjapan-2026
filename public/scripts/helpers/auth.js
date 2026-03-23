// =====================
// auth.js
// パス: /public/scripts/helpers/auth.js
// 用途: ログインユーザー情報の取得
// =====================

let _currentUser = null

export async function getCurrentUser() {
  if (_currentUser !== null) return _currentUser
  try {
    const res = await fetch('/api/auth/me')
    if (!res.ok) { _currentUser = null; return null }
    _currentUser = await res.json()
    return _currentUser
  } catch {
    _currentUser = null
    return null
  }
}