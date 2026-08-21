import http from 'node:http';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function firstExisting(paths) {
  for (const candidate of paths) {
    try { await access(candidate); return candidate; } catch {}
  }
  throw new Error(`No frontend build output found. Checked: ${paths.join(', ')}`);
}

const root = await firstExisting([
  path.join(projectRoot, 'dist'),
  path.join(projectRoot, '.output', 'public'),
]);

function safePath(urlPath) {
  const pathname = decodeURIComponent((urlPath || '/').split('?')[0]);
  const candidate = path.resolve(root, `.${pathname}`);
  return candidate.startsWith(root + path.sep) || candidate === root ? candidate : null;
}

const indexFile = path.join(root, 'index.html');
const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }

  let file = safePath(req.url);
  if (!file) {
    res.writeHead(400);
    return res.end('Bad request');
  }

  try {
    const info = await stat(file);
    if (info.isDirectory()) file = path.join(file, 'index.html');
  } catch {
    file = indexFile;
  }

  let body;
  try {
    body = await readFile(file);
  } catch {
    body = await readFile(indexFile);
    file = indexFile;
  }

  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    'Content-Type': mime[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  if (req.method === 'HEAD') return res.end();
  res.end(body);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`WK Health frontend listening on ${port}; build root: ${root}`);
});
