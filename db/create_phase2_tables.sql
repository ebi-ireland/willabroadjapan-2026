-- ユーザーテーブル拡張
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role ENUM('student','supporter','admin') DEFAULT 'student',
  ADD COLUMN IF NOT EXISTS status ENUM('active','suspended','banned','deleted') DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS nationality VARCHAR(100),
  ADD COLUMN IF NOT EXISTS target_country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS target_university VARCHAR(255),
  ADD COLUMN IF NOT EXISTS enrollment_year YEAR,
  ADD COLUMN IF NOT EXISTS last_login_at DATETIME;

-- エラーログテーブル
CREATE TABLE IF NOT EXISTS error_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  level ENUM('error','warn','info') NOT NULL DEFAULT 'error',
  message TEXT NOT NULL,
  stack TEXT,
  path VARCHAR(500),
  method VARCHAR(10),
  user_id INT,
  ip VARCHAR(45),
  user_agent VARCHAR(500),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_level (level),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- SEOメタテーブル
CREATE TABLE IF NOT EXISTS seo_meta (
  id INT AUTO_INCREMENT PRIMARY KEY,
  page_path VARCHAR(500) NOT NULL UNIQUE,
  title VARCHAR(200),
  description VARCHAR(500),
  og_title VARCHAR(200),
  og_description VARCHAR(500),
  og_image VARCHAR(500),
  canonical VARCHAR(500),
  robots VARCHAR(100) DEFAULT 'index, follow',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_page_path (page_path(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 学費シミュレーター用為替レートテーブル
CREATE TABLE IF NOT EXISTS exchange_rates (
  currency_code CHAR(3) PRIMARY KEY,
  rate_to_jpy DECIMAL(10,2) NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO exchange_rates (currency_code, rate_to_jpy) VALUES
  ('USD', 155.00), ('GBP', 198.00), ('AUD', 100.00),
  ('CAD', 112.00), ('EUR', 168.00), ('NZD', 93.00)
ON DUPLICATE KEY UPDATE rate_to_jpy = VALUES(rate_to_jpy);

-- ユーザー設定（レコメンド用）
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INT PRIMARY KEY,
  target_countries JSON,
  budget_jpy INT,
  major_interest VARCHAR(200),
  scholarship_need TINYINT(1) DEFAULT 0,
  gpa DECIMAL(3,2),
  toefl_score INT,
  ielts_score DECIMAL(3,1),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- レコメンド履歴
CREATE TABLE IF NOT EXISTS recommendation_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  college_ids JSON NOT NULL,
  score_snapshot JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 出願書類テンプレート
CREATE TABLE IF NOT EXISTS checklist_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category ENUM('required','recommended','optional') DEFAULT 'required',
  description TEXT,
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO checklist_templates (name, category, sort_order) VALUES
  ('成績証明書（高校）', 'required', 1),
  ('成績証明書（大学）', 'required', 2),
  ('英語スコア（TOEFL/IELTS）', 'required', 3),
  ('Common App / Coalition App 提出', 'required', 4),
  ('志望理由書（SOP）', 'required', 5),
  ('推薦状 1通目', 'required', 6),
  ('推薦状 2通目', 'required', 7),
  ('推薦状 3通目', 'optional', 8),
  ('財政証明書', 'required', 9),
  ('パスポートコピー', 'required', 10),
  ('履歴書（CV）', 'recommended', 11),
  ('エッセイ（各大学個別）', 'required', 12),
  ('SAT/ACTスコア', 'optional', 13),
  ('出願料支払い', 'required', 14);

-- ユーザー出願書類チェックリスト
CREATE TABLE IF NOT EXISTS user_checklists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  college_id INT,
  college_name VARCHAR(255),
  template_id INT,
  custom_name VARCHAR(200),
  status ENUM('not_started','in_progress','completed') DEFAULT 'not_started',
  note TEXT,
  due_date DATE,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_college (user_id, college_name(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ユーザー個人締め切り
CREATE TABLE IF NOT EXISTS user_deadlines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  deadline_date DATE NOT NULL,
  category ENUM('application','test','document','interview','other') DEFAULT 'application',
  college_name VARCHAR(255),
  url VARCHAR(500),
  note TEXT,
  reminder_days INT DEFAULT 7,
  is_done TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_deadline (user_id, deadline_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 公式締め切り（Admin管理）
CREATE TABLE IF NOT EXISTS official_deadlines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  deadline_date DATE NOT NULL,
  category ENUM('application','test','document','scholarship','other') DEFAULT 'application',
  description TEXT,
  url VARCHAR(500),
  target_country VARCHAR(100),
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_date (deadline_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
