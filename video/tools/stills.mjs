// Render single frames of a scene to PNG for quick review (and time each frame).
// Usage: node tools/stills.mjs scenes/x.html "?ch=2" out/stills 1.5 10 22.3   (or: ... out/stills cuts)
import { chromium } from 'playwright';
import http from 'node:http';
import path from 'node:path';
import { mkdirSync, existsSync, statSync, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
const [scene, query, outDir, ...times] = process.argv.slice(2);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' }); createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.addInitScript(() => { window.__RENDER__ = true; });
page.on('pageerror', (e) => { console.error('page error:', e.message); process.exit(2); });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('console:', m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/${path.relative(ROOT, path.resolve(scene))}${query || ''}`);
await page.waitForFunction(() => window.VIDEO && typeof window.seek === 'function', null, { timeout: 120000 });
await page.evaluate(() => document.fonts.ready);
mkdirSync(outDir, { recursive: true });
let list = times;
// "cuts": one still 1.4 s into every shot (scenes that expose window.CHAPTER.cuts())
if (times[0] === 'cuts') list = (await page.evaluate(() => window.CHAPTER.cuts())).map((c, i, a) => Math.min(c + 1.4, ((a[i + 1] ?? 1e9) + c) / 2).toFixed(2));
for (const t of list) {
  const t0 = Date.now();
  await page.evaluate((x) => window.seek(Number(x)), t);
  await page.screenshot({ path: path.join(outDir, `t${t}.png`), clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  console.log(`t=${t}  ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}
await browser.close(); server.close();
