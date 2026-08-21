const crypto = require('crypto');

module.exports = function mountRuntimeFeatures(app, { db, auth }) {
  const uid = (req) => req.user.sub;
  const now = () => new Date().toISOString();
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_daily (user_id TEXT NOT NULL, date TEXT NOT NULL, steps INTEGER DEFAULT 0, distance_km REAL DEFAULT 0, active_minutes INTEGER DEFAULT 0, floors INTEGER DEFAULT 0, PRIMARY KEY(user_id,date));
    CREATE TABLE IF NOT EXISTS workout_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, duration_min INTEGER DEFAULT 0, load REAL DEFAULT 0, status TEXT DEFAULT 'planned', created_at TEXT NOT NULL, completed_at TEXT);
    CREATE TABLE IF NOT EXISTS music_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, track TEXT NOT NULL, mode TEXT DEFAULT 'focus', playing INTEGER DEFAULT 0, progress_sec INTEGER DEFAULT 0, duration_sec INTEGER DEFAULT 0, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS device_connections (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, kind TEXT DEFAULT 'wearable', status TEXT DEFAULT 'connected', metadata_json TEXT DEFAULT '{}', updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sound_sessions (user_id TEXT PRIMARY KEY, mode TEXT DEFAULT 'ambient', volume INTEGER DEFAULT 68, voice_enabled INTEGER DEFAULT 1, output_name TEXT DEFAULT '', input_name TEXT DEFAULT '', updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS health_media (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, mime_type TEXT NOT NULL, filename TEXT NOT NULL, data TEXT, size_bytes INTEGER DEFAULT 0, created_at TEXT NOT NULL);
  `);

  app.get('/api/health/overview', auth, (req, res) => {
    const stats = db.prepare('SELECT COALESCE(SUM(calories),0) eaten,COALESCE(SUM(protein),0) protein,COALESCE(SUM(carbs),0) carbs,COALESCE(SUM(fat),0) fat FROM diary WHERE user_id=? AND date=?').get(uid(req), new Date().toISOString().slice(0,10));
    const water = db.prepare('SELECT glasses,goal_glasses goalGlasses FROM water WHERE user_id=?').get(uid(req)) || { glasses: 0, goalGlasses: 8 };
    const activity = db.prepare('SELECT steps,distance_km distanceKm,active_minutes activeMinutes,floors FROM activity_daily WHERE user_id=? AND date=?').get(uid(req), new Date().toISOString().slice(0,10)) || { steps: 0, distanceKm: 0, activeMinutes: 0, floors: 0 };
    res.json({ success:true, readiness:87, ...stats, ...water, ...activity });
  });

  app.get('/api/pedometer', auth, (req, res) => {
    const date = String(req.query.date || new Date().toISOString().slice(0,10));
    const row = db.prepare('SELECT steps,distance_km distanceKm,active_minutes activeMinutes,floors FROM activity_daily WHERE user_id=? AND date=?').get(uid(req), date) || { steps: 0, distanceKm: 0, activeMinutes: 0, floors: 0 };
    res.json({ success:true, ...row, goalSteps:10000 });
  });
  app.post('/api/pedometer', auth, (req, res) => {
    const p=req.body||{}, date=String(p.date||new Date().toISOString().slice(0,10));
    db.prepare('INSERT INTO activity_daily(user_id,date,steps,distance_km,active_minutes,floors) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,date) DO UPDATE SET steps=excluded.steps,distance_km=excluded.distance_km,active_minutes=excluded.active_minutes,floors=excluded.floors').run(uid(req),date,Number(p.steps||0),Number(p.distanceKm||p.distance_km||0),Number(p.activeMinutes||p.active_minutes||0),Number(p.floors||0));
    res.json({success:true});
  });

  app.get('/api/workout', auth, (req,res)=>res.json({success:true,sessions:db.prepare('SELECT id,title,duration_min durationMin,load,status,created_at createdAt,completed_at completedAt FROM workout_sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 30').all(uid(req))}));
  app.post('/api/workout', auth, (req,res)=>{const p=req.body||{},id=crypto.randomUUID();db.prepare('INSERT INTO workout_sessions(id,user_id,title,duration_min,load,status,created_at) VALUES(?,?,?,?,?,?,?)').run(id,uid(req),String(p.title||'Workout'),Number(p.durationMin||p.duration_min||0),Number(p.load||0),String(p.status||'planned'),now());res.json({success:true,id});});
  app.patch('/api/workout/:id', auth, (req,res)=>{const p=req.body||{};const status=String(p.status||'completed');db.prepare('UPDATE workout_sessions SET status=?,completed_at=? WHERE id=? AND user_id=?').run(status,status==='completed'?now():null,req.params.id,uid(req));res.json({success:true});});

  app.get('/api/music', auth, (req,res)=>{const rows=db.prepare('SELECT id,track,mode,playing,progress_sec progressSec,duration_sec durationSec,updated_at updatedAt FROM music_sessions WHERE user_id=? ORDER BY updated_at DESC LIMIT 20').all(uid(req));res.json({success:true,sessions:rows});});
  app.post('/api/music/session', auth, (req,res)=>{const p=req.body||{},id=crypto.randomUUID();db.prepare('INSERT INTO music_sessions(id,user_id,track,mode,playing,progress_sec,duration_sec,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(id,uid(req),String(p.track||'Nocturne Drift'),String(p.mode||'focus'),p.playing?1:0,Number(p.progressSec||0),Number(p.durationSec||0),now());res.json({success:true,id});});
  app.patch('/api/music/session/:id', auth, (req,res)=>{const p=req.body||{};db.prepare('UPDATE music_sessions SET playing=COALESCE(?,playing),progress_sec=COALESCE(?,progress_sec),mode=COALESCE(?,mode),updated_at=? WHERE id=? AND user_id=?').run(p.playing===undefined?null:(p.playing?1:0),p.progressSec===undefined?null:Number(p.progressSec),p.mode===undefined?null:String(p.mode),now(),req.params.id,uid(req));res.json({success:true});});

  app.get('/api/devices', auth, (req,res)=>res.json({success:true,devices:db.prepare('SELECT id,name,kind,status,metadata_json metadata,updated_at updatedAt FROM device_connections WHERE user_id=? ORDER BY updated_at DESC').all(uid(req)).map(x=>({...x,metadata:JSON.parse(x.metadata||'{}')}))}));
  app.post('/api/devices', auth, (req,res)=>{const p=req.body||{},id=crypto.randomUUID();db.prepare('INSERT INTO device_connections(id,user_id,name,kind,status,metadata_json,updated_at) VALUES(?,?,?,?,?,?,?)').run(id,uid(req),String(p.name||'WK Device'),String(p.kind||'wearable'),String(p.status||'connected'),JSON.stringify(p.metadata||{}),now());res.json({success:true,id});});
  app.patch('/api/devices/:id', auth, (req,res)=>{const p=req.body||{};db.prepare('UPDATE device_connections SET status=COALESCE(?,status),metadata_json=COALESCE(?,metadata_json),updated_at=? WHERE id=? AND user_id=?').run(p.status===undefined?null:String(p.status),p.metadata===undefined?null:JSON.stringify(p.metadata),now(),req.params.id,uid(req));res.json({success:true});});

  app.get('/api/sound', auth, (req,res)=>{let r=db.prepare('SELECT mode,volume,voice_enabled voiceEnabled,output_name outputName,input_name inputName FROM sound_sessions WHERE user_id=?').get(uid(req));if(!r){r={mode:'ambient',volume:68,voiceEnabled:1,outputName:'',inputName:''};db.prepare('INSERT INTO sound_sessions(user_id,updated_at) VALUES(?,?)').run(uid(req),now())}res.json({success:true,...r,voiceEnabled:!!r.voiceEnabled});});
  app.patch('/api/sound', auth, (req,res)=>{const p=req.body||{};db.prepare('INSERT INTO sound_sessions(user_id,mode,volume,voice_enabled,output_name,input_name,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET mode=excluded.mode,volume=excluded.volume,voice_enabled=excluded.voice_enabled,output_name=excluded.output_name,input_name=excluded.input_name,updated_at=excluded.updated_at').run(uid(req),String(p.mode||'ambient'),Math.max(0,Math.min(100,Number(p.volume??68))),p.voiceEnabled===false?0:1,String(p.outputName||''),String(p.inputName||''),now());res.json({success:true});});

  app.get('/api/gallery', auth, (req,res)=>res.json({success:true,items:db.prepare('SELECT id,mime_type mimeType,filename,size_bytes sizeBytes,created_at createdAt FROM health_media WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(uid(req))}));
  app.post('/api/gallery/upload', auth, (req,res)=>{const p=req.body||{};if(!p.imageBase64)return res.status(400).json({success:false,error:'ไม่พบไฟล์'});const mime=String(p.mimeType||'image/jpeg');if(!/^image\/(jpeg|png|webp)$|^video\/(mp4|webm)$/.test(mime))return res.status(400).json({success:false,error:'ชนิดไฟล์ไม่รองรับ'});const raw=String(p.imageBase64).replace(/^data:[^;]+;base64,/,'');if(raw.length>16_000_000)return res.status(413).json({success:false,error:'ไฟล์ใหญ่เกินไป'});const id=crypto.randomUUID();db.prepare('INSERT INTO health_media(id,user_id,mime_type,filename,data,size_bytes,created_at) VALUES(?,?,?,?,?,?,?)').run(id,uid(req),mime,String(p.filename||`wk-${id}`),raw,Buffer.byteLength(raw,'base64'),now());res.json({success:true,id,mimeType:mime,filename:String(p.filename||`wk-${id}`)});});
  app.get('/api/gallery/:id', auth, (req,res)=>{const r=db.prepare('SELECT mime_type mimeType,filename,data FROM health_media WHERE id=? AND user_id=?').get(req.params.id,uid(req));if(!r)return res.status(404).json({success:false,error:'ไม่พบไฟล์'});res.json({success:true,...r});});
};
