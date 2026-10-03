// Render a scene to MP4: load the HTML in headless Chromium, call
// window.seek(t) for every frame, screenshot it, and pipe the frames to ffmpeg.
//
// Usage: node render.mjs scenes/example.html [options]
//   --out file.mp4      output path (default out/<scene>.mp4)
//   --audio file        mux an audio track (cut to the shorter of video and audio)
//   --preview           fast draft: half resolution, 15 fps, JPEG frames (for motion review)
//   --scale 0.5         render at a fraction of full resolution
//   --fps 15            override the scene's frame rate
//
// A scene must define:
//   window.VIDEO = { width, height, fps, duration }   // duration in seconds
//   window.seek = (t) => { ... }                       // draw the frame at time t (may be async)
// Optional: window.CUES = [{ t, type, gain }] sound-effect cues, written to <out>.cues.json.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const scene = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && args[i - 1] !== '--preview'));
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const preview = args.includes('--preview');
if (!scene) {
  console.error('usage: node render.mjs <scene.html> [--out file.mp4] [--audio file] [--preview] [--scale s] [--fps n]');
  process.exit(1);
}

const out = flag('out') ?? path.join('out', path.basename(scene, '.html') + (preview ? '.preview' : '') + '.mp4');
const audio = flag('audio');
const scale = Number(flag('scale') ?? (preview ? 0.5 : 1));
mkdirSync(path.dirname(out), { recursive: true });

// Serve the project over local HTTP so scenes can use ES modules (Three.js) and fetch().
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// SwiftShader gives WebGL (Three.js) in headless Chromium without a GPU.
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ deviceScaleFactor: scale });
// Tells the scene not to start its own realtime playback loop.
await page.addInitScript(() => { window.__RENDER__ = true; });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`${base}/${path.relative(ROOT, path.resolve(scene)).split(path.sep).join('/')}${flag('query') ?? ''}`);
await page.waitForFunction(() => window.VIDEO && typeof window.seek === 'function');
await page.evaluate(() => document.fonts.ready);

const video = await page.evaluate(() => window.VIDEO);
const { width, height, duration } = video;
const fps = Number(flag('fps') ?? (preview ? 15 : video.fps));
await page.setViewportSize({ width, height });
const frames = Math.round(duration * fps);

const cues = await page.evaluate(() => window.CUES || []);
if (cues.length) writeFileSync(out.replace(/\.mp4$/, '.cues.json'), JSON.stringify(cues, null, 1) + '\n');

const imageType = preview ? 'jpeg' : 'png';
const ffmpegArgs = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-'];
if (audio) ffmpegArgs.push('-i', audio, '-c:a', 'aac', '-b:a', '192k', '-shortest');
ffmpegArgs.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', preview ? '28' : '18', '-preset', preview ? 'veryfast' : 'medium',
  '-movflags', '+faststart', out);
const ffmpeg = spawn('ffmpeg', ffmpegArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((resolve, reject) =>
  ffmpeg.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))));

const started = Date.now();
for (let i = 0; i < frames; i++) {
  await page.evaluate((t) => window.seek(t), i / fps);
  const img = await page.screenshot({ type: imageType, quality: preview ? 85 : undefined, clip: { x: 0, y: 0, width, height } });
  if (!ffmpeg.stdin.write(img)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
  if (i % fps === 0) process.stdout.write(`\rframe ${i + 1}/${frames}`);
}
ffmpeg.stdin.end();
await done;
await browser.close();
server.close();
console.log(`\rrendered ${frames} frames (${Math.round(width * scale)}x${Math.round(height * scale)}@${fps}) to ${out} in ${((Date.now() - started) / 1000).toFixed(1)}s` +
  (cues.length ? ` · ${cues.length} sound cues` : ''));
