// Motion toolkit: GSAP-driven DOM/SVG scenes that still follow the render contract
// (window.VIDEO + a pure window.seek(t)). The whole scene is one paused GSAP timeline;
// seek(t) jumps it to t, so any frame renders identically on its own.
//
// Load order in a scene:
//   <link rel="stylesheet" href="lib/motion.css">
//   <script src="../node_modules/gsap/dist/gsap.min.js"></script>
//   <script src="../node_modules/gsap/dist/SplitText.min.js"></script>
//   <script src="../node_modules/gsap/dist/MorphSVGPlugin.min.js"></script>
//   <script src="../node_modules/gsap/dist/DrawSVGPlugin.min.js"></script>
//   <script src="../node_modules/gsap/dist/CustomEase.min.js"></script>
//   <script src="lib/timings.js"></script>      (only if the scene has narration)
//   <script src="lib/motion.js"></script>
//
// Then: M.scene({ duration, key, voiceAt, build(tl, k) { ... } })
//   tl = the paused master timeline; place tweens at absolute times: tl.to(el, {...}, 3.2)
//   k  = narration helpers: k.at(i) / k.end(i) give segment i's start/end in scene time
// Sound effects: M.cue(t, 'whoosh'|'hit'|'tick'|'swell'|'pop', gain) records a cue in
// window.CUES; render.mjs writes them next to the video for the sound-design pass.
(function () {
  gsap.registerPlugin(SplitText, MorphSVGPlugin, DrawSVGPlugin, CustomEase);
  // House eases: confident, fast-in / soft-out, plus a gentle overshoot for pops.
  CustomEase.create('settle', 'M0,0 C0.16,1 0.3,1 1,1');
  CustomEase.create('glide', 'M0,0 C0.65,0 0.2,1 1,1');
  gsap.defaults({ ease: 'settle', duration: 0.9 });

  const $ = (sel, root = document) => (typeof sel === 'string' ? root.querySelector(sel) : sel);
  const $$ = (sel, root = document) => (typeof sel === 'string' ? [...root.querySelectorAll(sel)] : [sel].flat());
  window.CUES = [];

  const M = {
    $, $$,
    cue(t, type, gain = 1) { window.CUES.push({ t: +t.toFixed(3), type, gain }); },

    // Split text into words (or chars) once; returns the pieces.
    split(sel, by = 'words') {
      const s = new SplitText($(sel), { type: by === 'chars' ? 'words,chars' : 'words', wordsClass: 'word', charsClass: 'char' });
      return by === 'chars' ? s.chars : s.words;
    },
    // Kinetic type: pieces rise into place with a short stagger.
    typeIn(tl, sel, at, { by = 'words', stagger = 0.06, y = 60, dur = 0.9, blur = 6, cue = 'tick' } = {}) {
      const el = $(sel);
      gsap.set(el, { autoAlpha: 1 });
      const pieces = M.split(el, by);
      tl.from(pieces, { autoAlpha: 0, y, filter: `blur(${blur}px)`, duration: dur, stagger }, at);
      if (cue) M.cue(at, cue, 0.6);
      return pieces;
    },
    typeOut(tl, sel, at, { dur = 0.5, y = -30 } = {}) {
      tl.to($(sel), { autoAlpha: 0, y, filter: 'blur(6px)', duration: dur, ease: 'power2.in' }, at);
    },
    fadeIn(tl, sel, at, { dur = 0.8, y = 24, scale = 1 } = {}) {
      gsap.set($$(sel), { autoAlpha: 0, y, scale });
      tl.to($$(sel), { autoAlpha: 1, y: 0, scale: 1, duration: dur }, at);
    },
    fadeOut(tl, sel, at, { dur = 0.5 } = {}) { tl.to($$(sel), { autoAlpha: 0, duration: dur, ease: 'power1.in' }, at); },
    // Pop in with a slight overshoot (icons, tags).
    pop(tl, sel, at, { dur = 0.7, stagger = 0.08, cue = 'pop' } = {}) {
      gsap.set($$(sel), { autoAlpha: 0, scale: 0.6 });
      tl.to($$(sel), { autoAlpha: 1, scale: 1, duration: dur, stagger, ease: 'back.out(1.8)' }, at);
      if (cue) M.cue(at, cue, 0.7);
    },
    // Count a number up; fmt formats the displayed value.
    countUp(tl, sel, from, to, at, { dur = 1.6, fmt = (v) => Math.round(v).toLocaleString('en-GB') } = {}) {
      const el = $(sel), o = { v: from };
      el.textContent = fmt(from);
      tl.to(o, { v: to, duration: dur, ease: 'power3.out', onUpdate: () => { el.textContent = fmt(o.v); } }, at);
    },
    // Camera move on a .camera wrapper: x/y in px, scale, rotation in degrees.
    camera(tl, sel, at, props, { dur = 1.6, ease = 'glide', cue = null } = {}) {
      tl.to($(sel), { ...props, duration: dur, ease }, at);
      if (cue) M.cue(at, cue, 0.8);
    },
    // Reveal an element through a growing clip-path (circle from a point, or a wipe).
    reveal(tl, sel, at, { shape = 'circle', x = '50%', y = '50%', dur = 1.1, cue = 'whoosh' } = {}) {
      const el = $(sel);
      const from = shape === 'circle' ? `circle(0% at ${x} ${y})` : 'inset(0 100% 0 0)';
      const to = shape === 'circle' ? `circle(150% at ${x} ${y})` : 'inset(0 0% 0 0)';
      gsap.set(el, { clipPath: from, autoAlpha: 1 });
      tl.to(el, { clipPath: to, duration: dur, ease: 'glide' }, at);
      if (cue) M.cue(at, cue, 0.9);
    },
    // Draw an SVG stroke on.
    draw(tl, sel, at, { dur = 1.2, from = '0%' } = {}) {
      gsap.set($$(sel), { drawSVG: from });
      tl.to($$(sel), { drawSVG: '100%', duration: dur, ease: 'power2.inOut' }, at);
    },
    // Morph one SVG path into another shape (path data or selector).
    morph(tl, sel, to, at, { dur = 1.2, cue = 'whoosh' } = {}) {
      tl.to($(sel), { morphSVG: to, duration: dur, ease: 'glide' }, at);
      if (cue) M.cue(at, cue, 0.8);
    },
    // Hard-cut swap between two scene layers, with a hit.
    cut(tl, fromSel, toSel, at, { cue = 'hit' } = {}) {
      tl.set($$(fromSel), { autoAlpha: 0 }, at).set($$(toSel), { autoAlpha: 1 }, at);
      if (cue) M.cue(at, cue, 1);
    },
  };

  // ---------- grain (animated, deterministic) ----------
  function makeGrain() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    const img = g.createImageData(512, 512);
    let s = 1234567;
    for (let i = 0; i < img.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const v = 128 + ((s / 0x7fffffff) - 0.5) * 120;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const div = document.createElement('div');
    div.id = 'grain';
    div.style.backgroundImage = `url(${c.toDataURL()})`;
    return div;
  }

  // ---------- subtitles from narration timings ----------
  function subtitleChunks(segs, voiceAt) {
    const out = [];
    for (const s of segs) {
      const a = s.start + voiceAt - 0.1, b = s.end + voiceAt + 0.3;
      const sentences = s.text.match(/[^.?!]+[.?!]+["”’)]*\s*|[^.?!]+$/g).map((x) => x.trim());
      const groups = [];
      for (const sen of sentences) {
        const last = groups[groups.length - 1];
        if (last && (last + ' ' + sen).length <= 120) groups[groups.length - 1] = last + ' ' + sen;
        else groups.push(sen);
      }
      const total = groups.reduce((x, g) => x + g.length, 0);
      let acc = 0;
      for (const g of groups) {
        const st = a + (b - a) * acc / total; acc += g.length;
        out.push({ a: st, b: a + (b - a) * acc / total, text: g });
      }
    }
    return out;
  }

  // afterSeek(t): called after the timeline moves (e.g. to render a Three.js frame).
  // stepFps: quantise animation time to this rate for a stop-motion feel (e.g. 12 = "on twos").
  M.scene = function ({ duration, key = null, voiceAt = 1.0, fadeIn = 0.6, fadeOut = 0.6, build, afterSeek = null, stepFps = 0, stage: stageSel = '#stage' }) {
    const stage = $(stageSel);
    const finish = document.createElement('div'); finish.id = 'finish';
    const grain = makeGrain();
    const subs = document.createElement('div'); subs.id = 'subs';
    const black = document.createElement('div');
    Object.assign(black.style, { position: 'absolute', inset: '0', background: '#050c0f', pointerEvents: 'none' });
    stage.append(grain, finish, subs, black);
    const showSubs = new URLSearchParams(location.search).get('captions') !== '0';
    const segs = key ? (window.TIMINGS || {})[key] : null;
    const k = {
      at: (i) => voiceAt + segs[i].start,
      end: (i) => voiceAt + segs[i].end,
      voiceAt, segs,
    };
    const chunks = segs ? subtitleChunks(segs, voiceAt) : [];

    document.fonts.ready.then(() => {
      const tl = gsap.timeline({ paused: true });
      build(tl, k);
      // Pad the timeline to the full duration so seek past the last tween still works.
      tl.set({}, {}, duration);
      window.VIDEO = { width: 1920, height: 1080, fps: 30, duration };
      window.seek = (t) => {
        const ta = stepFps ? Math.floor(t * stepFps) / stepFps : t;
        tl.seek(ta, false); // false: let onUpdate callbacks (e.g. countUp) run
        if (afterSeek) afterSeek(ta, t);
        // grain jitters every frame (deterministic in t)
        const f = Math.floor(t * 30);
        grain.style.transform = `translate(${(f * 97) % 256 - 128}px, ${(f * 57) % 256 - 128}px)`;
        // subtitles
        let text = '', op = 0;
        if (showSubs) {
          for (const c of chunks) {
            if (t >= c.a && t < c.b) {
              text = c.text;
              op = Math.min(1, (t - c.a) / 0.15, (c.b - t) / 0.15);
              break;
            }
          }
        }
        if (subs.textContent !== text) subs.textContent = text;
        subs.style.opacity = op;
        // scene fades
        const d = Math.max(1 - Math.min(1, t / fadeIn), Math.min(1, Math.max(0, (t - (duration - fadeOut)) / fadeOut)));
        black.style.opacity = fadeIn || fadeOut ? d : 0;
      };
      if (!window.__RENDER__) {
        const start = performance.now();
        const loop = () => { window.seek(((performance.now() - start) / 1000) % duration); requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
      } else {
        window.seek(0);
      }
    });
  };

  window.M = M;
})();
