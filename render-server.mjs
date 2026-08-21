import http from 'node:http';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const backendUrl = (
  process.env.BACKEND_URL ||
  process.env.VITE_API_BASE_URL ||
  process.env.VITE_API_URL ||
  process.env.VITE_BACKEND_URL ||
  ''
).trim().replace(/\/$/, '');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2'};

async function firstExisting(paths) { for (const candidate of paths) { try { await access(candidate); return candidate; } catch {} } throw new Error(`No frontend build output found. Checked: ${paths.join(', ')}`); }
const root = await firstExisting([path.join(projectRoot,'dist')]);
const indexFile = path.join(root,'index.html');
function safePath(urlPath) { const pathname=decodeURIComponent((urlPath||'/').split('?')[0]); const candidate=path.resolve(root,`.${pathname}`); return candidate.startsWith(root+path.sep)||candidate===root?candidate:null; }

async function proxyApi(req, res) {
  if (!backendUrl) {
    res.writeHead(503, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'});
    return res.end(JSON.stringify({success:false,error:'backend_not_configured'}));
  }
  const target = `${backendUrl}${req.url}`;
  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase() === 'host' || value == null) continue;
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = ['GET','HEAD'].includes(req.method || 'GET') ? undefined : Buffer.concat(chunks);
    const upstream = await fetch(target, { method: req.method, headers, body, redirect: 'manual' });
    const responseHeaders = {};
    upstream.headers.forEach((value, key) => {
      if (!['connection','keep-alive','transfer-encoding','upgrade'].includes(key.toLowerCase())) responseHeaders[key] = value;
    });
    res.writeHead(upstream.status, responseHeaders);
    if (req.method === 'HEAD') return res.end();
    const arrayBuffer = await upstream.arrayBuffer();
    return res.end(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error('API proxy failed:', req.method, req.url, error);
    res.writeHead(502, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'});
    return res.end(JSON.stringify({success:false,error:'backend_unreachable'}));
  }
}

const server=http.createServer(async(req,res)=>{
  const pathname=(req.url||'/').split('?')[0];
  if(pathname.startsWith('/api/')) return proxyApi(req,res);
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{Allow:'GET, HEAD'});return res.end();}
  if(pathname==='/healthz'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});return res.end(JSON.stringify({status:'ok',service:'wk-health-frontend',backendConfigured:Boolean(backendUrl)}));}
  let file=safePath(req.url); if(!file){res.writeHead(400);return res.end('Bad request');}
  try { const info=await stat(file); if(info.isDirectory()) file=path.join(file,'index.html'); } catch { file=indexFile; }
  let body; try { body=await readFile(file); } catch { body=await readFile(indexFile); file=indexFile; }
  const ext=path.extname(file).toLowerCase(); res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':ext==='.html'?'no-cache':'public, max-age=31536000, immutable'}); if(req.method==='HEAD')return res.end(); res.end(body);
});
server.listen(port,'0.0.0.0',()=>console.log(`WK Health frontend listening on ${port}; build root: ${root}; backend proxy: ${backendUrl || 'NOT CONFIGURED'}`));