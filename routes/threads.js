// =====================
// threads.js
// パス: /routes/threads.js
// 用途: スレッドAPI
// =====================

const express = require("express");
const router = express.Router();
const db = require("../db/connection");
const fetch = require("node-fetch");

// スレッド一覧
router.get("/", (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 30;
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : "%";
  const userId = parseInt(req.query.user_id) || 0;

  db.query(
    "SELECT COUNT(*) as total FROM threads WHERE title LIKE ? OR content LIKE ?",
    [search, search],
    (err, countResult) => {
      if (err) return res.status(500).json({ error: err.message });
      const total = countResult[0].total;
      db.query(
        `
        SELECT t.id, t.title, t.content, t.view_count, t.created_at,
               u.username, u.avatar,
               COUNT(DISTINCT r.id) as reply_count,
               MAX(CASE WHEN t.user_id = ? THEN 1 ELSE 0 END) as is_mine
        FROM threads t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN thread_replies r ON t.id = r.thread_id
        WHERE t.title LIKE ? OR t.content LIKE ?
        GROUP BY t.id
        ORDER BY is_mine DESC, t.view_count DESC
        LIMIT ? OFFSET ?
      `,
        [userId, search, search, limit, offset],
        (err, results) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ total, page, limit, threads: results });
        },
      );
    },
  );
});

// スレッド詳細
router.get("/:id", (req, res) => {
  const threadId = req.params.id;
  db.query("UPDATE threads SET view_count = view_count + 1 WHERE id = ?", [
    threadId,
  ]);
  db.query(
    `
    SELECT t.id, t.title, t.content, t.view_count, t.created_at, t.user_id,
           u.username, u.avatar
    FROM threads t
    LEFT JOIN users u ON t.user_id = u.id
    WHERE t.id = ?
  `,
    [threadId],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0)
        return res.status(404).json({ error: "スレッドが見つかりません" });
      const thread = results[0];
      db.query(
        `
      SELECT r.id, r.content, r.like_count, r.created_at, r.user_id,
             u.username, u.avatar
      FROM thread_replies r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.thread_id = ?
      ORDER BY r.like_count DESC, r.created_at ASC
    `,
        [threadId],
        (err, replies) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ ...thread, replies });
        },
      );
    },
  );
});

// スレッド投稿
router.post("/", express.json(), async (req, res) => {
  const { user_id, title, content } = req.body;
  if (!user_id || !title || !content)
    return res.status(400).json({ error: "必須項目が不足しています" });
  db.query(
    "INSERT INTO threads (user_id, title, content) VALUES (?, ?, ?)",
    [user_id, title, content],
    async (err, result) => {
      if (err) return res.status(500).json({ error: err.message });

      const domain = process.env.DOMAIN || "http://localhost:3000";
      const payload = {
        embeds: [
          {
            title: "💬 新しいスレッドが立ち上がりました",
            color: 0xff8040,
            fields: [
              { name: "タイトル", value: title, inline: false },
              {
                name: "内容",
                value:
                  content.slice(0, 200) + (content.length > 200 ? "..." : ""),
                inline: false,
              },
              {
                name: "URL",
                value: `${domain}/student-japan/thread.html?id=${result.insertId}`,
                inline: false,
              },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      };
      try {
        await fetch(process.env.DISCORD_THREAD_NEW_WEBHOOK, {
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

// 回答投稿
router.post("/:id/replies", express.json(), (req, res) => {
  const { user_id, content } = req.body;
  if (!user_id || !content)
    return res.status(400).json({ error: "必須項目が不足しています" });
  db.query(
    "INSERT INTO thread_replies (thread_id, user_id, content) VALUES (?, ?, ?)",
    [req.params.id, user_id, content],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, id: result.insertId });
    },
  );
});

// いいね
router.post("/replies/:id/like", express.json(), (req, res) => {
  const { user_id } = req.body;
  db.query(
    "INSERT IGNORE INTO thread_likes (reply_id, user_id) VALUES (?, ?)",
    [req.params.id, user_id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows > 0) {
        db.query(
          "UPDATE thread_replies SET like_count = like_count + 1 WHERE id = ?",
          [req.params.id],
        );
      }
      res.json({ ok: true });
    },
  );
});

// お気に入り登録
router.post("/:id/favorite", express.json(), (req, res) => {
  const { user_id } = req.body;
  db.query(
    "INSERT IGNORE INTO thread_favorites (thread_id, user_id) VALUES (?, ?)",
    [req.params.id, user_id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, added: result.affectedRows > 0 });
    },
  );
});

// お気に入り解除
router.delete("/:id/favorite", express.json(), (req, res) => {
  const { user_id } = req.body;
  db.query(
    "DELETE FROM thread_favorites WHERE thread_id = ? AND user_id = ?",
    [req.params.id, user_id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    },
  );
});

// 通報
router.post("/report", express.json(), async (req, res) => {
  const { type, target_id, user_id, reason } = req.body;
  const domain = process.env.DOMAIN || "http://localhost:3000";

  db.query(
    "INSERT INTO thread_reports (type, target_id, user_id, reason) VALUES (?, ?, ?, ?)",
    [type, target_id, user_id, reason],
    async (err) => {
      if (err) return res.status(500).json({ error: err.message });

      let url = "";
      if (type === "thread") {
        url = `${domain}/student-japan/thread.html?id=${target_id}`;
      } else {
        url = `${domain}/student-japan/thread.html（回答ID: ${target_id}）`;
      }

      const payload = {
        embeds: [
          {
            title: "🚨 スレッド通報が届きました",
            color: 0xff0000,
            fields: [
              {
                name: "種類",
                value: type === "thread" ? "スレッド本文" : "回答",
                inline: true,
              },
              { name: "対象ID", value: String(target_id), inline: true },
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
              { name: "URL", value: url, inline: false },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      };

      try {
        await fetch(process.env.DISCORD_THREAD_REPORT_WEBHOOK, {
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
