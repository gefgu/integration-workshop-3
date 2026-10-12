import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const revisionDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
const projectDir = resolve(revisionDir, '..');
const port = Number(process.env.PORT || 5501);
let building = false;
const mime = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };

function send(res, status, body, type = 'application/json; charset=utf-8', origin) {
  const headers = { 'content-type': type, 'cache-control': 'no-store' };
  if (origin) headers['access-control-allow-origin'] = origin;
  res.writeHead(status, headers);
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, `http://127.0.0.1:${port}`).pathname;
  const requestOrigin = req.headers.origin;
  const allowedOrigin = [`http://127.0.0.1:${port}`, `http://localhost:${port}`, 'http://127.0.0.1:5500', 'http://localhost:5500'].includes(requestOrigin) ? requestOrigin : undefined;
  if (req.method === 'OPTIONS' && pathname === '/api/save-layout') {
    if (!allowedOrigin) return send(res, 403, { error: 'Editor requests must come from localhost.' });
    res.writeHead(204, {
      'access-control-allow-origin': allowedOrigin,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '600',
    });
    return res.end();
  }
  if (req.method === 'POST' && pathname === '/api/save-layout') {
    if (requestOrigin && !allowedOrigin) return send(res, 403, { error: 'Editor requests must come from localhost.' });
    if (building) return send(res, 409, { error: 'A schematic rebuild is already running.' }, undefined, allowedOrigin);
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 1_000_000) return send(res, 413, { error: 'Layout is too large.' }, undefined, allowedOrigin);
    }
    let layout;
    try { layout = JSON.parse(raw); } catch { return send(res, 400, { error: 'Invalid layout JSON.' }, undefined, allowedOrigin); }
    if (!layout || Array.isArray(layout) || typeof layout !== 'object') return send(res, 400, { error: 'Expected a component-position map.' }, undefined, allowedOrigin);
    const circuit = JSON.parse(readFileSync(resolve(revisionDir, 'lower/circuits/power-Complete-schematic.circuit.json'), 'utf8'));
    const known = new Set(circuit.filter((entry) => entry.type === 'source_component').map((entry) => entry.name));
    for (const [ref, point] of Object.entries(layout)) {
      if (!known.has(ref) || !Array.isArray(point) || point.length !== 2 || !point.every((n) => Number.isFinite(n) && Math.abs(n) <= 500)) {
        return send(res, 400, { error: `Invalid component position: ${ref}` }, undefined, allowedOrigin);
      }
    }
    building = true;
    writeFileSync(resolve(revisionDir, 'power-schematic-layout.json'), JSON.stringify(layout, null, 2) + '\n');
    const child = spawn('npm', ['run', 'build:revision8'], { cwd: projectDir, stdio: ['ignore', 'pipe', 'pipe'] });
    let buildLog = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => {
      const text = chunk.toString();
      buildLog = (buildLog + text).slice(-12000);
      (stream === child.stdout ? process.stdout : process.stderr).write(chunk);
    });
    child.on('error', (error) => { building = false; send(res, 500, { error: `Could not start the rebuild: ${error.message}` }, undefined, allowedOrigin); });
    child.on('exit', (code) => {
      building = false;
      if (res.writableEnded) return;
      if (code === 0) send(res, 200, { ok: true, placements: Object.keys(layout).length }, undefined, allowedOrigin);
      else send(res, 500, { error: `Build failed with exit code ${code}. Your layout file was saved at revision8/power-schematic-layout.json.`, details: buildLog.slice(-5000) }, undefined, allowedOrigin);
    });
    return;
  }

  const relative = pathname === '/' ? 'power-schematic-editor.html' : decodeURIComponent(pathname.slice(1));
  const file = resolve(revisionDir, relative);
  if (file !== revisionDir && !file.startsWith(revisionDir + sep)) return send(res, 403, { error: 'Forbidden.' });
  try {
    const content = readFileSync(file);
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(content);
  } catch { send(res, 404, { error: 'Not found.' }); }
});

server.listen(port, '127.0.0.1', () => console.log(`Power schematic editor: http://127.0.0.1:${port}/`));
