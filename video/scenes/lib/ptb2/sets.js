// "Pass the Blame" v2: close-up sets that cut away from the island. Each set is a small
// studio diorama on the same walnut plinth as the island, lit like a museum case against
// a calm navy backdrop ("soft data noir"). Every set returns
//   { scene, camera, rig, state, update(t), anchor(name) -> Vector3, post }
// and, like the island, reads only its numeric state, so frames stay pure in t.
import { THREE, rng, P, mat, glassMat, windowMat, rbox, add, person, car, forest } from './kit.js';

const NAVY_TOP = new THREE.Color(0x0d1828), NAVY_BOT = new THREE.Color(0x2a3a52);

function backdrop() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#' + NAVY_TOP.getHexString()); g.addColorStop(0.7, '#1b2a40'); g.addColorStop(1, '#' + NAVY_BOT.getHexString());
  x.fillStyle = g; x.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// A studio: backdrop, museum lighting, a walnut plinth with a brass rim, and an orbit rig.
function studio(envMap, { radius = 6, plinthY = 0, top = 0x37404a, key = 1.0 } = {}) {
  const scene = new THREE.Scene();
  scene.background = backdrop();
  scene.environment = envMap; scene.environmentIntensity = 0.25;
  scene.fog = new THREE.Fog(0x1b2a40, 40, 90);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 300);
  const hemi = new THREE.HemisphereLight(0xdfeaff, 0x1a2230, 0.35);
  const keyL = new THREE.DirectionalLight(0xfff0dc, 1.9 * key);
  keyL.position.set(-6, 12, 8); keyL.castShadow = true; keyL.shadow.mapSize.set(2048, 2048);
  Object.assign(keyL.shadow.camera, { left: -radius - 2, right: radius + 2, top: radius + 2, bottom: -radius - 2, near: 1, far: 50 });
  keyL.shadow.bias = -0.0004; keyL.shadow.normalBias = 0.02;
  const rim = new THREE.DirectionalLight(0x8fd8ff, 1.2); rim.position.set(8, 6, -10);
  const fill = new THREE.DirectionalLight(0xffc89a, 0.35); fill.position.set(10, 3, 6);
  scene.add(hemi, keyL, rim, fill);
  // plinth
  add(scene, new THREE.CylinderGeometry(radius, radius, 0.25, 96), mat(top, { roughness: 0.55 }), 0, plinthY - 0.125, 0, { cast: false });
  add(scene, new THREE.CylinderGeometry(radius + 0.02, radius + 0.25, 0.9, 96), mat(0x2b2622, { roughness: 0.45, metalness: 0.1 }), 0, plinthY - 0.7, 0, { cast: false });
  add(scene, new THREE.TorusGeometry(radius + 0.03, 0.035, 8, 160), mat(0xc9a46b, { roughness: 0.3, metalness: 0.8 }), 0, plinthY, 0, { cast: false }).rotation.x = Math.PI / 2;
  const rig = { angle: 1.35, tilt: 0.42, dist: 18, tx: 0, ty: 1, tz: 0, fov: 30, roll: 0 };
  const look = new THREE.Vector3();
  const placeCamera = () => {
    camera.fov = rig.fov; camera.updateProjectionMatrix();
    camera.position.set(rig.tx + Math.cos(rig.angle) * Math.cos(rig.tilt) * rig.dist, rig.ty + Math.sin(rig.tilt) * rig.dist, rig.tz + Math.sin(rig.angle) * Math.cos(rig.tilt) * rig.dist);
    camera.lookAt(look.set(rig.tx, rig.ty, rig.tz)); camera.rotation.z += rig.roll;
  };
  return { scene, camera, rig, placeCamera, lights: { hemi, keyL, rim, fill } };
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };

// Glowing material helper.
const glow = (color, intensity = 0.6) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });

// ---------------------------------------------------------------- people: 100 figures
// state.pop 0..1 figures rise in; state.aged = how many (of 100) are 67+ (lit amber).
export function peopleSet(envMap) {
  const S = studio(envMap, { radius: 7 });
  const state = { pop: 1, aged: 20, payers: 0 };
  const N = 100, figs = [];
  const bodyGeo = new THREE.CapsuleGeometry(0.17, 0.42, 4, 12), headGeo = new THREE.SphereGeometry(0.14, 16, 12);
  const young = new THREE.MeshStandardMaterial({ color: 0x8fd3cf, roughness: 0.5, emissive: 0x2a8f86, emissiveIntensity: 0.15 });
  const old = new THREE.MeshStandardMaterial({ color: 0xffc977, roughness: 0.45, emissive: 0xf6a540, emissiveIntensity: 0.55 });
  const skin = mat(0xf0d2b6);
  // aged figures are placed first in a stable shuffled order so the count reads anywhere on the grid
  const order = Array.from({ length: N }, (_, i) => i); const r = rng(4);
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const rank = new Array(N); order.forEach((idx, k) => { rank[idx] = k; });
  for (let i = 0; i < N; i++) {
    const g = new THREE.Group(); const cx = (i % 10) - 4.5, cz = Math.floor(i / 10) - 4.5;
    g.position.set(cx * 1.05, 0, cz * 1.05);
    const b = add(g, bodyGeo, young, 0, 0.38, 0); const h = add(g, headGeo, skin, 0, 0.82, 0);
    S.scene.add(g); figs.push({ g, b, h, rank: rank[i], d: Math.hypot(cx, cz) });
  }
  function update() {
    S.placeCamera();
    for (const f of figs) {
      const p = ease(state.pop * 1.6 - f.d / 9);
      f.g.scale.setScalar(Math.max(0.001, p));
      const isOld = f.rank < state.aged;
      f.b.material = isOld ? old : young;
      // older figures stoop a little
      f.g.scale.y = Math.max(0.001, p * (isOld ? 0.9 : 1));
    }
  }
  return { ...S, state, update, anchor: (n) => new THREE.Vector3(0, n === 'top' ? 2 : 0, 0), post: { bloom: 0.35, tilt: 0.6, focus: 0.5, threshold: 1.15 } };
}

