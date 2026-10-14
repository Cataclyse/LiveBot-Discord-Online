import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { handleRelay } from '../relay/worker.js';
const root = new URL('../', import.meta.url);
const files = new Map([['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']], ['/style.css', ['style.css', 'text/css']], ['/app.js', ['app.js', 'text/javascript']], ['/discord.js', ['discord.js', 'text/javascript']], ['/config.js', ['config.js', 'text/javascript']], ['/icon.svg', ['icon.svg', 'image/svg+xml']]]);
for (const file of ['message-content.js', 'media.js', 'icons.js']) files.set('/' + file, [file, 'text/javascript']);
export function createLocalServer(fetcher = globalThis.fetch) { return createServer(async (req, res) => {
  const host = req.headers.host || '';
  if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)) { res.writeHead(403); res.end('Local requests only'); return; }
  const origin = `http://${host}`;
  if ((req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site') { res.writeHead(403); res.end('Origin not allowed'); return; }
  const url = new URL(req.url, origin);
  if (url.pathname === '/livebot-health' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ relay: 'livebot-local-v1' })); return; }
  if (url.pathname.startsWith('/api/discord/')) {
    try {
      const headers = new Headers();
      for (const key of ['authorization', 'content-type']) if (req.headers[key]) headers.set(key, req.headers[key]);
      headers.set('Origin', origin);
      const request = new Request(url, { method: req.method, headers, ...(req.method === 'POST' ? { body: req, duplex: 'half' } : {}) });
      const response = await handleRelay(request, [origin], fetcher);
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
    } catch { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ message: 'Local relay error' })); }
    return;
  }
  const assetTypes = { svg: 'image/svg+xml', woff2: 'font/woff2', js: 'text/javascript', json: 'application/json', txt: 'text/plain', LICENSE: 'text/plain' };
  const assetExtension = url.pathname.split('.').at(-1);
  const file = files.get(url.pathname) || (/^\/assets\/[a-zA-Z0-9_./-]+$/.test(url.pathname) && !url.pathname.split('/').includes('..') && assetTypes[assetExtension] ? [url.pathname.slice(1), assetTypes[assetExtension]] : null);
  if (!file) { res.writeHead(404); res.end('Not found'); return; }
  try { const content = await readFile(fileURLToPath(new URL(file[0], root))); res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(content); }
  catch { res.writeHead(500); res.end('Unable to serve file'); }
}); }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) createLocalServer().listen(8080, '127.0.0.1', () => console.log('LiveBot: http://127.0.0.1:8080 (local relay enabled)'));
