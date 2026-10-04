// Shared building blocks for the "Pass the Blame" v2 dioramas:
// renderer + post-processing, palette/materials, rounded geometry, instanced foliage,
// tiny people, cars, street lamps and a deterministic RNG.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

export { THREE };

// ---------- deterministic randomness ----------
export function rng(seed = 1) {
  // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- palette ----------
export const P = {
  grass: 0x86b07a, grassDark: 0x6a9a64, meadow: 0xa3c27c, field1: 0xd2b866, field2: 0x97b866, soil: 0x7a5c48, rock: 0x8c7b6c,
  water: 0x7fb7c9, road: 0xd8cbb3, asphalt: 0x6f6a66, path: 0xe6dac4,
  plaster: 0xf3ece0, plaster2: 0xe9dcc6, stone: 0xd8cdb9, brick: 0xc9775e, roofRed: 0xb5553f, roofGrey: 0x6f7880, roofGreen: 0x5f8f74,
  glass: 0x9fc3d1, frame: 0x55606a, trim: 0xffffff, dark: 0x2b3238,
  amber: 0xf6b55b, blue: 0x8cc3dd, teal: 0x7fe0cf, coral: 0xff8a73, red: 0xd9534f,
  pine: 0x3f6e4c, leaf1: 0x5f9150, leaf2: 0x7aa755, leaf3: 0x527f4c, trunk: 0x6b4f3a,
};
const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...opts }));
  return matCache.get(key);
}
export const glassMat = () => new THREE.MeshStandardMaterial({ color: P.glass, roughness: 0.08, metalness: 0.65, envMapIntensity: 1.2 });
// Window panes that can glow at night: one material per group so groups can light independently.
export const windowMat = (glow = P.amber) => new THREE.MeshStandardMaterial({ color: 0x3d4a55, roughness: 0.25, metalness: 0.3, emissive: glow, emissiveIntensity: 0 });

export const rbox = (w, h, d, r = 0.08, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));

export function add(parent, geo, material, x = 0, y = 0, z = 0, { cast = true, receive = true, ry = 0 } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z); m.rotation.y = ry;
  m.castShadow = cast; m.receiveShadow = receive;
  parent.add(m);
  return m;
}

// ---------- renderer + post ----------
export function createRenderer(canvas, width, height) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  return { renderer, envMap };
}

// Post chain: render -> bloom (glowing windows, pipes, beam) -> tilt-shift (miniature) -> FXAA -> output.
export function createPost(renderer, width, height) {
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(1);
  composer.setSize(width, height);
  const renderPass = new RenderPass(null, null);
  composer.addPass(renderPass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(width / 2, height / 2), 0.3, 0.5, 1.0);
  composer.addPass(bloom);
  const hTilt = new ShaderPass(HorizontalTiltShiftShader);
  const vTilt = new ShaderPass(VerticalTiltShiftShader);
  hTilt.uniforms.h.value = 2.2 / width; vTilt.uniforms.v.value = 2.2 / height;
  hTilt.uniforms.r.value = vTilt.uniforms.r.value = 0.5;
  composer.addPass(hTilt); composer.addPass(vTilt);
  composer.addPass(new OutputPass());
  const fxaa = new ShaderPass(FXAAShader);
  fxaa.material.uniforms.resolution.value.set(1 / width, 1 / height);
  composer.addPass(fxaa);
  return {
    composer, bloom,
    // tilt: 0 = no miniature blur, 1 = full
    render(scene, camera, { bloom: b = 0.3, tilt = 1, focus = 0.5, threshold = 1.0 } = {}) {
      renderPass.scene = scene; renderPass.camera = camera;
      bloom.strength = b; bloom.threshold = threshold;
      hTilt.uniforms.h.value = 2.4 * tilt / width; vTilt.uniforms.v.value = 2.4 * tilt / height;
      hTilt.uniforms.r.value = vTilt.uniforms.r.value = focus;
      composer.render();
    },
  };
}