// ---------------------------------------------------------------- bars on a plinth
// spec: { bars: [{ v, color, ghost }], max, gap, width, depth }; state['b'+i] grows bar i (0..1).
// Negative values hang below a glass baseline. anchor('bar'+i) = top of bar i, anchor('base'+i) = foot.
export function barsSet(envMap, spec) {
  const n = spec.bars.length;
  const width = spec.width ?? 1.3, gap = spec.gap ?? 0.75, H = spec.height ?? 5;
  const span = n * width + (n - 1) * gap;
  const S = studio(envMap, { radius: Math.max(5.2, span / 2 + 1.6) });
  const base = spec.negative ? 2.1 : 0.02;
  const state = {}; spec.bars.forEach((_, i) => { state['b' + i] = 0; });
  state.glow = 0;
  const bars = spec.bars.map((b, i) => {
    const x = -span / 2 + width / 2 + i * (width + gap);
    const m = new THREE.MeshStandardMaterial({ color: b.color, emissive: b.color, emissiveIntensity: 0.25, roughness: 0.35, metalness: 0.05, transparent: !!b.ghost, opacity: b.ghost ? 0.55 : 1 });
    const geo = rbox(width, 1, spec.depth ?? 1.3, 0.12, 3); geo.translate(0, 0.5, 0);
    const mesh = add(S.scene, geo, m, x, base, 0);
    // slot in the plinth
    add(S.scene, rbox(width + 0.25, 0.04, (spec.depth ?? 1.3) + 0.25, 0.02), mat(0x262b31), x, 0.02, 0, { cast: false });
    return { mesh, m, x, h: (b.v / spec.max) * H, v: b.v };
  });
  if (spec.negative) {
    const glass = add(S.scene, new THREE.BoxGeometry(span + 1.4, 0.04, 2.2), new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.3 }), 0, base, 0, { cast: false });
    void glass;
    for (const b of bars) add(S.scene, new THREE.CylinderGeometry(0.05, 0.05, base, 8), mat(0x55606a), b.x, base / 2, -0.95, { cast: false });
  }
  // faint gridlines behind
  const gridMat = new THREE.MeshBasicMaterial({ color: 0x9fd8e8, transparent: true, opacity: 0.14 });
  for (let k = 1; k <= 4; k++) add(S.scene, new THREE.BoxGeometry(span + 1.2, 0.015, 0.015), gridMat, 0, base + (k / 4) * H, -1.1, { cast: false, receive: false });
  function update() {
    S.placeCamera();
    bars.forEach((b, i) => {
      const k = ease(state['b' + i]);
      const h = Math.max(0.0001, Math.abs(b.h) * k);
      b.mesh.scale.y = h; b.mesh.position.y = b.h >= 0 ? base : base - h;
      b.mesh.visible = k > 0.001;
      b.m.emissiveIntensity = 0.22 + 0.5 * state.glow;
    });
  }
  const anchor = (name) => {
    const i = Number(name.replace(/\D/g, '')); const b = bars[i];
    if (name.startsWith('bar')) return new THREE.Vector3(b.x, (b.h >= 0 ? base + b.h * ease(state['b' + i]) + 0.35 : base + 0.35), 0.65);
    return new THREE.Vector3(b.x, b.h >= 0 ? 0.05 : base - b.h * ease(state['b' + i]) * -1 - 0.4, 0.9);
  };
  S.rig.ty = H * 0.4; S.rig.dist = span * 1.5 + 9; S.rig.tilt = 0.18; S.rig.angle = Math.PI / 2;
  return { ...S, state, update, anchor, post: { bloom: 0.3, tilt: 0.5, focus: 0.55, threshold: 1.155 }, H, base };
}

// ---------------------------------------------------------------- the salary: a disc with a 42% wedge
// state.split 0..1 lifts the contributions wedge out of the salary.
export function salarySet(envMap) {
  const S = studio(envMap, { radius: 5.5 });
  const state = { split: 0, spin: 0, show: 1 };
  const share = 0.42, R = 3.2, Hh = 0.7;
  const g = new THREE.Group(); S.scene.add(g);
  const rest = add(g, new THREE.CylinderGeometry(R, R, Hh, 96, 1, false, share * Math.PI * 2, (1 - share) * Math.PI * 2), new THREE.MeshStandardMaterial({ color: 0xb9c9cc, roughness: 0.5 }), 0, Hh / 2 + 0.02, 0);
  const wedge = new THREE.Group(); g.add(wedge);
  const wm = new THREE.MeshStandardMaterial({ color: 0xe8a548, emissive: P.amber, emissiveIntensity: 0.1, roughness: 0.45 });
  add(wedge, new THREE.CylinderGeometry(R, R, Hh, 64, 1, false, 0, share * Math.PI * 2), wm, 0, Hh / 2 + 0.02, 0);
  // the four slices of the wedge (health, pensions, care, unemployment), as thin seams
  for (const f of [0.17, 0.36 + 0.0, 0.40]) {
    const a = f / share * share * Math.PI * 2;
    const seam = add(wedge, new THREE.BoxGeometry(R, Hh + 0.01, 0.025), mat(0xb87b2e), Math.sin(a) * R / 2, Hh / 2 + 0.02, Math.cos(a) * R / 2, { cast: false });
    seam.rotation.y = a - Math.PI / 2;
  }
  const mid = share * Math.PI; // wedge centre angle
  // coin edge ridges on the rest
  void rest;
  function update() {
    S.placeCamera();
    const k = ease(state.split);
    wedge.position.set(Math.sin(mid) * 1.4 * k, 1.1 * k, Math.cos(mid) * 1.4 * k);
    wedge.rotation.z = 0; g.rotation.y = state.spin;
    g.scale.setScalar(Math.max(0.001, ease(state.show)));
    wm.emissiveIntensity = 0.08 + 0.25 * k;
  }
  const anchor = (n) => {
    const v = n === 'wedge' ? new THREE.Vector3(Math.sin(mid) * (1.8 + 1.4 * ease(state.split)), 1.6 + 1.1 * ease(state.split), Math.cos(mid) * (1.8 + 1.4 * ease(state.split))) : new THREE.Vector3(-Math.sin(mid) * 1.8, 1.2, -Math.cos(mid) * 1.8);
    return v.applyAxisAngle(new THREE.Vector3(0, 1, 0), state.spin);
  };
  Object.assign(S.rig, { angle: 1.2, tilt: 0.62, dist: 15, ty: 0.6 });
  return { ...S, state, update, anchor, post: { bloom: 0.35, tilt: 0.5, focus: 0.5, threshold: 1.15 } };
}

