// Shared look and helpers for "The Hospital That Must Change Shape" scenes 2–8 and the end card.
// Matches scene 1 (hospital-01-habitat.html): dusk palette, serif type, paper grain, vignette,
// captions timed from the recorded narration (lib/timings.js).
//
// A scene calls HC.scene({ key, duration, voiceAt, draw(t, k) }).
//   t  = scene time in seconds
//   k  = { at(i), end(i), seg(i, pre, post) } narration segment helpers in scene time
(function () {
  const W = 1920, H = 1080;
  const canvas = document.getElementById('c');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const SERIF = 'Georgia, "Bitstream Charter", "Liberation Serif", serif';
  const C = {
    ink: '#efe6d6', inkDim: 'rgba(239,230,214,0.68)', inkFaint: 'rgba(239,230,214,0.38)',
    amber: '#f4b860', amberSoft: '#f7cf8e', teal: '#2c4a57', tealDeep: '#0b1a20',
    night: '#06121a', sage: '#7fa596', blue: '#8fb8c9', green: '#8fc4a2', rose: '#d9937e',
    wall: '#1c2f33', glass: '#0d1d21',
  };

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const smooth = (p) => p * p * (3 - 2 * p);
  const prog = (t, a, b) => smooth(clamp((t - a) / (b - a)));
  const window4 = (t, a, b, c, d) => prog(t, a, b) * (1 - prog(t, c, d));
  function mulberry32(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (c1, c2, p) => {
    const a = hex(c1), b = hex(c2);
    return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], p))).join(',')})`;
  };
  const rgba = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };

  // ---------- backgrounds and finishing ----------
  function background(warmth = 0) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, mix('#08161d', '#1e3a44', warmth));
    g.addColorStop(0.65, mix('#0f2830', '#4b5f5c', warmth));
    g.addColorStop(1, mix('#132f35', '#8a7a62', warmth));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  const grain = document.createElement('canvas');
  grain.width = grain.height = 512;
  {
    const g = grain.getContext('2d');
    const img = g.createImageData(512, 512);
    const r = mulberry32(99);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (r() - 0.5) * 70;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  let grainPattern = null;
  function finish() {
    if (!grainPattern) grainPattern = ctx.createPattern(grain, 'repeat');
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = grainPattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  // ---------- type ----------
  function text(str, x, y, { size = 40, alpha = 1, color = C.ink, align = 'left', italic = false, weight = 400, baseline = 'alphabetic' } = {}) {
    if (alpha <= 0.005) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${SERIF}`;
    ctx.fillText(str, x, y);
    ctx.restore();
  }
  // Wraps text to maxWidth; returns the height used.
  function para(str, x, y, maxWidth, opts = {}) {
    const size = opts.size ?? 34, lh = opts.lineHeight ?? size * 1.35;
    ctx.save();
    ctx.font = `${opts.italic ? 'italic ' : ''}${opts.weight ?? 400} ${size}px ${SERIF}`;
    const words = str.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
    }
    lines.push(line);
    ctx.restore();
    lines.forEach((l, i) => text(l, x, y + i * lh, { ...opts, size }));
    return lines.length * lh;
  }
  // Small source / caveat line, top-left.
  function source(str, alpha = 1) {
    text(str, 120, 92, { size: 22, italic: true, color: C.inkFaint, alpha });
  }
  // "ILLUSTRATION" tag for invented numbers.
  function illustrationTag(x, y, alpha = 1) {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = C.amberSoft;
    ctx.lineWidth = 1.5;
    ctx.font = `600 18px ${SERIF}`;
    const w = ctx.measureText('ILLUSTRATION').width + 24;
    ctx.strokeRect(x, y - 22, w, 32);
    ctx.fillStyle = C.amberSoft;
    ctx.textBaseline = 'middle';
    ctx.fillText('ILLUSTRATION', x + 12, y - 6);
    ctx.restore();
  }

  // ---------- simple illustrated objects ----------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function bed(x, y, s, color = C.ink, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
    roundRect(x, y, 220 * s, 34 * s, 8 * s); ctx.fill();            // mattress
    roundRect(x + 8 * s, y - 22 * s, 56 * s, 24 * s, 8 * s); ctx.fill(); // pillow
    ctx.fillRect(x - 6 * s, y - 50 * s, 10 * s, 120 * s);         // headboard
    ctx.fillRect(x + 214 * s, y - 10 * s, 10 * s, 80 * s);         // footboard
    ctx.fillRect(x, y + 34 * s, 8 * s, 36 * s);
    ctx.fillRect(x + 206 * s, y + 34 * s, 8 * s, 36 * s);
    ctx.restore();
  }
  function chair(x, y, s, color = C.ink, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
    roundRect(x, y, 120 * s, 30 * s, 10 * s); ctx.fill();          // seat
    roundRect(x + 90 * s, y - 110 * s, 30 * s, 120 * s, 10 * s); ctx.fill(); // back (reclined)
    roundRect(x - 50 * s, y + 4 * s, 60 * s, 18 * s, 8 * s); ctx.fill(); // leg rest
    ctx.fillRect(x + 20 * s, y + 30 * s, 10 * s, 50 * s);
    ctx.fillRect(x + 90 * s, y + 30 * s, 10 * s, 50 * s);
    ctx.restore();
  }
  function person(x, y, s, color = C.ink, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y - 92 * s, 18 * s, 0, Math.PI * 2); ctx.fill();
    roundRect(x - 24 * s, y - 70 * s, 48 * s, 70 * s, 18 * s); ctx.fill();
    ctx.restore();
  }
  function house(x, y, s, wall, roof, lit = 0, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = wall; ctx.fillRect(x, y - 140 * s, 220 * s, 140 * s);
    ctx.fillStyle = roof; ctx.beginPath();
    ctx.moveTo(x - 20 * s, y - 138 * s); ctx.lineTo(x + 110 * s, y - 230 * s); ctx.lineTo(x + 240 * s, y - 138 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = mix('#0d1d21', '#f4b860', lit);
    ctx.fillRect(x + 30 * s, y - 110 * s, 60 * s, 50 * s);
    ctx.fillRect(x + 130 * s, y - 110 * s, 60 * s, 50 * s);
    ctx.fillStyle = mix('#0d1d21', '#3a3026', 0.5); ctx.fillRect(x + 90 * s, y - 60 * s, 40 * s, 60 * s);
    if (lit > 0.01) {
      const g = ctx.createRadialGradient(x + 110 * s, y - 85 * s, 10, x + 110 * s, y - 85 * s, 220 * s);
      g.addColorStop(0, rgba(C.amber, 0.18 * lit)); g.addColorStop(1, rgba(C.amber, 0));
      ctx.fillStyle = g; ctx.fillRect(x - 200 * s, y - 320 * s, 620 * s, 420 * s);
    }
    ctx.restore();
  }
  // Simple hospital block: floors lit from the bottom up to `litFloors`.
  function hospital(x, y, w, floors, litFloors, { cols = 14, floorH = 34, alpha = 1, glow = 1 } = {}) {
    ctx.save(); ctx.globalAlpha = alpha;
    const h = floors * floorH + 18;
    ctx.fillStyle = C.wall; ctx.fillRect(x, y - h, w, h);
    const pad = 14, gap = 8, cw = (w - pad * 2 - gap * (cols - 1)) / cols;
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const wx = x + pad + c * (cw + gap), wy = y - 12 - (f + 1) * floorH + 6;
        ctx.fillStyle = C.glass; ctx.fillRect(wx, wy, cw, floorH - 12);
        const lit = clamp(litFloors - f);
        if (lit > 0) { ctx.fillStyle = rgba(C.amber, 0.95 * lit * glow); ctx.fillRect(wx, wy, cw, floorH - 12); }
      }
    }
    ctx.restore();
  }
  function priceTag(x, y, label, alpha = 1, scale = 1) {
    if (alpha <= 0.01) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.font = `600 46px ${SERIF}`;
    const w = ctx.measureText(label).width + 90;
    ctx.fillStyle = C.amberSoft;
    ctx.beginPath(); ctx.moveTo(-w / 2 + 30, -40); ctx.lineTo(w / 2, -40); ctx.lineTo(w / 2, 40); ctx.lineTo(-w / 2 + 30, 40); ctx.lineTo(-w / 2, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.tealDeep; ctx.beginPath(); ctx.arc(-w / 2 + 30, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 16, 2);
    ctx.restore();
  }
  // Horizontal bars: items [{label, value, color, note}], grows with p.
  function bars(items, x, y, w, max, p, { rowH = 92, size = 32, unit = '' } = {}) {
    items.forEach((it, i) => {
      const yy = y + i * rowH;
      const pi = prog(p * (items.length + 1), i, i + 1.6);
      text(it.label, x, yy - 14, { size, alpha: pi, color: it.labelColor ?? C.ink });
      ctx.fillStyle = rgba('#ffffff', 0.06 * pi); ctx.fillRect(x, yy, w, 26);
      ctx.fillStyle = it.color ?? C.amber; ctx.globalAlpha = pi;
      ctx.fillRect(x, yy, (w * it.value / max) * pi, 26); ctx.globalAlpha = 1;
      text(`${it.display ?? it.value}${unit}`, x + (w * it.value / max) * pi + 18, yy + 22, { size: size - 2, alpha: pi, color: it.color ?? C.amber });
    });
  }

  // ---------- captions (match scene 1) ----------
  const SHOW_CAPTIONS = new URLSearchParams(location.search).get('captions') !== '0';
  function captions(t, segs, voiceAt) {
    if (!SHOW_CAPTIONS || !segs) return;
    for (const s of segs) {
      const a = s.start + voiceAt - 0.15, b = s.end + voiceAt + 0.35;
      const al = window4(t, a, a + 0.4, b - 0.3, b);
      if (al <= 0.01) continue;
      ctx.save();
      ctx.font = `400 34px ${SERIF}`;
      // Long segments wrap onto two lines.
      // Split long segments at sentence boundaries into chunks of at most two balanced lines,
      // each shown for a share of the segment proportional to its length.
      const wrap = (str) => {
        const total = ctx.measureText(str).width;
        const n = Math.ceil(total / 1400), target = total / n;
        const out = [];
        let line = '';
        for (const w of str.split(' ')) {
          const test = line ? line + ' ' + w : w;
          if (line && out.length < n - 1 && ctx.measureText(test).width > target + 40) { out.push(line); line = w; } else line = test;
        }
        out.push(line);
        return out;
      };
      const sentences = s.text.match(/[^.?!]+[.?!]+["”’)]*\s*|[^.?!]+$/g).map((x) => x.trim());
      const groups = [];
      for (const sen of sentences) {
        const last = groups[groups.length - 1];
        if (last && ctx.measureText(last + ' ' + sen).width <= 2700) groups[groups.length - 1] = last + ' ' + sen;
        else groups.push(sen);
      }
      const chunks = groups.map(wrap);
      const lens = groups.map((g) => g.length), sum = lens.reduce((x, y) => x + y, 0);
      let acc = 0;
      const spans = lens.map((l) => { const st = a + (b - a) * acc / sum; acc += l; return [st, a + (b - a) * acc / sum]; });
      chunks.forEach((chunk, ci) => {
        const [ca, cb] = spans[ci];
        const cal = al * (chunks.length === 1 ? 1 : window4(t, ca, ca + 0.15, cb - 0.15, cb));
        if (cal <= 0.01) return;
        ctx.globalAlpha = cal;
        const widths = chunk.map((l) => ctx.measureText(l).width);
        const bw = Math.max(...widths) + 44, bh = chunk.length * 46 + 12;
        ctx.fillStyle = 'rgba(5,12,15,0.55)';
        ctx.fillRect(W / 2 - bw / 2, H - 38 - bh, bw, bh);
        ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        chunk.forEach((l, li) => ctx.fillText(l, W / 2, H - 38 - bh + 29 + li * 46));
      });
      ctx.restore();
    }
  }

  // ---------- scene wrapper ----------
  function scene({ key, duration, voiceAt = 1.0, draw, fadeIn = 0.8, fadeOut = 0.8 }) {
    window.VIDEO = { width: W, height: H, fps: 30, duration };
    const segs = key ? (window.TIMINGS || {})[key] : null;
    const k = {
      at: (i) => voiceAt + segs[i].start,
      end: (i) => voiceAt + segs[i].end,
      // Visibility of segment i's visuals: fades in `pre` s before it starts, out `post` s after the next starts.
      seg: (t, i, pre = 0.6, post = 0.6) => {
        const a = voiceAt + segs[i].start - pre;
        const b = i + 1 < segs.length ? voiceAt + segs[i + 1].start + post : duration + 1;
        return window4(t, a, a + 0.9, b - 0.9, b);
      },
      voiceAt, segs,
    };
    window.seek = (t) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);
      draw(t, k);
      finish();
      captions(t, segs, voiceAt);
      const dark = Math.max(1 - prog(t, 0, fadeIn), prog(t, duration - fadeOut, duration));
      if (dark > 0.001) { ctx.fillStyle = `rgba(6,18,26,${dark})`; ctx.fillRect(0, 0, W, H); }
    };
    if (!window.__RENDER__) {
      const start = performance.now();
      const loop = () => { window.seek(((performance.now() - start) / 1000) % duration); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    } else {
      window.seek(0);
    }
  }

  window.HC = {
    W, H, ctx, C, SERIF, clamp, lerp, smooth, prog, window4, mulberry32, mix, rgba,
    background, text, para, source, illustrationTag, roundRect,
    bed, chair, person, house, hospital, priceTag, bars, scene, captions,
  };
})();
