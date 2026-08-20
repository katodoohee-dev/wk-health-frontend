const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');

const app = express();
const PORT = Number(process.env.PORT || 10000);
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-render';
const DB_PATH = process.env.DB_PATH || '/var/data/wk-health.db';
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS diary (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL, meal_type TEXT, food_name TEXT, calories REAL DEFAULT 0, protein REAL DEFAULT 0, carbs REAL DEFAULT 0, fat REAL DEFAULT 0, emoji TEXT DEFAULT '🍽️', source TEXT DEFAULT 'manual', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS scans (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, image_data TEXT, mime_type TEXT, description TEXT, nutrition_json TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS water (user_id TEXT PRIMARY KEY, glasses INTEGER DEFAULT 0, goal_glasses INTEGER DEFAULT 8, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS checkins (user_id TEXT NOT NULL, date TEXT NOT NULL, streak INTEGER DEFAULT 0, PRIMARY KEY(user_id,date));
CREATE TABLE IF NOT EXISTS mood_logs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, mood TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS friendships (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, friend_id TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(user_id,friend_id));
CREATE TABLE IF NOT EXISTS invite_codes (user_id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS notification_settings (user_id TEXT PRIMARY KEY, meal_reminder INTEGER DEFAULT 1, water_reminder INTEGER DEFAULT 1, streak_risk INTEGER DEFAULT 1, weekly_insight INTEGER DEFAULT 1, smart_timing INTEGER DEFAULT 0, quiet_start TEXT DEFAULT '22:00', quiet_end TEXT DEFAULT '07:00');
`);

app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '12mb' }));
app.get('/', (_req, res) => res.json({ ok: true, service: 'wk-health-backend', version: '1.0.0' }));
app.get('/healthz', (_req, res) => res.json({ ok: true, db: true, time: new Date().toISOString() }));

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const sign = (u) => jwt.sign({ sub: u.id, email: u.email }, JWT_SECRET, { expiresIn: '30d' });
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'ต้องเข้าสู่ระบบ' });
  try { req.user = jwt.verify(h.slice(7), JWT_SECRET); next(); }
  catch { return res.status(401).json({ success: false, error: 'เซสชันหมดอายุ' }); }
}
function userById(id) { return db.prepare('SELECT id,email,name,created_at as createdAt FROM users WHERE id=?').get(id); }
function userResponse(u) {
  return { id: u.id, email: u.email, name: u.name, displayName: u.name, goalKcal: 2000, weightKg: 0, heightCm: 0, proteinGoal: 120, carbGoal: 240, fatGoal: 65, streak: db.prepare('SELECT COALESCE(streak,0) streak FROM checkins WHERE user_id=? ORDER BY date DESC LIMIT 1').get(u.id)?.streak || 0 };
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, displayName, name } = req.body || {};
    if (!email || !password) return res.status(400).json({ success: false, error: 'กรอกอีเมลและรหัสผ่าน' });
    if (password.length < 6) return res.status(400).json({ success: false, error: 'รหัสผ่านต้องอย่างน้อย 6 ตัวอักษร' });
    const id = crypto.randomUUID(); const n = (displayName || name || email.split('@')[0]).trim();
    const hash = await bcrypt.hash(password, 12);
    db.prepare('INSERT INTO users(id,email,password_hash,name,created_at) VALUES(?,?,?,?,?)').run(id, email.trim().toLowerCase(), hash, n, now());
    const u = userById(id); res.json({ success: true, token: sign(u), user: userResponse(u) });
  } catch { res.status(409).json({ success: false, error: 'อีเมลนี้มีบัญชีอยู่แล้ว' }); }
});
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(email || '').trim().toLowerCase());
  if (!u || !(await bcrypt.compare(String(password || ''), u.password_hash))) return res.status(401).json({ success: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  res.json({ success: true, token: sign(u), user: userResponse(u) });
});
app.post('/api/auth/logout', (_req, res) => res.json({ success: true }));
app.get('/api/auth/me', auth, (req, res) => { const u = userById(req.user.sub); if (!u) return res.status(401).json({ success: false, error: 'ไม่พบผู้ใช้' }); res.json({ success: true, user: userResponse(u) }); });
app.patch('/api/auth/me', auth, (req, res) => { const name = req.body?.displayName ?? req.body?.name; if (name) db.prepare('UPDATE users SET name=? WHERE id=?').run(String(name).trim(), req.user.sub); const u = userById(req.user.sub); res.json({ success: true, user: userResponse(u) }); });

app.post('/api/scan/vision', auth, async (req, res) => {
  const { imageBase64, mimeType = 'image/jpeg' } = req.body || {};
  if (!imageBase64) return res.status(400).json({ success: false, error: 'ไม่พบรูปภาพ' });
  let description = '';
  try {
    if (process.env.GEMINI_API_KEY) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}:generateContent?key=${process.env.GEMINI_API_KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: 'Analyze this food photo. Identify foods and approximate portions. Answer in Thai, concise.' }, { inline_data: { mime_type: mimeType, data: imageBase64.replace(/^data:[^;]+;base64,/, '') } }] }] }) });
      const j = await r.json(); description = j?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join(' ') || '';
    }
  } catch (e) { console.error('vision provider failed', e); }
  if (!description) description = 'ตรวจพบภาพแล้ว แต่ยังไม่ได้เปิด AI Vision บนเซิร์ฟเวอร์ กรุณาตั้ง GEMINI_API_KEY ใน Render';
  db.prepare('INSERT INTO scans(id,user_id,image_data,mime_type,description,created_at) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(), req.user.sub, imageBase64.slice(0, 200000), mimeType, description, now());
  res.json({ success: true, description });
});

app.post('/api/scan/calc', auth, async (req, res) => {
  const description = String(req.body?.description || 'อาหาร'); let nutrition = null;
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      const r = await fetch(process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` }, body: JSON.stringify({ model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', messages: [{ role: 'system', content: 'Return JSON only: {foodName,calories,protein,carbs,fat,items:[{label,grams,kcal}],tips,confidence}. Estimate nutrition reasonably.' }, { role: 'user', content: description }], response_format: { type: 'json_object' } }) });
      const j = await r.json(); nutrition = JSON.parse(j?.choices?.[0]?.message?.content || 'null');
    } catch (e) { console.error('nutrition provider failed', e); }
  }
  if (!nutrition) nutrition = { foodName: description, calories: 0, protein: 0, carbs: 0, fat: 0, items: [], tips: 'ตั้ง DEEPSEEK_API_KEY เพื่อเปิดการวิเคราะห์โภชนาการจริง', confidence: 0 };
  res.json({ success: true, nutrition });
});
app.post('/api/scan/save', auth, (req, res) => {
  const p = req.body || {}; const id = crypto.randomUUID();
  db.prepare('INSERT INTO diary(id,user_id,date,meal_type,food_name,calories,protein,carbs,fat,emoji,source,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id, req.user.sub, p.date || today(), p.mealType || p.meal_type || 'อื่น ๆ', p.name || p.foodName || p.food_name || 'อาหาร', Number(p.kcal || p.calories || 0), Number(p.protein || 0), Number(p.carb || p.carbs || 0), Number(p.fat || 0), p.emoji || '🍽️', p.source || 'scan', now());
  res.json({ success: true, id });
});

app.get('/api/diary', auth, (req, res) => { const rows = db.prepare('SELECT id,food_name name,created_at time,meal_type slot,calories kcal,protein,carbs carb,fat,emoji,source FROM diary WHERE user_id=? AND date=? ORDER BY created_at').all(req.user.sub, req.query.date || today()); res.json({ success: true, entries: rows }); });
app.delete('/api/diary/:id', auth, (req, res) => { db.prepare('DELETE FROM diary WHERE id=? AND user_id=?').run(req.params.id, req.user.sub); res.json({ success: true }); });

app.get('/api/water/today', auth, (req, res) => { let r = db.prepare('SELECT glasses,goal_glasses goalGlasses FROM water WHERE user_id=?').get(req.user.sub); if (!r) { db.prepare('INSERT INTO water(user_id,glasses,goal_glasses,updated_at) VALUES(?,?,?,?)').run(req.user.sub, 0, 8, now()); r = { glasses: 0, goalGlasses: 8 }; } res.json({ success: true, ...r }); });
app.post('/api/water', auth, (req, res) => { const glasses = Math.max(0, Number(req.body?.glasses ?? req.body?.amount ?? 1)); db.prepare('INSERT INTO water(user_id,glasses,goal_glasses,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET glasses=excluded.glasses,updated_at=excluded.updated_at').run(req.user.sub, glasses, 8, now()); res.json({ success: true, glasses, goalGlasses: 8 }); });
app.get('/api/checkin/today', auth, (req, res) => { let r = db.prepare('SELECT streak FROM checkins WHERE user_id=? AND date=?').get(req.user.sub, today()); if (!r) { const prev = db.prepare('SELECT streak FROM checkins WHERE user_id=? ORDER BY date DESC LIMIT 1').get(req.user.sub); const streak = (prev?.streak || 0) + 1; db.prepare('INSERT INTO checkins(user_id,date,streak) VALUES(?,?,?)').run(req.user.sub, today(), streak); r = { streak }; } res.json({ success: true, streak: r.streak }); });

function statsToday(uid) { const r = db.prepare('SELECT COALESCE(SUM(calories),0) eaten,COALESCE(SUM(protein),0) protein,COALESCE(SUM(carbs),0) carb,COALESCE(SUM(fat),0) fat FROM diary WHERE user_id=? AND date=?').get(uid, today()); return { ...r, goalKcal: 2000, proteinGoal: 120, carbGoal: 240, fatGoal: 65, burned: 0 }; }
app.get('/api/stats/today', auth, (req, res) => res.json({ success: true, totals: statsToday(req.user.sub) }));
app.get('/api/stats/weekly', auth, (req, res) => { const out = []; for (let i = 6; i >= 0; i--) { const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10); const r = db.prepare('SELECT COALESCE(SUM(calories),0) kcal FROM diary WHERE user_id=? AND date=?').get(req.user.sub, d); out.push({ day: d, kcal: r.kcal, burn: 0, steps: 0 }); } res.json({ success: true, days: out }); });
app.get('/api/stats/week-summary', auth, (req, res) => res.json({ success: true, streak: db.prepare('SELECT COALESCE(streak,0) streak FROM checkins WHERE user_id=? ORDER BY date DESC LIMIT 1').get(req.user.sub)?.streak || 0, avgKcal: 0, daysOnGoal: 0 }));

app.get('/api/mood/list', auth, (_req, res) => res.json({ success: true, moods: [{ key: 'calm', label: 'สงบ', emoji: '😌', hint: '' }, { key: 'happy', label: 'มีความสุข', emoji: '😊', hint: '' }, { key: 'tired', label: 'เหนื่อย', emoji: '😮‍💨', hint: '' }, { key: 'stressed', label: 'เครียด', emoji: '😵', hint: '' }] }));
app.get('/api/mood/recommend', auth, (_req, res) => res.json({ success: true, recommendations: [{ name: 'ข้าว + ปลา + ผัก', kcal: 520, emoji: '🍚', why: 'สมดุลและอิ่มนาน' }] }));
app.post('/api/mood/log', auth, (req, res) => { db.prepare('INSERT INTO mood_logs(id,user_id,mood,created_at) VALUES(?,?,?,?)').run(crypto.randomUUID(), req.user.sub, String(req.body?.mood || 'neutral'), now()); res.json({ success: true }); });
app.post('/api/nlp/analyze', auth, (req, res) => { const t = String(req.body?.text || ''); res.json({ success: true, items: [{ name: t || 'อาหาร', qty: '1 portion', kcal: 0, confidence: 0.5 }] }); });
app.post('/api/budget/plan', auth, (req, res) => { const days = Number(req.body?.days || 7); res.json({ success: true, days: Array.from({ length: days }, (_, i) => ({ day: `Day ${i + 1}`, meals: [], total: 0 })), totalCost: 0, note: 'ตั้งงบและข้อจำกัดเพื่อสร้างแผนที่เหมาะกับคุณ' }); });

app.post('/api/assistant', auth, async (req, res) => {
  const message = String(req.body?.message || req.body?.text || ''); if (!message) return res.status(400).json({ success: false, error: 'ข้อความว่าง' });
  db.prepare('INSERT INTO chat_messages(id,user_id,role,content,created_at) VALUES(?,?,?,?,?)').run(crypto.randomUUID(), req.user.sub, 'user', message, now());
  let answer = `รับทราบครับ: ${message}`;
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      const history = db.prepare('SELECT role,content FROM chat_messages WHERE user_id=? ORDER BY created_at DESC LIMIT 12').all(req.user.sub).reverse();
      const r = await fetch(process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` }, body: JSON.stringify({ model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', messages: [{ role: 'system', content: 'You are WK Health, a concise Thai health assistant. Do not diagnose. Give practical general wellness guidance.' }, ...history] }) });
      const j = await r.json(); answer = j?.choices?.[0]?.message?.content || answer;
    } catch (e) { console.error('assistant provider failed', e); }
  }
  db.prepare('INSERT INTO chat_messages(id,user_id,role,content,created_at) VALUES(?,?,?,?,?)').run(crypto.randomUUID(), req.user.sub, 'assistant', answer, now());
  res.json({ success: true, reply: answer, message: answer, content: answer });
});
app.get('/api/assistant/history', auth, (req, res) => res.json({ success: true, messages: db.prepare('SELECT role,content,created_at createdAt FROM chat_messages WHERE user_id=? ORDER BY created_at ASC LIMIT 100').all(req.user.sub) }));

app.get('/api/friends', auth, (req, res) => res.json(db.prepare('SELECT u.id,u.name,COALESCE(c.streak,0) streak FROM friendships f JOIN users u ON u.id=f.friend_id LEFT JOIN checkins c ON c.user_id=u.id WHERE f.user_id=?').all(req.user.sub)));
app.get('/api/friends/invite-code', auth, (req, res) => { let r = db.prepare('SELECT code FROM invite_codes WHERE user_id=?').get(req.user.sub); if (!r) { r = { code: crypto.randomBytes(4).toString('hex').toUpperCase() }; db.prepare('INSERT INTO invite_codes(user_id,code) VALUES(?,?)').run(req.user.sub, r.code); } res.json(r); });
app.post('/api/friends/add', auth, (req, res) => { const owner = db.prepare('SELECT user_id FROM invite_codes WHERE code=?').get(req.body?.code); if (!owner) return res.status(404).json({ success: false, error: 'ไม่พบโค้ดนี้' }); if (owner.user_id === req.user.sub) return res.status(400).json({ success: false, error: 'ใช้โค้ดตัวเองไม่ได้' }); for (const [a, b] of [[req.user.sub, owner.user_id], [owner.user_id, req.user.sub]]) db.prepare('INSERT OR IGNORE INTO friendships(id,user_id,friend_id,created_at) VALUES(?,?,?,?)').run(crypto.randomUUID(), a, b, now()); res.json({ success: true }); });
app.post('/api/friends/cheer/:id', auth, (req, res) => res.json({ success: true, friendId: req.params.id }));

app.get('/api/notifications/settings', auth, (req, res) => { let r = db.prepare('SELECT * FROM notification_settings WHERE user_id=?').get(req.user.sub); if (!r) { db.prepare('INSERT INTO notification_settings(user_id) VALUES(?)').run(req.user.sub); r = db.prepare('SELECT * FROM notification_settings WHERE user_id=?').get(req.user.sub); } res.json({ mealReminder: !!r.meal_reminder, waterReminder: !!r.water_reminder, streakRisk: !!r.streak_risk, weeklyInsight: !!r.weekly_insight, smartTiming: !!r.smart_timing, quietStart: r.quiet_start, quietEnd: r.quiet_end }); });
app.patch('/api/notifications/settings', auth, (req, res) => { const p = req.body || {}; const r = db.prepare('SELECT user_id FROM notification_settings WHERE user_id=?').get(req.user.sub); if (!r) db.prepare('INSERT INTO notification_settings(user_id) VALUES(?)').run(req.user.sub); const map = { mealReminder: 'meal_reminder', waterReminder: 'water_reminder', streakRisk: 'streak_risk', weeklyInsight: 'weekly_insight', smartTiming: 'smart_timing', quietStart: 'quiet_start', quietEnd: 'quiet_end' }; for (const [k, c] of Object.entries(map)) if (k in p) db.prepare(`UPDATE notification_settings SET ${c}=? WHERE user_id=?`).run(typeof p[k] === 'boolean' ? (p[k] ? 1 : 0) : p[k], req.user.sub); res.json({ success: true }); });

app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ success: false, error: 'เซิร์ฟเวอร์ผิดพลาด' }); });
app.listen(PORT, '0.0.0.0', () => console.log(`WK Health backend listening on ${PORT}`));