// ---------------------------------------------------------------- coins: one coin = one unit (e.g. €1m)
// spec: { value, perStack, cols }; state.fill 0..1 drops coins in (a fractional last coin is a thin sliver).
export function coinsSet(envMap, spec) {
  const S = studio(envMap, { radius: 5.5 });
  const value = spec.value, per = spec.perStack ?? 30, nStacks = Math.ceil(value / per), cols = spec.cols ?? Math.min(nStacks, 6);
  const rows = Math.ceil(nStacks / cols), R = spec.coin ?? 0.42, T = 0.09, pitch = R * 2.35;
  const state = { fill: 0 };
  const geo = new THREE.CylinderGeometry(R, R, T, 40); geo.translate(0, T / 2, 0);
  const m = new THREE.MeshStandardMaterial({ color: 0xf2c46b, metalness: 0.8, roughness: 0.3, emissive: 0x6b4a10, emissiveIntensity: 0.12 });
  const count = Math.ceil(value);
  const im = new THREE.InstancedMesh(geo, m, count); im.castShadow = im.receiveShadow = true; S.scene.add(im);
  const r = rng(9); const jit = Array.from({ length: count * 2 }, () => (r() - 0.5) * 0.05);
  const slot = (c) => { const st = Math.floor(c / per), k = c % per; return { x: ((st % cols) - (cols - 1) / 2) * pitch, z: (Math.floor(st / cols) - (rows - 1) / 2) * pitch, y: k * T }; };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  function update() {
    S.placeCamera();
    const shown = value * state.fill;
    for (let c = 0; c < count; c++) {
      const { x, y, z } = slot(c);
      const thick = Math.min(1, value - c); // the last coin may be a sliver
      const k = clamp01((shown - c) / Math.max(thick, 0.0001));
      m4.compose(v.set(x + jit[c * 2], y + (1 - ease(k)) * 2.2, z + jit[c * 2 + 1]), q.identity(), sc.set(1, k > 0 ? thick : 0.0001, 1));
      im.setMatrixAt(c, m4);
    }
    im.instanceMatrix.needsUpdate = true;
  }
  const anchor = () => new THREE.Vector3(0, Math.min(per, value) * T * state.fill + 0.9, rows > 1 ? -pitch * (rows - 1) / 2 : 0);
  Object.assign(S.rig, { angle: 1.3, tilt: 0.4, dist: 11 + cols * 1.2, ty: 1.2 });
  return { ...S, state, update, anchor, post: { bloom: 0.35, tilt: 0.6, focus: 0.5, threshold: 1.15 } };
}

// ---------------------------------------------------------------- the negotiating room
// Three parties at a round table (insurers, hospitals, doctors). state.argue 0..1: each points at
// the next; state.law 0..1: all point at the rule book; state.arbiter 0..1: an arbitration bench
// rises behind; state.gavel 0..1 strikes; state.slump 0..1 everyone turns away (unhappy).
export function roomSet(envMap) {
  const S = studio(envMap, { radius: 6.2, top: 0x6b5443 });
  const state = { argue: 0, law: 0, arbiter: 0, gavel: 0, slump: 0, lamp: 1, papers: 1 };
  const sc = S.scene;
  // walls: a cutaway corner of a panelled room
  add(sc, rbox(12, 5, 0.3, 0.05), mat(0xe9e2d6), 0, 2.5, -5.2);
  add(sc, rbox(0.3, 5, 10.4, 0.05), mat(0xe2dacb), -5.6, 2.5, 0);
  for (let i = 0; i < 5; i++) add(sc, rbox(1.6, 2.2, 0.06, 0.03), mat(0xd6cbb8), -4 + i * 2, 1.7, -5.03, { cast: false });
  const winMat = new THREE.MeshStandardMaterial({ color: 0xbfe0ff, emissive: 0x9fd0ff, emissiveIntensity: 0.6 });
  for (const z of [-2.5, 1.5]) add(sc, new THREE.BoxGeometry(0.05, 2.2, 1.6), winMat, -5.42, 2.6, z, { cast: false });
  // the table
  add(sc, new THREE.CylinderGeometry(2.1, 2.1, 0.14, 64), mat(0x7a5a43, { roughness: 0.4 }), 0, 1.05, 0);
  add(sc, new THREE.CylinderGeometry(0.25, 0.45, 1.0, 20), mat(0x5d4433), 0, 0.5, 0);
  // the rule book in the middle
  const book = new THREE.Group(); book.position.set(0, 1.14, 0); sc.add(book);
  add(book, rbox(0.9, 0.18, 0.65, 0.03), mat(0x2f4a6b), 0, 0.09, 0); add(book, rbox(0.84, 0.14, 0.6, 0.02), mat(0xf4efe4), 0.03, 0.09, 0);
  const bookGlow = new THREE.PointLight(0xffe2a8, 0, 4); bookGlow.position.set(0, 1.8, 0); sc.add(bookGlow);
  // pendant lamp
  add(sc, new THREE.CylinderGeometry(0.02, 0.02, 2.4, 6), mat(0x333333), 0, 4.6, 0, { cast: false });
  const shade = add(sc, new THREE.ConeGeometry(0.6, 0.5, 32, 1, true), mat(0x2d3a33, { side: THREE.DoubleSide }), 0, 3.3, 0, { cast: false });
  const bulb = add(sc, new THREE.SphereGeometry(0.14, 16, 10), new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffd28a, emissiveIntensity: 3 }), 0, 3.1, 0, { cast: false });
  const lampL = new THREE.PointLight(0xffd8a0, 18, 9, 1.6); lampL.position.set(0, 3.0, 0); sc.add(lampL);
  void shade;
  // three parties
  const parties = [
    { name: 'insurers', color: 0x8cc3dd, a: Math.PI * 0.5 },
    { name: 'hospitals', color: 0xf4f1ea, a: Math.PI * 0.5 + (Math.PI * 2) / 3 },
    { name: 'doctors', color: 0x6fa7a0, a: Math.PI * 0.5 + (Math.PI * 4) / 3 },
  ];
  const bodyGeo = new THREE.CapsuleGeometry(0.32, 0.7, 4, 16), headGeo = new THREE.SphereGeometry(0.27, 20, 14), armGeo = new THREE.CapsuleGeometry(0.08, 0.6, 4, 8);
  armGeo.translate(0, -0.38, 0);
  for (const p of parties) {
    const g = new THREE.Group(); g.position.set(Math.cos(p.a) * 2.75, 0, Math.sin(p.a) * 2.75); sc.add(g);
    g.lookAt(0, 0, 0);
    // chair
    add(g, rbox(0.8, 0.1, 0.8, 0.03), mat(0x3d4a55), 0, 0.75, -0.1); add(g, rbox(0.8, 1.0, 0.1, 0.03), mat(0x3d4a55), 0, 1.25, -0.5);
    for (const [x, z] of [[-0.32, 0.22], [0.32, 0.22], [-0.32, -0.42], [0.32, -0.42]]) add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.75, 6), mat(0x222222), x, 0.37, z);
    const torso = new THREE.Group(); torso.position.set(0, 0.85, 0); g.add(torso);
    add(torso, bodyGeo, mat(p.color, { roughness: 0.55 }), 0, 0.5, 0); add(torso, headGeo, mat(0xf0d2b6), 0, 1.25, 0);
    const shoulder = new THREE.Group(); shoulder.position.set(0.34, 0.85, 0.05); torso.add(shoulder);
    add(shoulder, armGeo, mat(p.color, { roughness: 0.55 }), 0, 0, 0);
    const other = new THREE.Group(); other.position.set(-0.34, 0.85, 0.05); torso.add(other);
    add(other, armGeo, mat(p.color, { roughness: 0.55 }), 0, 0, 0).rotation.x = -0.3;
    // name plaque and papers
    const plaque = add(g, rbox(0.7, 0.2, 0.06, 0.02), mat(0x1e2833), 0, 1.24, 1.0, { cast: false }); plaque.rotation.x = -0.4;
    add(g, new THREE.BoxGeometry(0.5, 0.01, 0.36), mat(0xffffff), 0.25, 1.13, 1.25, { cast: false }).rotation.y = 0.2;
    p.g = g; p.torso = torso; p.shoulder = shoulder;
  }
  // arbitration bench: rises behind the table
  const bench = new THREE.Group(); bench.position.set(0, 0, -3.9); sc.add(bench);
  add(bench, rbox(3.6, 1.6, 0.9, 0.06), mat(0x5d4433, { roughness: 0.45 }), 0, 0.8, 0);
  add(bench, rbox(3.8, 0.12, 1.1, 0.04), mat(0x7a5a43), 0, 1.66, 0);
  const judge = new THREE.Group(); judge.position.set(0, 1.0, -0.5); bench.add(judge);
  add(judge, bodyGeo, mat(0x2b3240), 0, 0.85, 0); add(judge, headGeo, mat(0xf0d2b6), 0, 1.6, 0);
  const gavel = new THREE.Group(); gavel.position.set(0.7, 1.75, 0.1); bench.add(gavel);
  add(gavel, new THREE.CylinderGeometry(0.11, 0.11, 0.36, 16), mat(0x4a2f20), 0, 0.12, 0).rotation.z = Math.PI / 2;
  add(gavel, new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), mat(0x4a2f20), 0, 0.12, 0.28).rotation.x = Math.PI / 2;
  add(bench, new THREE.CylinderGeometry(0.2, 0.22, 0.08, 20), mat(0x4a2f20), 0.7, 1.74, 0.1);
  const v = new THREE.Vector3(), tmp = new THREE.Object3D();
  function update(t) {
    S.placeCamera();
    const arg = ease(state.argue), law = ease(state.law), sl = ease(state.slump);
    parties.forEach((p, i) => {
      // pointing: shoulder aims at the next party (argue) or at the book (law)
      const next = parties[(i + 1) % 3].g.position;
      p.g.updateMatrixWorld();
      const aimAt = (target) => { tmp.position.copy(p.shoulder.getWorldPosition(v)); tmp.lookAt(target); return tmp.quaternion.clone(); };
      const qNext = aimAt(new THREE.Vector3(next.x, 2.4, next.z));
      const qBook = aimAt(new THREE.Vector3(0, 1.2, 0));
      const qRest = new THREE.Quaternion();
      // convert world aim into shoulder-local rotation pointing the arm (local -Y) along the aim
      const parentQ = p.torso.getWorldQuaternion(new THREE.Quaternion()).invert();
      const toLocal = (qw) => parentQ.clone().multiply(qw).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)));
      const target = qRest.clone().slerp(toLocal(qNext), arg * (1 - law)).slerp(toLocal(qBook), law);
      p.shoulder.quaternion.copy(target);
      p.torso.rotation.y = sl * (i === 1 ? 2.4 : i === 0 ? -2.2 : 2.6) * 0.5 + Math.sin(t * 0.8 + i * 2) * 0.03;
      p.torso.rotation.x = -0.05 * arg + 0.15 * sl;
    });
    bench.position.y = -2.2 + 2.2 * ease(state.arbiter); bench.visible = state.arbiter > 0.01;
    gavel.rotation.z = Math.sin(clamp01(state.gavel) * Math.PI) * 0.9;
    bookGlow.intensity = 6 * law;
    lampL.intensity = 18 * state.lamp; bulb.material.emissiveIntensity = 3 * state.lamp;
  }
  const anchor = (n) => {
    const p = parties.find((q) => q.name === n);
    if (p) return p.g.position.clone().setY(3.1);
    if (n === 'book') return new THREE.Vector3(0, 1.8, 0);
    if (n === 'bench') return new THREE.Vector3(0, bench.position.y + 3.3, -3.9);
    return new THREE.Vector3();
  };
  Object.assign(S.rig, { angle: 1.25, tilt: 0.55, dist: 15, ty: 1.4 });
  return { ...S, state, update, anchor, post: { bloom: 0.35, tilt: 0.7, focus: 0.5, threshold: 1.15 } };
}

