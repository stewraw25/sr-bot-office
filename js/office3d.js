/* SR Bot Office — Three.js scene for the office TV.
   Models are procedural primitives. Three.js (MIT) is loaded from jsDelivr.
   Add a bot in data/bots.json. status.json is polled for live state.
   The flat fallback lives at /2d/. */
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const STALE_MS = 2 * 60 * 60 * 1000;
const POLL_MS = 45000;
const FLOOR = 0.72;
const HUT = { x0: -12.4, x1: 12.4, z0: -0.5, z1: 13.5 };
const VIEW_H = 24.2;

const params = new URLSearchParams(location.search);
const DEMO = params.get('demo') === '1' || params.get('demo') === 'true';
const DEBUG = params.has('debug') || params.has('fps');
let SKY_LOCK = params.get('sky');
if (!['night', 'dawn', 'day', 'dusk'].includes(SKY_LOCK)) SKY_LOCK = null;

const GROK_SWEATERS = [0x1f8a7b, 0x218a9a, 0x2f6f86, 0x3d8f6a, 0x1d6e78, 0x2a7d62];
const BUZZ_SWEATERS = [0xd4893a, 0xe09a3a, 0xc46b3a, 0xe0b15a, 0xb86a48, 0xcc7a3a];
const STATE_LABEL = { working: 'Working', idle: 'Idle', collaborating: 'Together', offline: 'Offline' };
const DEMO_TASKS = [
  'Weekly SEO check', 'Drafting X post', 'Call wrap-up', 'Inbox tidy', 'Backtest review',
  'Macro notes', 'Overnight digest', 'Risk scan', 'Keyword pass', 'Site health check',
  'Diary skim', 'Statement run', 'Job notes sync', 'Cert booking', 'Market open scan', 'Desk research'
];
const CHICKEN_COLORS = [0xf7f1e3, 0xe6d2a8, 0xd08a45, 0xfffaf2, 0x8d5a34, 0xf0e2c0, 0xc46a3a, 0xefe6c9, 0xf4d7a8, 0xa86b3c, 0xfffdf8, 0xe7c98a];
const SKY = {
  night: { bg: 0x12182a, fog: 0x12182a, sky: 0x243456, ground: 0x1a140e, sun: 0x9aafd0, dir: 0.28, hemi: 0.28, exp: 0.82 },
  dawn: { bg: 0xf0b48a, fog: 0xe7b090, sky: 0xffc9a4, ground: 0x6a5038, sun: 0xffc090, dir: 0.72, hemi: 0.42, exp: 1.0 },
  day: { bg: 0x8ec6ef, fog: 0x9ec8ea, sky: 0xc5e4f8, ground: 0x5e8a48, sun: 0xfff4dd, dir: 1.15, hemi: 0.62, exp: 1.05 },
  dusk: { bg: 0xe07a4a, fog: 0xd88860, sky: 0xf0a070, ground: 0x5a4030, sun: 0xffb070, dir: 0.7, hemi: 0.4, exp: 0.98 }
};

const clockEl = document.getElementById('clock');
const countsEl = document.getElementById('counts');
const feedEl = document.getElementById('feed');
const fullBtn = document.getElementById('fullbtn');
const tickerTrack = document.getElementById('ticker-track');
const fpsEl = document.getElementById('fps');

const matCache = new Map();
const agents = [];
const byId = new Map();
const horses = [];
const poodles = [];
const ducks = [];
const chickens = [];
const clouds = [];
const glow = [];
let wizard = null;
let brands = [];
let nearCaravans = 0;
let farCaravans = 0;
let zoneTitles = [];
let links = [];
let lastStatus = null;
let botSig = '';
let demoHistory = [];
let lastMinute = -1;
let frames = 0;
let fpsStamp = 0;
let elapsed = 0;

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  return h;
}
function sweater(team, id) {
  const palette = team === 'buzz' ? BUZZ_SWEATERS : GROK_SWEATERS;
  return palette[hash(id) % palette.length];
}
function teamLabel(team) {
  if (team === 'grok') return 'Grok Bots';
  if (team === 'buzz') return 'Buzz';
  return String(team);
}

function mat(color, opts = {}) {
  const key = [color, opts.rough ?? '', opts.metal ?? '', opts.lambert ? 'L' : 'S', opts.emissive || 0, opts.map ? 'M' : ''].join('|');
  if (matCache.has(key)) return matCache.get(key);
  const m = opts.lambert
    ? new THREE.MeshLambertMaterial({ color, map: opts.map || null })
    : new THREE.MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.62,
      metalness: opts.metal ?? 0.02,
      emissive: opts.emissive || 0x000000,
      emissiveIntensity: opts.emissive ? 0.7 : 0,
      map: opts.map || null
    });
  matCache.set(key, m);
  return m;
}

