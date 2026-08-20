// ==========================================================================
// Backend routes สำหรับ Export/Backup, Friends/Leaderboard, Notifications
// เขียนเป็น Express Router แยก mount เข้า app หลักของคุณได้เลย
//
// วิธีติดตั้ง (ในโปรเจกต์ backend Express+SQLite ที่มีอยู่แล้ว):
//   const newFeaturesRouter = require("./new-features.routes");
//   app.use(newFeaturesRouter(db, authMiddleware));
//
// สมมติฐานเรื่อง db: ใช้ better-sqlite3 (sync API) ปรับ query ตาม schema
// จริงของคุณถ้าใช้ driver อื่น (sqlite3 async, prisma ฯลฯ)
// สมมติฐานเรื่อง authMiddleware: ต้องมี req.user.id หลังผ่าน middleware
// (ตาม pattern เดิมที่ apiFetch<T>() ส่ง Authorization: Bearer token ไปแล้ว)
// ==========================================================================

const express = require("express");
const crypto = require("crypto");

module.exports = function newFeaturesRouter(db, requireAuth) {
  const router = express.Router();

  // ---------------- schema (สร้างตารางถ้ายังไม่มี) ----------------
  db.exec(`
    CREATE TABLE IF NOT EXISTS export_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      format TEXT NOT NULL,
      range TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS friendships (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      friend_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, friend_id)
    );

    CREATE TABLE IF NOT EXISTS invite_codes (
      user_id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_settings (
      user_id TEXT PRIMARY KEY,
      meal_reminder INTEGER DEFAULT 1,
      water_reminder INTEGER DEFAULT 1,
      streak_risk INTEGER DEFAULT 1,
      weekly_insight INTEGER DEFAULT 1,
      smart_timing INTEGER DEFAULT 0,
      quiet_start TEXT DEFAULT '22:00',
      quiet_end TEXT DEFAULT '07:00'
    );
  `);

  // ---------------- Export / Backup ----------------
  router.post("/export", requireAuth, (req, res) => {
    const { format, range } = req.body ?? {};
    if (!["pdf", "csv"].includes(format)) {
      return res.status(400).json({ success: false, error: "format ไม่ถูกต้อง" });
    }
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare(
      "INSERT INTO export_history (id, user_id, format, range, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(id, req.user.id, format, range ?? "30d", createdAt);

    // TODO: ต่อ logic สร้างไฟล์จริงจากข้อมูล diary/stats ของ user แล้วอัปโหลด
    // ไปที่ storage (S3/R2/local) แล้วคืน URL จริงแทน placeholder นี้
    const downloadUrl = `${req.protocol}://${req.get("host")}/export/download/${id}.${format}`;
    res.json({ success: true, downloadUrl });
  });

  router.get("/export/history", requireAuth, (req, res) => {
    const rows = db
      .prepare("SELECT id, format, range, created_at as createdAt FROM export_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20")
      .all(req.user.id);
    res.json(rows);
  });

  // ---------------- Friends / Leaderboard ----------------
  router.get("/friends", requireAuth, (req, res) => {
    const rows = db
      .prepare(
        `SELECT u.id as id, u.name as name, u.avatar as avatar,
                COALESCE(c.streak, 0) as streak
         FROM friendships f
         JOIN users u ON u.id = f.friend_id
         LEFT JOIN checkins c ON c.user_id = u.id
         WHERE f.user_id = ?`
      )
      .all(req.user.id);
    res.json(rows);
  });

  router.post("/friends/cheer/:id", requireAuth, (req, res) => {
    const friendId = req.params.id;
    // TODO: บันทึก event เชียร์ + ส่ง push notification ให้เพื่อนจริง
    // ผ่านระบบ Web Push (ดู notifications.routes ด้านล่าง)
    res.json({ success: true });
  });

  router.get("/friends/invite-code", requireAuth, (req, res) => {
    let row = db.prepare("SELECT code FROM invite_codes WHERE user_id = ?").get(req.user.id);
    if (!row) {
      const code = crypto.randomBytes(4).toString("hex").toUpperCase();
      db.prepare("INSERT INTO invite_codes (user_id, code) VALUES (?, ?)").run(req.user.id, code);
      row = { code };
    }
    res.json({ code: row.code });
  });

  router.post("/friends/add", requireAuth, (req, res) => {
    const { code } = req.body ?? {};
    const owner = db.prepare("SELECT user_id FROM invite_codes WHERE code = ?").get(code);
    if (!owner) return res.status(404).json({ success: false, error: "ไม่พบโค้ดนี้" });
    if (owner.user_id === req.user.id) {
      return res.status(400).json({ success: false, error: "ใช้โค้ดตัวเองไม่ได้" });
    }
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare(
      "INSERT OR IGNORE INTO friendships (id, user_id, friend_id, created_at) VALUES (?, ?, ?, ?)"
    ).run(id, req.user.id, owner.user_id, createdAt);
    // เพิ่มความสัมพันธ์กลับด้าน (mutual friendship)
    const id2 = crypto.randomUUID();
    db.prepare(
      "INSERT OR IGNORE INTO friendships (id, user_id, friend_id, created_at) VALUES (?, ?, ?, ?)"
    ).run(id2, owner.user_id, req.user.id, createdAt);
    res.json({ success: true });
  });

  router.get("/stats/week-summary", requireAuth, (req, res) => {
    // TODO: ต่อ query จริงจากตาราง diary/checkins ของคุณ นี่คือ placeholder
    // ให้ frontend ทำงานได้ก่อน
    const row = db
      .prepare(
        `SELECT COALESCE(streak, 0) as streak FROM checkins WHERE user_id = ? ORDER BY date DESC LIMIT 1`
      )
      .get(req.user.id);
    res.json({ streak: row?.streak ?? 0, avgKcal: 0, daysOnGoal: 0 });
  });

  // ---------------- Notification Settings ----------------
  router.get("/notifications/settings", requireAuth, (req, res) => {
    let row = db.prepare("SELECT * FROM notification_settings WHERE user_id = ?").get(req.user.id);
    if (!row) {
      db.prepare("INSERT INTO notification_settings (user_id) VALUES (?)").run(req.user.id);
      row = db.prepare("SELECT * FROM notification_settings WHERE user_id = ?").get(req.user.id);
    }
    res.json({
      mealReminder: Boolean(row.meal_reminder),
      waterReminder: Boolean(row.water_reminder),
      streakRisk: Boolean(row.streak_risk),
      weeklyInsight: Boolean(row.weekly_insight),
      smartTiming: Boolean(row.smart_timing),
      quietStart: row.quiet_start,
      quietEnd: row.quiet_end,
    });
  });

  router.patch("/notifications/settings", requireAuth, (req, res) => {
    const patch = req.body ?? {};
    const map = {
      mealReminder: "meal_reminder",
      waterReminder: "water_reminder",
      streakRisk: "streak_risk",
      weeklyInsight: "weekly_insight",
      smartTiming: "smart_timing",
      quietStart: "quiet_start",
      quietEnd: "quiet_end",
    };
    const sets = [];
    const vals = [];
    for (const [k, col] of Object.entries(map)) {
      if (k in patch) {
        sets.push(`${col} = ?`);
        vals.push(typeof patch[k] === "boolean" ? (patch[k] ? 1 : 0) : patch[k]);
      }
    }
    if (sets.length) {
      vals.push(req.user.id);
      db.prepare(`UPDATE notification_settings SET ${sets.join(", ")} WHERE user_id = ?`).run(...vals);
    }
    const row = db.prepare("SELECT * FROM notification_settings WHERE user_id = ?").get(req.user.id);
    res.json({
      mealReminder: Boolean(row.meal_reminder),
      waterReminder: Boolean(row.water_reminder),
      streakRisk: Boolean(row.streak_risk),
      weeklyInsight: Boolean(row.weekly_insight),
      smartTiming: Boolean(row.smart_timing),
      quietStart: row.quiet_start,
      quietEnd: row.quiet_end,
    });
  });

  router.post("/notifications/test", requireAuth, async (req, res) => {
    // TODO: ต้องต่อ Web Push จริง — ดูคำอธิบายใน README ส่วน
    // "Push Notification จริง" ต้องมี VAPID key ของคุณเองก่อนบรรทัดนี้จะส่งได้จริง
    res.json({ success: true, note: "placeholder — ยังไม่ได้ต่อ Web Push จริง" });
  });

  return router;
};
