// WK Health backend additions: Export/Backup, Friends, Notifications.
// Mount with: app.use(newFeaturesRouter(db, requireAuth));
// Uses better-sqlite3. Adjust table/column names only if your existing backend schema differs.
const express = require("express");
const crypto = require("crypto");

module.exports = function newFeaturesRouter(db, requireAuth) {
  const router = express.Router();
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

  const tableExists = (name) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
  const columnNames = (name) => tableExists(name) ? db.prepare(`PRAGMA table_info(${name})`).all().map((x) => x.name) : [];
  const firstColumn = (cols, names) => names.find((x) => cols.includes(x));

  router.post("/export", requireAuth, (req, res) => {
    const { format, range } = req.body ?? {};
    if (!["pdf", "csv"].includes(format)) return res.status(400).json({ success: false, error: "format ไม่ถูกต้อง" });
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare("INSERT INTO export_history (id, user_id, format, range, created_at) VALUES (?, ?, ?, ?, ?)").run(id, req.user.id, format, range ?? "30d", createdAt);
    const downloadUrl = `${req.protocol}://${req.get("host")}/export/download/${id}.${format}`;
    res.json({ success: true, downloadUrl, id });
  });

  router.get("/export/history", requireAuth, (req, res) => {
    const rows = db.prepare("SELECT id, format, range, created_at as createdAt FROM export_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20").all(req.user.id);
    res.json(rows);
  });

  router.get("/export/download/:id.csv", requireAuth, (req, res) => {
    const job = db.prepare("SELECT id, user_id, range FROM export_history WHERE id=? AND format='csv'").get(req.params.id);
    if (!job || job.user_id !== req.user.id) return res.status(404).json({ success: false, error: "ไม่พบไฟล์ส่งออก" });
    const rows = [];
    if (tableExists("diary")) {
      const cols = columnNames("diary");
      const userCol = firstColumn(cols, ["user_id", "userId"]);
      if (userCol) {
        const dateCol = firstColumn(cols, ["date", "created_at", "createdAt"]);
        const sql = `SELECT * FROM diary WHERE ${userCol} = ? ${dateCol ? `ORDER BY ${dateCol} DESC` : ""} LIMIT 5000`;
        rows.push(...db.prepare(sql).all(req.user.id));
      }
    }
    const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
    const csvEscape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const body = keys.length ? [keys.map(csvEscape).join(","), ...rows.map((r) => keys.map((k) => csvEscape(r[k])).join(","))].join("\n") : "exported_at,user_id,range\n" + [createdSafe(), req.user.id, job.range].map(csvEscape).join(",");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=wk-health-${job.range}-${job.id}.csv`);
    res.send("\uFEFF" + body);
  });

  function createdSafe() { return new Date().toISOString(); }

  router.get("/friends", requireAuth, (req, res) => {
    const rows = db.prepare(`SELECT u.id as id, u.name as name, u.avatar as avatar, COALESCE(c.streak, 0) as streak FROM friendships f JOIN users u ON u.id = f.friend_id LEFT JOIN checkins c ON c.user_id = u.id WHERE f.user_id = ?`).all(req.user.id);
    res.json(rows);
  });
  router.post("/friends/cheer/:id", requireAuth, (req, res) => res.json({ success: true, friendId: req.params.id }));
  router.get("/friends/invite-code", requireAuth, (req, res) => {
    let row = db.prepare("SELECT code FROM invite_codes WHERE user_id = ?").get(req.user.id);
    if (!row) { const code = crypto.randomBytes(4).toString("hex").toUpperCase(); db.prepare("INSERT INTO invite_codes (user_id, code) VALUES (?, ?)").run(req.user.id, code); row = { code }; }
    res.json({ code: row.code });
  });
  router.post("/friends/add", requireAuth, (req, res) => {
    const { code } = req.body ?? {};
    const owner = db.prepare("SELECT user_id FROM invite_codes WHERE code = ?").get(code);
    if (!owner) return res.status(404).json({ success: false, error: "ไม่พบโค้ดนี้" });
    if (owner.user_id === req.user.id) return res.status(400).json({ success: false, error: "ใช้โค้ดตัวเองไม่ได้" });
    const createdAt = new Date().toISOString();
    db.prepare("INSERT OR IGNORE INTO friendships (id, user_id, friend_id, created_at) VALUES (?, ?, ?, ?)").run(crypto.randomUUID(), req.user.id, owner.user_id, createdAt);
    db.prepare("INSERT OR IGNORE INTO friendships (id, user_id, friend_id, created_at) VALUES (?, ?, ?, ?)").run(crypto.randomUUID(), owner.user_id, req.user.id, createdAt);
    res.json({ success: true });
  });

  router.get("/stats/week-summary", requireAuth, (req, res) => {
    let streak = 0; const checkinExists = tableExists("checkins");
    if (checkinExists) { const row = db.prepare("SELECT COALESCE(streak,0) as streak FROM checkins WHERE user_id=? ORDER BY date DESC LIMIT 1").get(req.user.id); streak = row?.streak ?? 0; }
    let avgKcal = 0; let daysOnGoal = 0;
    if (tableExists("diary")) {
      const cols = columnNames("diary"); const userCol = firstColumn(cols, ["user_id", "userId"]); const kcalCol = firstColumn(cols, ["calories", "kcal"]); const dateCol = firstColumn(cols, ["date", "created_at", "createdAt"]);
      if (userCol && kcalCol) {
        const dateFilter = dateCol ? `AND datetime(${dateCol}) >= datetime('now','-6 days')` : "";
        const rows = db.prepare(`SELECT ${kcalCol} as kcal, ${dateCol || "NULL"} as day FROM diary WHERE ${userCol}=? ${dateFilter}`).all(req.user.id);
        const byDay = new Map(); rows.forEach((r) => { const key = String(r.day ?? "").slice(0,10); byDay.set(key, (byDay.get(key) || 0) + Number(r.kcal || 0)); });
        const values = Array.from(byDay.values()).filter((v) => v > 0); avgKcal = values.length ? Math.round(values.reduce((a,b)=>a+b,0)/values.length) : 0; daysOnGoal = values.filter((v) => v <= 2500).length;
      }
    }
    res.json({ streak, avgKcal, daysOnGoal });
  });

  router.get("/notifications/settings", requireAuth, (req, res) => {
    let row = db.prepare("SELECT * FROM notification_settings WHERE user_id = ?").get(req.user.id);
    if (!row) { db.prepare("INSERT INTO notification_settings (user_id) VALUES (?)").run(req.user.id); row = db.prepare("SELECT * FROM notification_settings WHERE user_id = ?").get(req.user.id); }
    res.json({ mealReminder:Boolean(row.meal_reminder), waterReminder:Boolean(row.water_reminder), streakRisk:Boolean(row.streak_risk), weeklyInsight:Boolean(row.weekly_insight), smartTiming:Boolean(row.smart_timing), quietStart:row.quiet_start, quietEnd:row.quiet_end });
  });
  router.patch("/notifications/settings", requireAuth, (req, res) => {
    const patch = req.body ?? {}; const map = {mealReminder:"meal_reminder",waterReminder:"water_reminder",streakRisk:"streak_risk",weeklyInsight:"weekly_insight",smartTiming:"smart_timing",quietStart:"quiet_start",quietEnd:"quiet_end"}; const sets=[]; const vals=[];
    for (const [k,col] of Object.entries(map)) if (k in patch) { sets.push(`${col}=?`); vals.push(typeof patch[k]==="boolean" ? (patch[k]?1:0) : patch[k]); }
    if (sets.length) { vals.push(req.user.id); db.prepare(`UPDATE notification_settings SET ${sets.join(",")} WHERE user_id=?`).run(...vals); }
    const row=db.prepare("SELECT * FROM notification_settings WHERE user_id=?").get(req.user.id); res.json({mealReminder:Boolean(row.meal_reminder),waterReminder:Boolean(row.water_reminder),streakRisk:Boolean(row.streak_risk),weeklyInsight:Boolean(row.weekly_insight),smartTiming:Boolean(row.smart_timing),quietStart:row.quiet_start,quietEnd:row.quiet_end});
  });
  router.post("/notifications/test", requireAuth, async (req,res) => res.status(501).json({success:false,error:"Web Push ยังไม่ถูกเปิดใช้งาน: ต้องตั้งค่า VAPID_PRIVATE_KEY/VAPID_PUBLIC_KEY ใน backend ก่อน"}));
  return router;
};