function plankTexture(a, b) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  for (let x = 0; x < 128; x += 16) {
    g.fillStyle = (x / 16) % 2 ? a : b;
    g.fillRect(x, 0, 15, 256);
    g.fillStyle = 'rgba(0,0,0,0.15)';
    g.fillRect(x + 15, 0, 1, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function grassTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#3f7a3a';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 280; i++) {
    g.fillStyle = i % 3 ? '#4e8a42' : '#2f642e';
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(18, 14);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function corrugationTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 16;
  const g = c.getContext('2d');
  for (let x = 0; x < 128; x++) {
    const s = 0.45 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin((x / 128) * Math.PI * 18), 1.4);
    const v = Math.round(168 * s);
    g.fillStyle = `rgb(${v},${v + 3},${v + 6})`;
    g.fillRect(x, 0, 1, 16);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function textTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 180;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 1024, 180);
  let size = 86;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 ${size}px Arial, Helvetica, sans-serif`;
  while (g.measureText(text).width > 980 && size > 28) {
    size -= 2;
    g.font = `700 ${size}px Arial, Helvetica, sans-serif`;
  }
  g.fillStyle = color;
  g.fillText(text, 512, 94);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function brandMaterial(text, color) {
  return new THREE.MeshBasicMaterial({
    map: textTexture(text, color),
    transparent: true,
    depthWrite: false
  });
}

const woodTex = plankTexture('#8a5a32', '#6e4528');
const woodMat = new THREE.MeshLambertMaterial({ map: woodTex, color: 0xffffff });
woodTex.repeat.set(2, 1);
const floorTex = plankTexture('#7a5134', '#62402a');
floorTex.repeat.set(6, 4);
const floorMat = new THREE.MeshLambertMaterial({ map: floorTex, color: 0xffffff });
const grassMat = new THREE.MeshLambertMaterial({ map: grassTexture(), color: 0xffffff });
const gravelMat = new THREE.MeshLambertMaterial({ color: 0x8d8478 });
const metalMat = new THREE.MeshStandardMaterial({ color: 0x8d98a3, roughness: 0.45, metalness: 0.35 });

const G = {
  head: new THREE.SphereGeometry(0.2, 18, 14),
  torso: new THREE.CapsuleGeometry(0.18, 0.26, 4, 10),
  limb: new THREE.CapsuleGeometry(0.055, 0.2, 3, 8),
  arm: new THREE.CapsuleGeometry(0.045, 0.16, 3, 8),
  eye: new THREE.SphereGeometry(0.038, 8, 6),
  deskTop: new THREE.BoxGeometry(0.86, 0.06, 0.48),
  deskLeg: new THREE.BoxGeometry(0.06, 0.68, 0.06),
  monitor: new THREE.BoxGeometry(0.4, 0.28, 0.035),
  screen: new THREE.PlaneGeometry(0.32, 0.2),
  seat: new THREE.BoxGeometry(0.42, 0.08, 0.4),
  seatBack: new THREE.BoxGeometry(0.42, 0.36, 0.06),
  blob: new THREE.CircleGeometry(0.22, 10)
};
const skinMat = mat(0xf3e0cc, { rough: 0.55 });
const eyeMat = mat(0x1b1b1b, { rough: 0.3 });
const darkMat = mat(0x2a3140, { rough: 0.7 });
const clothMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.48, metalness: 0.03 });
const deskTopMat = mat(0xa86b42, { lambert: true });
const deskLegMat = mat(0x4a3020, { lambert: true });
const monMat = mat(0x1c1c1c, { rough: 0.4 });
const screenMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const seatMat = mat(0x3a2418, { lambert: true });
const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
const batches = [];
let batch = null;
const _dummy = new THREE.Object3D();
const _tint = new THREE.Color();

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.id = 'view';
document.body.prepend(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels';
document.body.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY.day.bg);
scene.fog = new THREE.Fog(SKY.day.fog, 55, 110);

const camera = new THREE.OrthographicCamera(-20, 20, 12, -12, 0.1, 280);
const look = new THREE.Vector3(-5.6, 1.5, 4.8);
const hemi = new THREE.HemisphereLight(SKY.day.sky, SKY.day.ground, SKY.day.hemi);
scene.add(hemi);
const dir = new THREE.DirectionalLight(SKY.day.sun, SKY.day.dir);
dir.position.set(22, 28, 18);
dir.castShadow = true;
dir.shadow.mapSize.set(1024, 1024);
dir.shadow.camera.near = 4;
dir.shadow.camera.far = 80;
dir.shadow.camera.left = -36;
dir.shadow.camera.right = 26;
dir.shadow.camera.top = 26;
dir.shadow.camera.bottom = -26;
dir.shadow.bias = -0.00035;
dir.shadow.normalBias = 0.04;
dir.target.position.copy(look);
scene.add(dir, dir.target);
const lamp = new THREE.PointLight(0xffc48a, 1.1, 22, 2);
lamp.position.set(0, 3.4, 6);
scene.add(lamp);

const sun = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff3c4 }));
const moon = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 12), new THREE.MeshBasicMaterial({ color: 0xe7ebf4 }));
scene.add(sun, moon);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  let pr = Math.min(window.devicePixelRatio || 1, 1.35);
  if (w * pr > 2200) pr = 2200 / w;
  renderer.setPixelRatio(Math.max(0.7, pr));
  renderer.setSize(w, h, false);
  labelRenderer.setSize(w, h);
  const aspect = w / Math.max(1, h);
  const vh = VIEW_H;
  const vw = vh * aspect;
  camera.left = -vw / 2;
  camera.right = vw / 2;
  camera.top = vh / 2;
  camera.bottom = -vh / 2;
  camera.updateProjectionMatrix();
  document.querySelectorAll('.nm').forEach((nm) => {
    delete nm.dataset.fit;
    nm.style.transform = '';
  });
}
resize();
window.addEventListener('resize', resize);

function placeCamera(t) {
  const yaw = 0.74 + Math.sin(t * 0.07) * 0.07;
  const pitch = 0.56 + Math.sin(t * 0.05) * 0.01;
  const dist = 52;
  camera.position.set(
    look.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    look.y + Math.sin(pitch) * dist,
    look.z + Math.cos(yaw) * Math.cos(pitch) * dist
  );
  camera.lookAt(look);
}
placeCamera(0);

function mesh(geo, material, x, y, z, parent) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  (parent || scene).add(m);
  return m;
}

function box(w, h, d, material, x, y, z, parent) {
  return mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z, parent);
}

function buildHut() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(96, 78), grassMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const hill = new THREE.Mesh(new THREE.SphereGeometry(16, 18, 12), mat(0x4d8a42, { lambert: true }));
  hill.scale.y = 0.28;
  hill.position.set(-16, -3.2, -22);
  scene.add(hill);
  const hill2 = hill.clone();
  hill2.position.set(8, -4.2, -26);
  hill2.scale.set(1.3, 0.22, 1.1);
  scene.add(hill2);

  const cx = (HUT.x0 + HUT.x1) / 2;
  const cz = (HUT.z0 + HUT.z1) / 2;
  const hw = (HUT.x1 - HUT.x0);
  const hd = (HUT.z1 - HUT.z0);
  const floor = box(hw, 0.16, hd, floorMat, cx, FLOOR - 0.08, cz);
  floor.receiveShadow = true;

  const wallH = 2.45;
  const wallMat = woodMat;
  const north = box(hw, wallH, 0.18, wallMat, cx, FLOOR + wallH / 2, HUT.z0);
  north.castShadow = true;
  north.receiveShadow = true;
  const west = box(0.18, wallH, hd, wallMat, HUT.x0, FLOOR + wallH / 2, cz);
  west.castShadow = true;
  const east = box(0.16, 1.05, hd, wallMat, HUT.x1, FLOOR + 0.52, cz);
  east.castShadow = true;

  const winMat = new THREE.MeshBasicMaterial({ color: 0xd7f1fb });
  glow.push(winMat);
  for (let i = 0; i < 4; i++) {
    const w = mesh(new THREE.PlaneGeometry(1.1, 0.8), winMat, -7 + i * 3.4, FLOOR + 1.7, HUT.z0 + 0.1);
  }
  const port = mesh(new THREE.CircleGeometry(0.28, 16), winMat, HUT.x0 + 0.12, FLOOR + 1.7, cz - 2);
  port.rotation.y = Math.PI / 2;

  // Barrel roof: cylinder axis is local Y. After a quarter-turn about Z the
  // axis runs along X, and (sin θ, cos θ) lands in world Y / Z.
  // θ from just south of the crown to the north eave leaves the front open.
  const radius = 4.8;
  const thetaStart = Math.PI / 2 - 0.42;
  const thetaLength = Math.PI / 2 + 0.42;
  const roofGeo = new THREE.CylinderGeometry(radius, radius, hw + 1.15, 28, 1, false, thetaStart, thetaLength);
  const roofMatLocal = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: corrugationTexture(),
    roughness: 0.46,
    metalness: 0.28,
    side: THREE.DoubleSide
  });
  const roof = new THREE.Mesh(roofGeo, roofMatLocal);
  roof.rotation.z = Math.PI / 2;
  roof.position.set(cx, FLOOR + wallH, HUT.z0 + radius - 0.15);
  roof.castShadow = true;
  roof.receiveShadow = true;
  scene.add(roof);

  const chimney = box(0.46, 1.3, 0.46, mat(0x6a4038, { lambert: true }), HUT.x0 + 1.4, FLOOR + wallH + 1.5, HUT.z0 + 1.2);
  chimney.castShadow = true;

  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.2, 12);
  const wheelMat = mat(0x242424, { rough: 0.85 });
  for (const x of [HUT.x0 + 1.6, HUT.x1 - 1.6]) {
    for (const z of [HUT.z0 + 1.4, HUT.z1 - 1.4]) {
      const w = mesh(wheelGeo, wheelMat, x, 0.36, z);
      w.rotation.x = Math.PI / 2;
      w.castShadow = true;
    }
  }
  for (let i = 0; i < 3; i++) {
    const step = box(3.4, 0.16, 0.42, floorMat, 0, 0.16 * i + 0.1, HUT.z1 + 0.15 + i * 0.28);
    step.receiveShadow = true;
  }

  const bulbGeo = new THREE.SphereGeometry(0.055, 6, 6);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe1a0 });
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, 22);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 22; i++) {
    dummy.position.set(-9.2 + (i % 11) * 1.75, FLOOR + 2.15, i < 11 ? 2.2 : 8.4);
    dummy.updateMatrix();
    bulbs.setMatrixAt(i, dummy.matrix);
  }
  scene.add(bulbs);

  const rugMat = (color) => new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.42 });
  const rugG = box(hw - 2.4, 0.02, 5.2, rugMat(0x2f8a80), cx, FLOOR + 0.02, 3.2);
  rugG.receiveShadow = true;
  const rugB = box(hw - 2.4, 0.02, 4.4, rugMat(0x8a5878), cx, FLOOR + 0.02, 10.0);
  rugB.receiveShadow = true;

  lamp.position.set(cx, FLOOR + 3.1, 6.2);
  lamp.intensity = 2.4;
  const lamp2 = new THREE.PointLight(0xffe0b8, 1.3, 16, 2);
  lamp2.position.set(cx, FLOOR + 2.6, 10.4);
  scene.add(lamp2);
}

function pitchedRoof(x, z, w, d, y, color) {
  const matR = mat(color, { rough: 0.7, metal: 0.05 });
  const a = box(w, 0.1, d * 0.7, matR, x, y + 0.22, z - d * 0.1);
  a.rotation.x = 0.5;
  a.castShadow = true;
  const b = box(w, 0.1, d * 0.7, matR, x, y + 0.22, z + d * 0.1);
  b.rotation.x = -0.5;
  b.castShadow = true;
}

function barnAndStables() {
  const barnMat = mat(0x8d4038, { lambert: true });
  const body = box(10.5, 3.6, 6.4, barnMat, -25, 1.8, -7.2);
  body.castShadow = true;
  body.receiveShadow = true;
  pitchedRoof(-25, -7.2, 11.2, 7.2, 4.15, 0x6e322c);
  const door = box(1.8, 2.2, 0.12, mat(0x3e2a24, { lambert: true }), -22.2, 1.15, -4.05);
  const glass = new THREE.MeshBasicMaterial({ color: 0xd7f1fb });
  glow.push(glass);
  for (const [dx, dy] of [[-3.2, 2.3], [-1.2, 2.5], [1.4, 2.2], [3.2, 1.6]]) {
    mesh(new THREE.PlaneGeometry(1.15, 0.9), glass, -25 + dx, dy, -3.95);
  }

  const stableMat = mat(0x7a5340, { lambert: true });
  const stable = box(10.2, 2.5, 4.4, stableMat, -24.5, 1.25, -0.6);
  stable.castShadow = true;
  stable.receiveShadow = true;
  pitchedRoof(-24.5, -0.6, 10.8, 5.0, 2.85, 0x6a4534);
  for (let i = 0; i < 3; i++) {
    box(1.5, 1.7, 0.08, mat(0x2a1c14, { lambert: true }), -27.4 + i * 2.6, 0.9, 1.55);
  }

  const postGeo = new THREE.BoxGeometry(0.08, 0.9, 0.08);
  const railGeo = new THREE.BoxGeometry(1.3, 0.06, 0.06);
  const postMat = mat(0x6b4a30, { lambert: true });
  const railMat = mat(0xd7bc8a, { lambert: true });
  const posts = new THREE.InstancedMesh(postGeo, postMat, 28);
  const rails = new THREE.InstancedMesh(railGeo, railMat, 28);
  const dummy = new THREE.Object3D();
  let n = 0;
  for (let i = 0; i < 14; i++) {
    const x = -31 + i * 1.3;
    dummy.position.set(x, 0.45, 3.2);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    posts.setMatrixAt(n, dummy.matrix);
    dummy.position.set(x, 0.45, 8.6);
    dummy.updateMatrix();
    posts.setMatrixAt(n + 14, dummy.matrix);
    dummy.position.set(x + 0.65, 0.7, 3.2);
    dummy.updateMatrix();
    rails.setMatrixAt(n, dummy.matrix);
    dummy.position.set(x + 0.65, 0.7, 8.6);
    dummy.updateMatrix();
    rails.setMatrixAt(n + 14, dummy.matrix);
    n++;
  }
  scene.add(posts, rails);
  const sideRail = box(0.06, 0.06, 5.4, railMat, -31, 0.7, 5.9);
  box(0.06, 0.9, 0.08, postMat, -31, 0.45, 5.9);
}

function caravan(x, z, scale, bodyColor, far) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.85, 0.95), mat(bodyColor, { lambert: true }));
  body.position.y = 0.7;
  body.castShadow = !far;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 1.55, 8, 1, false, 0, Math.PI), mat(0xd9cbb8, { lambert: true }));
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 1.12;
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 10), mat(0x222222, { rough: 0.8 }));
  wheel.rotation.z = Math.PI / 2;
  const w2 = wheel.clone();
  wheel.position.set(-0.45, 0.2, 0.42);
  w2.position.set(0.45, 0.2, 0.42);
  g.add(body, roof, wheel, w2);
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  scene.add(g);
  return g;
}

function blackWheel(parent, x, y, z) {
  const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 14), mat(0x141414, { rough: 0.72, metal: 0.08 }));
  w.rotation.z = Math.PI / 2;
  w.position.set(x, y, z);
  parent.add(w);
  return w;
}

function buildVehicles() {
  brands = ['Stewart Rawson Electrical', 'SR Security'];
  const van = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.25, 2.7), mat(0xf4f6f8, { rough: 0.38, metal: 0.06 }));
  body.position.y = 0.95;
  body.castShadow = true;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.7), mat(0xb7d4e2, { rough: 0.2, metal: 0.04 }));
  cab.position.set(0, 1.25, 1.0);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.1, 2.72), mat(0x1d4e89, { rough: 0.4 }));
  stripe.position.y = 0.78;
  const brand = brandMaterial('Stewart Rawson Electrical', '#1d4e89');
  const side = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 0.32), brand);
  side.position.set(0.64, 1.15, -0.15);
  side.rotation.y = Math.PI / 2;
  const side2 = side.clone();
  side2.position.x = -0.64;
  side2.rotation.y = -Math.PI / 2;
  van.add(body, cab, stripe, side, side2);
  blackWheel(van, 0.55, 0.32, 0.85);
  blackWheel(van, -0.55, 0.32, 0.85);
  blackWheel(van, 0.55, 0.32, -0.85);
  blackWheel(van, -0.55, 0.32, -0.85);
  van.position.set(-16.5, 0, 15.2);
  van.userData.brand = 'Stewart Rawson Electrical';
  scene.add(van);

  const sec = new THREE.Group();
  const sb = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.0, 1.85), mat(0x1b3f66, { rough: 0.45, metal: 0.05 }));
  sb.position.y = 0.78;
  sb.castShadow = true;
  const scab = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.5), mat(0x9ec4d6, { rough: 0.2 }));
  scab.position.set(0, 1.05, 0.65);
  const sbrand = brandMaterial('SR Security', '#f4f7fb');
  const ss = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.28), sbrand);
  ss.position.set(0.54, 0.9, -0.05);
  ss.rotation.y = Math.PI / 2;
  const ss2 = ss.clone();
  ss2.position.x = -0.54;
  ss2.rotation.y = -Math.PI / 2;
  sec.add(sb, scab, ss, ss2);
  blackWheel(sec, 0.48, 0.26, 0.55);
  blackWheel(sec, -0.48, 0.26, 0.55);
  blackWheel(sec, 0.48, 0.26, -0.55);
  blackWheel(sec, -0.48, 0.26, -0.55);
  sec.position.set(-16.2, 0, 11.6);
  sec.userData.brand = 'SR Security';
  scene.add(sec);

  const tesla = new THREE.Group();
  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.38, 2.35), mat(0x121212, { rough: 0.28, metal: 0.55 }));
  lower.position.y = 0.42;
  lower.castShadow = true;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.42, 1.35), mat(0x161616, { rough: 0.25, metal: 0.6 }));
  cabin.position.set(0, 0.78, -0.05);
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.12, 0.7), mat(0x141414, { rough: 0.25, metal: 0.6 }));
  hatch.position.set(0, 0.95, -0.72);
  hatch.rotation.x = -0.45;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.28, 0.9), mat(0x1c2833, { rough: 0.1, metal: 0.1 }));
  glass.position.set(0, 0.95, 0.05);
  const lampL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.18), new THREE.MeshBasicMaterial({ color: 0xe7eef3 }));
  lampL.position.set(0.4, 0.55, 1.15);
  const lampR = lampL.clone();
  lampR.position.x = -0.4;
  tesla.add(lower, cabin, hatch, glass, lampL, lampR);
  blackWheel(tesla, 0.52, 0.3, 0.75);
  blackWheel(tesla, -0.52, 0.3, 0.75);
  blackWheel(tesla, 0.52, 0.3, -0.75);
  blackWheel(tesla, -0.52, 0.3, -0.75);
  tesla.position.set(-16.4, 0, 8.4);
  tesla.userData.brand = 'Tesla Model Y';
  scene.add(tesla);

  const pad = box(6.2, 0.04, 9.2, gravelMat, -16.4, 0.02, 11.8);
  pad.receiveShadow = true;

  nearCaravans = 3;
  farCaravans = 2;
  caravan(-12.5, 15.4, 1, 0xf4efe4, false);
  caravan(-9.6, 16.6, 0.95, 0xe3efe4, false);
  caravan(-6.8, 15.2, 0.9, 0xf3e0cc, false);
  caravan(-17.6, -11.4, 0.52, 0xefe6d4, true);
  caravan(2.2, -13.4, 0.44, 0xe4eee4, true);
}

function animalRig(kind) {
  const g = new THREE.Group();
  g.userData.kind = kind;
  scene.add(g);
  return g;
}

function buildCritters() {
  const pond = new THREE.Mesh(new THREE.CircleGeometry(3.1, 24), new THREE.MeshLambertMaterial({ color: 0x2f7ea8 }));
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(-22.5, 0.03, 6.2);
  pond.receiveShadow = true;
  scene.add(pond);
  const pond2 = new THREE.Mesh(new THREE.CircleGeometry(1.8, 18), new THREE.MeshLambertMaterial({ color: 0x4aa0c8 }));
  pond2.rotation.x = -Math.PI / 2;
  pond2.position.set(-22.8, 0.04, 6.0);
  scene.add(pond2);

  for (let i = 0; i < 2; i++) {
    const h = animalRig('horse');
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 4, 8), mat(0x141414, { rough: 0.55 }));
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.95;
    body.castShadow = true;
    const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.35, 3, 6), mat(0x161616, { rough: 0.5 }));
    neck.position.set(0.55, 1.25, 0);
    neck.rotation.z = -0.8;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat(0x121212, { rough: 0.5 }));
    head.position.set(0.78, 1.45, 0);
    head.scale.set(1.3, 0.8, 0.7);
    const legs = [];
    for (const [lx, lz] of [[0.28, 0.12], [0.28, -0.12], [-0.32, 0.12], [-0.32, -0.12]]) {
      const pivot = new THREE.Group();
      pivot.position.set(lx, 0.85, lz);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.32, 2, 6), mat(0x101010, { rough: 0.6 }));
      leg.position.y = -0.22;
      pivot.add(leg);
      h.add(pivot);
      legs.push(pivot);
    }
    h.add(body, neck, head);
    h.position.set(-28 + i * 2.4, 0, 5.6);
    horses.push({ mesh: h, legs, x: h.position.x, z: h.position.z, tx: h.position.x + 1.5, wait: i * 4, speed: 0.55, minX: -30.2, maxX: -20.5, z0: 4.2, z1: 7.8 });
  }

  const loop = [
    { x: -27, z: 10.2 }, { x: -22, z: 11.4 }, { x: -18, z: 9.6 },
    { x: -20, z: 12.6 }, { x: -25, z: 13.2 }, { x: -28, z: 11.2 }
  ];
  for (let i = 0; i < 2; i++) {
    const p = animalRig('poodle');
    const fur = mat(0xc62828, { rough: 0.85 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), fur);
    body.position.y = 0.28;
    body.scale.set(1.3, 0.9, 0.85);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), fur);
    head.position.set(0.22, 0.4, 0);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), fur);
    pom.position.set(-0.24, 0.32, 0);
    p.add(body, head, pom);
    const start = loop[i * 3];
    p.position.set(start.x, 0, start.z);
    poodles.push({ mesh: p, points: loop, i: i * 3, speed: 1.15 });
  }

  for (let i = 0; i < 6; i++) {
    const d = animalRig('duck');
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat(0xfffaf2, { rough: 0.6 }));
    body.position.y = 0.16;
    body.scale.set(1.25, 0.8, 0.9);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(0xfffaf2, { rough: 0.6 }));
    head.position.set(0.14, 0.28, 0);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 6), mat(0xe09a3a, { rough: 0.5 }));
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.24, 0.28, 0);
    d.add(body, head, beak);
    ducks.push({ mesh: d, angle: (Math.PI * 2 * i) / 6, speed: 0.35 + (i % 3) * 0.05 });
  }

  for (let i = 0; i < 12; i++) {
    const c = animalRig('chicken');
    const col = mat(CHICKEN_COLORS[i % CHICKEN_COLORS.length], { rough: 0.7 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), col);
    body.position.y = 0.16;
    body.scale.set(1.2, 0.85, 0.8);
    const headPivot = new THREE.Group();
    headPivot.position.set(0.08, 0.24, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), col);
    head.position.set(0.04, 0.04, 0);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 5), mat(0xe09a3a, { lambert: true }));
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.1, 0.03, 0);
    headPivot.add(head, beak);
    c.add(body, headPivot);
    const x = -28 + (i % 6) * 0.7;
    const z = 10.4 + (i % 3) * 0.45;
    c.position.set(x, 0, z);
    chickens.push({
      mesh: c, head: headPivot, x, z, tx: x, tz: z,
      minX: -28.2, maxX: -23.6, minZ: 9.8, maxZ: 12.2,
      wait: (i % 4) * 0.4, speed: 0.35, peck: i * 0.4
    });
  }

  const digger = new THREE.Group();
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 1.3), mat(0xf0c020, { rough: 0.45, metal: 0.1 }));
  chassis.position.y = 0.32;
  chassis.castShadow = true;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.7), mat(0xf0c020, { rough: 0.4, metal: 0.08 }));
  cab.position.set(0, 0.7, -0.15);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.28, 0.08), mat(0xb7d4e2, { rough: 0.15 }));
  glass.position.set(0, 0.82, 0.22);
  const boom = new THREE.Group();
  boom.position.set(0, 0.55, 0.45);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.7), mat(0x222222, { rough: 0.5, metal: 0.2 }));
  arm.position.set(0, 0, 0.3);
  const bucket = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.22), mat(0x333333, { rough: 0.55, metal: 0.25 }));
  bucket.position.set(0, -0.05, 0.68);
  boom.add(arm, bucket);
  const tracks = [];
  for (const x of [-0.38, 0.38]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 1.15), mat(0x1a1a1a, { rough: 0.8 }));
    t.position.set(x, 0.14, 0);
    digger.add(t);
    tracks.push(t);
  }
  digger.add(chassis, cab, glass, boom);

  const mage = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 10), mat(0x3a2d8a, { rough: 0.75 }));
  robe.position.y = 0.4;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), skinMat);
  head.position.y = 0.82;
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat(0xc8c8c8, { rough: 0.9 }));
  beard.position.set(0.06, 0.74, 0);
  beard.scale.set(0.7, 1.1, 0.6);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 8), mat(0x2a2168, { rough: 0.7 }));
  hat.position.y = 1.12;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 10), mat(0x2a2168, { rough: 0.7 }));
  brim.position.y = 0.94;
  const spade = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), mat(0x8a5a32, { lambert: true }));
  handle.position.y = 0.35;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.02), mat(0xaaaaaa, { metal: 0.4, rough: 0.4 }));
  blade.position.y = 0.02;
  spade.add(handle, blade);
  spade.position.set(0.28, 0.15, 0.1);
  mage.add(robe, head, beard, hat, brim, spade);
  mage.position.set(-9.2, 0, 13.4);
  digger.position.set(-8.2, 0, 14.2);
  scene.add(mage, digger);
  wizard = { mage, digger, boom, bucket, spade, digX: -9.4, driveMin: -8.6, driveMax: -6.2, z: 14.2 };
}

function emojiSprite(emoji) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  g.font = '46px serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(emoji || '🤖', 32, 36);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(0.34, 0.34, 0.34);
  s.position.set(0, 1.05, 0.16);
  return s;
}

function makeLabel(name) {
  const el = document.createElement('div');
  el.className = 'tag';
  const nudge = document.createElement('div');
  nudge.className = 'nudge';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.hidden = true;
  const plate = document.createElement('div');
  plate.className = 'plate';
  const nm = document.createElement('div');
  nm.className = 'nm';
  nm.textContent = name;
  const st = document.createElement('div');
  st.className = 'st idle';
  st.textContent = 'Idle';
  plate.append(nm, st);
  nudge.append(bubble, plate);
  el.append(nudge);
  const obj = new CSS2DObject(el);
  obj.center.set(0.5, 1);
  obj.position.set(0, 1.42, 0);
  return { obj, el, nudge, bubble, st };
}

function marker(x, y, z, parent) {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

function makeBot(bot) {
  const root = new THREE.Group();
  root.scale.setScalar(1.18);
  const rig = new THREE.Group();
  root.add(rig);
  const color = sweater(bot.team, bot.id);
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  legL.position.set(-0.09, 0.36, 0);
  legR.position.set(0.09, 0.36, 0);
  rig.add(legL, legR);
  const legLm = marker(0, -0.16, 0, legL);
  const legRm = marker(0, -0.16, 0, legR);
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  armL.position.set(-0.24, 0.78, 0);
  armR.position.set(0.24, 0.78, 0);
  rig.add(armL, armR);
  const armLm = marker(0, -0.12, 0, armL);
  const armRm = marker(0, -0.12, 0, armR);
  const torso = marker(0, 0.68, 0, rig);
  const head = marker(0, 1.05, 0, rig);
  const eyeL = marker(-0.07, 1.08, 0.16, rig);
  const eyeR = marker(0.07, 1.08, 0.16, rig);
  const face = emojiSprite(bot.emoji);
  rig.add(face);
  const label = makeLabel(bot.name);
  root.add(label.obj);
  const blob = new THREE.Object3D();
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  root.add(blob);
  scene.add(root);
  return { root, rig, legL, legR, armL, armR, legLm, legRm, armLm, armRm, torso, head, eyeL, eyeR, blob, color, face, label };
}

function propKettle(x, z) {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mat(0xd7dde2, { metal: 0.55, rough: 0.35 }));
  pot.position.y = 0.2;
  pot.scale.y = 0.8;
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.16, 6), mat(0xd7dde2, { metal: 0.5, rough: 0.35 }));
  spout.rotation.z = Math.PI / 2.4;
  spout.position.set(0.16, 0.24, 0);
  g.add(pot, spout);
  g.position.set(x, FLOOR, z);
  scene.add(g);
  trackProp(g);
}

function propSofa(x, z) {
  const g = new THREE.Group();
  const seat = box(1.3, 0.28, 0.5, mat(0x8d3a48, { rough: 0.7 }), 0, 0.28, 0, g);
  const back = box(1.3, 0.4, 0.14, mat(0x8d3a48, { rough: 0.7 }), 0, 0.55, -0.2, g);
  seat.castShadow = true;
  g.position.set(x, FLOOR, z);
  scene.add(g);
  trackProp(g);
}

function propTable(x, z) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 16), floorMat);
  top.position.y = 0.7;
  top.castShadow = true;
  top.receiveShadow = true;
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.66, 8), mat(0x4a3020, { lambert: true }));
  leg.position.y = 0.33;
  g.add(top, leg);
  g.position.set(x, FLOOR, z);
  scene.add(g);
  trackProp(g);
  return { x, z };
}

function zoneLabel(text, x, z) {
  const el = document.createElement('div');
  el.className = 'zone-title';
  el.textContent = text;
  const obj = new CSS2DObject(el);
  obj.position.set(x, FLOOR + 2.15, z);
  scene.add(obj);
  zoneTitles.push({ el, obj });
}

function chooseGrid(n, w, d) {
  let best = null;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cellW = w / cols;
    const cellD = d / rows;
    const usable = cellW >= 2.7 && cellD >= 1.18;
    const wide = cellW >= 3.05;
    const score = (usable ? 500 : 0) + (wide ? 200 : 0) + Math.min(cellW, 3.4) * 40 + cellD * 30;
    if (!best || score > best.score) best = { cols, rows, cellW, cellD, score };
  }
  return best;
}

function layoutZones(list) {
  const groups = new Map();
  const order = [];
  list.forEach((bot) => {
    if (!groups.has(bot.team)) {
      groups.set(bot.team, []);
      order.push(bot.team);
    }
    groups.get(bot.team).push(bot);
  });
  order.sort((a, b) => (a === 'grok' ? -1 : 1) - (b === 'grok' ? -1 : 1));
  const specs = [
    { x0: -11.3, x1: 11.3, z0: 0.2, z1: 6.55 },
    { x0: -11.3, x1: 11.3, z0: 7.2, z1: 12.85 }
  ];
  return order.map((team, i) => {
    const bots = groups.get(team);
    const spec = specs[Math.min(i, specs.length - 1)];
    const grid = chooseGrid(bots.length, spec.x1 - spec.x0, spec.z1 - spec.z0 - 1.3);
    const zone = { team, bots, ...spec, grid };
    zone.kettle = { x: spec.x0 + 0.8, z: spec.z1 - 0.55 };
    zone.sofa = { x: spec.x0 + 2.8, z: spec.z1 - 0.5 };
    zone.table = { x: (spec.x0 + spec.x1) / 2, z: spec.z1 - 0.7 };
    zone.spots = [
      { x: zone.kettle.x + 0.45, z: zone.kettle.z, kind: 'kettle' },
      { x: zone.sofa.x, z: zone.sofa.z + 0.55, kind: 'sofa' },
      { x: spec.x1 - 1.2, z: spec.z0 + 1.1, kind: 'window' }
    ];
    bots.forEach((bot, n) => {
      const col = n % grid.cols;
      const row = Math.floor(n / grid.cols);
      bot.deskX = spec.x0 + col * grid.cellW + grid.cellW / 2;
      bot.deskZ = spec.z0 + 0.45 + row * grid.cellD;
      zone.spots.push({
        x: bot.deskX + (n % 2 ? 0.45 : -0.45),
        z: Math.min(spec.z1 - 0.4, bot.deskZ + 0.85)
      });
    });
    return zone;
  });
}

const zoneProps = [];
let sharedTable = { x: 8.2, z: 6.8 };

function trackProp(obj) {
  zoneProps.push(obj);
  return obj;
}

function disposeBatches() {
  for (const mesh of batches) scene.remove(mesh);
  batches.length = 0;
  batch = null;
}

function instanced(geo, material, count, shadow) {
  const mesh = new THREE.InstancedMesh(geo, material, count);
  mesh.castShadow = !!shadow;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  scene.add(mesh);
  batches.push(mesh);
  return mesh;
}

function putDesk(mesh, idx, x, y, z, ry) {
  _dummy.position.set(x, y, z);
  _dummy.rotation.set(0, ry || 0, 0);
  _dummy.scale.set(1, 1, 1);
  _dummy.updateMatrix();
  mesh.setMatrixAt(idx, _dummy.matrix);
}

function buildBatches() {
  disposeBatches();
  const n = agents.length;
  if (!n) return;
  batch = {
    torso: instanced(G.torso, clothMat, n, true),
    head: instanced(G.head, skinMat, n, true),
    eye: instanced(G.eye, eyeMat, n * 2, false),
    leg: instanced(G.limb, darkMat, n * 2, false),
    arm: instanced(G.arm, clothMat, n * 2, false),
    blob: instanced(G.blob, blobMat, n, false),
    top: instanced(G.deskTop, deskTopMat, n, false),
    dleg: instanced(G.deskLeg, deskLegMat, n * 4, false),
    mon: instanced(G.monitor, monMat, n, false),
    screen: instanced(G.screen, screenMat, n, false),
    seat: instanced(G.seat, seatMat, n, false),
    back: instanced(G.seatBack, seatMat, n, false)
  };
  batch.top.receiveShadow = true;
  batch.seat.receiveShadow = true;
  agents.forEach((a, i) => {
    _tint.setHex(a.color);
    batch.torso.setColorAt(i, _tint);
    batch.arm.setColorAt(i * 2, _tint);
    batch.arm.setColorAt(i * 2 + 1, _tint);
    _tint.setHex(0x1c2830);
    batch.screen.setColorAt(i, _tint);
    const x = a.deskX;
    const z = a.deskZ;
    putDesk(batch.top, i, x, FLOOR + 0.72, z + 0.42, 0);
    [[-0.34, 0.22], [0.34, 0.22], [-0.34, 0.6], [0.34, 0.6]].forEach(([lx, lz], k) => {
      putDesk(batch.dleg, i * 4 + k, x + lx, FLOOR + 0.34, z + lz, 0);
    });
    putDesk(batch.mon, i, x, FLOOR + 1.02, z + 0.58, -0.55);
    putDesk(batch.screen, i, x, FLOOR + 1.02, z + 0.6, -0.55);
    putDesk(batch.seat, i, x, FLOOR + 0.32, z - 0.02, 0);
    putDesk(batch.back, i, x, FLOOR + 0.52, z - 0.18, 0);
    a._hex = a.color;
    a._screen = 0;
  });
  for (const mesh of batches) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}

function syncInstances() {
  if (!batch) return;
  let tinted = false;
  let screens = false;
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    a.root.updateWorldMatrix(true, true);
    batch.torso.setMatrixAt(i, a.torso.matrixWorld);
    batch.head.setMatrixAt(i, a.head.matrixWorld);
    batch.eye.setMatrixAt(i * 2, a.eyeL.matrixWorld);
    batch.eye.setMatrixAt(i * 2 + 1, a.eyeR.matrixWorld);
    batch.leg.setMatrixAt(i * 2, a.legLm.matrixWorld);
    batch.leg.setMatrixAt(i * 2 + 1, a.legRm.matrixWorld);
    batch.arm.setMatrixAt(i * 2, a.armLm.matrixWorld);
    batch.arm.setMatrixAt(i * 2 + 1, a.armRm.matrixWorld);
    batch.blob.setMatrixAt(i, a.blob.matrixWorld);
    const hex = a.state === 'offline' ? 0x8d8b96 : a.color;
    if (a._hex !== hex) {
      a._hex = hex;
      _tint.setHex(hex);
      batch.torso.setColorAt(i, _tint);
      batch.arm.setColorAt(i * 2, _tint);
      batch.arm.setColorAt(i * 2 + 1, _tint);
      tinted = true;
    }
    const on = a._on ? 1 : 0;
    if (a._screen !== on) {
      a._screen = on;
      _tint.setHex(on ? 0x9fd7ff : 0x1c2830);
      batch.screen.setColorAt(i, _tint);
      screens = true;
    }
  }
  batch.torso.instanceMatrix.needsUpdate = true;
  batch.head.instanceMatrix.needsUpdate = true;
  batch.eye.instanceMatrix.needsUpdate = true;
  batch.leg.instanceMatrix.needsUpdate = true;
  batch.arm.instanceMatrix.needsUpdate = true;
  batch.blob.instanceMatrix.needsUpdate = true;
  if (tinted) {
    batch.torso.instanceColor.needsUpdate = true;
    batch.arm.instanceColor.needsUpdate = true;
  }
  if (screens) batch.screen.instanceColor.needsUpdate = true;
}

function clearBots() {
  disposeBatches();
  zoneProps.forEach((obj) => scene.remove(obj));
  zoneProps.length = 0;
  agents.forEach((a) => {
    a.label.el.remove();
    scene.remove(a.root);
  });
  agents.length = 0;
  byId.clear();
  zoneTitles.forEach((z) => {
    z.el.remove();
    scene.remove(z.obj);
  });
  zoneTitles = [];
  links.forEach((l) => scene.remove(l));
  links = [];
}

function mount(list) {
  clearBots();
  const zones = layoutZones(list);
  zones.forEach((zone) => {
    propKettle(zone.kettle.x, zone.kettle.z);
    propSofa(zone.sofa.x, zone.sofa.z);
    propTable(zone.table.x, zone.table.z);
    zoneLabel(teamLabel(zone.team), zone.x0 + 1.3, zone.z0 + 0.2);
  });
  propTable(sharedTable.x, sharedTable.z);
  const zonesByTeam = new Map(zones.map((z) => [z.team, z]));
  list.forEach((bot) => {
    const zone = zonesByTeam.get(bot.team) || zones[0];
    const parts = makeBot(bot);
    parts.root.position.set(bot.deskX, FLOOR, bot.deskZ);
    const agent = {
      ...bot,
      ...parts,
      zone,
      x: bot.deskX,
      z: bot.deskZ,
      path: [],
      state: 'idle',
      task: '',
      with: [],
      mode: '',
      destKey: '',
      settled: true,
      walking: false,
      dwell: 1 + Math.random() * 2,
      speed: 1.35 + (hash(bot.id) % 8) * 0.06,
      heading: 0,
      phase: Math.random() * 6,
      sig: '',
      spot: null,
      meet: null
    };
    agents.push(agent);
    byId.set(bot.id, agent);
  });
  buildBatches();
}

function spotCrowded(agent, spot) {
  for (const other of agents) {
    if (other === agent || other.zone !== agent.zone) continue;
    if (other.spot === spot) return true;
    if (Math.hypot(other.x - spot.x, other.z - spot.z) < 0.9) return true;
  }
  return false;
}

function countIdleWalking() {
  let n = 0;
  for (const a of agents) if (a.state === 'idle' && a.walking) n++;
  return n;
}

function route(agent, dest) {
  const path = [];
  const dx = dest.x - agent.x;
  const dz = dest.z - agent.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 2.2) {
    const nx = -dz / dist;
    const nz = dx / dist;
    const bend = ((hash(agent.id + ':' + Math.round(dest.x * 4)) % 5) - 2) * 0.35;
    path.push({
      x: clamp((agent.x + dest.x) / 2 + nx * bend, HUT.x0 + 0.7, HUT.x1 - 0.7),
      z: clamp((agent.z + dest.z) / 2 + nz * bend, HUT.z0 + 0.7, HUT.z1 - 0.5)
    });
  }
  path.push({ x: dest.x, z: dest.z });
  return path;
}

function pickWander(agent, preferNear) {
  const spots = agent.zone.spots;
  const social = spots.filter((s) => s.kind);
  const floorSpots = spots.filter((s) => !s.kind);
  let spot = null;
  if (preferNear) {
    const nearby = spots.filter((s) => {
      const d = Math.hypot(s.x - agent.x, s.z - agent.z);
      return d > 0.35 && d < 2.4 && !spotCrowded(agent, s);
    });
    if (nearby.length) spot = nearby[(Math.random() * nearby.length) | 0];
  }
  if (!spot && social.length && Math.random() < 0.4) {
    for (let i = 0; i < 5; i++) {
      const s = social[(Math.random() * social.length) | 0];
      if (Math.hypot(s.x - agent.x, s.z - agent.z) < 0.8) continue;
      if (!spotCrowded(agent, s)) { spot = s; break; }
    }
  }
  if (!spot) {
    const pool = floorSpots.length ? floorSpots : spots;
    const far = pool.filter((s) => s !== agent.spot && Math.hypot(s.x - agent.x, s.z - agent.z) > 1.6);
    const bag = far.length ? far : pool;
    spot = bag[(Math.random() * bag.length) | 0];
    for (let i = 0; i < 8; i++) {
      const c = bag[(Math.random() * bag.length) | 0];
      spot = c;
      if (!spotCrowded(agent, c)) break;
    }
  }
  agent.spot = spot;
  agent.path = route(agent, spot);
  agent.settled = false;
  agent.dwell = spot.kind === 'kettle' ? 5 + Math.random() * 5 : 2.8 + Math.random() * 3.5;
  agent.destKey = 'wander:' + spot.x.toFixed(1);
}

function assignMeetings() {
  const collab = agents.filter((a) => a.state === 'collaborating');
  const parent = new Map(collab.map((a) => [a.id, a.id]));
  function find(id) {
    let p = parent.get(id);
    if (p == null) return id;
    while (parent.get(p) !== p) {
      parent.set(p, parent.get(parent.get(p)));
      p = parent.get(p);
    }
    return p;
  }
  function union(a, b) {
    if (!parent.has(a) || !parent.has(b)) return;
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent.set(pa, pb);
  }
  collab.forEach((a) => (a.with || []).forEach((id) => union(a.id, id)));
  const groups = new Map();
  collab.forEach((a) => {
    const p = find(a.id);
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push(a);
  });
  groups.forEach((group) => {
    const teams = new Set(group.map((a) => a.team));
    const table = teams.size > 1 ? sharedTable : group[0].zone.table;
    if (group.length === 2) {
      group[0].meet = { x: table.x - 0.7, z: table.z + 0.15 };
      group[1].meet = { x: table.x + 0.7, z: table.z + 0.15 };
    } else {
      group.forEach((a, i) => {
        const ang = -Math.PI / 2 + (i / group.length) * Math.PI * 2;
        a.meet = { x: table.x + Math.cos(ang) * 0.9, z: table.z + Math.sin(ang) * 0.7 };
      });
    }
    group.forEach((a) => {
      a.meet.x = clamp(a.meet.x, HUT.x0 + 0.6, HUT.x1 - 0.6);
      a.meet.z = clamp(a.meet.z, HUT.z0 + 0.6, HUT.z1 - 0.4);
    });
  });
}

function retarget(agent) {
  let dest;
  if (agent.state === 'working' || agent.state === 'offline') dest = { x: agent.deskX, z: agent.deskZ };
  else if (agent.state === 'collaborating') dest = agent.meet || { x: agent.zone.table.x, z: agent.zone.table.z };
  else return;
  const key = dest.x.toFixed(2) + ',' + dest.z.toFixed(2);
  if (agent.destKey === key) return;
  agent.destKey = key;
  agent.path = route(agent, dest);
  agent.settled = false;
}

function follow(agent, dt) {
  const speed = agent.state === 'idle' ? agent.speed * 0.9 : agent.speed;
  if (!agent.path || !agent.path.length) {
    agent.walking = false;
    agent.settled = true;
    return;
  }
  const p = agent.path[0];
  const dx = p.x - agent.x;
  const dz = p.z - agent.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.06) {
    agent.x = p.x;
    agent.z = p.z;
    agent.path.shift();
    agent.walking = agent.path.length > 0;
    agent.settled = agent.path.length === 0;
    return;
  }
  const step = Math.min(dist, speed * dt);
  agent.x += (dx / dist) * step;
  agent.z += (dz / dist) * step;
  agent.heading = Math.atan2(dx, dz);
  agent.walking = true;
  agent.settled = false;
}

function separate() {
  const min = 0.72;
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i];
      const b = agents[j];
      if (a.settled && b.settled) continue;
      let dx = b.x - a.x;
      let dz = b.z - a.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min || d2 < 0.0001) continue;
      const d = Math.sqrt(d2);
      const push = (min - d) * 0.45;
      dx /= d;
      dz /= d;
      if (!a.settled) { a.x -= dx * push; a.z -= dz * push; }
      if (!b.settled) { b.x += dx * push; b.z += dz * push; }
    }
  }
}

function drawAgent(agent, dt) {
  agent.x = clamp(agent.x, HUT.x0 + 0.55, HUT.x1 - 0.55);
  agent.z = clamp(agent.z, HUT.z0 + 0.55, HUT.z1 - 0.35);
  const sitting = agent.settled && !agent.walking && (agent.state === 'working' || agent.state === 'offline');
  const typing = agent.settled && !agent.walking && agent.state === 'working';
  agent.root.position.set(agent.x, FLOOR, agent.z);
  let face = agent.heading;
  if (sitting || (agent.settled && agent.state === 'collaborating')) face = 0;
  let turn = face - agent.root.rotation.y;
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  agent.root.rotation.y += turn * Math.min(1, dt * 8);
  if (agent.walking) {
    agent.phase += dt * 8;
    const s = Math.sin(agent.phase);
    agent.legL.rotation.x = s * 0.7;
    agent.legR.rotation.x = -s * 0.7;
    agent.armL.rotation.x = -s * 0.55;
    agent.armR.rotation.x = s * 0.55;
    agent.rig.position.y = Math.abs(s) * 0.04;
  } else if (sitting) {
    agent.legL.rotation.x = -1.15;
    agent.legR.rotation.x = -1.15;
    agent.rig.position.y = -0.18;
    const tap = typing ? Math.sin(elapsed * 14 + agent.phase) * 0.22 : 0;
    agent.armL.rotation.x = -0.85 + tap;
    agent.armR.rotation.x = -0.85 - tap;
  } else {
    agent.legL.rotation.x = 0;
    agent.legR.rotation.x = 0;
    agent.armL.rotation.x = 0;
    agent.armR.rotation.x = 0;
    agent.rig.position.y = Math.sin(elapsed * 1.6 + agent.phase) * 0.015;
  }
  agent.face.material.opacity = agent.state === 'offline' ? 0.45 : 1;
  if (agent._state !== agent.state) {
    agent._state = agent.state;
    agent.label.st.textContent = STATE_LABEL[agent.state] || 'Idle';
    agent.label.st.className = 'st ' + agent.state;
  }
  let text = '';
  if (agent.state === 'working' || agent.state === 'collaborating') {
    text = agent.task || (agent.state === 'collaborating' ? 'Working together' : '');
  }
  if (agent._bubble !== text) {
    agent._bubble = text;
    agent.label.bubble.hidden = !text;
    agent.label.bubble.textContent = text;
  }
  agent._on = typing;
}

function stepAgents(dt) {
  for (const agent of agents) {
    if (agent.state === 'idle') {
      if (agent.mode !== 'idle') {
        agent.mode = 'idle';
        agent.destKey = '';
        pickWander(agent, true);
      } else if (agent.settled) {
        agent.dwell -= dt;
        if (agent.dwell <= 0) {
          if (countIdleWalking() < 7) pickWander(agent, false);
          else agent.dwell = 0.4 + Math.random() * 0.8;
        }
      }
    } else {
      if (agent.mode !== agent.state) {
        agent.mode = agent.state;
        agent.destKey = '';
      }
      retarget(agent);
    }
    follow(agent, dt);
  }
  separate();
  for (const agent of agents) drawAgent(agent, dt);
  syncInstances();
  renderLinks();
}

function renderLinks() {
  const want = [];
  const seen = new Set();
  agents.forEach((a) => {
    if (a.state !== 'collaborating') return;
    (a.with || []).forEach((id) => {
      const b = byId.get(id);
      if (!b || b.state !== 'collaborating') return;
      const key = a.id < id ? a.id + '|' + id : id + '|' + a.id;
      if (seen.has(key)) return;
      seen.add(key);
      want.push([a, b]);
    });
  });
  while (links.length < want.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe7b0 }));
    line.frustumCulled = false;
    scene.add(line);
    links.push(line);
  }
  links.forEach((line, i) => {
    const pair = want[i];
    line.visible = !!pair;
    if (!pair) return;
    const pos = line.geometry.attributes.position.array;
    pos[0] = pair[0].x;
    pos[1] = FLOOR + 1.05;
    pos[2] = pair[0].z;
    pos[3] = pair[1].x;
    pos[4] = FLOOR + 1.05;
    pos[5] = pair[1].z;
    line.geometry.attributes.position.needsUpdate = true;
  });
}

function separateLabels() {
  const nodes = [...document.querySelectorAll('.tag')];
  nodes.forEach((el) => {
    const nudge = el.querySelector('.nudge');
    if (nudge) nudge.style.transform = 'none';
  });
  nodes.forEach((el) => {
    const nm = el.querySelector('.nm');
    const plate = el.querySelector('.plate');
    if (!nm || !plate || nm.dataset.fit) return;
    nm.dataset.fit = '1';
    const max = Math.max(48, plate.clientWidth - 2);
    if (nm.scrollWidth > max) nm.style.transform = 'scaleX(' + Math.max(0.62, max / nm.scrollWidth).toFixed(3) + ')';
  });
  const gap = 4;
  const placed = [];
  document.querySelectorAll('.zone-title').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 2) placed.push({ x: r.left - 4, y: r.top - 2, w: r.width + 8, h: r.height + 4 });
  });
  const items = [];
  const header = 66;
  const footer = window.innerHeight - 54;
  nodes.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2) return;
    items.push({ nudge: el.querySelector('.nudge'), ax: r.left, ay: r.top, w: r.width, h: r.height });
  });
  items.sort((a, b) => (a.ay - b.ay) || (a.ax - b.ax));
  const hits = (it, ox, oy) => {
    const x = it.ax + ox;
    const y = it.ay + oy;
    if (y < header || y + it.h > footer) return true;
    for (let i = 0; i < placed.length; i++) {
      const p = placed[i];
      if (x < p.x + p.w + gap && x + it.w + gap > p.x && y < p.y + p.h + gap && y + it.h + gap > p.y) return true;
    }
    return false;
  };
  let overlaps = 0;
  for (const it of items) {
    let ox = 0;
    let oy = 0;
    if (hits(it, 0, 0)) {
      let found = false;
      const stepY = Math.max(8, it.h * 0.55);
      for (let step = 1; step <= 18 && !found; step++) {
        const tries = [
          [0, -step * stepY],
          [0, step * (it.h * 0.45)],
          [step * 14, -step * stepY],
          [-step * 14, -step * stepY]
        ];
        for (const [dx, dy] of tries) {
          if (!hits(it, dx, dy)) {
            ox = dx;
            oy = dy;
            found = true;
            break;
          }
        }
      }
      if (!found) overlaps += 1;
    }
    it.nudge.style.transform = 'translate(' + ox.toFixed(1) + 'px,' + oy.toFixed(1) + 'px)';
    placed.push({ x: it.ax + ox, y: it.ay + oy, w: it.w, h: it.h });
  }
  window.__overlaps = overlaps;
}

function stepCritters(dt, t) {
  for (const h of horses) {
    if (Math.abs(h.tx - h.x) < 0.08) {
      h.wait -= dt;
      if (h.wait <= 0) {
        h.tx = h.minX + Math.random() * (h.maxX - h.minX);
        h.z = h.z0 + Math.random() * (h.z1 - h.z0);
        h.wait = 4 + Math.random() * 7;
      }
      h.legs.forEach((leg) => { leg.rotation.x *= 0.8; });
    } else {
      const dir = Math.sign(h.tx - h.x);
      h.x += dir * h.speed * dt;
      h.mesh.rotation.y = dir > 0 ? 0 : Math.PI;
      const s = Math.sin(t * 6);
      h.legs[0].rotation.x = s * 0.4;
      h.legs[1].rotation.x = -s * 0.4;
      h.legs[2].rotation.x = -s * 0.4;
      h.legs[3].rotation.x = s * 0.4;
    }
    h.mesh.position.x = h.x;
    h.mesh.position.z = h.z;
  }
  for (const p of poodles) {
    const target = p.points[p.i];
    const dx = target.x - p.mesh.position.x;
    const dz = target.z - p.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.08) p.i = (p.i + 1) % p.points.length;
    else {
      p.mesh.position.x += (dx / dist) * p.speed * dt;
      p.mesh.position.z += (dz / dist) * p.speed * dt;
      p.mesh.rotation.y = Math.atan2(dx, dz) - Math.PI / 2;
    }
    p.mesh.position.y = Math.abs(Math.sin(t * 10 + p.i)) * 0.05;
  }
  const pond = { x: -22.5, z: 6.2, rx: 2.3, rz: 1.5 };
  for (const d of ducks) {
    d.angle += d.speed * dt;
    d.mesh.position.x = pond.x + Math.cos(d.angle) * pond.rx;
    d.mesh.position.z = pond.z + Math.sin(d.angle) * pond.rz;
    d.mesh.position.y = 0.02 + Math.sin(t * 3 + d.angle) * 0.02;
    d.mesh.rotation.y = d.angle + Math.PI / 2;
  }
  for (const c of chickens) {
    if (c.moving) {
      const dx = c.tx - c.x;
      const dz = c.tz - c.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.05) {
        c.moving = false;
        c.wait = 0.6 + Math.random() * 2;
      } else {
        c.x += (dx / dist) * c.speed * dt;
        c.z += (dz / dist) * c.speed * dt;
        c.mesh.rotation.y = Math.atan2(dx, dz);
      }
    } else {
      c.wait -= dt;
      c.head.rotation.x = Math.sin(t * 3 + c.peck) > 0.65 ? 0.6 : 0;
      if (c.wait <= 0) {
        c.tx = c.minX + Math.random() * (c.maxX - c.minX);
        c.tz = c.minZ + Math.random() * (c.maxZ - c.minZ);
        c.moving = true;
      }
    }
    c.mesh.position.x = c.x;
    c.mesh.position.z = c.z;
  }
  if (wizard) {
    const cycle = t % 18;
    const driving = cycle > 7;
    const u = driving ? (cycle - 7) / 11 : 0;
    const x = driving ? wizard.driveMin + Math.sin(u * Math.PI) * (wizard.driveMax - wizard.driveMin) : wizard.digX;
    wizard.digger.position.x = x;
    wizard.digger.position.z = wizard.z;
    wizard.boom.rotation.x = driving ? Math.sin(t * 3) * 0.35 : Math.sin(t * 2.2) * 0.15;
    wizard.bucket.rotation.x = driving ? Math.sin(t * 3) * 0.5 : 0;
    if (driving) {
      wizard.mage.position.set(x, 0.35, wizard.z - 0.15);
      wizard.spade.visible = false;
    } else {
      wizard.mage.position.set(wizard.digX - 0.7, 0, wizard.z - 0.2);
      wizard.spade.visible = true;
      wizard.spade.rotation.z = Math.sin(t * 4) * 0.5;
    }
    wizard.mage.rotation.y = driving ? Math.PI / 2 : 0.4;
  }
  for (const cloud of clouds) {
    cloud.position.x += dt * 0.35;
    if (cloud.position.x > 36) cloud.position.x = -36;
  }
}

function londonParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
  }).formatToParts(date);
  const get = (type) => {
    const p = parts.find((x) => x.type === type);
    return p ? p.value : '';
  };
  let hour = Number(get('hour'));
  if (!isFinite(hour)) hour = 12;
  hour = ((hour % 24) + 24) % 24;
  return { hour, minute: Number(get('minute')) || 0, label: (get('weekday') + ' ' + get('day') + ' ' + get('month')).replace(/,/g, '') };
}
function londonTime(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).format(date);
}
function londonShort(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(d);
}
function skyPhase(hour) {
  if (hour >= 20 || hour < 5) return 'night';
  if (hour < 8) return 'dawn';
  if (hour >= 17) return 'dusk';
  return 'day';
}
function updateSky(parts) {
  const phase = SKY_LOCK || skyPhase(parts.hour);
  const lookSky = SKY[phase];
  scene.background.set(lookSky.bg);
  scene.fog.color.set(lookSky.fog);
  hemi.color.set(lookSky.sky);
  hemi.groundColor.set(lookSky.ground);
  hemi.intensity = lookSky.hemi;
  dir.color.set(lookSky.sun);
  dir.intensity = lookSky.dir;
  renderer.toneMappingExposure = lookSky.exp;
  const night = phase === 'night';
  sun.visible = !night;
  moon.visible = night;
  stars.visible = night;
  const t = parts.hour + parts.minute / 60;
  const arc = night ? ((t >= 20 ? t - 20 : t + 4) / 9) : (t - 5) / 16;
  const u = clamp(arc, 0.05, 0.95);
  const elev = Math.sin(u * Math.PI);
  const body = night ? moon : sun;
  body.position.set(-18 + u * 40, 8 + elev * 18, -12);
  if (phase === 'dawn') dir.position.set(-12, 10, 16);
  else if (phase === 'dusk') dir.position.set(24, 8, 10);
  else if (phase === 'night') dir.position.set(-8, 16, -6);
  else dir.position.set(18, 26, 14);
  glow.forEach((m) => m.color.set(night ? 0xffc56e : phase === 'dusk' ? 0xffb07a : 0xd7f1fb));
  clouds.forEach((c) => { c.visible = phase !== 'night'; });
}
function tickClock() {
  const now = new Date();
  const parts = londonParts(now);
  clockEl.textContent = parts.label + '  ·  ' + londonTime(now);
  if (parts.minute !== lastMinute) {
    lastMinute = parts.minute;
    updateSky(parts);
  }
}
function setFeed(mode) {
  feedEl.className = 'feed' + (mode && mode !== 'live' ? ' ' + mode : '');
  feedEl.textContent = mode === 'demo' ? 'Demo' : mode === 'error' ? 'No feed' : 'Live';
}
function updateCounts() {
  const c = { working: 0, idle: 0, collaborating: 0, offline: 0 };
  agents.forEach((a) => { if (c[a.state] != null) c[a.state] += 1; else c.idle += 1; });
  countsEl.replaceChildren();
  [['working', c.working, 'working'], ['idle', c.idle, 'idle'], ['collaborating', c.collaborating, 'together'], ['offline', c.offline, 'offline']].forEach((row) => {
    const el = document.createElement('span');
    el.className = 'count ' + row[0];
    const dot = document.createElement('i');
    el.append(dot, document.createTextNode(row[1] + ' ' + row[2]));
    countsEl.appendChild(el);
  });
}
function historyLabel(entry) {
  const bot = byId.get(entry.id);
  const name = bot ? bot.name : entry.id;
  const when = londonShort(entry.at);
  let how = entry.state || 'idle';
  if (entry.state === 'collaborating') {
    const names = (entry.with || []).map((id) => (byId.get(id) ? byId.get(id).name : id));
    how = names.length ? 'together with ' + names.join(', ') : 'together';
  }
  const task = entry.task ? '  ·  ' + entry.task : '';
  return (when ? when + '  ' : '') + name + '  ' + how + task;
}
function renderTicker(entries) {
  let items = (entries || []).slice(0, 5).map(historyLabel);
  if (!items.length) items = ['Quiet in the hut — waiting for a status change'];
  const twice = items.concat(items);
  tickerTrack.replaceChildren();
  twice.forEach((text) => {
    const s = document.createElement('span');
    s.className = 'tick';
    s.textContent = text;
    tickerTrack.appendChild(s);
  });
}
function asIds(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return value.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}
function effective(entry) {
  if (!entry) return { state: 'idle', task: '', with: [] };
  let state = String(entry.state || 'idle');
  if (!['working', 'idle', 'collaborating', 'offline'].includes(state)) state = 'idle';
  const updated = Date.parse(entry.updated_at || entry.at || '');
  const stale = !isFinite(updated) || (Date.now() - updated > STALE_MS);
  if (stale && state !== 'offline') return { state: 'idle', task: '', with: [] };
  const task = String(entry.task || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return { state, task, with: asIds(entry.with) };
}
function pulse(agent) {
  agent.label.el.classList.remove('flash');
  void agent.label.el.offsetWidth;
  agent.label.el.classList.add('flash');
}
function applyStatus(data, opts = {}) {
  const list = Array.isArray(data) ? data : ((data && data.bots) || []);
  const entries = new Map();
  list.forEach((entry) => { if (entry && entry.id) entries.set(entry.id, entry); });
  agents.forEach((agent) => {
    const eff = effective(entries.get(agent.id));
    const withIds = eff.with.filter((id) => byId.has(id) && id !== agent.id);
    const sig = eff.state + '|' + eff.task + '|' + withIds.join(',');
    const changed = agent.sig && agent.sig !== sig;
    agent.state = eff.state;
    agent.task = eff.task;
    agent.with = withIds;
    agent.sig = sig;
    if (opts.force || changed) agent.mode = '';
    if (opts.flash && changed) pulse(agent);
  });
  assignMeetings();
  updateCounts();
  const history = Array.isArray(data) ? [] : ((data && data.history) || []);
  renderTicker(history.slice(-5).reverse());
}
function seedDemo() {
  agents.forEach((a) => {
    a.state = 'idle';
    a.task = '';
    a.with = [];
    a.mode = '';
    a.sig = '';
    a.destKey = '';
  });
  const set = (id, state, task, withIds) => {
    const a = byId.get(id);
    if (!a) return;
    a.state = state;
    a.task = task || '';
    a.with = withIds || [];
  };
  set('kelvin', 'working', 'Weekly SEO check');
  set('eden', 'collaborating', 'Morning standup', ['grace']);
  set('grace', 'collaborating', 'Morning standup', ['eden']);
  set('merlin', 'working', 'Market open scan');
  set('amber', 'working', 'Inbox sweep');
  set('scout', 'working', 'Overnight digest');
  set('phoenix', 'working', 'Front desk cover');
  set('sr-planner-agent', 'offline', 'Parked');
  const now = Date.now();
  demoHistory = [
    { id: 'amber', state: 'working', task: 'Inbox sweep', with: [], at: new Date(now - 8 * 60000).toISOString() },
    { id: 'scout', state: 'working', task: 'Overnight digest', with: [], at: new Date(now - 6 * 60000).toISOString() },
    { id: 'merlin', state: 'working', task: 'Market open scan', with: [], at: new Date(now - 4 * 60000).toISOString() },
    { id: 'eden', state: 'collaborating', task: 'Morning standup', with: ['grace'], at: new Date(now - 2 * 60000).toISOString() },
    { id: 'kelvin', state: 'working', task: 'Weekly SEO check', with: [], at: new Date(now).toISOString() }
  ];
  assignMeetings();
  updateCounts();
  renderTicker(demoHistory.slice(-5).reverse());
}
function demoTick() {
  const pool = agents.filter((a) => a.id !== 'sr-planner-agent');
  const picks = pool.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  const now = new Date().toISOString();
  picks.forEach((a) => {
    const roll = Math.random();
    if (roll < 0.5) {
      a.state = 'working';
      a.task = pick(DEMO_TASKS);
      a.with = [];
    } else if (roll < 0.78) {
      const mates = pool.filter((b) => b !== a && b.team === a.team);
      const m = mates.length ? mates[(Math.random() * mates.length) | 0] : null;
      const task = pick(['Morning standup', 'Desk huddle', 'Handover', 'Review notes']);
      a.state = 'collaborating';
      a.task = task;
      a.with = m ? [m.id] : [];
      if (m) {
        m.state = 'collaborating';
        m.task = task;
        m.with = [a.id];
        m.mode = '';
        demoHistory.push({ id: m.id, state: 'collaborating', task, with: m.with.slice(), at: now });
      }
    } else if (roll < 0.92) {
      a.state = 'idle';
      a.task = '';
      a.with = [];
    } else {
      a.state = 'offline';
      a.task = '';
      a.with = [];
    }
    a.mode = '';
    demoHistory.push({ id: a.id, state: a.state, task: a.task, with: (a.with || []).slice(), at: now });
    pulse(a);
  });
  const planner = byId.get('sr-planner-agent');
  if (planner && planner.state !== 'offline') {
    planner.state = 'offline';
    planner.task = 'Parked';
    planner.with = [];
    planner.mode = '';
  }
  if (demoHistory.length > 20) demoHistory.splice(0, demoHistory.length - 20);
  assignMeetings();
  updateCounts();
  renderTicker(demoHistory.slice(-5).reverse());
}
function normalizeBots(raw) {
  const seen = new Set();
  const list = [];
  (raw || []).forEach((bot) => {
    if (!bot || !bot.id || seen.has(bot.id)) return;
    seen.add(String(bot.id));
    list.push({
      id: String(bot.id),
      name: String(bot.name || bot.id),
      emoji: String(bot.emoji || '🤖'),
      team: String(bot.team || 'grok').trim().toLowerCase(),
      role: String(bot.role || '')
    });
  });
  return list;
}
function showFatal(msg) {
  const d = document.createElement('div');
  d.className = 'fatal';
  d.innerHTML = msg + ' <a href="2d/">Open the 2D view</a>.';
  document.body.appendChild(d);
}
async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(url + ' ' + res.status);
  return res.json();
}
async function load() {
  let bots;
  try {
    bots = normalizeBots(await fetchJson('data/bots.json?ts=' + Date.now()));
  } catch (err) {
    showFatal('Could not load the bot list.');
    return;
  }
  if (!bots.length) {
    showFatal('The bot list is empty.');
    return;
  }
  botSig = JSON.stringify(bots);
  if (!DEMO) {
    try {
      lastStatus = await fetchJson('status.json?ts=' + Date.now());
      setFeed('live');
    } catch (err) {
      lastStatus = null;
      setFeed('error');
    }
  }
  mount(bots);
  if (DEMO) {
    document.getElementById('demo-flag').hidden = false;
    setFeed('demo');
    seedDemo();
    setInterval(demoTick, 10000);
  } else if (lastStatus) applyStatus(lastStatus, { force: true, flash: false });
  else {
    updateCounts();
    renderTicker([]);
  }
  setInterval(refresh, POLL_MS);
}
async function refresh() {
  try {
    const bots = normalizeBots(await fetchJson('data/bots.json?ts=' + Date.now()));
    const sig = JSON.stringify(bots);
    if (sig !== botSig && bots.length) {
      botSig = sig;
      mount(bots);
      if (DEMO) seedDemo();
      else if (lastStatus) applyStatus(lastStatus, { force: true, flash: false });
    }
  } catch (err) { /* keep the roster */ }
  if (DEMO) return;
  try {
    lastStatus = await fetchJson('status.json?ts=' + Date.now());
    applyStatus(lastStatus, { flash: true });
    setFeed('live');
  } catch (err) {
    setFeed('error');
  }
}

function buildClouds() {
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const puff = new THREE.SphereGeometry(1, 8, 6);
  for (const [x, y, z, s] of [[-8, 14, -8, 1.4], [6, 16, 2, 1.1], [-20, 13, 6, 0.9], [14, 15, -6, 1.2]]) {
    const g = new THREE.Group();
    [[0, 0, 0, 1], [1.2, 0.2, 0.1, 0.7], [-1, 0.15, 0.2, 0.62], [0.4, 0.35, -0.2, 0.5]].forEach(([dx, dy, dz, r]) => {
      const m = new THREE.Mesh(puff, cloudMat);
      m.position.set(dx, dy, dz);
      m.scale.setScalar(r);
      g.add(m);
    });
    g.position.set(x, y, z);
    g.scale.setScalar(s);
    scene.add(g);
    clouds.push(g);
  }
}

function buildStars() {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(90 * 3);
  for (let i = 0; i < 90; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = 0.15 + Math.random() * 1.1;
    const r = 50 + Math.random() * 20;
    pos[i * 3] = Math.cos(th) * Math.cos(ph) * r;
    pos[i * 3 + 1] = 8 + Math.sin(ph) * 28;
    pos[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * r;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.45, sizeAttenuation: true }));
  stars.visible = false;
  scene.add(stars);
}
let stars = null;

function bindUi() {
  fullBtn.addEventListener('click', toggleFull);
  document.addEventListener('dblclick', toggleFull);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') toggleFull();
  });
  let cursorTimer = 0;
  const poke = () => {
    document.body.classList.remove('hide-cursor');
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(() => document.body.classList.add('hide-cursor'), 4000);
  };
  document.addEventListener('mousemove', poke, { passive: true });
  document.addEventListener('mousedown', poke, { passive: true });
  poke();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !DEMO) refresh();
  });
}
function isFull() { return document.fullscreenElement || document.webkitFullscreenElement; }
function toggleFull() {
  if (isFull()) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) exit.call(document);
  } else {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) req.call(el);
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  elapsed += dt;
  if (DEBUG) {
    frames += 1;
    if (now - fpsStamp > 1000) {
      fpsEl.hidden = false;
      fpsEl.textContent = frames + ' fps';
      frames = 0;
      fpsStamp = now;
    }
  }
  stepCritters(dt, elapsed);
  if (agents.length) {
    try {
      stepAgents(dt);
    } catch (err) {
      if (!window.__stepErr) {
        window.__stepErr = String(err && err.stack || err);
        console.error(err);
      }
    }
  }
  placeCamera(params.has('still') ? 0 : elapsed);
  renderer.render(scene, camera);
  window.__draws = renderer.info.render.calls;
  labelRenderer.render(scene, camera);
  if (agents.length) separateLabels();
  requestAnimationFrame(frame);
}

function boot() {
  buildHut();
  barnAndStables();
  buildVehicles();
  buildCritters();
  buildClouds();
  buildStars();
  const parts = londonParts(new Date());
  lastMinute = parts.minute;
  updateSky(parts);
  tickClock();
  setInterval(tickClock, 1000);
  bindUi();
  requestAnimationFrame(frame);
  load();
  window.__office = {
    booted: true,
    agents: () => agents,
    counts: () => ({
      actors: agents.length,
      ducks: ducks.length,
      horses: horses.length,
      poodles: poodles.length,
      chickens: chickens.length,
      wizards: wizard ? 1 : 0,
      nearVans: nearCaravans,
      farVans: farCaravans,
      brands: brands.slice(),
      zones: zoneTitles.length
    })
  };
}

try {
  boot();
} catch (err) {
  showFatal('The 3D office hit a problem.');
  console.error(err);
}
