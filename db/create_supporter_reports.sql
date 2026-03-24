USE willabroadjapan;

CREATE TABLE IF NOT EXISTS supporter_reports (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  type       ENUM('activity','finance') NOT NULL,
  title      VARCHAR(255) NOT NULL,
  date_label VARCHAR(100),
  file_url   VARCHAR(500) NOT NULL,
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 既存データを移行（現在のsupporter.htmlの内容）
INSERT INTO supporter_reports (type, title, date_label, file_url, sort_order) VALUES
('activity', '2025年度 計画書',        '2025年公開',      '/document/activity/2025-plan.pdf', 100),
('activity', '2025年 上半期 活動報告', '2025年7月公開予定', '/document/activity/2025-1h.pdf',   90),
('activity', '2024年 下半期 活動報告', '2025年2月公開',   '/document/activity/2024-2h.pdf',   80),
('activity', '2024年 上半期 活動報告', '2024年8月公開',   '/document/activity/2024-1h.pdf',   70),
('finance',  '2025年 上半期 収支報告', '2025年7月公開予定', '/document/finance/2025-1h.pdf',    90),
('finance',  '2024年 年間 財務報告',   '2025年3月公開',   '/document/finance/2024-annual.pdf', 80);