// ---------- sky + lights shared pattern ----------
export function lights(scene, { shadowSize = 2048, extent = 26 } = {}) {
  const hemi = new THREE.HemisphereLight(0xfff1de, 0x40506a, 0.9);
  const sun = new THREE.DirectionalLight(0xffd2a6, 2.4);
  sun.position.set(-20, 30, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: 120 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
  const rim = new THREE.DirectionalLight(0x9fc8ff, 0.5);
  rim.position.set(18, 12, -20);
  scene.add(hemi, sun, rim);
  return { hemi, sun, rim };
}
// Time of day: d = 1 golden afternoon, 0 = night.
export function applyDay(L, scene, d, { exposure } = {}) {
  L.hemi.intensity = 0.12 + 0.48 * d;
  L.sun.intensity = 0.06 + 2.1 * d;
  L.sun.color.setRGB(1, 0.66 + 0.16 * d, 0.48 + 0.2 * d);
  L.rim.intensity = 0.25 + 0.3 * (1 - d);
  L.rim.color.setRGB(0.55 + 0.1 * d, 0.7, 1);
  const top = new THREE.Color(0x0a1424).lerp(new THREE.Color(0x8fb4cf), d);
  const bot = new THREE.Color(0x1b2a44).lerp(new THREE.Color(0xf4d3ae), d);
  scene.environmentIntensity = 0.12 + 0.33 * d;
  scene.userData.skyTop = top; scene.userData.skyBot = bot;
  if (scene.background?.isTexture) paintSky(scene.background, top, bot);
  if (scene.fog) scene.fog.color.copy(bot);
}
export function skyTexture() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.canvas = c;
  return t;
}
function paintSky(tex, top, bot) {
  const c = tex.userData.canvas, x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#' + top.getHexString()); g.addColorStop(1, '#' + bot.getHexString());
  x.fillStyle = g; x.fillRect(0, 0, 4, 256); tex.needsUpdate = true;
}

// ---------- foliage (instanced) ----------
export function forest(parent, spots, seed = 3) {
  const r = rng(seed);
  const conifers = spots.filter(() => r() < 0.45);
  const decid = spots.filter((s) => !conifers.includes(s));
  const coneGeo = new THREE.ConeGeometry(0.55, 1.2, 8);
  const blobGeo = new THREE.IcosahedronGeometry(0.62, 1);
  const trunkGeo = new THREE.CylinderGeometry(0.07, 0.1, 0.6, 6);
  const leafMat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
  const pineMat = new THREE.MeshStandardMaterial({ color: P.pine, roughness: 0.9, flatShading: true });
  const trunkMat = mat(P.trunk);
  const nC = conifers.length * 2, nD = decid.length * 2;
  const cone = new THREE.InstancedMesh(coneGeo, pineMat, Math.max(1, nC));
  const blob = new THREE.InstancedMesh(blobGeo, leafMat, Math.max(1, nD));
  const trunk = new THREE.InstancedMesh(trunkGeo, trunkMat, Math.max(1, spots.length));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const leafCols = [P.leaf1, P.leaf2, P.leaf3, 0x6f9f5c, 0x88aa58, 0xa8b25a].map((c) => new THREE.Color(c));
  let ci = 0, di = 0, ti = 0;
  for (const [x, y, z, s0] of spots) {
    const s = s0 ?? 0.7 + r() * 0.6;
    m4.compose(v.set(x, y + 0.3 * s, z), q.identity(), sc.set(s, s, s)); trunk.setMatrixAt(ti++, m4);
    if (conifers.includes(spots[ti - 1])) {
      m4.compose(v.set(x, y + 0.85 * s, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6), sc.set(s, s * 1.15, s)); cone.setMatrixAt(ci++, m4);
      m4.compose(v.set(x, y + 1.45 * s, z), q, sc.set(s * 0.72, s * 0.9, s * 0.72)); cone.setMatrixAt(ci++, m4);
    } else {
      m4.compose(v.set(x, y + 1.0 * s, z), q.setFromEuler(new THREE.Euler(r(), r() * 6, r())), sc.set(s, s * 0.95, s)); blob.setMatrixAt(di, m4);
      blob.setColorAt(di++, leafCols[Math.floor(r() * leafCols.length)]);
      m4.compose(v.set(x + 0.28 * s, y + 0.82 * s, z + 0.12 * s), q, sc.set(s * 0.62, s * 0.62, s * 0.62)); blob.setMatrixAt(di, m4);
      blob.setColorAt(di++, leafCols[Math.floor(r() * leafCols.length)]);
    }
  }
  cone.count = ci; blob.count = di; trunk.count = ti;
  for (const im of [cone, blob, trunk]) { im.castShadow = true; im.receiveShadow = true; parent.add(im); }
  return { cone, blob, trunk };
}