// ---------------------------------------------------------------- Berlin vs the states: ping-pong
// spec.hops: a list of target names ('berlin' | 'state' | 'table' | 'law'); state.hop (float) runs
// along the list: the integer part is the leg, the fraction the flight along it.
export function pingpongSet(envMap, hops) {
  const S = studio(envMap, { radius: 8 });
  const state = { hop: 0, ball: 0, trail: 1 };
  const sc = S.scene;
  // Berlin (left): dome hall
  const ber = new THREE.Group(); ber.position.set(-4.6, 0, 0); sc.add(ber);
  add(ber, rbox(3.2, 1.4, 2.2, 0.08), mat(P.stone), 0, 0.7, 0);
  for (let i = 0; i < 5; i++) add(ber, new THREE.CylinderGeometry(0.09, 0.1, 1.1, 10), mat(0xffffff), -1 + i * 0.5, 0.62, 1.2);
  add(ber, new THREE.SphereGeometry(0.9, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), glassMat(), 0, 1.42, 0);
  for (const [x, z] of [[-1.5, -1], [1.5, -1], [-1.5, 1], [1.5, 1]]) add(ber, rbox(0.55, 1.7, 0.55, 0.05), mat(0xe2d7c3), x, 0.85, z);
  ['#1d1d1d', '#c8312b', '#f2c230'].forEach((c, i) => add(ber, new THREE.BoxGeometry(0.5, 0.1, 0.015), mat(c), 1.75, 2.3 - i * 0.1, 1.0, { cast: false }));
  add(ber, new THREE.CylinderGeometry(0.02, 0.02, 1.0, 6), mat(0x444444), 1.5, 1.95, 1.0);
  ber.rotation.y = 0.35;
  // the state capital (right): town hall + clock tower
  const st = new THREE.Group(); st.position.set(4.6, 0, 0); sc.add(st);
  add(st, rbox(2.8, 1.3, 1.9, 0.07), mat(0xead6b4), 0, 0.65, 0);
  add(st, rbox(0.85, 2.9, 0.85, 0.05), mat(0xe2c9a1), 0, 1.45, 0.3);
  add(st, new THREE.ConeGeometry(0.66, 1.05, 4), mat(0x5f8f74, { roughness: 0.5, metalness: 0.3 }), 0, 3.42, 0.3).rotation.y = Math.PI / 4;
  add(st, new THREE.CylinderGeometry(0.24, 0.24, 0.04, 24), new THREE.MeshStandardMaterial({ color: 0xfffaf0, emissive: 0xffe6b0, emissiveIntensity: 0.6 }), 0, 2.45, 0.74, { cast: false }).rotation.x = Math.PI / 2;
  st.rotation.y = -0.35;
  // the table (front centre) and the law book (back centre)
  const tb = new THREE.Group(); tb.position.set(0, 0, 3.2); sc.add(tb);
  add(tb, new THREE.CylinderGeometry(0.9, 0.9, 0.08, 40), mat(0x8a6a50), 0, 0.62, 0); add(tb, new THREE.CylinderGeometry(0.08, 0.14, 0.6, 12), mat(0x6b4f3a), 0, 0.3, 0);
  [0x8cc3dd, 0xf4f1ea, 0x6fa7a0].forEach((c, i) => { const a = i * 2.1 + 0.4; person(tb, Math.cos(a) * 1.15, Math.sin(a) * 1.15, c, 0, 1.6); });
  const law = new THREE.Group(); law.position.set(0, 0, -3.6); sc.add(law);
  add(law, rbox(1.3, 0.7, 0.24, 0.04), mat(0x2f4a6b), 0, 0.6, 0).rotation.x = -0.25;
  add(law, rbox(0.7, 0.3, 0.7, 0.04), mat(0x55606a), 0, 0.15, 0);
  forest(sc, [[-6.6, 0, -2.4, 0.8], [-6.2, 0, 2.6, 0.7], [6.6, 0, -2.2, 0.8], [6.4, 0, 2.6, 0.7], [-2.5, 0, -5.6, 0.6], [2.6, 0, -5.6, 0.6]], 31);
  add(sc, new THREE.CylinderGeometry(3.2, 3.2, 0.03, 64), mat(0x4a5560), -4.6, 0.015, 0, { cast: false });
  add(sc, new THREE.CylinderGeometry(3.2, 3.2, 0.03, 64), mat(0x55504a), 4.6, 0.015, 0, { cast: false });
  const T = { berlin: new THREE.Vector3(-4.6, 2.6, 0), state: new THREE.Vector3(4.6, 3.9, 0.3), table: new THREE.Vector3(0, 1.2, 3.2), law: new THREE.Vector3(0, 1.3, -3.6) };
  // the ball of blame + a short trail
  const ballMat = glow(0xff8a73, 2.2);
  const ball = add(sc, new THREE.SphereGeometry(0.28, 24, 16), ballMat, 0, 3, 0, { cast: true });
  const light = new THREE.PointLight(0xff8a73, 8, 6, 1.5); sc.add(light);
  const trail = []; for (let i = 0; i < 8; i++) trail.push(add(sc, new THREE.SphereGeometry(0.2 - i * 0.02, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff8a73, transparent: true, opacity: 0.35 - i * 0.04, depthWrite: false }), 0, 0, 0, { cast: false }));
  const posAt = (h) => {
    h = Math.min(Math.max(0, h), hops.length - 1.0001);
    const i = Math.floor(h), f = h - i;
    const a = T[hops[i]], b = T[hops[i + 1]] ?? a;
    const p = a.clone().lerp(b, f); p.y += Math.sin(f * Math.PI) * (0.9 + a.distanceTo(b) * 0.12);
    return p;
  };
  function update() {
    S.placeCamera();
    const p = posAt(state.hop); ball.position.copy(p); light.position.copy(p);
    ball.visible = state.ball > 0.01; ball.scale.setScalar(Math.max(0.001, state.ball)); light.intensity = 8 * state.ball;
    trail.forEach((s, i) => { s.position.copy(posAt(state.hop - (i + 1) * 0.035)); s.visible = state.ball > 0.5 && state.trail > 0; });
  }
  const anchor = (n) => (T[n] ? T[n].clone().add(new THREE.Vector3(0, n === 'table' ? 1.6 : 1.2, 0)) : new THREE.Vector3());
  Object.assign(S.rig, { angle: Math.PI / 2, tilt: 0.38, dist: 21, ty: 1.4 });
  return { ...S, state, update, anchor, post: { bloom: 0.5, tilt: 0.6, focus: 0.5, threshold: 1.15 } };
}

