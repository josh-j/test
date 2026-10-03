# Code-rendered video kit

Videos here are programs, not generated pixels: each scene is an HTML file
that draws any frame on demand, and `render.mjs` captures the frames in
headless Chromium (Playwright) and encodes them with ffmpeg.

## Making a video

1. Write a short storyboard first (beats with timestamps), then the scene.
2. Create `scenes/<name>.html` following the contract below. Copy
   `scenes/example.html` as a starting point.
3. Render: `node render.mjs scenes/<name>.html` → `out/<name>.mp4`.
   Add a soundtrack or voiceover with `--audio path/to/file.mp3`; the
   output is cut to the shorter of video and audio.
4. Check frames before calling it done:
   `ffmpeg -ss 2.5 -i out/<name>.mp4 -frames:v 1 frame.png`, then look at it.

## Scene contract

- `window.VIDEO = { width, height, fps, duration }` (duration in seconds).
- `window.seek(t)` draws the exact frame at time `t` seconds. It may be async.
- `seek` must be **pure in t**: no `Date.now()`, `performance.now()`,
  `Math.random()` without a fixed seed, or state carried between calls.
  Frames are rendered in order but must look identical if rendered alone.
- When `window.__RENDER__` is unset (normal browser), run a realtime
  `requestAnimationFrame` loop so the file previews when opened directly.
- Everything must be self-contained: inline code, generated shapes, system
  fonts. Load libraries (p5.js, Three.js, GSAP) from a CDN only if needed;
  rendering waits for `document.fonts.ready` but not for other network loads.
- For GSAP/anime.js timelines, build them paused and call
  `timeline.seek(t)` / `timeline.progress(...)` inside `window.seek`.
- For Three.js, render once per `seek` call with `renderer.render(...)`;
  set `preserveDrawingBuffer: true` on the renderer.

## Preview

`npm run preview` serves `scenes/` on port 8080 for a browser preview.
