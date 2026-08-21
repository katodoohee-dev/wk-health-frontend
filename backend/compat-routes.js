const crypto = require('crypto');

module.exports = function mountCompatRoutes(app, { db, auth }) {
  const uid = (req) => req.user.sub;
  const now = () => new Date().toISOString();

  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_routes (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,title TEXT DEFAULT '',distance_km REAL DEFAULT 0,duration_min REAL DEFAULT 0,payload_json TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS app_notifications (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,type TEXT NOT NULL,title TEXT NOT NULL,body TEXT DEFAULT '',read_at TEXT,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS workout_sessions (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,title TEXT NOT NULL,duration_min INTEGER DEFAULT 0,load REAL DEFAULT 0,status TEXT DEFAULT 'planned',created_at TEXT NOT NULL,completed_at TEXT);
    CREATE TABLE IF NOT EXISTS music_sessions (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,track TEXT NOT NULL,mode TEXT DEFAULT 'focus',playing INTEGER DEFAULT 0,progress_sec INTEGER DEFAULT 0,duration_sec INTEGER DEFAULT 0,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS device_connections (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,name TEXT NOT NULL,kind TEXT DEFAULT 'wearable',status TEXT DEFAULT 'connected',metadata_json TEXT DEFAULT '{}',updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sound_sessions (user_id TEXT PRIMARY KEY,mode TEXT DEFAULT 'ambient',volume INTEGER DEFAULT 68,voice_enabled INTEGER DEFAULT 1,output_name TEXT DEFAULT '',input_name TEXT DEFAULT '',updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS health_media (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,mime_type TEXT NOT NULL,filename TEXT NOT NULL,data TEXT,size_bytes INTEGER DEFAULT 0,created_at TEXT NOT NULL);
  `);

  app.post('/api/workout/start', auth, (req, res) => {
    const p = req.body || {}; const id = crypto.randomUUID();
    db.prepare('INSERT INTO workout_sessions(id,user_id,title,duration_min,load,status,created_at) VALUES(?,?,?,?,?,?,?)').run(id, uid(req), String(p.title || p.name || 'Workout'), Number(p.durationMin || p.duration_min || 0), Number(p.load || 0), 'active', now());
    res.json({ success: true, id, status: 'active' });
  });
  app.post('/api/workout/:id/stop', auth, (req, res) => {
    const p = req.body || {};
    db.prepare('UPDATE workout_sessions SET status=?,duration_min=COALESCE(?,duration_min),completed_at=? WHERE id=? AND user_id=?').run('completed', p.durationMin == null ? null : Number(p.durationMin), now(), req.params.id, uid(req));
    res.json({ success: true, id: req.params.id, status: 'completed' });
  });

  app.get('/api/route/history', auth, (req, res) => {
    const rows = db.prepare('SELECT id,title,distance_km distanceKm,duration_min durationMin,payload_json payload,created_at createdAt FROM saved_routes WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(uid(req));
    res.json({ success: true, routes: rows.map((r) => ({ ...r, payload: JSON.parse(r.payload || '{}') })) });
  });
  app.post('/api/route/save', auth, (req, res) => {
    const p = req.body || {}; const id = crypto.randomUUID();
    db.prepare('INSERT INTO saved_routes(id,user_id,title,distance_km,duration_min,payload_json,created_at) VALUES(?,?,?,?,?,?,?)').run(id, uid(req), String(p.title || p.name || 'Route'), Number(p.distanceKm || p.distance_km || p.distance || 0), Number(p.durationMin || p.duration_min || p.duration || 0), JSON.stringify(p), now());
    res.json({ success: true, id });
  });

  app.post('/api/assistant/chat', auth, async (req, res) => {
    const message = String(req.body?.message || req.body?.text || '').trim();
    if (!message) return res.status(400).json({ success: false, error: 'ข้อความว่าง' });
    db.prepare('INSERT INTO chat_messages(id,user_id,role,content,created_at) VALUES(?,?,?,?,?)').run(crypto.randomUUID(), uid(req), 'user', message, now());
    let answer = `รับทราบครับ: ${message}`;
    if (process.env.DEEPSEEK_API_KEY) {
      try {
        const history = db.prepare('SELECT role,content FROM chat_messages WHERE user_id=? ORDER BY created_at DESC LIMIT 12').all(uid(req)).reverse();
        const r = await fetch(process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` }, body: JSON.stringify({ model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', messages: [{ role: 'system', content: 'You are WK Health, a concise Thai health assistant. Do not diagnose. Give practical general wellness guidance.' }, ...history] }) });
        const j = await r.json(); answer = j?.choices?.[0]?.message?.content || answer;
      } catch (e) { console.error('assistant/chat provider failed', e); }
    }
    db.prepare('INSERT INTO chat_messages(id,user_id,role,content,created_at) VALUES(?,?,?,?,?)').run(crypto.randomUUID(), uid(req), 'assistant', answer, now());
    res.json({ success: true, reply: answer, message: answer, content: answer });
  });

  app.get('/api/barcode/:code', auth, async (req, res) => {
    const code = String(req.params.code || '').replace(/[^0-9A-Za-z.-]/g, '');
    if (!code) return res.status(400).json({ success: false, error: 'รหัสบาร์โค้ดไม่ถูกต้อง' });
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`, { headers: { accept: 'application/json', 'user-agent': 'WK-Health/1.0' } });
      const j = await r.json();
      if (j.status !== 1 || !j.product) return res.status(404).json({ success: false, error: 'ไม่พบสินค้า' });
      const p = j.product;
      res.json({ success: true, barcode: code, product: { name: p.product_name_th || p.product_name || '', brand: p.brands || '', image: p.image_front_url || '', calories: Number(p.nutriments?.['energy-kcal_100g'] || 0), protein: Number(p.nutriments?.proteins_100g || 0), carbs: Number(p.nutriments?.carbohydrates_100g || 0), fat: Number(p.nutriments?.fat_100g || 0) } });
    } catch (e) { console.error('barcode provider failed', e); res.status(502).json({ success: false, error: 'บริการค้นหาบาร์โค้ดไม่พร้อมใช้งาน' }); }
  });

  app.get('/api/music', auth, (req, res) => {
    const rows = db.prepare('SELECT id,track,mode,playing,progress_sec progressSec,duration_sec durationSec,updated_at updatedAt FROM music_sessions WHERE user_id=? ORDER BY updated_at DESC LIMIT 20').all(uid(req));
    res.json({ success: true, sessions: rows, items: rows });
  });
  app.post('/api/music', auth, (req, res) => {
    const p = req.body || {}; const id = crypto.randomUUID(); const track = String(p.url || p.track || p.title || '').trim();
    if (!track) return res.status(400).json({ success: false, error: 'กรุณาใส่ลิงก์หรือชื่อเพลง' });
    db.prepare('INSERT INTO music_sessions(id,user_id,track,mode,playing,progress_sec,duration_sec,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(id, uid(req), track, String(p.mode || 'focus'), p.playing ? 1 : 0, Number(p.progressSec || 0), Number(p.durationSec || 0), now());
    res.json({ success: true, id, track });
  });
  app.delete('/api/music/:id', auth, (req, res) => { db.prepare('DELETE FROM music_sessions WHERE id=? AND user_id=?').run(req.params.id, uid(req)); res.json({ success: true }); });

  app.get('/api/gallery', auth, (req, res) => {
    const rows = db.prepare('SELECT id,mime_type mimeType,filename,size_bytes sizeBytes,created_at createdAt FROM health_media WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(uid(req));
    res.json({ success: true, items: rows });
  });
  app.delete('/api/gallery/:id', auth, (req, res) => { db.prepare('DELETE FROM health_media WHERE id=? AND user_id=?').run(req.params.id, uid(req)); res.json({ success: true }); });

  // Full device contract used by both api.ts and live-api.ts.
  app.get('/api/devices', auth, (req, res) => {
    const rows = db.prepare('SELECT id,name,kind,status,metadata_json metadata,updated_at updatedAt FROM device_connections WHERE user_id=? ORDER BY updated_at DESC').all(uid(req)).map((x) => ({ ...x, deviceType: x.kind, deviceUid: x.id, metadata: JSON.parse(x.metadata || '{}') }));
    res.json({ success: true, devices: rows });
  });
  app.post('/api/devices', auth, (req, res) => {
    const p = req.body || {}; const id = crypto.randomUUID();
    const device = { id, name: String(p.name || 'WK Device'), kind: String(p.kind || p.deviceType || 'wearable'), status: String(p.status || 'connected'), metadata: p.metadata || {}, deviceType: String(p.deviceType || p.kind || 'wearable'), deviceUid: String(p.deviceUid || id) };
    db.prepare('INSERT INTO device_connections(id,user_id,name,kind,status,metadata_json,updated_at) VALUES(?,?,?,?,?,?,?)').run(id, uid(req), device.name, device.kind, device.status, JSON.stringify(device.metadata), now());
    res.json({ success: true, device });
  });
  app.post('/api/devices/connect', auth, (req, res) => {
    const p = req.body || {}; const id = crypto.randomUUID(); const name = String(p.name || p.deviceName || 'WK Device'); const kind = String(p.kind || p.deviceType || 'wearable'); const metadata = p.metadata || {};
    db.prepare('INSERT INTO device_connections(id,user_id,name,kind,status,metadata_json,updated_at) VALUES(?,?,?,?,?,?,?)').run(id, uid(req), name, kind, 'connected', JSON.stringify(metadata), now());
    res.json({ success: true, id, status: 'connected' });
  });
  app.post('/api/devices/:id/sync', auth, (req, res) => { db.prepare('UPDATE device_connections SET updated_at=?,status=? WHERE id=? AND user_id=?').run(now(), 'connected', req.params.id, uid(req)); res.json({ success: true, id: req.params.id, status: 'connected', syncedAt: now() }); });
  app.post('/api/devices/:id/disconnect', auth, (req, res) => { db.prepare('UPDATE device_connections SET status=?,updated_at=? WHERE id=? AND user_id=?').run('disconnected', now(), req.params.id, uid(req)); res.json({ success: true, id: req.params.id, status: 'disconnected' }); });
  app.delete('/api/devices/:id', auth, (req, res) => { db.prepare('DELETE FROM device_connections WHERE id=? AND user_id=?').run(req.params.id, uid(req)); res.json({ success: true }); });

  app.get('/api/sound', auth, (req, res) => {
    let r = db.prepare('SELECT mode,volume,voice_enabled voiceEnabled,output_name outputDevice,input_name inputDevice,updated_at updatedAt FROM sound_sessions WHERE user_id=?').get(uid(req));
    if (!r) { r = { mode: 'ambient', volume: 68, voiceEnabled: true, outputDevice: null, inputDevice: null, updatedAt: now() }; db.prepare('INSERT INTO sound_sessions(user_id,updated_at) VALUES(?,?)').run(uid(req), now()); }
    r.voiceEnabled = !!r.voiceEnabled;
    res.json({ success: true, ...r, settings: r });
  });
  app.put('/api/sound', auth, (req, res) => {
    const p = req.body || {};
    db.prepare('INSERT INTO sound_sessions(user_id,mode,volume,voice_enabled,output_name,input_name,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET mode=excluded.mode,volume=excluded.volume,voice_enabled=excluded.voice_enabled,output_name=excluded.output_name,input_name=excluded.input_name,updated_at=excluded.updated_at').run(uid(req), String(p.mode || 'ambient'), Math.max(0, Math.min(100, Number(p.volume ?? 68))), p.voiceEnabled === false ? 0 : 1, String(p.outputName || p.outputDevice || ''), String(p.inputName || p.inputDevice || ''), now());
    const settings = db.prepare('SELECT mode,volume,voice_enabled voiceEnabled,output_name outputDevice,input_name inputDevice,updated_at updatedAt FROM sound_sessions WHERE user_id=?').get(uid(req));
    settings.voiceEnabled = !!settings.voiceEnabled;
    res.json({ success: true, settings });
  });

  app.get('/api/notifications', auth, (req, res) => {
    const rows = db.prepare('SELECT id,type,title,body,read_at readAt,created_at createdAt FROM app_notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(uid(req));
    const settings = db.prepare('SELECT * FROM notification_settings WHERE user_id=?').get(uid(req));
    res.json({ success: true, items: rows, notifications: rows, settings: settings ? { mealReminder: !!settings.meal_reminder, waterReminder: !!settings.water_reminder, streakRisk: !!settings.streak_risk, weeklyInsight: !!settings.weekly_insight, smartTiming: !!settings.smart_timing } : null });
  });

  app.post('/api/friends/invite', auth, (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ success: false, error: 'กรุณาระบุอีเมล' });
    const friend = db.prepare('SELECT id,name,email FROM users WHERE email=?').get(email);
    if (!friend) return res.status(404).json({ success: false, error: 'ไม่พบบัญชีนี้' });
    if (friend.id === uid(req)) return res.status(400).json({ success: false, error: 'เพิ่มบัญชีตัวเองไม่ได้' });
    const createdAt = now();
    db.prepare('INSERT OR IGNORE INTO friendships(id,user_id,friend_id,created_at) VALUES(?,?,?,?)').run(crypto.randomUUID(), uid(req), friend.id, createdAt);
    db.prepare('INSERT OR IGNORE INTO friendships(id,user_id,friend_id,created_at) VALUES(?,?,?,?)').run(crypto.randomUUID(), friend.id, uid(req), createdAt);
    res.json({ success: true, friend: { id: friend.id, name: friend.name, email: friend.email } });
  });

  app.get('/api/health', auth, (req, res) => {
    const user = db.prepare('SELECT 1 ok FROM users WHERE id=?').get(uid(req));
    const dbOk = !!db.prepare('SELECT 1 ok').get()?.ok;
    res.json({ success: true, status: 'ok', db: dbOk, user: !!user, timestamp: now() });
  });
};
