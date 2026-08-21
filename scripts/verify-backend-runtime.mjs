import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const port = Number(process.env.WK_TEST_PORT || 18123);
const base = process.env.WK_TEST_BASE_URL || `http://127.0.0.1:${port}`;
const dbPath = path.join(os.tmpdir(), `wk-health-contract-${process.pid}.db`);
try { fs.rmSync(dbPath, { force: true }); } catch {}

if (!fs.existsSync(path.join(process.cwd(), 'backend', 'node_modules'))) {
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund'], { cwd: path.join(process.cwd(), 'backend'), stdio: 'inherit' });
}

const child = spawn(process.execPath, ['bootstrap.js'], {
  cwd: path.join(process.cwd(), 'backend'),
  env: { ...process.env, PORT: String(port), DB_PATH: dbPath, JWT_SECRET: 'wk-runtime-contract-test-secret' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let logs = '';
child.stdout.on('data', (d) => { logs += d.toString(); });
child.stderr.on('data', (d) => { logs += d.toString(); });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitForHealth() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${base}/healthz`); if (r.ok) return; } catch {}
    await sleep(250);
  }
  throw new Error(`backend did not become healthy\n${logs}`);
}

let passed = 0;
async function request(method, pathName, body, expected = [200]) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch(`${base}${pathName}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch {}
  if (!expected.includes(r.status)) throw new Error(`${method} ${pathName}: expected ${expected.join('/')}, got ${r.status} ${JSON.stringify(data)}`);
  passed++;
  return { r, data };
}

let token = '';
const email = `runtime-${Date.now()}@wk-health.test`;
const email2 = `runtime-friend-${Date.now()}@wk-health.test`;
try {
  await waitForHealth();
  await request('GET', '/healthz');
  let x = await request('POST', '/api/auth/register', { name: 'Runtime Test', email, password: 'password123' });
  token = x.data.token;
  if (!token) throw new Error('register did not return token');
  await request('POST', '/api/auth/login', { email, password: 'password123' });
  await request('GET', '/api/auth/me');
  await request('PATCH', '/api/auth/me', { displayName: 'Runtime Verified' });
  await request('POST', '/api/scan/vision', { imageBase64: 'aGVsbG8=', mimeType: 'image/jpeg' });
  await request('POST', '/api/scan/calc', { description: 'ข้าวและไก่' });
  await request('POST', '/api/scan/save', { name: 'Runtime Meal', kcal: 500, protein: 30, carb: 50, fat: 15 });
  await request('GET', '/api/diary?date=2099-01-01');
  await request('GET', '/api/stats/today');
  await request('GET', '/api/stats/weekly');
  await request('GET', '/api/stats/week-summary');
  await request('GET', '/api/water/today');
  await request('POST', '/api/water', { glasses: 3 });
  await request('GET', '/api/checkin/today');
  await request('GET', '/api/mood/list');
  await request('GET', '/api/mood/recommend?mood=calm&meal=main');
  await request('POST', '/api/mood/log', { mood: 'calm' });
  await request('POST', '/api/nlp/analyze', { text: 'ข้าวไก่' });
  await request('POST', '/api/budget/plan', { monthlyBudget: 5000, conditions: [], allergies: [], days: 2 });
  await request('POST', '/api/workout/start', { title: 'Contract Test', durationMin: 20 });
  const workout = await request('GET', '/api/workout');
  const workoutId = workout.data.sessions?.[0]?.id;
  if (workoutId) await request('POST', `/api/workout/${workoutId}/stop`, { durationMin: 20 });
  await request('GET', '/api/route/history');
  const route = await request('POST', '/api/route/save', { title: 'Test Route', distanceKm: 1.2, durationMin: 15 });
  await request('GET', '/api/route/history');
  await request('POST', '/api/assistant/chat', { message: 'สวัสดี' });
  await request('GET', '/api/assistant/history');
  await request('GET', '/api/barcode/0000000000000', undefined, [404, 502]);
  const music = await request('POST', '/api/music', { url: 'https://example.com/track.mp3', title: 'Contract Track' });
  await request('GET', '/api/music');
  if (music.data.id) await request('DELETE', `/api/music/${music.data.id}`);
  const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const gallery = await request('POST', '/api/gallery/upload', { imageBase64: pixel, mimeType: 'image/png', filename: 'contract.png' });
  await request('GET', '/api/gallery');
  if (gallery.data.id) { await request('GET', `/api/gallery/${gallery.data.id}`); await request('DELETE', `/api/gallery/${gallery.data.id}`); }
  const device = await request('POST', '/api/devices', { name: 'Contract Watch', deviceType: 'wearable' });
  await request('GET', '/api/devices');
  if (device.data.device?.id) { await request('POST', `/api/devices/${device.data.device.id}/sync`); await request('POST', `/api/devices/${device.data.device.id}/disconnect`); await request('DELETE', `/api/devices/${device.data.device.id}`); }
  const connected = await request('POST', '/api/devices/connect', { name: 'Contract Watch 2', kind: 'wearable' });
  if (connected.data.id) await request('POST', `/api/devices/${connected.data.id}/disconnect`);
  await request('GET', '/api/sound');
  await request('PUT', '/api/sound', { volume: 70, mode: 'focus', voiceEnabled: true });
  await request('GET', '/api/notifications');
  await request('GET', '/api/notifications/settings');
  await request('PATCH', '/api/notifications/settings', { smartTiming: true });
  await request('GET', '/api/friends');
  await request('GET', '/api/friends/invite-code');
  const friend = await request('POST', '/api/auth/register', { name: 'Runtime Friend', email: email2, password: 'password123' });
  const token1 = token; token = friend.data.token;
  await request('GET', '/api/auth/me');
  token = token1;
  await request('POST', '/api/friends/invite', { email: email2 });
  await request('GET', '/api/health');
  await request('GET', '/api/health/overview');
  await request('GET', '/api/pedometer');
  await request('POST', '/api/pedometer', { steps: 1000, distanceKm: 0.7, activeMinutes: 12, floors: 2 });
  await request('GET', '/api/export/history');
  await request('POST', '/api/auth/logout');
  console.log(`BACKEND RUNTIME CONTRACT PASSED: ${passed} requests`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error(logs);
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
  try { fs.rmSync(dbPath, { force: true }); } catch {}
}
