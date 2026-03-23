// =====================
// title.js
// パス: /public/scripts/helpers/title.js
// 使用: 全ページ
// 用途: ページタイトルを自動設定
// =====================

const titles = {
  '/':                               'Scholarship Portal',
  '/index.html':                     'Scholarship Portal',
  '/student-japan.html':             'ホーム',
  '/student-japan/scholarship.html': '奨学金検索',
  '/student-japan/foundation.html': '財団奨学金',
  '/student-japan/program.html':    'プログラム奨学金',
  '/student-japan/diagnosis.html':   '大学合格診断',
  '/student-japan/articles.html':    '記事',
  '/student-japan/experiences.html': '留学体験記',
  '/student-japan/support.html':     'サポート一覧',
  '/student-japan/support/waprogram.html': 'WAプログラム',
  '/student-japan/support/tutor.html':     '進学サポート',
  '/student-japan/support/template.html':  'テンプレート',
  '/student-japan/profile.html':     'プロフィール',
  '/student-japan/threads.html':     'スレッド',
  '/student-japan/thread.html': 'スレッド詳細',
  '/student-japan/login.html':       'ログイン',
  '/student-japan/privacy.html':     'プライバシーポリシー',
  '/student-japan/contact.html':     'お問い合わせ',
  '/student-japan/notices.html':     'お知らせ一覧',
}

const path = window.location.pathname
document.title = (titles[path] ?? 'Will Abroad') + ' | Will Abroad Scholarship Portal'