// ---------------------------------------------------------------- the factory: a slowing line
// state.travel: distance moved by the conveyor (tween it with an ease-out to slow it);
// state.lit 0..1 hall lights; state.ship 0..1 a container ship passing on the water behind.
export function factorySet(envMap) {
  const S = studio(envMap, { radius: 7.5, top: 0x4a5058 });
  const state = { travel: 0, lit: 1, ship: 0, smoke: 1 };
  const sc = S.scene;
  // the hall: back wall + saw-tooth roof frames (cutaway: no front wall)
  add(sc, rbox(10, 3, 0.25, 0.04), mat(0xd6cfc4), 0, 1.5, -2.8);
  add(sc, rbox(0.25, 3, 5.6, 0.04), mat(0xcfc8bc), -5, 1.5, 0);
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Shape(); s.moveTo(-1, 0); s.lineTo(1, 0); s.lineTo(1, 0.9); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false });
    add(sc, geo, mat(0x9da7ad), -4 + i * 2, 3, -2.8);
  }
  const hallLights = [];
  for (let i = 0; i < 5; i++) {
    const lm = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xffe2a8, emissiveIntensity: 2 });
    add(sc, new THREE.BoxGeometry(1.2, 0.06, 0.2), lm, -4 + i * 2, 2.7, -0.6, { cast: false }); hallLights.push(lm);
  }
  const hallL = new THREE.PointLight(0xffe2a8, 14, 12, 1.4); hallL.position.set(0, 2.5, 0); sc.add(hallL);
  // conveyor
  add(sc, rbox(10, 0.3, 1.1, 0.06), mat(0x3a3f44), 0, 0.75, 0);
  add(sc, new THREE.BoxGeometry(10, 0.04, 0.9), mat(0x23262a), 0, 0.92, 0);
  for (let i = 0; i < 9; i++) add(sc, new THREE.CylinderGeometry(0.07, 0.07, 0.6, 8), mat(0x666b70), -4.5 + i * 1.125, 0.3, 0.4);
  const items = [];
  for (let i = 0; i < 9; i++) { const c = car(sc, [0xd9534f, 0xf2f2f2, 0x4f86c6, 0x3d4a55, 0xe9c46a][i % 5]); c.scale.setScalar(1.7); items.push(c); }
  // robotic arms
  const arms = [];
  for (const x of [-2.2, 1.6]) {
    const base = add(sc, new THREE.CylinderGeometry(0.3, 0.38, 0.4, 16), mat(0xf2a33a), x, 0.2, -1.2);
    const a = new THREE.Group(); a.position.set(x, 0.4, -1.2); sc.add(a);
    add(a, rbox(0.22, 1.4, 0.22, 0.05), mat(0xf2a33a), 0, 0.7, 0);
    const fore = new THREE.Group(); fore.position.set(0, 1.4, 0); a.add(fore);
    add(fore, rbox(0.18, 1.1, 0.18, 0.05), mat(0xf2a33a), 0, 0.55, 0); fore.rotation.x = 1.1;
    arms.push({ a, fore }); void base;
  }
  // chimneys + smoke
  const smokeMat = new THREE.MeshStandardMaterial({ color: 0xe9e6e0, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false });
  const smoke = [];
  for (const x of [3.6, 4.4]) {
    add(sc, new THREE.CylinderGeometry(0.22, 0.28, 4.6, 16), mat(0xb8aea2), x, 2.3, -3.6); add(sc, new THREE.CylinderGeometry(0.24, 0.24, 0.16, 16), mat(0xb5553f), x, 4.3, -3.6);
    for (let i = 0; i < 7; i++) smoke.push({ s: add(sc, new THREE.SphereGeometry(0.3, 14, 10), smokeMat, x, 4.6, -3.6, { cast: false, receive: false }), x, ph: i / 7 });
  }
  function update(t) {
    S.placeCamera();
    const L = 10;
    items.forEach((c, i) => {
      const x = (((i * (L / items.length) + state.travel) % L) + L) % L - L / 2;
      c.position.set(x, 0.92, 0); c.rotation.y = 0;
      c.scale.setScalar(1.7 * ease(Math.min(x + L / 2, L / 2 - x) / 0.5));
    });
    arms.forEach((a, i) => { a.a.rotation.y = Math.sin(state.travel * 0.9 + i * 2) * 0.6; a.fore.rotation.x = 1.0 + Math.sin(state.travel * 1.3 + i) * 0.35; });
    hallLights.forEach((m) => { m.emissiveIntensity = 2 * state.lit; }); hallL.intensity = 14 * state.lit;
    for (const s of smoke) { const ph = (t * 0.1 * (0.3 + 0.7 * state.smoke) + s.ph) % 1; s.s.position.set(s.x + ph * 1.4, 4.6 + ph * 2.6, -3.6 - ph * 0.6); s.s.scale.setScalar((0.5 + ph * 2) * Math.max(0.05, state.smoke)); }
  }
  const anchor = () => new THREE.Vector3(0, 3.6, 0);
  Object.assign(S.rig, { angle: 1.3, tilt: 0.28, dist: 17, ty: 1.4 });
  return { ...S, state, update, anchor, post: { bloom: 0.35, tilt: 0.7, focus: 0.5, threshold: 1.15 } };
}