// ---------- tiny people ----------
const personGeo = { body: new THREE.CapsuleGeometry(0.11, 0.26, 4, 8), head: new THREE.SphereGeometry(0.09, 12, 8) };
export function person(parent, x, z, color = 0x4f86c6, y = 0, scale = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(scale);
  add(g, personGeo.body, mat(color), 0, 0.24, 0);
  add(g, personGeo.head, mat(0xf0c9a8), 0, 0.5, 0);
  parent.add(g);
  return g;
}

// ---------- cars ----------
const carGeo = { body: rbox(0.62, 0.2, 0.32, 0.06), cab: rbox(0.34, 0.16, 0.28, 0.05), wheel: new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10) };
export function car(parent, color = 0xd9534f) {
  const g = new THREE.Group();
  add(g, carGeo.body, mat(color, { roughness: 0.4, metalness: 0.2 }), 0, 0.17, 0);
  add(g, carGeo.cab, mat(0xdfe8ee, { roughness: 0.2, metalness: 0.4 }), -0.04, 0.33, 0);
  for (const [x, z] of [[-0.2, 0.15], [0.2, 0.15], [-0.2, -0.15], [0.2, -0.15]]) {
    const w = add(g, carGeo.wheel, mat(0x222222), x, 0.07, z); w.rotation.x = Math.PI / 2;
  }
  const lamps = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.22), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c8, emissiveIntensity: 0 }));
  lamps.position.set(0.32, 0.18, 0); g.add(lamps); g.userData.lamps = lamps;
  parent.add(g);
  return g;
}
// Place an object on a curve at progress p (0..1), facing along it.
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
export function onCurve(obj, curve, p, yOff = 0) {
  p = ((p % 1) + 1) % 1;
  curve.getPointAt(p, tmpA); curve.getPointAt(Math.min(0.9999, p + 0.002), tmpB);
  obj.position.set(tmpA.x, tmpA.y + yOff, tmpA.z);
  obj.rotation.y = Math.atan2(-(tmpB.z - tmpA.z), tmpB.x - tmpA.x);
}

// ---------- street lamps (instanced posts + glowing heads) ----------
export function lamps(parent, spots) {
  const post = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.035, 0.9, 6), mat(0x3a3f44), spots.length);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffd28a, emissiveIntensity: 0 });
  const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 10, 8), headMat, spots.length);
  const m4 = new THREE.Matrix4();
  spots.forEach(([x, y, z], i) => {
    post.setMatrixAt(i, m4.makeTranslation(x, y + 0.45, z));
    head.setMatrixAt(i, m4.makeTranslation(x, y + 0.92, z));
  });
  post.castShadow = true;
  parent.add(post, head);
  return headMat;
}

// Simple soft cloud made of overlapping spheres.
export function cloud(parent, x, y, z, s = 1, seed = 1) {
  const r = rng(seed);
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s);
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.6 + r() * 0.5, 14, 10), m);
    b.position.set((i - 2.5) * 0.55, r() * 0.25, (r() - 0.5) * 0.5); b.scale.y = 0.6; g.add(b);
  }
  parent.add(g);
  return g;
}
