import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const files = new Map([['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']], ['/style.css', ['style.css', 'text/css']], ['/app.js', ['app.js', 'text/javascript']], ['/discord.js', ['discord.js', 'text/javascript']], ['/icon.svg', ['icon.svg', 'image/svg+xml']]]);
export const server = createServer(async (req, res) => {
  const file = files.get(new URL(req.url, 'http://localhost').pathname);
  if (!file) { res.writeHead(404); res.end('Not found'); return; }
  try { const content = await readFile(fileURLToPath(new URL(file[0], root))); res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(content); }
  catch { res.writeHead(500); res.end('Unable to serve file'); }
});
server.listen(8080, '127.0.0.1', () => console.log('LiveBot: http://127.0.0.1:8080'));
