const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = __dirname;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const filename = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!filename.startsWith(root + path.sep) || pathname.includes('/.git') || pathname.includes('/tests') || pathname.endsWith('.cjs')) { res.writeHead(403); res.end(); return; }
  fs.readFile(filename, (error, bytes) => { if (error) { res.writeHead(404); return res.end('Not found'); } res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(bytes); });
}).listen(4173, '127.0.0.1', () => console.log('Business Hub preview: http://127.0.0.1:4173'));
