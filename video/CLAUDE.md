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

## Motion toolkit (GSAP, Three.js, sound design)

For anything beyond simple canvas drawing, build scenes on `scenes/lib/motion.js` + `motion.css`
(see `scenes/style-*.html` for four complete examples):

- **One paused GSAP timeline per scene.** `M.scene({ duration, build(tl) {...} })`; place tweens at
  absolute times (`tl.to(el, {...}, 3.2)`). `seek(t)` jumps the timeline, so frames stay pure in t.
- **Helpers:** `M.typeIn` (word/char kinetic type), `M.countUp`, `M.camera` (move a `.camera`
  wrapper), `M.reveal` (clip-path circle/wipe), `M.draw` (SVG stroke draw-on), `M.morph` (SVG shape
  morph), `M.pop`, `M.cut`. House eases: `settle` (fast in, soft out) and `glide` (camera moves).
- **3D:** import `../node_modules/three/build/three.module.js` in a module script, tween Three.js
  objects with GSAP, and render in `afterSeek(t)`. Use `preserveDrawingBuffer: true`.
- **Stop-motion:** `stepFps: 12` quantises animation time ("on twos").
- **Sound design:** `M.cue(t, 'whoosh'|'hit'|'tick'|'pop'|'swell', gain)`; the renderer writes
  `<out>.cues.json`, and `music/sfx.py` turns it into a synced effects track.
- **Narration:** pass `key: 'scene-0X'` to get clean subtitles from `lib/timings.js`.
- **Review loop:** `node render.mjs scene.html --preview` (half-res, 15 fps, fast), then
  `tools/filmstrip.sh out/x.preview.mp4 strip.png` and look at the strip before a full render.

Style rules learned the hard way: keep the frame moving (camera drift, staggered builds, transitions
that carry shapes into the next beat), use few words in big type, put sources in small text, and
put a sound cue on every cut.
