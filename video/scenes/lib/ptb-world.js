// "Pass the Blame" diorama: Germany's healthcare as a miniature under a glass dome.
// One shared world for every chapter. Everything that animates is a plain property
// (world.state.*, world.rig.*, world.beam.*) so GSAP timelines can tween it, and
// world.render(t) draws the frame from those values, which keeps it pure in t.
import * as THREE from '../../node_modules/three/build/three.module.js';

export function createWorld(canvas, { width = 1920, height = 1080 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, width / height, 0.5, 400);

  // ---------- light ----------
  const hemi = new THREE.HemisphereLight(0xffeedd, 0x2a3a4a, 1.0);
  const sun = new THREE.DirectionalLight(0xffc999, 2.2);
  sun.position.set(-18, 26, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 });
  sun.shadow.bias = -0.0006;
  scene.add(hemi, sun);

  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, ...o });
  const mesh = (geo, m, x = 0, y = 0, z = 0, parent = scene) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  };
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // ---------- ground: island under a dome ----------
  const R = 17;
  mesh(new THREE.CylinderGeometry(R, R - 0.6, 1.2, 72), mat(0x93b48e), 0, -0.6, 0).castShadow = false;
  mesh(new THREE.CylinderGeometry(R - 0.6, R - 4, 3.5, 72), mat(0x6e5848), 0, -2.95, 0).castShadow = false;
  // a gentle hill for the hospital
  const hill = mesh(new THREE.SphereGeometry(5.2, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x86aa82), -6, -0.2, 5);
  hill.scale.y = 0.42;
  // glass dome: faint shell + bright rim
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R + 0.4, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.05, roughness: 0.1, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide }));
  scene.add(dome);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.4, 0.08, 8, 120), new THREE.MeshBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.5 }));
  rim.rotation.x = Math.PI / 2; scene.add(rim);

  // roads
  const roadMat = mat(0xd9ccb4);
  const road = (pts) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0.02, z)));
    const g = new THREE.TubeGeometry(curve, 80, 0.32, 4, false);
    const m = new THREE.Mesh(g, roadMat); m.scale.y = 0.15; m.receiveShadow = true; scene.add(m);
    return curve;
  };
  const roadHome = road([[-3.2, 4.6], [0, 4.2], [4, 3.6], [8.4, 5.6]]);

  // trees
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2, r = 4 + rnd() * (R - 5.5);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const near = [[-8, -6], [-1, -9], [8, -6], [-6, 5], [4, 3], [9, 6], [2, -2], [-12.5, 1], [0, 4]].some(([bx, bz]) => Math.hypot(x - bx, z - bz) < 3.4);
    if (near) continue;
    const s = 0.6 + rnd() * 0.6;
    const y = Math.hypot(x + 6, z - 5) < 5 ? 1.2 : 0;
    mesh(new THREE.ConeGeometry(0.55 * s, 1.7 * s, 7), mat(0x4e7d5a), x, y + 0.85 * s + 0.25, z);
    mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 6), mat(0x6b4f3a), x, y + 0.25, z);
  }

  // ---------- buildings ----------
  const B = {};
  const group = (name, x, z, y = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g); B[name] = g; return g; };
  const glowMat = (c) => new THREE.MeshStandardMaterial({ color: 0x1d2a33, emissive: c, emissiveIntensity: 0, roughness: 0.6 });

  // Berlin: federal ministry with a dome
  {
    const g = group('berlin', -8, -6);
    mesh(new THREE.BoxGeometry(4.2, 1.8, 2.6), mat(0xeee6d8), 0, 0.9, 0, g);
    for (let i = 0; i < 6; i++) mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 8), mat(0xffffff), -1.75 + i * 0.7, 0.7, 1.4, g);
    mesh(new THREE.SphereGeometry(1.0, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xb9d4e0, { metalness: 0.3, roughness: 0.3 }), 0, 1.8, 0, g);
    mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), mat(0x333333), 1.6, 2.25, 0, g);
    mesh(new THREE.BoxGeometry(0.6, 0.36, 0.02), mat(0x222222), 1.9, 2.5, 0, g); // flag
  }
  // State capital: town hall with clock tower
  {
    const g = group('state', -1, -9);
    mesh(new THREE.BoxGeometry(3.4, 1.6, 2.2), mat(0xe8d6b8), 0, 0.8, 0, g);
    mesh(new THREE.BoxGeometry(0.9, 3.2, 0.9), mat(0xe2cba6), 0, 1.6, 0, g);
    mesh(new THREE.ConeGeometry(0.75, 1.0, 4), mat(0x7f6a5a), 0, 3.7, 0, g).rotation.y = Math.PI / 4;
    mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 20), mat(0xffffff), 0, 2.7, 0.47, g).rotation.x = Math.PI / 2;
  }
  // Insurers: glass tower
  {
    const g = group('insurers', 8, -6);
    mesh(new THREE.BoxGeometry(2.2, 5.2, 2.2), mat(0x9fc2cf, { metalness: 0.4, roughness: 0.25 }), 0, 2.6, 0, g);
    mesh(new THREE.BoxGeometry(3.2, 1.0, 3.2), mat(0xdbe7ea), 0, 0.5, 0, g);
    for (let f = 0; f < 9; f++) mesh(new THREE.BoxGeometry(2.24, 0.05, 2.24), mat(0x6f8f9c), 0, 1.2 + f * 0.5, 0, g);
  }
  // Klinikum on its hill: main block + wing; lit band of windows
  const hospWindows = [];
  {
    const g = group('hospital', -6, 5, 1.2);
    mesh(new THREE.BoxGeometry(4.6, 3.6, 2.4), mat(0xf0ebe2), 0, 1.8, 0, g);
    mesh(new THREE.BoxGeometry(2.0, 2.0, 2.0), mat(0xe6dfd2), 3.2, 1.0, 0.2, g);
    mesh(new THREE.BoxGeometry(0.9, 0.35, 0.9), mat(0xd9534f), 0, 3.8, 0, g);
    for (let f = 0; f < 6; f++) for (let c = 0; c < 8; c++) {
      const w = mesh(new THREE.BoxGeometry(0.34, 0.32, 0.04), glowMat(0xf6b55b), -1.85 + c * 0.53, 0.42 + f * 0.56, 1.22, g);
      w.castShadow = false; w.userData.floor = f; hospWindows.push(w);
    }
  }
  // Doctor's practice
  {
    const g = group('practice', 4, 3);
    mesh(new THREE.BoxGeometry(2.0, 1.3, 1.6), mat(0xf4f1ea), 0, 0.65, 0, g);
    mesh(new THREE.BoxGeometry(2.2, 0.12, 1.8), mat(0x6fa7a0), 0, 1.36, 0, g);
    mesh(new THREE.BoxGeometry(0.5, 0.5, 0.05), mat(0x4fb3a9), 0.6, 0.9, 0.82, g);
  }
  // Patient's home
  let homeWin;
  {
    const g = group('home', 9, 6);
    mesh(new THREE.BoxGeometry(1.8, 1.2, 1.5), mat(0xf3e3c3), 0, 0.6, 0, g);
    mesh(new THREE.ConeGeometry(1.5, 0.9, 4), mat(0xb5553f), 0, 1.65, 0, g).rotation.y = Math.PI / 4;
    homeWin = mesh(new THREE.BoxGeometry(0.5, 0.4, 0.04), glowMat(0xf6b55b), -0.4, 0.7, 0.77, g); homeWin.castShadow = false;
  }
  // Negotiating table (self-administration): round table, three chairs, a gavel
  {
    const g = group('table', 2, -2);
    mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.1, 32), mat(0x8a6a50), 0, 0.75, 0, g);
    mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.7, 12), mat(0x6b4f3a), 0, 0.37, 0, g);
    const chairCol = [0x9fc2cf, 0xf0ebe2, 0x6fa7a0];
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      const c = mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), mat(chairCol[i]), Math.cos(a) * 1.55, 0.45, Math.sin(a) * 1.55, g);
      mesh(new THREE.BoxGeometry(0.5, 0.6, 0.08), mat(chairCol[i]), Math.cos(a) * 1.8, 0.75, Math.sin(a) * 1.8, g).lookAt(new THREE.Vector3(2, 0.75, -2));
      c.lookAt(new THREE.Vector3(2, 0.45, -2));
    }
    const gavel = new THREE.Group(); gavel.position.set(0.2, 0.85, 0.1); g.add(gavel); B.gavel = gavel;
    mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.36, 12), mat(0x5b3a28), 0, 0.05, 0, gavel).rotation.z = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), mat(0x5b3a28), 0, 0.05, 0.25, gavel).rotation.x = Math.PI / 2;
  }
  // Factory at the edge (economy)
  let factoryGlow;
  {
    const g = group('factory', -12.5, 1);
    mesh(new THREE.BoxGeometry(3.0, 1.4, 2.0), mat(0xb7aea2), 0, 0.7, 0, g);
    for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(1.0, 0.5, 2.0), mat(0xa39a8e), -1 + i, 1.6, 0, g).rotation.z = 0.45;
    mesh(new THREE.CylinderGeometry(0.2, 0.25, 2.6, 10), mat(0x9b8f82), 1.1, 2.0, -0.5, g);
    factoryGlow = mesh(new THREE.BoxGeometry(2.6, 0.3, 0.04), glowMat(0xffc27a), 0, 0.8, 1.02, g); factoryGlow.castShadow = false;
  }

  // ---------- money pipes (flowing stripes) ----------
  function stripeTexture(hex) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 4;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, 64, 4);
    x.fillStyle = hex; x.fillRect(0, 0, 36, 4);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const pipes = {};
  function pipe(name, color, pts, radius = 0.14) {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const geo = new THREE.TubeGeometry(curve, 160, radius, 10, false);
    const tex = stripeTexture(color); tex.repeat.set(curve.getLength() / 0.9, 1);
    const m = new THREE.MeshStandardMaterial({ color: 0x1a2630, emissive: new THREE.Color(color), emissiveMap: tex, emissiveIntensity: 1.6, roughness: 0.4, transparent: true, opacity: 1 });
    const o = new THREE.Mesh(geo, m); scene.add(o);
    const total = geo.index.count;
    pipes[name] = { mesh: o, tex, total, curve };
    return o;
  }
  // amber: treatment money from insurers to hospital and practice
  pipe('treatHosp', '#f6b55b', [[8, 1.2, -6], [5, 2.6, -1], [-1, 3.2, 2.5], [-5, 3.2, 4.8]]);
  pipe('treatPractice', '#f6b55b', [[8, 1.0, -6], [6.5, 1.8, -1], [4.2, 1.6, 2.6]]);
  // blue: building money from the state capital to the hospital
  pipe('build', '#8cc3dd', [[-1, 1.2, -9], [-4, 2.4, -4], [-6.4, 3.0, 1.2], [-6.6, 3.0, 4.4]]);
  // teal: the joined-up "whole journey" pipe that appears at the very end
  pipe('whole', '#7fe0cf', [[-8, 2.0, -6], [-4.5, 3.6, -2], [-1, 3.8, 1.8], [4, 2.4, 3.2], [9, 1.6, 6]], 0.18);

  // ---------- decision lines (thin, white) from the two capitals ----------
  const decisions = [];
  for (const [from, to] of [['berlin', 'hospital'], ['berlin', 'practice'], ['berlin', 'insurers'], ['berlin', 'table'], ['state', 'hospital'], ['state', 'practice']]) {
    const a = B[from].position, b = B[to].position;
    const mid = new THREE.Vector3((a.x + b.x) / 2, 9, (a.z + b.z) / 2);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(a.x, 3.5, a.z), mid, new THREE.Vector3(b.x, 2.5 + b.y, b.z));
    const geo = new THREE.TubeGeometry(curve, 60, 0.03, 4, false);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0 }));
    scene.add(m); decisions.push({ mesh: m, total: geo.index.count });
  }

  // ---------- the blame beam: a soft coral cone from the sky onto a target ----------
  const beamGroup = new THREE.Group(); scene.add(beamGroup);
  const coneGeo = new THREE.CylinderGeometry(0.05, 1.6, 1, 32, 1, true); coneGeo.translate(0, -0.5, 0);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xff8a73, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const cone = new THREE.Mesh(coneGeo, coneMat); beamGroup.add(cone);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.7, 40), new THREE.MeshBasicMaterial({ color: 0xff8a73, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2; scene.add(pool);
  const spot = new THREE.SpotLight(0xff9a80, 0, 60, 0.22, 0.6, 1.2); scene.add(spot, spot.target);

  // ---------- patient tokens (simple vs complex) ----------
  const tokens = [];
  const tokenGeo = new THREE.CapsuleGeometry(0.16, 0.3, 4, 10);
  for (let i = 0; i < 10; i++) {
    const complex = i % 3 === 2;
    const m = mesh(tokenGeo, mat(complex ? 0xe48d78 : 0x9cd6c8, { emissive: complex ? 0x5a1a10 : 0x0d3a33, emissiveIntensity: 0.4 }), 0, -5, 0);
    tokens.push({ mesh: m, complex, offset: i * 0.1 });
  }
  const pathDown = roadHome;                        // simple: hospital -> down the road -> practice / home
  const pathUp = new THREE.CatmullRomCurve3([new THREE.Vector3(4, 0.3, 3.6), new THREE.Vector3(0, 0.6, 4.4), new THREE.Vector3(-3.5, 1.6, 4.8), new THREE.Vector3(-5.5, 1.6, 5.6)]);

  // ---------- animatable state ----------
  const state = {
    day: 1,            // 1 = late afternoon, 0 = night
    hospLit: 1,        // fraction of hospital floors lit (bottom two always lit at night)
    homeLit: 0,
    factory: 1,        // factory lights / activity
    pipeTreat: 0,      // 0..1 draw-on of treatment pipes
    pipeBuild: 0,      // 0..1 draw-on of building pipe
    buildFill: 1,      // brightness of building pipe (half-full = 0.45)
    treatFlow: 1,      // flow speed multiplier
    whole: 0,          // draw-on of the joined pipe
    decisions: 0,      // 0..1 opacity of decision lines
    tokens: 0,         // 0..1 progress of the sorting animation
    gavel: 0,          // gavel swing 0..1
    domeGlow: 0,
  };
  const rig = { angle: 1.15, tilt: 0.62, dist: 52, tx: 0, ty: 1.5, tz: 0 };
  const beam = { x: 0, z: 0, on: 0 };
  const B_POS = (name) => { const p = B[name].position; return { x: p.x, y: p.y, z: p.z }; };

  const sky = { top: new THREE.Color(), bottom: new THREE.Color() };
  const dayTop = new THREE.Color(0x9cb8cc), dayBot = new THREE.Color(0xf2d2b0);
  const nightTop = new THREE.Color(0x0b1626), nightBot = new THREE.Color(0x1d2c44);

  function render(t) {
    const d = state.day;
    // camera on a sphere around the target
    const r = rig.dist;
    camera.position.set(rig.tx + Math.cos(rig.angle) * Math.cos(rig.tilt) * r, rig.ty + Math.sin(rig.tilt) * r, rig.tz + Math.sin(rig.angle) * Math.cos(rig.tilt) * r);
    camera.lookAt(rig.tx, rig.ty, rig.tz);
    // light: dusk -> night
    hemi.intensity = 0.25 + 0.85 * d; sun.intensity = 0.12 + 2.1 * d;
    sun.color.setRGB(1, 0.62 + 0.18 * d, 0.45 + 0.2 * d);
    renderer.toneMappingExposure = 0.9 + 0.15 * d;
    sky.top.copy(nightTop).lerp(dayTop, d); sky.bottom.copy(nightBot).lerp(dayBot, d);
    canvas.style.background = `linear-gradient(#${sky.top.getHexString()}, #${sky.bottom.getHexString()})`;
    // hospital windows: bottom two floors always lit after dusk; others by hospLit
    const night = 1 - d;
    for (const w of hospWindows) {
      const f = w.userData.floor;
      const on = f < 2 ? 1 : (f / 6 < state.hospLit ? 1 : 0);
      w.material.emissiveIntensity = on * (0.25 + 1.9 * night) * (f < 2 ? 1 + 0.15 * Math.sin(t * 1.3) : 1);
    }
    homeWin.material.emissiveIntensity = state.homeLit * 2.2;
    factoryGlow.material.emissiveIntensity = state.factory * (0.4 + 1.2 * night);
    // pipes: draw-on + flowing stripes
    const draw = (p, v) => { p.mesh.geometry.setDrawRange(0, Math.floor(p.total * Math.min(1, Math.max(0, v)) / 3) * 3); p.mesh.visible = v > 0.001; };
    draw(pipes.treatHosp, state.pipeTreat); draw(pipes.treatPractice, state.pipeTreat);
    draw(pipes.build, state.pipeBuild); draw(pipes.whole, state.whole);
    pipes.treatHosp.tex.offset.x = pipes.treatPractice.tex.offset.x = -t * 0.6 * state.treatFlow;
    pipes.build.tex.offset.x = -t * 0.35;
    pipes.whole.tex.offset.x = -t * 0.5;
    pipes.build.mesh.material.emissiveIntensity = 1.6 * state.buildFill;
    for (const dl of decisions) { dl.mesh.material.opacity = 0.55 * state.decisions; dl.mesh.visible = state.decisions > 0.01; }
    // gavel
    B.gavel.rotation.z = -Math.sin(Math.min(1, state.gavel) * Math.PI) * 0.9;
    // beam
    const bx = beam.x, bz = beam.z;
    let by = 0;
    for (const [name, g] of Object.entries(B)) if (name !== 'gavel' && Math.hypot(g.position.x - bx, g.position.z - bz) < 1) by = g.position.y;
    const topY = 22;
    beamGroup.position.set(bx * 0.6, topY, bz * 0.6);
    const dir = new THREE.Vector3(bx - beamGroup.position.x, by - topY, bz - beamGroup.position.z);
    const len = dir.length();
    cone.scale.set(1, len, 1);
    beamGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
    coneMat.opacity = 0.16 * beam.on;
    pool.position.set(bx, by + 0.05, bz); pool.material.opacity = 0.35 * beam.on;
    spot.position.copy(beamGroup.position); spot.target.position.set(bx, by, bz); spot.intensity = 220 * beam.on;
    // tokens: simple ones roll down the road; complex ones climb back to the hospital
    tokens.forEach((tk) => {
      const p = Math.min(1, Math.max(0, state.tokens * 1.6 - tk.offset));
      if (p <= 0 || p >= 1) { tk.mesh.visible = false; return; }
      tk.mesh.visible = true;
      const pos = tk.complex ? pathUp.getPointAt(p) : pathDown.getPointAt(p);
      tk.mesh.position.set(pos.x, pos.y + 0.3, pos.z);
    });
    dome.material.opacity = 0.05 + 0.08 * state.domeGlow;
    renderer.render(scene, camera);
  }

  // Screen position of a building (for DOM labels and cards).
  function screen(name, dy = 3) {
    const p = B[name].getWorldPosition(new THREE.Vector3()); p.y += dy; p.project(camera);
    return { x: (p.x * 0.5 + 0.5) * width, y: (-p.y * 0.5 + 0.5) * height };
  }
  // Camera presets: frame a building.
  const SHOTS = {
    wide: { angle: 1.15, tilt: 0.6, dist: 52, tx: 0, ty: 1.5, tz: 0 },
    high: { angle: 1.0, tilt: 0.95, dist: 64, tx: 0, ty: 0, tz: 0 },
    berlin: { angle: 1.25, tilt: 0.42, dist: 22, tx: -8, ty: 1.5, tz: -6 },
    state: { angle: 1.35, tilt: 0.42, dist: 22, tx: -1, ty: 2, tz: -9 },
    insurers: { angle: 1.0, tilt: 0.4, dist: 22, tx: 8, ty: 2.5, tz: -6 },
    hospital: { angle: 1.45, tilt: 0.36, dist: 22, tx: -5, ty: 3, tz: 5 },
    theatre: { angle: 1.5, tilt: 0.22, dist: 12, tx: -6, ty: 3, tz: 5.5 },
    practice: { angle: 1.2, tilt: 0.4, dist: 20, tx: 3, ty: 1, tz: 3 },
    home: { angle: 1.0, tilt: 0.34, dist: 18, tx: 8.5, ty: 1, tz: 6 },
    table: { angle: 1.2, tilt: 0.55, dist: 18, tx: 2, ty: 1, tz: -2 },
    factory: { angle: 1.75, tilt: 0.35, dist: 18, tx: -12, ty: 1.5, tz: 1 },
    road: { angle: 1.3, tilt: 0.5, dist: 30, tx: 1.5, ty: 1, tz: 4.5 },
    capitals: { angle: 1.35, tilt: 0.55, dist: 32, tx: -4.5, ty: 2, tz: -7.5 },
  };

  return { scene, camera, renderer, render, screen, state, rig, beam, B_POS, SHOTS, B };
}
