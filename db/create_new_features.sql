USE willabroadjapan;

-- ── 日本人学生向け 大学独自奨学金 ──────────────────────────
CREATE TABLE IF NOT EXISTS university_own_scholarships (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  university_name  VARCHAR(255) NOT NULL,
  name             VARCHAR(255) NOT NULL,
  url              VARCHAR(500),
  deadline         VARCHAR(100),
  amount           VARCHAR(100),
  num_recipients   VARCHAR(100),
  target_country   VARCHAR(255),
  duration         VARCHAR(100),
  conditions       TEXT,
  target           VARCHAR(100),
  status           VARCHAR(20) DEFAULT 'active',
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── 診断 スコアリング ───────────────────────────────────────
-- item_type: 'gpa','sat','act','toefl','ielts','duolingo' → min/max/pts を使用
--            'classrank' → key_val/pts を使用
CREATE TABLE IF NOT EXISTS diagnosis_scoring (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  item_type VARCHAR(20) NOT NULL,
  min_val   DECIMAL(8,2),
  max_val   DECIMAL(8,2),
  key_val   VARCHAR(20),
  pts       INT NOT NULL,
  sort_order INT DEFAULT 0
);

INSERT INTO diagnosis_scoring (item_type, min_val, max_val, pts, sort_order) VALUES
('gpa',4.0,4.0,5000,1),('gpa',3.9,3.99,4600,2),('gpa',3.8,3.89,4200,3),
('gpa',3.7,3.79,3800,4),('gpa',3.6,3.69,3400,5),('gpa',3.5,3.59,3000,6),
('gpa',3.4,3.49,2600,7),('gpa',3.3,3.39,2200,8),('gpa',3.0,3.29,1800,9),('gpa',0,2.99,1000,10),
('sat',1550,1600,5000,1),('sat',1500,1549,4500,2),('sat',1450,1499,4000,3),
('sat',1400,1449,3500,4),('sat',1350,1399,3000,5),('sat',1300,1349,2500,6),
('sat',1200,1299,2000,7),('sat',1100,1199,1400,8),('sat',0,1099,800,9),
('act',35,36,5000,1),('act',33,34,4500,2),('act',31,32,4000,3),
('act',29,30,3500,4),('act',27,28,3000,5),('act',25,26,2500,6),
('act',23,24,2000,7),('act',20,22,1400,8),('act',0,19,800,9),
('toefl',115,120,4000,1),('toefl',110,114,3500,2),('toefl',105,109,3000,3),
('toefl',100,104,2500,4),('toefl',90,99,2000,5),('toefl',80,89,1500,6),
('toefl',70,79,1000,7),('toefl',0,69,500,8),
('ielts',8.5,9.0,4000,1),('ielts',8.0,8.4,3500,2),('ielts',7.5,7.9,3000,3),
('ielts',7.0,7.4,2500,4),('ielts',6.5,6.9,2000,5),('ielts',6.0,6.4,1500,6),
('ielts',5.5,5.9,1000,7),('ielts',0,5.4,500,8),
('duolingo',145,160,4000,1),('duolingo',130,144,3500,2),('duolingo',120,129,3000,3),
('duolingo',110,119,2500,4),('duolingo',100,109,2000,5),('duolingo',90,99,1500,6),
('duolingo',80,89,1000,7),('duolingo',0,79,500,8);

INSERT INTO diagnosis_scoring (item_type, key_val, pts, sort_order) VALUES
('classrank','cr_5',2000,1),('classrank','cr_10',1700,2),('classrank','cr_20',1400,3),
('classrank','cr_30',1100,4),('classrank','cr_50',700,5),
('classrank','cr_lo',300,6),('classrank','cr_na',0,7);

-- ── 診断 全体設定 ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diagnosis_config (
  cfg_key   VARCHAR(50) PRIMARY KEY,
  cfg_val   VARCHAR(200) NOT NULL,
  label     VARCHAR(100)
);

INSERT INTO diagnosis_config (cfg_key, cfg_val, label) VALUES
('pass_threshold',  '90', '合格見込みライン（%）'),
('maybe_threshold', '70', '要検討ライン（%）'),
('max_selections',  '5',  '最大選択大学数');

-- ── 診断 大学テーブル（存在しない場合） ─────────────────
CREATE TABLE IF NOT EXISTS diagnosis_colleges (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  score      INT NOT NULL DEFAULT 10000,
  need_based TINYINT(1) DEFAULT 0,
  country    VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── 診断 キーワードテーブル（存在しない場合） ────────────
CREATE TABLE IF NOT EXISTS diagnosis_keywords (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  keyword VARCHAR(100) NOT NULL,
  points  INT NOT NULL DEFAULT 200,
  category VARCHAR(50)
);
