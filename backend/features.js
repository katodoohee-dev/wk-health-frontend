const crypto = require('crypto');

module.exports = function mountFeatures(app, { db, auth }) {
  const now = () => new Date().toISOString();
  const uid = (req) => req.user.sub;

  db.exec(`
    CREATE TABLE IF NOT EXISTS export_history (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, format TEXT NOT NULL, range TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS friend_locations (user_id TEXT PRIMARY KEY, lat REAL, lng REAL, accuracy REAL, heading REAL, speed_mps REAL, enabled INTEGER DEFAULT 0, updated_at TEXT NOT NULL);
  `);

  app.post('/api/export', auth, (req, res) => {
    const format = req.body?.format; const range = req.body?.range || '30d';
    if (!['pdf', 'csv'].includes(format)) return res.status(400).json({ success: false, error: 'format ไม่ถูกต้อง' });
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO export_history(id,user_id,format,range,created_at) VALUES(?,?,?,?,?)').run(id, uid(req), format, range, now());
    res.json({ success: true, id, downloadUrl: `${req.protocol}://${req.get('host')}/api/export/download/${id}.${format}` });
  });
  app.get('/api/export/history', auth, (req, res) => res.json(db.prepare('SELECT id,format,range,created_at createdAt FROM export_history WHERE user_id=? ORDER BY created_at DESC LIMIT 20').all(uid(req))));
  app.get('/api/export/download/:id.csv', auth, (req, res) => {
    const job = db.prepare('SELECT * FROM export_history WHERE id=? AND user_id=? AND format=\'csv\'').get(req.params.id, uid(req));
    if (!job) return res.status(404).json({ success: false, error: 'ไม่พบไฟล์' });
    const rows = db.prepare('SELECT date,meal_type,food_name,calories,protein,carbs,fat,source,created_at FROM diary WHERE user_id=? ORDER BY created_at DESC LIMIT 5000').all(uid(req));
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const body = ['date,meal_type,food_name,calories,protein,carbs,fat,source,created_at', ...rows.map(r => [r.date,r.meal_type,r.food_name,r.calories,r.protein,r.carbs,r.fat,r.source,r.created_at].map(esc).join(','))].join('\n');
    res.setHeader('Content-Type','text/csv; charset=utf-8'); res.setHeader('Content-Disposition',`attachment; filename=wk-health-${job.range}-${job.id}.csv`); res.send('\uFEFF' + body);
  });
  app.get('/api/export/download/:id.pdf', auth, (req, res) => {
    const job = db.prepare('SELECT * FROM export_history WHERE id=? AND user_id=? AND format=\'pdf\'').get(req.params.id, uid(req));
    if (!job) return res.status(404).json({ success: false, error: 'ไม่พบไฟล์' });
    const rows = db.prepare('SELECT date,meal_type,food_name,calories FROM diary WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(uid(req));
    const lines = ['WK Health Export', `Range: ${job.range}`, `Created: ${now()}`, '', ...rows.map(r => `${r.date} | ${r.meal_type || ''} | ${r.food_name || ''} | ${r.calories || 0} kcal`)];
    const text = lines.join('\n').replace(/[()\\]/g, '\\$&');
    const stream = `BT /F1 10 Tf 40 780 Td 12 TL (${text.split('\n').join(') Tj T* (')}) Tj ET`;
    const objects = [`1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj`, `2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj`, `3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>endobj`, `4 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj`, `5 0 obj<< /Length ${Buffer.byteLength(stream)} >>stream\n${stream}\nendstream endobj`];
    let pdf = '%PDF-1.4\n'; const offsets = [0]; for (const o of objects) { offsets.push(Buffer.byteLength(pdf)); pdf += o + '\n'; }
    const xref = Buffer.byteLength(pdf); pdf += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    res.setHeader('Content-Type','application/pdf'); res.setHeader('Content-Disposition',`attachment; filename=wk-health-${job.range}-${job.id}.pdf`); res.send(Buffer.from(pdf));
  });

  app.get('/api/insight/weekly', auth, (req, res) => {
    const rows = db.prepare("SELECT date,COALESCE(SUM(calories),0) kcal FROM diary WHERE user_id=? AND date>=date('now','-6 days') GROUP BY date ORDER BY date").all(uid(req));
    const avgKcal = rows.length ? Math.round(rows.reduce((a,r)=>a+Number(r.kcal||0),0)/rows.length) : 0;
    const bestDay = rows.length ? rows.reduce((a,b)=>Number(a.kcal)<=Number(b.kcal)?a:b) : null;
    res.json({ headline: rows.length ? 'สัปดาห์นี้เริ่มมีรูปแบบที่อ่านได้' : 'เริ่มบันทึกวันนี้เพื่อสร้าง insight', daysLogged: rows.length, avgKcal, daysOnGoal: rows.filter(r=>Number(r.kcal||0)<=2000).length, totalSteps: 0, totalWorkoutMinutes: 0, streakChange: 0, bestDay: bestDay ? {date:bestDay.date,kcal:Number(bestDay.kcal)} : null, tips: rows.length ? ['รักษาความสม่ำเสมอของการบันทึก','ตรวจปริมาณก่อนบันทึกมื้อใหญ่'] : ['ลองสแกนมื้ออาหารแรกของวันนี้'] });
  });

  app.post('/api/friends/location/publish', auth, (req, res) => {
    const p=req.body||{}; db.prepare('INSERT INTO friend_locations(user_id,lat,lng,accuracy,heading,speed_mps,enabled,updated_at) VALUES(?,?,?,?,?,?,1,?) ON CONFLICT(user_id) DO UPDATE SET lat=excluded.lat,lng=excluded.lng,accuracy=excluded.accuracy,heading=excluded.heading,speed_mps=excluded.speed_mps,enabled=1,updated_at=excluded.updated_at').run(uid(req),Number(p.lat),Number(p.lng),Number(p.accuracy||0),Number(p.heading||0),Number(p.speedMps||0),now()); res.json({success:true});
  });
  app.post('/api/friends/location/share', auth, (req,res)=>{db.prepare('INSERT INTO friend_locations(user_id,enabled,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at').run(uid(req),req.body?.enabled?1:0,now());res.json({success:true})});
  app.get('/api/friends/location/status', auth, (req,res)=>{const r=db.prepare('SELECT enabled FROM friend_locations WHERE user_id=?').get(uid(req));res.json({enabled:!!r?.enabled,visibleToConfirmedFriends:!!r?.enabled})});
  app.post('/api/notifications/test', auth, (_req,res)=>res.json({success:true,delivered:false,reason:'Web Push ต้องตั้ง VAPID credentials ก่อน'}));
};
