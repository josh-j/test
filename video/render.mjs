// Render a scene to MP4: load the HTML in headless Chromium, call
// window.seek(t) for every frame, screenshot it, and pipe the PNGs to ffmpeg.
//
// Usage: node render.mjs scenes/example.html [--out out/example.mp4] [--audio track.mp3]
//
// A scene must define:
//   window.VIDEO = { width, height, fps, duration }   // duration in seconds
//   window.seek = (t) => { ... }                       // draw the frame at time t (may be async)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const scene = args.find((a) => !a.startsWith('--'));
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!scene) {
  console.error('usage: node render.mjs <scene.html> [--out file.mp4] [--audio file]');
  process.exit(1);
}

const out = flag('out') ?? path.join('out', path.basename(scene, '.html') + '.mp4');
const audio = flag('audio');
mkdirSync(path.dirname(out), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
// Tells the scene not to start its own realtime playback loop.
await page.addInitScript(() => { window.__RENDER__ = true; });
await page.goto(pathToFileURL(path.resolve(scene)).href);
await page.waitForFunction(() => window.VIDEO && typeof window.seek === 'function');
await page.evaluate(() => document.fonts.ready);

const { width, height, fps, duration } = await page.evaluate(() => window.VIDEO);
await page.setViewportSize({ width, height });
const frames = Math.round(duration * fps);

const ffmpegArgs = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-'];
if (audio) ffmpegArgs.push('-i', audio, '-c:a', 'aac', '-b:a', '192k', '-shortest');
ffmpegArgs.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium',
  '-movflags', '+faststart', out);
const ffmpeg = spawn('ffmpeg', ffmpegArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((resolve, reject) =>
  ffmpeg.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))));

const started = Date.now();
for (let i = 0; i < frames; i++) {
  await page.evaluate((t) => window.seek(t), i / fps);
  const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
  if (!ffmpeg.stdin.write(png)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
  if (i % fps === 0) process.stdout.write(`\rframe ${i + 1}/${frames}`);
}
ffmpeg.stdin.end();
await done;
await browser.close();
console.log(`\rrendered ${frames} frames (${width}x${height}@${fps}) to ${out} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
