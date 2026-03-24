USE willabroadjapan;

CREATE TABLE IF NOT EXISTS university_scholarships (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  country    VARCHAR(100) NOT NULL,
  city       VARCHAR(100),
  url        VARCHAR(500),
  lat        DECIMAL(10,7),
  lng        DECIMAL(10,7),
  currency   VARCHAR(10),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- university_favorites テーブル（お気に入り機能用）
CREATE TABLE IF NOT EXISTS university_favorites (
  user_id       INT NOT NULL,
  university_id INT NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, university_id)
);
