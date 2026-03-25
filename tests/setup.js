// =====================
// tests/setup.js
// 全テスト共通の環境変数・初期設定
// =====================

process.env.NODE_ENV       = 'test'
process.env.SESSION_SECRET = 'test_session_secret'
process.env.ADMIN_PASSWORD = 'test_admin_password'
process.env.DB_HOST        = 'localhost'
process.env.DB_USER        = 'test_user'
process.env.DB_PASSWORD    = 'test_password'
process.env.DB_NAME        = 'test_db'
process.env.BASE_URL       = 'http://localhost:3000'
process.env.DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/test'