// ---------------------------------------------------------------- the hospital, cut open
// Three floors, front wall removed: ground = emergency, middle = operating theatre, top = ward.
// state.night 0..1, state.er / state.op / state.ward 0..1 lights per floor, state.clock (hours),
// state.overnight 0..1 patients in the ward beds, state.surgery 0..1 the theatre at work,
// state.resident 0..1 a trainee joins the surgeon.
export function wardSet(envMap) {
  const S = studio(envMap, { radius: 7.5, top: 0x3a4148 });
  const state = { night: 0, er: 1, op: 1, ward: 1, clock: 15, overnight: 0, surgery: 0, resident: 0, ambulance: 0 };
  const sc = S.scene;
  const W = 9, D = 3.4, FH = 1.8;
  // shell: floors, back wall, side walls, roof
  for (let f = 0; f <= 3; f++) add(sc, rbox(W + 0.3, 0.16, D + 0.2, 0.04), mat(f === 3 ? 0xd0d6da : 0xf2efe9), 0, f * FH + 0.08, 0);
  add(sc, rbox(W + 0.3, 3 * FH, 0.18, 0.04), mat(0xf4f1ea), 0, 1.5 * FH, -D / 2);
  for (const x of [-W / 2, W / 2]) add(sc, rbox(0.18, 3 * FH, D + 0.2, 0.04), mat(0xf0ebe2), x, 1.5 * FH, 0);
  for (let f = 0; f < 3; f++) add(sc, rbox(W + 0.32, 0.1, 0.14, 0.03), mat(0xd9534f), 0, f * FH + 0.2, D / 2 + 0.06, { cast: false });
  // room colour per floor (soft hospital palette)
  const floorMat = [mat(0xc9d6d3), mat(0xbcd9d2), mat(0xd9d0c2)];
  // back walls tinted per floor: emergency (warm), theatre (surgical green), ward (cream)
  [0xf0e2d4, 0xcfe6df, 0xf2ead8].forEach((c, f) => add(sc, new THREE.BoxGeometry(W - 0.25, FH - 0.2, 0.04), mat(c), 0, f * FH + FH / 2 + 0.1, -D / 2 + 0.12, { cast: false }));
  for (let f = 0; f < 3; f++) add(sc, new THREE.BoxGeometry(W - 0.2, 0.02, D - 0.1), floorMat[f], 0, f * FH + 0.17, 0, { cast: false });
  // ceiling light panels per floor (glow = floor on)
  const panels = [0, 1, 2].map((f) => {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3dc, emissiveIntensity: 1.5 });
    for (let i = 0; i < 4; i++) add(sc, new THREE.BoxGeometry(1.2, 0.03, 0.5), m, -3.3 + i * 2.2, (f + 1) * FH - 0.02, -0.2, { cast: false });
    const l = new THREE.PointLight(0xfff0d8, 2, 9, 1.2); l.position.set(0, (f + 0.85) * FH, 1.6); sc.add(l);
    return { m, l };
  });
  // ---- ground: emergency department
  const y0 = 0.18;
  add(sc, rbox(1.8, 0.5, 0.8, 0.05), mat(0xcfd8dc), -2.8, y0 + 0.45, -0.8); // reception desk
  for (let i = 0; i < 2; i++) { add(sc, rbox(1.3, 0.12, 0.6, 0.04), mat(0xffffff), 0.6 + i * 1.7, y0 + 0.6, -0.6); add(sc, rbox(1.3, 0.5, 0.06, 0.02), mat(0x9fb5c0), 0.6 + i * 1.7, y0 + 0.3, -0.6, { cast: false }); }
  const erPatient = person(sc, 0.6, -0.6, 0xe48d78, y0 + 0.66, 1.6); erPatient.rotation.z = Math.PI / 2; erPatient.position.x = 1.0;
  person(sc, -2.8, -1.25, 0x6fa7a0, y0, 1.7); person(sc, 2.6, 0.2, 0x8cc3dd, y0, 1.7);
  const amb = car(sc, 0xffffff); amb.scale.setScalar(2.2); amb.rotation.y = Math.PI;
  const ambStripe = add(amb, new THREE.BoxGeometry(0.64, 0.05, 0.34), mat(0xd9534f), 0, 0.2, 0, { cast: false }); void ambStripe;
  const siren = new THREE.MeshStandardMaterial({ color: 0x9fd3ff, emissive: 0x4fa8ff, emissiveIntensity: 0 });
  add(amb, new THREE.BoxGeometry(0.12, 0.05, 0.22), siren, -0.04, 0.43, 0, { cast: false });
  // ---- middle: operating theatre
  const y1 = FH + 0.18;
  add(sc, rbox(1.8, 0.14, 0.7, 0.04), mat(0x8fb5c0), 0, y1 + 0.85, 0); add(sc, new THREE.CylinderGeometry(0.12, 0.2, 0.8, 12), mat(0xb0b8c0), 0, y1 + 0.42, 0);
  const opPatient = add(sc, new THREE.CapsuleGeometry(0.2, 1.1, 4, 12), mat(0x8fd3cf), 0, y1 + 1.06, 0); opPatient.rotation.z = Math.PI / 2;
  const opLamp = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e8, emissiveIntensity: 0 });
  add(sc, new THREE.CylinderGeometry(0.5, 0.35, 0.16, 24), mat(0xe9eef0), 0, y1 + 1.55, 0, { cast: false });
  add(sc, new THREE.CylinderGeometry(0.42, 0.42, 0.02, 24), opLamp, 0, y1 + 1.46, 0, { cast: false });
  const opSpot = new THREE.SpotLight(0xffffff, 0, 6, 0.6, 0.5, 1); opSpot.position.set(0, y1 + 1.5, 0); opSpot.target.position.set(0, y1, 0); sc.add(opSpot, opSpot.target);
  const surgeon = person(sc, -0.2, 0.75, 0x5aa58f, y1, 1.7);
  const assistant = person(sc, 0.9, -0.7, 0x5aa58f, y1, 1.7);
  const resident = person(sc, -1.1, 0.7, 0x86c5ae, y1, 1.65);
  const monitor = new THREE.MeshStandardMaterial({ color: 0x0b1626, emissive: 0x2fd0b0, emissiveIntensity: 0.8 });
  add(sc, rbox(0.8, 0.5, 0.06, 0.03), monitor, 2.0, y1 + 1.4, -1.4, { cast: false });
  add(sc, rbox(0.8, 0.5, 0.06, 0.03), monitor, -2.4, y1 + 1.2, -1.4, { cast: false }); // laparoscopy screen
  // clock on the theatre wall
  const clk = new THREE.Group(); clk.position.set(3.2, y1 + 1.25, -1.6); sc.add(clk);
  add(clk, new THREE.CylinderGeometry(0.36, 0.36, 0.05, 32), mat(0xffffff), 0, 0, 0, { cast: false }).rotation.x = Math.PI / 2;
  const hourH = new THREE.Group(); clk.add(hourH); add(hourH, new THREE.BoxGeometry(0.04, 0.2, 0.02), mat(0x222222), 0, 0.1, 0.04, { cast: false });
  const minH = new THREE.Group(); clk.add(minH); add(minH, new THREE.BoxGeometry(0.03, 0.3, 0.02), mat(0x222222), 0, 0.15, 0.05, { cast: false });
  // ---- top: ward with beds
  const y2 = 2 * FH + 0.18;
  const sleepers = [];
  for (let i = 0; i < 4; i++) {
    const x = -3.2 + i * 2.1;
    add(sc, rbox(1.0, 0.4, 1.7, 0.05), mat(0xffffff), x, y2 + 0.35, -0.6); add(sc, rbox(1.0, 0.6, 0.08, 0.03), mat(0x9fb5c0), x, y2 + 0.5, -1.45);
    add(sc, rbox(0.6, 0.12, 0.35, 0.05), mat(0xf4f1ea), x, y2 + 0.6, -1.2, { cast: false });
    const sl = add(sc, new THREE.CapsuleGeometry(0.22, 0.9, 4, 10), mat(i % 2 ? 0xe48d78 : 0x8fd3cf), x, y2 + 0.66, -0.5); sl.rotation.x = Math.PI / 2; sleepers.push(sl);
    const lampM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffc27a, emissiveIntensity: 0 });
    add(sc, new THREE.SphereGeometry(0.09, 12, 8), lampM, x + 0.6, y2 + 1.2, -1.45, { cast: false }); sleepers[i].userData.lamp = lampM;
  }
  const nurse = person(sc, 2.6, 0.6, 0x8cc3dd, y2, 1.9);
  void nurse;
  // outside: a few trees + ground on the plinth
  forest(sc, [[-6.0, 0, 2.6, 0.9], [6.0, 0, 2.4, 0.8], [-6.2, 0, -2.0, 1.1], [6.3, 0, -1.6, 1.0]], 21);
  function update(t) {
    S.placeCamera();
    const n = state.night;
    S.scene.environmentIntensity = 0.25 - 0.15 * n;
    S.lights.keyL.intensity = 2.4 * (1 - 0.75 * n); S.lights.hemi.intensity = 0.35 * (1 - 0.6 * n);
    [state.er, state.op, state.ward].forEach((v, f) => { panels[f].m.emissiveIntensity = 0.1 + 0.7 * v; panels[f].l.intensity = (0.6 + 2.2 * n) * v; });
    const s = ease(state.surgery);
    opLamp.emissiveIntensity = 1.6 * s; opSpot.intensity = 7 * s;
    surgeon.position.y = y1 + Math.sin(t * 2.1) * 0.01 * s; resident.visible = state.resident > 0.01; resident.scale.setScalar(Math.max(0.001, ease(state.resident)) * 1.65);
    monitor.emissiveIntensity = 0.3 + 0.9 * s;
    sleepers.forEach((sl, i) => { const on = clamp01(state.overnight * 4 - i); sl.visible = on > 0.01; sl.scale.setScalar(Math.max(0.001, on)); sl.userData.lamp.emissiveIntensity = 2 * on * n; });
    const h = state.clock; hourH.rotation.z = -((h % 12) / 12) * Math.PI * 2; minH.rotation.z = -(h % 1) * Math.PI * 2;
    amb.position.set(-7.5 + 4.0 * ease(state.ambulance), y0 - 0.15, 1.7); amb.visible = state.ambulance > 0.01;
    siren.emissiveIntensity = state.ambulance > 0.01 && state.ambulance < 0.999 ? (Math.sin(t * 18) > 0 ? 4 : 0.3) : 0.3;
    void assistant; void erPatient;
  }
  const anchor = (n) => ({ er: new THREE.Vector3(-1, FH * 0.95, 1.8), theatre: new THREE.Vector3(0, FH * 1.95, 1.8), ward: new THREE.Vector3(0, FH * 2.95, 1.8), clock: new THREE.Vector3(3.2, y1 + 1.8, -1.4), roof: new THREE.Vector3(0, 3 * FH + 0.8, 0) }[n] ?? new THREE.Vector3());
  Object.assign(S.rig, { angle: Math.PI / 2, tilt: 0.12, dist: 17, ty: 2.7 });
  return { ...S, state, update, anchor, FH, post: { bloom: 0.35, tilt: 0.55, focus: 0.5, threshold: 1.155 } };
}

