// "Pass the Blame" v2: the main diorama. A round slice of Germany on a dark plinth:
// terrain with a hill and a river, roads with traffic, villages, forests, and the
// buildings of the story (Berlin, the state capital, the insurers, the Klinikum on its hill,
// a doctor's practice, a patient's home, the negotiating pavilion and a factory).
// Everything that animates is a plain number on world.state / world.rig / world.beam,
// so GSAP can tween it and update(t) stays pure in t.
import { THREE, rng, P, mat, glassMat, windowMat, rbox, add, lights, applyDay, skyTexture, forest, person, car, onCurve, lamps, cloud } from './kit.js';

const R = 17;          // island radius
const RIVER = [[-18, -1.4], [-12, -1.9], [-6.5, -1.2], [-2, 0.2], [2.5, 0.7], [7, 0.2], [12, 1.1], [18, 1.6]];
const HILL = { x: -6, z: 5, r: 5.4, h: 1.25 };

export function createIsland(envMap) {
  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xf4d3ae, 70, 150);
  scene.environment = envMap;
  const camera = new THREE.PerspectiveCamera(26, 16 / 9, 0.3, 400);
  const L = lights(scene, { shadowSize: 2048, extent: 21 });
  const r = rng(7);

  // ---------- height field ----------
  const riverCurve = new THREE.CatmullRomCurve3(RIVER.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const riverPts = riverCurve.getSpacedPoints(300);
  const riverDist = (x, z) => { let m = 1e9; for (const p of riverPts) m = Math.min(m, (p.x - x) ** 2 + (p.z - z) ** 2); return Math.sqrt(m); };
  const n2 = (x, z) => Math.sin(x * 0.55 + 1.3) * Math.cos(z * 0.47 - 0.4) * 0.5 + Math.sin(x * 1.3 - z * 0.9) * 0.25;
  function heightAt(x, z) {
    const rr = Math.hypot(x, z);
    let h = 0.04 + 0.06 * n2(x, z);
    const dh = Math.hypot(x - HILL.x, z - HILL.z);
    if (dh < HILL.r) h += HILL.h * (0.5 + 0.5 * Math.cos(Math.PI * dh / HILL.r)) ** 0.8;
    const dr = riverDist(x, z);
    if (dr < 1.25) h = THREE.MathUtils.lerp(-0.42, h, THREE.MathUtils.smoothstep(dr, 0.55, 1.25));
    const edge = THREE.MathUtils.smoothstep(rr, R - 1.2, R);
    return h * (1 - edge) + -0.05 * edge;
  }
  const hospTop = heightAt(HILL.x, HILL.z);

  // ---------- terrain (polar grid, vertex-coloured fields) ----------
  {
    const RINGS = 70, SEG = 200;
    const pos = [], col = [], idx = [];
    const c = new THREE.Color();
    const fieldCols = [P.field1, P.field2, P.meadow, 0xc9c27a, 0x9bbd7c, 0xd6c48d].map((h) => new THREE.Color(h));
    const g1 = new THREE.Color(P.grass), g2 = new THREE.Color(P.grassDark), sand = new THREE.Color(0xd9c9a4), mud = new THREE.Color(0x8a7a62);
    pos.push(0, heightAt(0, 0), 0); col.push(g1.r, g1.g, g1.b);
    for (let i = 1; i <= RINGS; i++) {
      const rad = R * (i / RINGS);
      for (let j = 0; j < SEG; j++) {
        const a = (j / SEG) * Math.PI * 2;
        const x = Math.cos(a) * rad, z = Math.sin(a) * rad, y = heightAt(x, z);
        pos.push(x, y, z);
        const dr = riverDist(x, z);
        c.copy(g1).lerp(g2, 0.5 + 0.5 * n2(x * 2.1, z * 2.3));
        // patchwork fields in the open countryside
        const u = x * 0.74 + z * 0.67, v = -x * 0.67 + z * 0.74;
        const cell = Math.floor(u / 2.4) * 31 + Math.floor(v / 1.7) * 17;
        const open = (x > 5 && z > 7.5) || (x < -10 && z > 4) || (x > 10 && z < -1) || (z < -12) || (x < -12 && z < -5);
        if (open && (cell & 3) !== 0) c.copy(fieldCols[Math.abs(cell) % fieldCols.length]);
        if (dr < 1.35) c.lerp(dr < 0.9 ? mud : sand, THREE.MathUtils.smoothstep(1.35 - dr, 0, 0.45));
        col.push(c.r, c.g, c.b);
      }
    }
    for (let j = 0; j < SEG; j++) idx.push(0, 1 + ((j + 1) % SEG), 1 + j);
    for (let i = 1; i < RINGS; i++) for (let j = 0; j < SEG; j++) {
      const a = 1 + (i - 1) * SEG + j, b = 1 + (i - 1) * SEG + ((j + 1) % SEG), cc = a + SEG, d = b + SEG;
      idx.push(a, b, cc, b, d, cc);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }));
    m.receiveShadow = true; scene.add(m);
    // cake sides: soil layers, then a dark wooden plinth
    add(scene, new THREE.CylinderGeometry(R, R - 0.15, 0.9, 128, 1, true), mat(P.soil, { side: THREE.DoubleSide }), 0, -0.5, 0, { cast: false });
    add(scene, new THREE.CylinderGeometry(R - 0.15, R - 0.3, 0.7, 128, 1, true), mat(0x5e4636, { side: THREE.DoubleSide }), 0, -1.25, 0, { cast: false });
    add(scene, new THREE.CylinderGeometry(R + 0.9, R + 1.1, 0.5, 128), mat(0x2b2622, { roughness: 0.45, metalness: 0.1 }), 0, -1.85, 0, { cast: false });
    add(scene, new THREE.TorusGeometry(R + 0.9, 0.05, 8, 160), mat(0xc9a46b, { roughness: 0.3, metalness: 0.8 }), 0, -1.6, 0, { cast: false }).rotation.x = Math.PI / 2;
    // water: one sheet; the terrain only dips below it in the river channel
    const water = add(scene, new THREE.CircleGeometry(R - 0.05, 128), new THREE.MeshStandardMaterial({ color: P.water, roughness: 0.12, metalness: 0.35, envMapIntensity: 1.4, transparent: true, opacity: 0.92 }), 0, -0.16, 0, { cast: false });
    water.rotation.x = -Math.PI / 2;
  }

  // ---------- roads (ribbons hugging the terrain, dashed centre line) ----------
  const roadTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
    const x = cv.getContext('2d');
    x.fillStyle = '#77716b'; x.fillRect(0, 0, 64, 256);
    x.fillStyle = '#d9d2c4'; x.fillRect(0, 0, 5, 256); x.fillRect(59, 0, 5, 256);
    x.fillStyle = '#f2e8cf'; x.fillRect(30, 0, 4, 120);
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  })();
  const roads = {};
  function road(name, pts, width = 0.5, lift = 0.035) {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const N = Math.ceil(curve.getLength() * 6);
    const pos = [], uv = [], idx = [];
    const p = new THREE.Vector3(), tg = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      const u = i / N; curve.getPointAt(u, p); curve.getTangentAt(u, tg);
      const nx = -tg.z, nz = tg.x, l = Math.hypot(nx, nz) || 1;
      for (const s of [-1, 1]) {
        const x = p.x + (nx / l) * width * 0.5 * s, z = p.z + (nz / l) * width * 0.5 * s;
        const onRiver = riverDist(p.x, p.z) < 1.3;
        const y = onRiver ? Math.max(heightAt(x, z), 0.12) + 0.08 : heightAt(x, z) + lift;
        pos.push(x, y, z); uv.push(s < 0 ? 0 : 1, (u * curve.getLength()) / 1.6);
      }
      if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.receiveShadow = true; scene.add(m);
    // a 3D path for traffic: same curve lifted to the road surface
    const lifted = new THREE.CatmullRomCurve3(curve.getSpacedPoints(Math.ceil(N / 2)).map((q) => {
      const y = riverDist(q.x, q.z) < 1.3 ? Math.max(heightAt(q.x, q.z), 0.12) + 0.08 : heightAt(q.x, q.z) + lift;
      return new THREE.Vector3(q.x, y, q.z);
    }));
    roads[name] = { curve: lifted, width };
    return lifted;
  }
  road('north', [[-16.8, -3.2], [-12, -3.6], [-8, -3.4], [-4, -4.6], [-1, -5.8], [3, -5.1], [8, -3.4], [12.5, -3.9], [16.8, -2.8]]);
  road('south', [[-6.2, 3.0], [-3.4, 4.4], [0.5, 5.4], [4, 5.0], [7, 6.6], [9.6, 7.6], [13, 9.4], [15.4, 10.4]]);
  road('bridge', [[-1.6, -5.4], [-2.2, -3.0], [-1.6, -0.4], [-1.2, 1.2], [-2.0, 3.0], [-3.3, 4.35]], 0.46);
  road('mill', [[-12.6, 2.4], [-10.6, 3.0], [-8.4, 2.6], [-6.4, 3.0]], 0.4);
  road('lane', [[4.2, 5.0], [4.6, 3.6]], 0.36);
  // bridge deck + railings
  {
    const bp = roads.bridge.curve; const a = bp.getPointAt(0.38), b = bp.getPointAt(0.62);
    const len = a.distanceTo(b), mid = a.clone().lerp(b, 0.5);
    const deck = add(scene, rbox(0.75, 0.12, len, 0.04), mat(P.stone), mid.x, 0.1, mid.z);
    deck.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    for (const s of [-1, 1]) { const rl = add(deck, rbox(0.05, 0.12, len, 0.02), mat(0xffffff), 0.36 * s, 0.12, 0); rl.castShadow = false; }
    for (const s of [-0.3, 0.3]) add(deck, new THREE.CylinderGeometry(0.1, 0.12, 0.5, 10), mat(P.stone), 0, -0.3, s * len);
  }

  // ---------- buildings ----------
  const B = {};
  const lit = [];  // { m: windowMaterial, k: group key }
  const group = (name, x, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, heightAt(x, z), z); g.rotation.y = ry; scene.add(g); B[name] = g; return g; };
  // A grid of window panes on a facade. Returns the material so groups can glow.
  function windows(parent, { x0, y0, z, cols, rows, dx, dy, w = 0.22, h = 0.26, glow = P.amber, ry = 0, key = 'misc', perRow = false }) {
    const geo = new THREE.BoxGeometry(w, h, 0.03);
    const mats = [];
    for (let rI = 0; rI < rows; rI++) {
      const m = perRow || rI === 0 ? windowMat(glow) : mats[0];
      if (perRow || rI === 0) { mats.push(m); lit.push({ m, key, row: rI }); }
      for (let c = 0; c < cols; c++) {
        const pane = new THREE.Mesh(geo, perRow ? m : mats[0]);
        const px = x0 + c * dx;
        if (ry) { pane.position.set(z, y0 + rI * dy, px); pane.rotation.y = ry; } else pane.position.set(px, y0 + rI * dy, z);
        parent.add(pane);
      }
    }
    return mats;
  }

  // Berlin: the federal ministry (domed parliament-style hall with corner towers)
  {
    const g = group('berlin', -8.2, -6.6);
    add(g, rbox(4.6, 1.7, 3.0, 0.1), mat(P.stone), 0, 0.85, 0);
    add(g, rbox(4.9, 0.18, 3.3, 0.05), mat(0xc8bca6), 0, 1.75, 0);
    for (const [x, z] of [[-2.15, -1.35], [2.15, -1.35], [-2.15, 1.35], [2.15, 1.35]]) add(g, rbox(0.8, 2.15, 0.8, 0.08), mat(0xe2d7c3), x, 1.08, z);
    for (let i = 0; i < 6; i++) add(g, new THREE.CylinderGeometry(0.11, 0.13, 1.35, 12), mat(0xffffff), -1.35 + i * 0.54, 0.78, 1.62);
    add(g, rbox(3.4, 0.35, 0.35, 0.05), mat(0xf3ece0), 0, 1.55, 1.62);
    add(g, rbox(3.6, 0.15, 0.9, 0.05), mat(0xdcd2c0), 0, 0.08, 1.95);
    windows(g, { x0: -1.6, y0: 0.55, z: -1.52, cols: 7, rows: 2, dx: 0.53, dy: 0.62, key: 'berlin' });
    const dome = add(g, new THREE.SphereGeometry(1.15, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), glassMat(), 0, 1.84, 0);
    for (let i = 0; i < 12; i++) {
      const rib = add(g, new THREE.TorusGeometry(1.16, 0.022, 6, 32, Math.PI), mat(0x8a959e, { metalness: 0.7, roughness: 0.3 }), 0, 1.84, 0, { cast: false });
      rib.rotation.y = (i / 12) * Math.PI;
    }
    dome.material.emissive = new THREE.Color(P.amber); dome.material.emissiveIntensity = 0; lit.push({ m: dome.material, key: 'berlinDome', scale: 0.5 });
    add(g, new THREE.CylinderGeometry(0.02, 0.02, 1.2, 6), mat(0x444444), 2.15, 2.75, 1.35);
    ['#1d1d1d', '#c8312b', '#f2c230'].forEach((c, i) => add(g, new THREE.BoxGeometry(0.5, 0.1, 0.015), mat(c), 2.42, 3.26 - i * 0.1, 1.35, { cast: false }));
  }
  // The state capital: town hall with a clock tower and steep roofs
  {
    const g = group('state', -0.6, -9.6);
    add(g, rbox(3.6, 1.5, 2.3, 0.08), mat(0xead6b4), 0, 0.75, 0);
    const roof = add(g, prism(3.8, 0.9, 2.5), mat(0x7d5b4b), 0, 1.5, 0);
    add(g, rbox(1.0, 3.3, 1.0, 0.06), mat(0xe2c9a1), 0, 1.65, 0.35);
    add(g, new THREE.ConeGeometry(0.78, 1.25, 4), mat(0x5f8f74, { roughness: 0.5, metalness: 0.3 }), 0, 3.92, 0.35).rotation.y = Math.PI / 4;
    const clock = add(g, new THREE.CylinderGeometry(0.3, 0.3, 0.04, 24), new THREE.MeshStandardMaterial({ color: 0xfffaf0, emissive: 0xffe6b0, emissiveIntensity: 0 }), 0, 2.85, 0.87, { cast: false });
    clock.rotation.x = Math.PI / 2; lit.push({ m: clock.material, key: 'state', scale: 1.2 });
    windows(g, { x0: -1.45, y0: 0.5, z: 1.17, cols: 3, rows: 2, dx: 0.4, dy: 0.55, key: 'state' });
    windows(g, { x0: 0.65, y0: 0.5, z: 1.17, cols: 3, rows: 2, dx: 0.4, dy: 0.55, key: 'state' });
    void roof;
  }
  // The insurers: a glass tower on a podium
  {
    const g = group('insurers', 8.4, -6.8);
    add(g, rbox(3.4, 0.9, 3.0, 0.1), mat(0xdfe6e8), 0, 0.45, 0);
    add(g, rbox(2.2, 5.6, 2.0, 0.12), glassMat(), 0, 3.6, 0);
    for (let f = 0; f < 11; f++) add(g, rbox(2.26, 0.06, 2.06, 0.02), mat(0xe9eef0), 0, 1.25 + f * 0.48, 0, { cast: false });
    add(g, rbox(1.2, 0.5, 1.0, 0.06), mat(0xdfe6e8), 0.3, 6.6, -0.2);
    windows(g, { x0: -0.8, y0: 1.5, z: 1.02, cols: 5, rows: 10, dx: 0.4, dy: 0.48, w: 0.3, h: 0.3, glow: 0xbfe6ff, key: 'insurers', perRow: true });
  }
  // The Klinikum on its hill: ward slab, low treatment block, helipad, ambulance bay
  const hosp = {};
  {
    const g = group('hospital', HILL.x, HILL.z);
    g.position.y = hospTop - 0.1;
    add(g, rbox(5.0, 3.6, 2.2, 0.1), mat(0xf4f1ea), 0, 1.8, -0.4);
    add(g, rbox(5.2, 0.14, 2.4, 0.04), mat(0xd0d6da), 0, 3.66, -0.4);
    add(g, rbox(3.4, 1.4, 2.4, 0.08), mat(0xe8e4dc), 1.1, 0.7, 1.6);
    add(g, rbox(2.2, 1.0, 1.8, 0.08), mat(0xe8e4dc), -2.6, 0.5, 1.4);
    // helipad
    add(g, new THREE.CylinderGeometry(0.85, 0.85, 0.08, 32), mat(0x55606a), -1.2, 3.76, -0.4, { cast: false });
    const H = new THREE.Group(); H.position.set(-1.2, 3.81, -0.4); g.add(H);
    add(H, new THREE.BoxGeometry(0.1, 0.01, 0.6), mat(0xffffff), -0.2, 0, 0, { cast: false }); add(H, new THREE.BoxGeometry(0.1, 0.01, 0.6), mat(0xffffff), 0.2, 0, 0, { cast: false });
    add(H, new THREE.BoxGeometry(0.4, 0.01, 0.1), mat(0xffffff), 0, 0, 0, { cast: false });
    // red cross sign
    const cross = new THREE.MeshStandardMaterial({ color: 0xd9534f, emissive: 0xff3b30, emissiveIntensity: 0.2 });
    add(g, new THREE.BoxGeometry(0.5, 0.16, 0.05), cross, 1.8, 3.25, 0.73, { cast: false }); add(g, new THREE.BoxGeometry(0.16, 0.5, 0.05), cross, 1.8, 3.25, 0.73, { cast: false });
    hosp.cross = cross;
    hosp.floors = windows(g, { x0: -2.1, y0: 0.5, z: 0.72, cols: 10, rows: 6, dx: 0.42, dy: 0.53, key: 'hospital', perRow: true });
    windows(g, { x0: -0.3, y0: 0.55, z: 2.82, cols: 7, rows: 1, dx: 0.4, dy: 0.5, w: 0.3, h: 0.36, key: 'hospital' });
    // ambulance bay canopy + ambulance
    add(g, rbox(1.4, 0.08, 1.0, 0.03), mat(0xd0d6da), -2.6, 1.15, 2.55);
    for (const x of [-3.2, -2.0]) add(g, new THREE.CylinderGeometry(0.04, 0.04, 1.1, 8), mat(0xaaaaaa), x, 0.55, 3.0);
    hosp.parked = car(g, 0xffffff); hosp.parked.position.set(-2.6, 0, 2.6); hosp.parked.rotation.y = Math.PI / 2;
    // car park
    for (let i = 0; i < 5; i++) { const c = car(g, [0x6f8fa8, 0xb5553f, 0xdfe2e6, 0x4a5a68, 0xc9a46b][i]); c.position.set(2.6 + (i % 3) * 0.5 - 0.5, 0.02, 2.9 + Math.floor(i / 3) * 0.75); c.rotation.y = Math.PI / 2; c.scale.setScalar(0.85); }
  }
  // The doctor's practice: a low pavilion with a green roof
  {
    const g = group('practice', 4.4, 2.9, 0);
    add(g, rbox(2.4, 1.0, 1.7, 0.08), mat(0xf6f3ee), 0, 0.5, 0);
    add(g, rbox(2.6, 0.14, 1.9, 0.05), mat(P.roofGreen), 0, 1.05, 0);
    add(g, rbox(2.3, 0.08, 1.6, 0.04), mat(0x8fb87a), 0, 1.14, 0, { cast: false });
    windows(g, { x0: -0.85, y0: 0.5, z: 0.86, cols: 4, rows: 1, dx: 0.42, dy: 0, w: 0.32, h: 0.42, key: 'practice' });
    add(g, new THREE.BoxGeometry(0.42, 0.42, 0.04), new THREE.MeshStandardMaterial({ color: 0x4fb3a9, emissive: 0x4fb3a9, emissiveIntensity: 0.3 }), 0.9, 0.82, 0.88, { cast: false });
  }
  // The patient's home: a house with a garden and a picket fence
  const home = {};
  {
    const g = group('home', 9.8, 5.6, -0.2);
    add(g, rbox(1.8, 1.1, 1.4, 0.06), mat(0xf3e3c3), 0, 0.55, 0);
    add(g, prism(2.0, 0.8, 1.6), mat(P.roofRed), 0, 1.1, 0);
    add(g, rbox(0.25, 0.5, 0.25, 0.03), mat(0x9a6a55), 0.5, 1.55, -0.25);
    home.win = windowMat(P.amber);
    for (const x of [-0.45, 0.45]) add(g, new THREE.BoxGeometry(0.4, 0.36, 0.03), home.win, x, 0.68, 0.71, { cast: false });
    add(g, new THREE.BoxGeometry(0.3, 0.55, 0.03), mat(0x6d4c3d), 0, 0.28, 0.71, { cast: false });
    const fence = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), mat(0xffffff), 40);
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2; fence.setMatrixAt(i, new THREE.Matrix4().makeTranslation(Math.cos(a) * 1.9, 0.11, Math.sin(a) * 1.5 + 0.1));
    }
    g.add(fence);
  }
  // The negotiating pavilion: an open round hall, a round table, three chairs, a gavel
  {
    const g = group('table', 2.6, -2.4);
    add(g, new THREE.CylinderGeometry(1.9, 2.0, 0.16, 48), mat(P.stone), 0, 0.08, 0);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; add(g, new THREE.CylinderGeometry(0.07, 0.07, 1.5, 10), mat(0xffffff), Math.cos(a) * 1.75, 0.9, Math.sin(a) * 1.75); }
    add(g, new THREE.CylinderGeometry(2.05, 2.05, 0.12, 48), mat(0xf1ece2), 0, 1.7, 0);
    add(g, new THREE.SphereGeometry(1.5, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), glassMat(), 0, 1.72, 0).scale.y = 0.38;
    add(g, new THREE.CylinderGeometry(0.85, 0.85, 0.08, 36), mat(0x8a6a50), 0, 0.68, 0);
    add(g, new THREE.CylinderGeometry(0.1, 0.16, 0.5, 12), mat(0x6b4f3a), 0, 0.4, 0);
    const chairCol = [0x8cc3dd, 0xf4f1ea, 0x6fa7a0];
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3 + 0.5;
      const ch = new THREE.Group(); ch.position.set(Math.cos(a) * 1.15, 0.16, Math.sin(a) * 1.15); ch.rotation.y = -a - Math.PI / 2; g.add(ch);
      add(ch, rbox(0.4, 0.06, 0.4, 0.02), mat(chairCol[i]), 0, 0.3, 0); add(ch, rbox(0.4, 0.45, 0.06, 0.02), mat(chairCol[i]), 0, 0.55, -0.2);
      person(g, Math.cos(a) * 1.15, Math.sin(a) * 1.15, chairCol[i], 0.2, 1.3);
    }
    const gavel = new THREE.Group(); gavel.position.set(0.15, 0.78, 0.1); g.add(gavel); B.gavel = gavel;
    add(gavel, new THREE.CylinderGeometry(0.07, 0.07, 0.26, 12), mat(0x5b3a28), 0, 0.04, 0).rotation.z = Math.PI / 2;
    add(gavel, new THREE.CylinderGeometry(0.018, 0.018, 0.36, 6), mat(0x5b3a28), 0, 0.04, 0.18).rotation.x = Math.PI / 2;
  }
  // The factory by the river: saw-tooth roofs, chimneys, containers
  const fac = {};
  {
    const g = group('factory', -12.4, 0.9, 0.15);
    add(g, rbox(3.6, 1.2, 2.4, 0.06), mat(0xc9c1b4), 0, 0.6, 0);
    for (let i = 0; i < 4; i++) { const s = add(g, prism(0.9, 0.5, 2.4, true), mat(0x9da7ad), -1.35 + i * 0.9, 1.2, 0); s.rotation.y = 0; }
    fac.glow = windowMat(0xffc27a);
    add(g, new THREE.BoxGeometry(3.0, 0.28, 0.03), fac.glow, 0, 0.75, 1.21, { cast: false });
    const chim = [];
    for (const [x, z, h] of [[1.3, -0.7, 3.0], [0.6, -0.7, 2.4]]) { add(g, new THREE.CylinderGeometry(0.17, 0.22, h, 14), mat(0xb8aea2), x, h / 2, z); add(g, new THREE.CylinderGeometry(0.19, 0.19, 0.12, 14), mat(0xb5553f), x, h - 0.2, z); chim.push([x, h, z]); }
    fac.smoke = [];
    const smokeMat = new THREE.MeshStandardMaterial({ color: 0xf2efe9, roughness: 1, transparent: true, opacity: 0.7, depthWrite: false });
    for (const [x, h, z] of chim) for (let i = 0; i < 6; i++) { const s = add(g, new THREE.SphereGeometry(0.22, 12, 8), smokeMat, x, h, z, { cast: false, receive: false }); fac.smoke.push({ s, base: [x, h, z], ph: i / 6 }); }
    fac.smokeMat = smokeMat;
    const contCols = [0xb5553f, 0x4f86c6, 0xd9a441, 0x6fa7a0, 0x8c7b6c];
    for (let i = 0; i < 7; i++) add(g, rbox(0.9, 0.36, 0.38, 0.02), mat(contCols[i % 5]), -1.3 + (i % 4) * 0.95, 0.18 + Math.floor(i / 4) * 0.37, 1.8 + (i % 2) * 0.05);
  }

  // ---------- villages: instanced houses ----------
  function prism(w, h, d, saw = false) {
    // A gable roof (or a saw-tooth when saw = true), base at y = 0.
    const s = new THREE.Shape();
    if (saw) { s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.closePath(); } else { s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath(); }
    const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); geo.translate(0, 0, -d / 2);
    return geo;
  }
  const occupied = [[-8.2, -6.6, 3.6], [-0.6, -9.6, 2.8], [8.4, -6.8, 2.6], [HILL.x, HILL.z, 3.6], [4.4, 2.9, 1.8], [9.8, 5.6, 2.2], [2.6, -2.4, 2.5], [-12.4, 0.9, 2.8]];
  const roadList = Object.values(roads).map((rd) => rd.curve.getSpacedPoints(120));
  const nearRoad = (x, z, d) => roadList.some((pts) => pts.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < d * d));
  const free = (x, z, pad = 0) => Math.hypot(x, z) < R - 1.0 && riverDist(x, z) > 1.5 && !occupied.some(([ox, oz, rr]) => Math.hypot(x - ox, z - oz) < rr + pad);
  {
    const spots = [];
    const clusters = [[12.5, 8.6, 2.6, 12], [-3.5, -12.2, 2.4, 10], [13.5, -7, 2.2, 8], [-13.8, -6.4, 2.2, 8], [1.2, 8.8, 2.2, 8], [6.6, -10.6, 2.2, 7]];
    for (const [cx, cz, rad, n] of clusters) for (let i = 0; i < n * 3 && spots.filter((s) => s.c === cx).length < n; i++) {
      const x = cx + (r() - 0.5) * rad * 2, z = cz + (r() - 0.5) * rad * 2;
      if (!free(x, z, 0.2) || nearRoad(x, z, 0.55) || spots.some((s) => Math.hypot(s.x - x, s.z - z) < 0.95)) continue;
      spots.push({ x, z, c: cx, ry: Math.round(r() * 4) * Math.PI / 2 + (r() - 0.5) * 0.3, s: 0.75 + r() * 0.35 });
    }
    const wallGeo = rbox(0.8, 0.55, 0.65, 0.03); wallGeo.translate(0, 0.275, 0);
    const roofGeo = prism(0.92, 0.42, 0.75); roofGeo.translate(0, 0.55, 0);
    const walls = new THREE.InstancedMesh(wallGeo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), spots.length);
    const roofs = new THREE.InstancedMesh(roofGeo, new THREE.MeshStandardMaterial({ roughness: 0.7 }), spots.length);
    const winGeo = new THREE.BoxGeometry(0.16, 0.14, 0.02);
    const vWin = new THREE.InstancedMesh(winGeo, windowMat(P.amber), spots.length * 2);
    lit.push({ m: vWin.material, key: 'village', scale: 0.8 });
    const wallC = [0xf3ece0, 0xefe1c6, 0xe9d3bd, 0xf6f1e8, 0xdcd6c8].map((h) => new THREE.Color(h));
    const roofC = [P.roofRed, 0xa4553f, 0x8a5a48, P.roofGrey, 0xc06a4a].map((h) => new THREE.Color(h));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), off = new THREE.Vector3();
    spots.forEach((s, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.ry);
      m4.compose(v.set(s.x, heightAt(s.x, s.z) - 0.02, s.z), q, sc.set(s.s, s.s, s.s));
      walls.setMatrixAt(i, m4); roofs.setMatrixAt(i, m4);
      walls.setColorAt(i, wallC[i % wallC.length]); roofs.setColorAt(i, roofC[(i * 3) % roofC.length]);
      for (const k of [0, 1]) {
        off.set((k ? 0.18 : -0.18) * s.s, 0.3 * s.s, 0.33 * s.s).applyQuaternion(q);
        m4.compose(v.set(s.x + off.x, heightAt(s.x, s.z) + off.y, s.z + off.z), q, sc.set(1, 1, 1)); vWin.setMatrixAt(i * 2 + k, m4);
      }
    });
    for (const im of [walls, roofs]) { im.castShadow = im.receiveShadow = true; scene.add(im); }
    scene.add(vWin);
    occupied.push(...spots.map((s) => [s.x, s.z, 0.6]));
  }

  // ---------- trees ----------
  {
    const spots = [];
    for (let i = 0; i < 1400 && spots.length < 430; i++) {
      const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * (R - 1.0);
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      // denser woods in a few bands; sparse elsewhere
      const woods = n2(x * 0.8 + 3, z * 0.8 - 1) > 0.15 || Math.hypot(x + 12, z + 9.5) < 4 || Math.hypot(x - 14, z - 3) < 3.2 || Math.hypot(x - 5.5, z + 13) < 3;
      if (!woods && r() > 0.12) continue;
      if (!free(x, z, 0.25) || nearRoad(x, z, 0.5)) continue;
      if (spots.some(([sx, , sz]) => (sx - x) ** 2 + (sz - z) ** 2 < 0.3)) continue;
      spots.push([x, heightAt(x, z) - 0.05, z, 0.55 + r() * 0.5]);
    }
    // a few trees along the river and in the home's garden
    for (let i = 0; i < 40; i++) { const p = riverPts[Math.floor(r() * riverPts.length)], s = r() > 0.5 ? 1 : -1; const x = p.x + s * (1.6 + r() * 0.4), z = p.z + s * 0.6 * r(); if (free(x, z) && !nearRoad(x, z, 0.5)) spots.push([x, heightAt(x, z) - 0.05, z, 0.45 + r() * 0.3]); }
    spots.push([10.9, heightAt(10.9, 6.3), 6.3, 0.7]);
    forest(scene, spots, 5);
  }
  // street lamps along the main roads
  const lampSpots = [];
  for (const name of ['north', 'south', 'bridge']) {
    const c = roads[name].curve;
    for (let u = 0.04; u < 0.98; u += name === 'bridge' ? 0.16 : 0.05) {
      const p = c.getPointAt(u), tg = c.getTangentAt(u);
      const x = p.x - tg.z * 0.42, z = p.z + tg.x * 0.42;
      if (Math.hypot(x, z) < R - 0.8 && riverDist(x, z) > 1.2) lampSpots.push([x, heightAt(x, z), z]);
    }
  }
  const lampMat = lamps(scene, lampSpots);

  // ---------- traffic ----------
  const traffic = [];
  const carCols = [0xd9534f, 0xf2f2f2, 0x4f86c6, 0x3d4a55, 0xe9c46a, 0x6fa7a0, 0xb0b8c0, 0x9b6b9e];
  const lane = (name, n, speed, side, seed) => {
    const rr = rng(seed);
    for (let i = 0; i < n; i++) {
      const c = car(scene, carCols[Math.floor(rr() * carCols.length)]);
      c.scale.setScalar(0.85);
      traffic.push({ c, curve: roads[name].curve, p0: i / n + rr() * 0.05, speed: speed * (0.85 + rr() * 0.3) * side, side, width: roads[name].width });
    }
  };
  lane('north', 5, 0.012, 1, 3); lane('north', 4, 0.011, -1, 4); lane('south', 4, 0.014, 1, 5); lane('south', 3, 0.013, -1, 6); lane('bridge', 2, 0.02, 1, 8);
  // the ambulance: drives up the bridge road to the hospital when state.ambulance runs 0..1
  const amb = car(scene, 0xffffff); amb.scale.setScalar(0.95);
  const ambStripe = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.05, 0.34), new THREE.MeshStandardMaterial({ color: 0xd9534f })); ambStripe.position.y = 0.2; amb.add(ambStripe);
  const siren = new THREE.MeshStandardMaterial({ color: 0x9fd3ff, emissive: 0x4fa8ff, emissiveIntensity: 0 });
  add(amb, new THREE.BoxGeometry(0.12, 0.05, 0.22), siren, -0.04, 0.43, 0, { cast: false });
  const ambPath = new THREE.CatmullRomCurve3([...roads.bridge.curve.getSpacedPoints(30), ...roads.south.curve.getSpacedPoints(60).slice(0, 4).reverse()]);

  // ---------- clouds ----------
  const CL = [[-14, 15, -19, 1.6], [12, 16, -21, 2.0], [24, 13, 2, 1.4], [-24, 14, 6, 1.7]];
  const clouds = CL.map(([x, y, z, s], i) => cloud(scene, x, y, z, s, i + 1));

  // ---------- money pipes ----------
  function flowTexture() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 4;
    const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 128, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(0.4, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0.25)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 4);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const pipes = {};
  function pipe(name, color, pts, radius = 0.11) {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const geo = new THREE.TubeGeometry(curve, 200, radius, 12, false);
    const tex = flowTexture(); tex.repeat.set(curve.getLength() / 1.6, 1);
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.3), emissive: new THREE.Color(color), emissiveMap: tex, emissiveIntensity: 1.3, roughness: 0.25, transparent: true, opacity: 0.92 });
    const o = new THREE.Mesh(geo, m); o.castShadow = false; scene.add(o);
    // a glass sleeve around the light core
    const sleeve = new THREE.Mesh(new THREE.TubeGeometry(curve, 200, radius * 1.7, 12, false), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.16, depthWrite: false }));
    scene.add(sleeve);
    pipes[name] = { mesh: o, sleeve, tex, total: geo.index.count, curve };
  }
  const bp = (n, dy = 2.6) => { const p = B[n].position; return [p.x, p.y + dy, p.z]; };
  pipe('treatHosp', '#f6b55b', [bp('insurers', 1.2), [5.5, 3.4, -2.2], [0, 4.4, 2.0], [-4.2, 4.6, 4.2], bp('hospital', 3.9)]);
  pipe('treatPractice', '#f6b55b', [bp('insurers', 1.0), [7.2, 2.4, -2.0], [5.4, 2.2, 1.6], bp('practice', 1.3)]);
  pipe('build', '#8cc3dd', [bp('state', 1.6), [-2.6, 3.4, -5.2], [-5.4, 4.4, -0.6], [-6.2, 4.6, 2.6], bp('hospital', 3.9)]);
  pipe('whole', '#7fe0cf', [bp('practice', 1.6), [1.6, 3.6, 4.2], [-3.4, 4.8, 4.6], bp('hospital', 4.4), [-3.2, 5.0, 7.6], [3.6, 3.8, 8.4], [8.4, 2.6, 6.8], bp('home', 1.9)], 0.16);

  // ---------- decision lines from the two capitals ----------
  const decisions = [];
  for (const [from, to] of [['berlin', 'hospital'], ['berlin', 'practice'], ['berlin', 'insurers'], ['berlin', 'table'], ['state', 'hospital'], ['state', 'practice'], ['berlin', 'state']]) {
    const a = B[from].position, b = B[to].position;
    const mid = new THREE.Vector3((a.x + b.x) / 2, 10, (a.z + b.z) / 2);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(a.x, a.y + 3.8, a.z), mid, new THREE.Vector3(b.x, b.y + 3.4, b.z));
    const geo = new THREE.TubeGeometry(curve, 80, 0.035, 6, false);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    scene.add(m); decisions.push({ m, total: geo.index.count });
  }

  // ---------- the blame beam ----------
  const beamG = new THREE.Group(); scene.add(beamG);
  const coneGeo = new THREE.CylinderGeometry(0.06, 1.7, 1, 40, 1, true); coneGeo.translate(0, -0.5, 0);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xff8a73, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const cone = new THREE.Mesh(coneGeo, coneMat); beamG.add(cone);
  const core = new THREE.Mesh(coneGeo, coneMat.clone()); core.scale.set(0.35, 1, 0.35); beamG.add(core);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.9, 48), new THREE.MeshBasicMaterial({ color: 0xff8a73, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2; scene.add(pool);
  const spot = new THREE.SpotLight(0xff9a80, 0, 80, 0.2, 0.6, 1.1); scene.add(spot, spot.target);

  // ---------- patients (little people) on the journey ----------
  const walkers = [];
  const pathOut = new THREE.CatmullRomCurve3([...roads.south.curve.getSpacedPoints(80).slice(2, 70)].map((p) => p.clone().add(new THREE.Vector3(0, 0, 0.32))));
  const pathUp = pathOut.clone ? new THREE.CatmullRomCurve3(pathOut.getSpacedPoints(80).reverse()) : null;
  for (let i = 0; i < 12; i++) {
    const complex = i % 3 === 2;
    const w = person(scene, 0, 0, complex ? 0xe48d78 : 0x7fd6c4, -5, 1.6);
    w.children[0].material = new THREE.MeshStandardMaterial({ color: complex ? 0xe48d78 : 0x7fd6c4, emissive: complex ? 0xff6a50 : 0x2fd0b0, emissiveIntensity: 0.5 });
    walkers.push({ w, complex, offset: i * 0.075 });
  }
  // the one patient we follow (state.journey 0..1): home -> practice -> hospital -> home
  const journeyCurve = new THREE.CatmullRomCurve3([
    [9.6, 6.6], [8.2, 6.6], [6.2, 6.0], [4.6, 5.3], [4.5, 4.0], [4.6, 5.3], [2.0, 5.6], [-1.2, 5.2], [-3.2, 4.7], [-4.6, 4.3], [-5.2, 4.2],
  ].map(([x, z]) => new THREE.Vector3(x, heightAt(x, z) + 0.06, z)));
  const hero = person(scene, 0, 0, 0xf6b55b, -5, 1.7);
  hero.children[0].material = new THREE.MeshStandardMaterial({ color: 0xf6b55b, emissive: 0xf6a040, emissiveIntensity: 0.6 });

  // ---------- state ----------
  const state = {
    day: 1, hospLit: 1, homeLit: 0, factory: 1, pipeTreat: 0, pipeBuild: 0, buildFill: 1, treatFlow: 1, whole: 0,
    decisions: 0, tokens: 0, gavel: 0, ambulance: -1, journey: -1, traffic: 1, smoke: 1, cityLit: 1,
  };
  const rig = { angle: 1.15, tilt: 0.6, dist: 52, tx: 0, ty: 1.5, tz: 0, fov: 26, roll: 0, follow: 0 };
  const beam = { x: 0, z: 0, on: 0 };
  const B_POS = (name) => { const p = B[name].position; return { x: p.x, y: p.y, z: p.z }; };
  const look = new THREE.Vector3();

  function update(t) {
    const d = state.day, night = 1 - d;
    applyDay(L, scene, d);
    scene.fog.near = 70; scene.fog.far = 160;
    // camera on a sphere around the target
    camera.fov = rig.fov; camera.updateProjectionMatrix();
    const rr = rig.dist;
    camera.position.set(rig.tx + Math.cos(rig.angle) * Math.cos(rig.tilt) * rr, rig.ty + Math.sin(rig.tilt) * rr, rig.tz + Math.sin(rig.angle) * Math.cos(rig.tilt) * rr);
    camera.lookAt(look.set(rig.tx, rig.ty, rig.tz));
    camera.rotation.z += rig.roll;
    // windows: everything glows after dusk; hospital floors follow hospLit (bottom two always on)
    for (const w of lit) {
      let on = (0.15 + 1.9 * night) * (w.scale ?? 1);
      if (w.key === 'hospital' && w.row !== undefined) on *= w.row < 2 ? 1.1 : (w.row / 6 < state.hospLit ? 1 : 0.04);
      else if (w.key === 'hospital') on *= 1;
      else if (w.key === 'insurers') on *= ((w.row * 7) % 5) / 5 < 0.6 + 0.4 * state.cityLit ? 0.9 : 0.05;
      else on *= state.cityLit;
      w.m.emissiveIntensity = on;
    }
    home.win.emissiveIntensity = state.homeLit * 2.6 + 0.1 * night;
    fac.glow.emissiveIntensity = state.factory * (0.4 + 1.6 * night);
    hosp.cross.emissiveIntensity = 0.2 + 1.6 * night;
    lampMat.emissiveIntensity = 2.6 * THREE.MathUtils.smoothstep(night, 0.25, 0.7);
    // factory smoke rises (slower and thinner when the factory slows)
    for (const s of fac.smoke) {
      const ph = (t * 0.12 * (0.3 + 0.7 * state.factory) + s.ph) % 1;
      s.s.position.set(s.base[0] - ph * 0.7, s.base[1] + ph * 2.2, s.base[2] + ph * 0.35);
      s.s.scale.setScalar((0.6 + ph * 1.8) * (0.3 + 0.7 * state.smoke * state.factory));
      s.s.visible = state.smoke * state.factory > 0.02;
    }
    fac.smokeMat.opacity = 0.55;
    // traffic (headlights at night)
    for (const v of traffic) {
      const pp = (((v.p0 + t * Math.abs(v.speed) * state.traffic) % 1) + 1) % 1;
      onCurve(v.c, v.curve, v.side > 0 ? pp : 1 - pp, 0);
      if (v.side < 0) v.c.rotation.y += Math.PI;
      const ry = v.c.rotation.y; // keep right
      v.c.position.x += Math.sin(ry) * 0.12; v.c.position.z += Math.cos(ry) * 0.12;
      v.c.scale.setScalar(0.85 * THREE.MathUtils.smoothstep(Math.min(pp, 1 - pp), 0, 0.03));
      v.c.userData.lamps.material.emissiveIntensity = 3 * night;
    }
    // ambulance
    if (state.ambulance >= 0 && state.ambulance <= 1) {
      amb.visible = true; onCurve(amb, ambPath, Math.min(0.999, state.ambulance), 0);
      siren.emissiveIntensity = Math.sin(t * 18) > 0 ? 4 : 0.4; amb.userData.lamps.material.emissiveIntensity = 3;
      hosp.parked.visible = state.ambulance < 0.98;
    } else { amb.visible = false; hosp.parked.visible = true; }
    // clouds drift
    clouds.forEach((c, i) => { c.position.x = CL[i][0] + Math.sin(t * 0.03 + i) * 2.5; c.children.forEach((b) => { b.material.opacity = 0.9 * (0.35 + 0.65 * d); }); });
    // pipes: draw-on + flowing light
    const draw = (p, v) => {
      const k = Math.min(1, Math.max(0, v));
      p.mesh.geometry.setDrawRange(0, Math.floor(p.total * k / 3) * 3); p.sleeve.geometry.setDrawRange(0, Math.floor(p.total * k / 3) * 3);
      p.mesh.visible = p.sleeve.visible = k > 0.001;
    };
    draw(pipes.treatHosp, state.pipeTreat); draw(pipes.treatPractice, state.pipeTreat); draw(pipes.build, state.pipeBuild); draw(pipes.whole, state.whole);
    pipes.treatHosp.tex.offset.x = pipes.treatPractice.tex.offset.x = -t * 0.6 * state.treatFlow;
    pipes.build.tex.offset.x = -t * 0.35; pipes.whole.tex.offset.x = -t * 0.5;
    pipes.build.mesh.material.emissiveIntensity = 1.3 * state.buildFill;
    pipes.treatHosp.mesh.material.emissiveIntensity = pipes.treatPractice.mesh.material.emissiveIntensity = 1.0 + 0.35 * state.treatFlow;
    for (const dl of decisions) { dl.m.material.opacity = 0.6 * state.decisions; dl.m.visible = state.decisions > 0.01; dl.m.geometry.setDrawRange(0, Math.floor(dl.total * Math.min(1, state.decisions * 1.4) / 3) * 3); }
    B.gavel.rotation.z = -Math.sin(Math.min(1, state.gavel) * Math.PI) * 0.9;
    // beam: from high above toward the target building
    let by = heightAt(beam.x, beam.z);
    for (const [name, g] of Object.entries(B)) if (name !== 'gavel' && Math.hypot(g.position.x - beam.x, g.position.z - beam.z) < 1.2) by = g.position.y;
    const topY = 26;
    beamG.position.set(beam.x * 0.55, topY, beam.z * 0.55 + 4);
    const dir = new THREE.Vector3(beam.x - beamG.position.x, by - topY, beam.z - beamG.position.z);
    cone.scale.set(1, dir.length(), 1); core.scale.set(0.35, dir.length(), 0.35);
    beamG.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
    coneMat.opacity = (0.05 + 0.1 * night) * beam.on; core.material.opacity = (0.08 + 0.12 * night) * beam.on;
    cone.visible = core.visible = pool.visible = beam.on > 0.005;
    pool.position.set(beam.x, by + 0.06, beam.z); pool.material.opacity = (0.35 + 0.2 * night) * beam.on;
    spot.position.copy(beamG.position); spot.target.position.set(beam.x, by, beam.z); spot.intensity = 260 * beam.on;
    // walkers: simple patients go down the road home; complex ones come back up the hill
    walkers.forEach((k) => {
      const p = Math.min(1, Math.max(0, state.tokens * 1.8 - k.offset));
      if (p <= 0 || p >= 1) { k.w.visible = false; return; }
      k.w.visible = true;
      const curve = k.complex ? pathUp : pathOut; onCurve(k.w, curve, p, 0.02);
      k.w.position.y += Math.abs(Math.sin(p * 90)) * 0.05;
    });
    if (state.journey >= 0 && state.journey <= 1) {
      hero.visible = true; onCurve(hero, journeyCurve, Math.min(0.999, state.journey), 0.0);
      hero.position.y += Math.abs(Math.sin(state.journey * 160)) * 0.05;
    } else hero.visible = false;
    // follow shot: the camera target slides onto the walking patient
    if (rig.follow > 0 && hero.visible) {
      const f = rig.follow, tx = THREE.MathUtils.lerp(rig.tx, hero.position.x, f), ty = THREE.MathUtils.lerp(rig.ty, hero.position.y + 0.4, f), tz = THREE.MathUtils.lerp(rig.tz, hero.position.z, f);
      camera.position.set(tx + Math.cos(rig.angle) * Math.cos(rig.tilt) * rr, ty + Math.sin(rig.tilt) * rr, tz + Math.sin(rig.angle) * Math.cos(rig.tilt) * rr);
      camera.lookAt(look.set(tx, ty, tz)); camera.rotation.z += rig.roll;
    }
  }

  const v3 = new THREE.Vector3();
  function screen(name, dy = 3) {
    if (name === 'hero') v3.copy(hero.position).setY(hero.position.y + dy);
    else { B[name].getWorldPosition(v3); v3.y += dy; }
    return v3;
  }
  const heroPos = () => hero.position;

  const SHOTS = {
    wide: { angle: 1.15, tilt: 0.58, dist: 56, tx: 0, ty: 0.5, tz: 0.5, fov: 26 },
    high: { angle: 1.0, tilt: 1.0, dist: 66, tx: 0, ty: 0, tz: 0, fov: 26 },
    top: { angle: 1.57, tilt: 1.35, dist: 70, tx: 0, ty: 0, tz: 0, fov: 26 },
    low: { angle: 1.3, tilt: 0.22, dist: 44, tx: 0, ty: 1.2, tz: 0, fov: 28 },
    berlin: { angle: 2.0, tilt: 0.36, dist: 21, tx: -8.2, ty: 1.8, tz: -6.6, fov: 26 },
    state: { angle: 1.35, tilt: 0.34, dist: 20, tx: -0.6, ty: 2.0, tz: -9.6, fov: 26 },
    insurers: { angle: 0.9, tilt: 0.28, dist: 24, tx: 8.4, ty: 3.2, tz: -6.8, fov: 26 },
    hospital: { angle: 1.42, tilt: 0.3, dist: 21, tx: -5.8, ty: 2.8, tz: 5, fov: 26 },
    hospitalLow: { angle: 1.75, tilt: 0.12, dist: 17, tx: -5.6, ty: 2.4, tz: 5, fov: 28 },
    practice: { angle: 1.2, tilt: 0.34, dist: 16, tx: 4.4, ty: 0.8, tz: 3.2, fov: 26 },
    home: { angle: 1.05, tilt: 0.3, dist: 14, tx: 9.8, ty: 0.9, tz: 5.8, fov: 26 },
    homeNear: { angle: 1.45, tilt: 0.16, dist: 9, tx: 9.8, ty: 0.8, tz: 5.8, fov: 28 },
    table: { angle: 1.1, tilt: 0.55, dist: 15, tx: 2.6, ty: 0.9, tz: -2.4, fov: 26 },
    factory: { angle: 1.95, tilt: 0.3, dist: 20, tx: -12.4, ty: 1.4, tz: 0.9, fov: 26 },
    road: { angle: 1.35, tilt: 0.42, dist: 30, tx: 1.8, ty: 1.0, tz: 4.8, fov: 26 },
    bridge: { angle: 0.75, tilt: 0.22, dist: 16, tx: -1.8, ty: 0.6, tz: 1.0, fov: 28 },
    capitals: { angle: 1.4, tilt: 0.5, dist: 30, tx: -4.4, ty: 2, tz: -7.8, fov: 26 },
    river: { angle: 0.3, tilt: 0.18, dist: 26, tx: 0, ty: 0.6, tz: 0.6, fov: 30 },
  };
  return { scene, camera, update, screen, heroPos, state, rig, beam, B, B_POS, SHOTS, heightAt, journeyCurve, post: { bloom: 0.3, tilt: 0.55, focus: 0.5 } };
}
