// =====================
// experiences.js
// パス: /routes/experiences.js
// 用途: 留学体験記API
// =====================

const express = require("express");
const router = express.Router();
const db = require("../db/connection");
const fetch = require("node-fetch");

// 体験記一覧
router.get("/", (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : "%";
  const country = req.query.country || "";
  const countryFilter = country ? "AND country = ?" : "";
  const params = country
    ? [search, search, country, limit, offset]
    : [search, search, limit, offset];
  const countParams = country ? [search, search, country] : [search, search];

  db.query(
    `SELECT COUNT(*) as total FROM experiences WHERE status = 'published' AND (university LIKE ? OR summary LIKE ?) ${countryFilter}`,
    countParams,
    (err, countResult) => {
      if (err) return res.status(500).json({ error: err.message });
      const total = countResult[0].total;
      db.query(
        `
        SELECT id, country, university, author_name, major, rating, summary, like_count, created_at
        FROM experiences
        WHERE status = 'published' AND (university LIKE ? OR summary LIKE ?) ${countryFilter}
        ORDER BY like_count DESC, created_at DESC
        LIMIT ? OFFSET ?
      `,
        params,
        (err, results) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ total, page, limit, experiences: results });
        },
      );
    },
  );
});

// 国一覧
router.get("/countries", (req, res) => {
  db.query(
    "SELECT DISTINCT country FROM experiences WHERE status = 'published' ORDER BY country",
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results.map((r) => r.country));
    },
  );
});

// 体験記詳細
router.get("/:id", (req, res) => {
  db.query(
    'SELECT * FROM experiences WHERE id = ? AND status = "published"',
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0)
        return res.status(404).json({ error: "体験記が見つかりません" });
      res.json(results[0]);
    },
  );
});

// 体験記投稿
router.post("/", express.json(), async (req, res) => {
  const {
    user_id,
    country,
    university,
    author_name,
    major,
    rating,
    summary,
    good,
    bad,
    fun,
  } = req.body;
  if (!user_id || !country || !author_name || !rating || !summary) {
    return res.status(400).json({ error: "必須項目が不足しています" });
  }
  if (summary.length < 50)
    return res.status(400).json({ error: "summaryは50文字以上必要です" });
  if (summary.length > 800)
    return res
      .status(400)
      .json({ error: "summaryは800文字以内にしてください" });

  db.query(
    "INSERT INTO experiences (user_id, country, university, author_name, major, rating, summary, good, bad, fun) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      user_id,
      country,
      university || "匿名",
      author_name,
      major || "匿名",
      rating,
      summary,
      good || "",
      bad || "",
      fun || "",
    ],
    async (err, result) => {
      if (err) return res.status(500).json({ error: err.message });

      const payload = {
        embeds: [
          {
            title: "✈️ 新しい留学体験記が投稿されました（承認待ち）",
            color: 0x16a34a,
            fields: [
              { name: "国", value: country, inline: true },
              { name: "大学", value: university || "匿名", inline: true },
              { name: "著者", value: author_name, inline: true },
              { name: "評価", value: `${rating}/10`, inline: true },
              {
                name: "要約",
                value:
                  summary.slice(0, 200) + (summary.length > 200 ? "..." : ""),
                inline: false,
              },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      };
      try {
        await fetch(process.env.DISCORD_EXPERIENCE_NEW_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        console.error("Discord通知エラー:", e);
      }

      res.json({ ok: true, id: result.insertId });
    },
  );
});

// いいね
router.post("/:id/like", express.json(), (req, res) => {
  const { user_id } = req.body;
  db.query(
    "INSERT IGNORE INTO experience_likes (experience_id, user_id) VALUES (?, ?)",
    [req.params.id, user_id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows > 0) {
        db.query(
          "UPDATE experiences SET like_count = like_count + 1 WHERE id = ?",
          [req.params.id],
        );
      }
      res.json({ ok: true, added: result.affectedRows > 0 });
    },
  );
});

// 通報
router.post("/:id/report", express.json(), async (req, res) => {
  const { user_id, reason } = req.body;
  const domain = process.env.DOMAIN || "http://localhost:3000";

  db.query(
    "INSERT INTO experience_reports (experience_id, user_id, reason) VALUES (?, ?, ?)",
    [req.params.id, user_id, reason],
    async (err) => {
      if (err) return res.status(500).json({ error: err.message });

      const payload = {
        embeds: [
          {
            title: "🚨 留学体験記の通報が届きました",
            color: 0xff0000,
            fields: [
              { name: "体験記ID", value: String(req.params.id), inline: true },
              {
                name: "通報者ID",
                value: String(user_id || "未ログイン"),
                inline: true,
              },
              {
                name: "通報理由",
                value: reason || "（理由なし）",
                inline: false,
              },
              {
                name: "URL",
                value: `${domain}/student-japan/experience.html?id=${req.params.id}`,
                inline: false,
              },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      };

      try {
        await fetch(process.env.DISCORD_EXPERIENCE_REPORT_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        console.error("Discord通知エラー:", e);
      }

      res.json({ ok: true });
    },
  );
});

module.exports = router;