// ---------------------------------------------------------------- the verdict: three layers
// Three floating slabs. state.l1..l3 0..1 bring each in; state.f1..f3 0..1 highlight;
// state.lever 0..4 flips the four levers on the top slab (choices that can change).
export function layersSet(envMap) {
  const S = studio(envMap, { radius: 6, top: 0x2f363e });
  const state = { l1: 0, l2: 0, l3: 0, f1: 0, f2: 0, f3: 0, lever: 0 };
  const sc = S.scene;
  const slabs = [];
  const tints = [0x9fd8e8, 0x8cc3dd, 0xffd08a];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group(); sc.add(g);
    const edge = new THREE.MeshStandardMaterial({ color: tints[i], emissive: tints[i], emissiveIntensity: 0.15, roughness: 0.3, transparent: true, opacity: 0.95 });
    add(g, rbox(7.2, 0.28, 3.4, 0.12, 3), mat(0xe9eef0, { roughness: 0.4 }), 0, 0, 0);
    add(g, rbox(7.3, 0.08, 3.5, 0.04), edge, 0, -0.16, 0, { cast: false });
    slabs.push({ g, edge });
  }
  // layer 1: forces (an older crowd, a factory under a grey cloud)
  {
    const g = slabs[0].g;
    for (let i = 0; i < 14; i++) { const p = person(g, -3.0 + (i % 7) * 0.45, -0.6 + Math.floor(i / 7) * 0.6, i % 4 === 0 ? 0xffc977 : 0x8fd3cf, 0.14, 1.5); void p; }
    add(g, rbox(1.6, 0.8, 1.1, 0.05), mat(0xc9c1b4), 1.8, 0.54, 0); add(g, new THREE.CylinderGeometry(0.12, 0.15, 1.5, 10), mat(0xb8aea2), 2.4, 0.9, -0.3);
    const cl = new THREE.Group(); cl.position.set(1.8, 1.9, 0); g.add(cl);
    for (let i = 0; i < 4; i++) add(cl, new THREE.SphereGeometry(0.35 + (i % 2) * 0.12, 14, 10), mat(0x8b96a1), -0.5 + i * 0.35, (i % 2) * 0.1, 0, { cast: false });
  }
  // layer 2: design (two capitals, two pipes that never meet)
  {
    const g = slabs[1].g;
    add(g, rbox(1.1, 0.6, 0.8, 0.04), mat(P.stone), -2.6, 0.44, -0.6); add(g, new THREE.SphereGeometry(0.32, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), glassMat(), -2.6, 0.74, -0.6);
    add(g, rbox(0.9, 0.55, 0.7, 0.04), mat(0xead6b4), -2.6, 0.42, 0.8); add(g, rbox(0.3, 1.1, 0.3, 0.03), mat(0xe2c9a1), -2.6, 0.7, 0.9);
    const p1 = new THREE.CatmullRomCurve3([new THREE.Vector3(-2.0, 0.6, -0.6), new THREE.Vector3(0, 0.9, -0.4), new THREE.Vector3(1.9, 0.6, -0.15)]);
    const p2 = new THREE.CatmullRomCurve3([new THREE.Vector3(-2.0, 0.55, 0.8), new THREE.Vector3(0, 0.85, 0.6), new THREE.Vector3(1.9, 0.6, 0.35)]);
    add(g, new THREE.TubeGeometry(p1, 40, 0.08, 10), glow(0x8cc3dd, 0.9), 0, 0, 0, { cast: false }); add(g, new THREE.TubeGeometry(p2, 40, 0.08, 10), glow(0xf6b55b, 0.9), 0, 0, 0, { cast: false });
    add(g, rbox(1.0, 0.9, 0.8, 0.04), mat(0xf4f1ea), 2.6, 0.58, 0.1);
    add(g, new THREE.CylinderGeometry(0.5, 0.5, 0.06, 24), mat(0x8a6a50), 0.2, 0.42, 1.2);
  }
  // layer 3: choices (four levers)
  const levers = [];
  {
    const g = slabs[2].g;
    for (let i = 0; i < 4; i++) {
      const x = -2.4 + i * 1.6;
      add(g, rbox(0.9, 0.2, 0.6, 0.06), mat(0x3d4a55), x, 0.24, 0);
      const pivot = new THREE.Group(); pivot.position.set(x, 0.34, 0); g.add(pivot);
      add(pivot, new THREE.CylinderGeometry(0.05, 0.05, 0.8, 10), mat(0xd0d6da, { metalness: 0.6, roughness: 0.3 }), 0, 0.4, 0);
      const knob = new THREE.MeshStandardMaterial({ color: 0xffb4a3, emissive: 0xff8a73, emissiveIntensity: 0.6 });
      add(pivot, new THREE.SphereGeometry(0.16, 16, 12), knob, 0, 0.82, 0);
      levers.push({ pivot, knob });
    }
  }
  const Y = [0.9, 2.9, 4.9];
  function update(t) {
    S.placeCamera();
    slabs.forEach((s, i) => {
      const k = ease(state['l' + (i + 1)]);
      s.g.position.set(0, Y[i] - (1 - k) * 2.5 + Math.sin(t * 0.6 + i) * 0.05, 0);
      s.g.scale.setScalar(Math.max(0.001, k)); s.g.visible = k > 0.002;
      s.edge.emissiveIntensity = 0.15 + 1.6 * state['f' + (i + 1)];
    });
    levers.forEach((l, i) => {
      const f = ease(clamp01(state.lever - i));
      l.pivot.rotation.z = 0.6 - 1.2 * f;
      l.knob.color.setHex(f > 0.5 ? 0x9fe6d8 : 0xffb4a3); l.knob.emissive.setHex(f > 0.5 ? 0x2fd0b0 : 0xff8a73);
    });
  }
  const anchor = (n) => { const i = Number(n.replace(/\D/g, '')) - 1; return new THREE.Vector3(3.9, (slabs[i]?.g.position.y ?? 0) + 0.2, 1.7); };
  Object.assign(S.rig, { angle: 1.3, tilt: 0.3, dist: 20, ty: 2.9 });
  return { ...S, state, update, anchor, post: { bloom: 0.4, tilt: 0.6, focus: 0.5, threshold: 1.15 } };
}
