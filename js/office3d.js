/* SR Bot Office — warm low-poly room for the office TV.
   Walk poses, flat desks and the toy rig are adapted from agent-office-3d
   (c) 2026 Jeffery Sha, MIT.
   Collaborators carry a handoff to the lead office, the way Hermes3D
   (c) 2026 Luke The Dev, MIT) sends people into a meeting — routed on a
   waypoint graph instead of that project's stair nav.
   Carpet zones and wood use the hermes-virtual-office material approach
   (c) 2026 Hermes Virtual Office Contributors, MIT).
   Licence texts: third_party/. Three.js (MIT) loads from jsDelivr.
   The flat fallback at /2d/ is separate and untouched.
   Status is read from status.json. Nothing in this file writes status. */
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import {
  HIP_STAND, HIP_SIT, lambert, basic, woodTexture, labelMaterial, sharpen,
  screenTexture, drawScreen, makeRig, workstationGeos, badgeGeos, shinGeo, foreGeo, batch
} from './kit.js';
import { buildYard, stepYard } from './yard.js';

const STALE_MS = 10 * 60 * 1000;
const POLL_MS = 45000;
const FY = 0.08;

const DEPT = {
  kelvin: 'lead',
  sre: 'web', srs: 'web', src: 'web', reload: 'web', 'website-seo': 'web', 'seo-aeo': 'web',
  'stews-pa': 'office', eden: 'office', grace: 'office',
  phoenix: 'jobs', amber: 'jobs', vera: 'jobs',
  'sr-job-agent': 'jobs', 'sr-notes-agent': 'jobs', 'sr-eicr-agent': 'jobs',
  'sr-invoice-agent': 'jobs', 'sr-billing-checker': 'jobs', 'sr-planner-agent': 'jobs',
  'sr-oracle-agent': 'jobs', 'sr-tech-support-agent': 'jobs', seren: 'jobs',
  merlin: 'money', 'cash-desk': 'money', ledger: 'money', chief: 'money',
  'vat-desk': 'money', forge: 'money', cfo: 'money',
  cipher: 'research', atlas: 'research', scout: 'research', tide: 'research',
  'grok-bot-choices': 'study', challenge: 'study', pulse: 'study', '18th-edition': 'study',
  'disk-saver-1': 'house', 'disk-saver-2': 'house'
};
const ACCESSORY = {
  lead: 'star', web: 'monitor', office: 'phone', jobs: 'clip',
  money: 'coin', research: 'mag', study: 'book', house: 'duster'
};
const PALETTE = {
  lead: [0xf26b4a],
  web: [0x6c63ff, 0x4c6fff, 0x7a5af8, 0x5b8def, 0x8b7cf6, 0x3d4fd6],
  office: [0x2aa7b8, 0x3dbea0, 0x1f8a9a],
  jobs: [0xf08a2a, 0xe06a3a, 0xf0b03a, 0xd4654a, 0xe8943a, 0xc46b3a, 0xf2a15a, 0xb85a38, 0xe07a55, 0xd98a4a, 0xc47a4a, 0xe0a060],
  money: [0x3cbe6e, 0x2f9e5a, 0x6dce4a, 0x1f8a4e, 0x49b86a, 0x2e8f5a, 0x7ed957],
  research: [0x3ec6e0, 0x4aa3e8, 0x2fbfc4, 0x5b7cfa],
  study: [0xf0c14e, 0xe0b03a, 0xf2d36a, 0xd4a24a],
  house: [0x8a9a4a, 0x6d7a3e]
};
const DEPT_NAME = {
  lead: 'Lead',
  web: 'Websites / SEO / Social',
  office: 'Office & Phones',
  jobs: 'Jobs',
  money: 'Money',
  research: 'Research',
  study: 'Study',
  house: 'Housekeeping'
};
const ORDER = ['lead', 'web', 'office', 'jobs', 'money', 'research', 'study', 'house'];
const STATE_WORD = { working: 'Working', idle: 'Idle', collaborating: 'Together', offline: 'Offline' };
const SIM_TASKS = [
  'Weekly SEO check', 'Inbox tidy', 'Call notes', 'Diary skim', 'Market scan',
  'Backtest review', 'Macro notes', 'Keyword pass', 'Site check', 'Desk research',
  'Statement run', 'Job notes', 'Cert booking', 'Risk scan', 'Overnight digest'
];
const ON_COLORS = [0x46e08a, 0x3ec6e0, 0x8fd46a, 0x5b9bff];
const BADGE_COLOR = {
  monitor: 0x39c6e0, phone: 0x22262c, clip: 0xf2e2c4, coin: 0xe2b340,
  mag: 0xd8dde3, book: 0x243a6b, duster: 0xf0d36a, star: 0xf0c14e
};

const ZONE_DEFS = [
  { id: 'lead', title: 'LEAD', color: 0x2a3348, x0: -11.55, x1: -7.15, z0: -7.75, z1: -3.65, lx: -9.35, lz: -4.3, lw: 2.5, ld: 0.7 },
  { id: 'web', title: 'WEBSITES · SEO · SOCIAL', color: 0x5b4ec4, x0: -6.55, x1: 4.85, z0: -7.75, z1: -3.65, lx: -0.85, lz: -4.55, lw: 6.6, ld: 0.85 },
  { id: 'research', title: 'RESEARCH', color: 0x3a74c4, x0: 5.45, x1: 11.55, z0: -7.75, z1: -3.65, lx: 8.15, lz: -4.55, lw: 3.3, ld: 0.8 },
  { id: 'office', title: 'OFFICE & PHONES', color: 0x2c7f90, x0: -11.55, x1: -7.15, z0: -3.05, z1: 2.25, lx: -9.35, lz: 0.2, lw: 3.2, ld: 0.75 },
  { id: 'money', title: 'MONEY', color: 0x2e9a58, x0: 5.45, x1: 11.55, z0: -3.05, z1: 2.25, lx: 8.5, lz: 0.9, lw: 3.1, ld: 0.8 },
  { id: 'study', title: 'STUDY', color: 0xc48a3a, x0: -11.55, x1: -7.15, z0: 2.85, z1: 8.15, lx: -9.35, lz: 6.6, lw: 2.6, ld: 0.75 },
  { id: 'house', title: 'HOUSEKEEPING', color: 0x7c8a42, x0: -6.55, x1: -2.35, z0: 2.85, z1: 8.15, lx: -4.45, lz: 6.4, lw: 3.3, ld: 0.72 },
  { id: 'jobs', title: 'JOBS', color: 0xd07a32, x0: -1.75, x1: 11.55, z0: 2.85, z1: 8.15, lx: 4.9, lz: 6.75, lw: 3.4, ld: 0.8 }
];
const LOUNGE = { x: -0.85, z: -0.4, disc: 1.55, r1: 2.35, r2: 2.9 };
const HAND_SPOTS = [
  { x: -11.05, z: -3.35 }, { x: -10.25, z: -3.35 }, { x: -9.45, z: -3.35 },
  { x: -8.65, z: -3.35 }, { x: -7.85, z: -3.35 },
  { x: -6.85, z: -2.5 }, { x: -6.85, z: -1.6 }, { x: -6.85, z: -0.7 }
];
const KELVIN_FOCUS = { x: -9.35, z: -6.4 };
const SKY = {
  night: { bg: 0x12182c, fog: 0x12182c, sky: 0x243456, ground: 0x1a140e, sun: 0x9aafd0, dir: 0.22, hemi: 0.28, fill: 0.08, interior: 1.55 },
  dawn: { bg: 0xf0b48a, fog: 0xe7b090, sky: 0xffc9a4, ground: 0x6a5038, sun: 0xffc090, dir: 0.7, hemi: 0.55, fill: 0.28, interior: 0.25 },
  day: { bg: 0x8ec8ef, fog: 0x9ec8ea, sky: 0xfff6ea, ground: 0xc4a07a, sun: 0xfff4dd, dir: 0.78, hemi: 0.95, fill: 0.38, interior: 0.12 },
  dusk: { bg: 0xe07a4a, fog: 0xd88860, sky: 0xf0a070, ground: 0x5a4030, sun: 0xffb070, dir: 0.55, hemi: 0.48, fill: 0.22, interior: 0.45 }
};

const params = new URLSearchParams(location.search);
let simulating = params.get('simulate') === '1' || params.get('simulate') === 'true' || params.get('demo') === '1' || params.get('demo') === 'true';
let skyLock = params.get('sky');
if (skyLock === 'evening') skyLock = 'dusk';
if (!['night', 'dawn', 'day', 'dusk'].includes(skyLock)) skyLock = null;
const SHOW_FPS = params.has('fps') || params.has('debug');

const view = document.getElementById('view');
const countsEl = document.getElementById('counts');
const clockEl = document.getElementById('clock');
const liveEl = document.getElementById('live');
const simPill = document.getElementById('sim-pill');
const simBtn = document.getElementById('simbtn');
const rosterEl = document.getElementById('roster-list');
const activityEl = document.getElementById('activity');
const fpsEl = document.getElementById('fps');
const fullBtn = document.getElementById('fullbtn');

const agents = [];
const byId = new Map();
const obstacles = [];
let graph = [];
let botMeshes = [];
let screenMesh = null;
let chairMesh = null;
let lastStatus = null;
let feedOk = true;
let hoverId = null;
let pinned = null;
let sig = '';
let loungeSeats = [];
let serverLamps = [];
let wallScreens = [];
let shadowsOn = true;
let lowFps = 0;
let frames = 0;
let fpsStamp = 0;
let fps = 60;
let lastMinute = -1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY.day.bg);
scene.fog = new THREE.Fog(SKY.day.fog, 78, 150);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 260);
camera.position.set(4, 22, 22);
camera.lookAt(-0.5, 0.2, 2);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
view.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels';
view.appendChild(labelRenderer.domElement);

const hemi = new THREE.HemisphereLight(SKY.day.sky, SKY.day.ground, SKY.day.hemi);
scene.add(hemi);
const dir = new THREE.DirectionalLight(SKY.day.sun, SKY.day.dir);
dir.position.set(10, 18, 12);
dir.castShadow = true;
dir.shadow.mapSize.set(1024, 1024);
dir.shadow.camera.left = -16;
dir.shadow.camera.right = 16;
dir.shadow.camera.top = 14;
dir.shadow.camera.bottom = -14;
dir.shadow.camera.near = 2;
dir.shadow.camera.far = 42;
dir.shadow.bias = -0.0004;
scene.add(dir);
scene.add(dir.target);
dir.target.position.set(-1, 0, -1);
const fill = new THREE.DirectionalLight(0xfff1dc, SKY.day.fill);
fill.position.set(4, 10, 16);
scene.add(fill);

const office = new THREE.Group();
office.position.y = FY;
scene.add(office);
const interior = new THREE.PointLight(0xffe2b8, SKY.day.interior, 28, 2);
interior.position.set(-1, 3.4, 0);
office.add(interior);

const sun = new THREE.Mesh(new THREE.SphereGeometry(1.3, 14, 10), basic(0xfff3c4));
sun.position.set(-6, 15, -24);
scene.add(sun);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dummy = new THREE.Object3D();

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function deptOf(bot) {
  if (DEPT[bot.id]) return DEPT[bot.id];
  return bot.team === 'buzz' ? 'jobs' : 'study';
}
function shortName(name) {
  if (name.startsWith('SR-')) return name.replace(/^SR-/, '').replace(/-Agent$/, '').split('-')[0];
  if (name.length <= 14) return name;
  return name.slice(0, 13) + '…';
}
function angLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
}
function put(mesh, i, x, y, z, s = 1, ry = 0) {
  dummy.position.set(x, y, z);
  dummy.rotation.set(0, ry, 0);
  dummy.scale.setScalar(s);
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
  mesh.instanceMatrix.needsUpdate = true;
}

function londonParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
  }).formatToParts(date);
  const get = (type) => (parts.find((p) => p.type === type) || {}).value || '';
  let hour = Number(get('hour'));
  if (!Number.isFinite(hour)) hour = 12;
  return {
    hour: ((hour % 24) + 24) % 24,
    minute: Number(get('minute')) || 0,
    label: (get('weekday') + ' ' + get('day') + ' ' + get('month')).replace(/,/g, '')
  };
}
function londonTime(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(date);
}
function skyPhase(hour) {
  if (hour >= 20 || hour < 5) return 'night';
  if (hour < 8) return 'dawn';
  if (hour >= 17) return 'dusk';
  return 'day';
}
function updateSky(parts) {
  const phase = skyLock || skyPhase(parts.hour);
  const look = SKY[phase];
  scene.background.set(look.bg);
  scene.fog.color.set(look.fog);
  hemi.color.set(look.sky);
  hemi.groundColor.set(look.ground);
  hemi.intensity = look.hemi;
  dir.color.set(look.sun);
  dir.intensity = look.dir;
  fill.intensity = look.fill;
  interior.intensity = look.interior;
  sun.visible = phase !== 'night';
  document.querySelectorAll('#skybar button').forEach((btn) => {
    const key = btn.dataset.sky;
    const on = key === 'now' ? !skyLock : (key === 'evening' ? skyLock === 'dusk' : skyLock === key);
    btn.classList.toggle('on', on);
  });
}

function resize() {
  const w = view.clientWidth || 1;
  const h = view.clientHeight || 1;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  labelRenderer.setSize(w, h);
}

function addCarpet(def) {
  const w = def.x1 - def.x0;
  const d = def.z1 - def.z0;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.025, d), lambert(def.color));
  mesh.position.set((def.x0 + def.x1) / 2, 0.02, (def.z0 + def.z1) / 2);
  mesh.receiveShadow = true;
  office.add(mesh);
  const mat = labelMaterial(def.color, def.title, false);
  sharpen(renderer, mat.map);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(def.lw, def.ld), mat);
  label.rotation.x = -Math.PI / 2;
  label.position.set(def.lx, 0.045, def.lz);
  label.receiveShadow = true;
  office.add(label);
  obstacles.push({
    type: 'rect',
    x0: def.lx - def.lw / 2 - 0.12,
    x1: def.lx + def.lw / 2 + 0.12,
    z0: def.lz - def.ld / 2 - 0.12,
    z1: def.lz + def.ld / 2 + 0.12
  });
}

function desksFor(def, n) {
  const labelNorth = def.lz - def.ld / 2;
  const zStart = def.z0 + 0.95;
  const zLimit = labelNorth - 0.9;
  const width = def.x1 - def.x0 - 0.7;
  let cols = Math.max(1, Math.min(n, Math.floor(width / 1.12)));
  let rows = Math.ceil(n / cols);
  while (rows > 1 && zStart + (rows - 1) * 1.32 > zLimit && cols < n) {
    cols += 1;
    rows = Math.ceil(n / cols);
  }
  const seats = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    seats.push({
      x: def.x0 + 0.35 + width * ((c + 0.5) / cols),
      z: zStart + r * 1.32,
      face: 0
    });
  }
  return seats;
}

function buildShell() {
  const wood = new THREE.MeshLambertMaterial({ map: sharpen(renderer, woodTexture()) });
  const side = lambert(0x6a432c);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(24.6, 0.24, 17.3), [side, side, wood, side, side, side]);
  slab.position.set(0, -0.12, 0.2);
  slab.receiveShadow = true;
  office.add(slab);

  const frame = lambert(0x2c261f);
  const glassMat = basic(0xd7eef8);
  glassMat.transparent = true;
  glassMat.opacity = 0.2;
  glassMat.depthWrite = false;
  glassMat.side = THREE.DoubleSide;
  const leadGlass = basic(0xd7eef8);
  leadGlass.transparent = true;
  leadGlass.opacity = 0.1;
  leadGlass.depthWrite = false;
  leadGlass.side = THREE.DoubleSide;

  const north = new THREE.Mesh(new THREE.BoxGeometry(24.4, 0.22, 0.18), frame);
  north.position.set(0, 0.45, -8.55);
  office.add(north);
  const header = new THREE.Mesh(new THREE.BoxGeometry(24.4, 0.14, 0.2), frame);
  header.position.set(0, 2.35, -8.55);
  office.add(header);
  const nglass = new THREE.Mesh(new THREE.PlaneGeometry(23.6, 1.7), glassMat);
  nglass.position.set(0, 1.4, -8.5);
  office.add(nglass);
  const mullionGeo = new THREE.BoxGeometry(0.08, 2.2, 0.16);
  const northXs = [];
  for (let x = -12; x <= 12; x += 1.75) northXs.push(x);
  const northMullions = new THREE.InstancedMesh(mullionGeo, frame, northXs.length);
  northMullions.frustumCulled = false;
  const mullionM = new THREE.Matrix4();
  northXs.forEach((x, i) => {
    mullionM.makeTranslation(x, 1.2, -8.55);
    northMullions.setMatrixAt(i, mullionM);
  });
  office.add(northMullions);

  const westHead = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 17.1), frame);
  westHead.position.set(-12.15, 2.35, 0.2);
  office.add(westHead);
  const wsill = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 17.1), frame);
  wsill.position.set(-12.15, 0.45, 0.2);
  office.add(wsill);
  const wglass = new THREE.Mesh(new THREE.PlaneGeometry(16.4, 1.7), glassMat);
  wglass.rotation.y = Math.PI / 2;
  wglass.position.set(-12.08, 1.4, 0.2);
  office.add(wglass);
  const westZs = [];
  for (let z = -8.2; z <= 8.4; z += 1.75) westZs.push(z);
  const westMullions = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 2.2, 0.08), frame, westZs.length);
  westMullions.frustumCulled = false;
  westZs.forEach((z, i) => {
    mullionM.makeTranslation(-12.15, 1.2, z);
    westMullions.setMatrixAt(i, mullionM);
  });
  office.add(westMullions);

  const kneeS = new THREE.Mesh(new THREE.BoxGeometry(24.4, 0.36, 0.16), lambert(0x8a5a34));
  kneeS.position.set(0, 0.18, 8.75);
  office.add(kneeS);
  const kneeE = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 17.2), lambert(0x8a5a34));
  kneeE.position.set(12.2, 0.21, 0.2);
  office.add(kneeE);

  const roof = lambert(0x1c2822);
  const capN = new THREE.Mesh(new THREE.BoxGeometry(25.4, 0.18, 1.6), roof);
  capN.position.set(0, 2.95, -9.45);
  capN.rotation.x = -0.42;
  office.add(capN);
  const capW = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.16, 18.2), roof);
  capW.position.set(-13.05, 2.82, 0.2);
  capW.rotation.z = 0.45;
  office.add(capW);

  [ [-8, 10.15], [-2.6, 10.15], [2.8, 10.15], [8.2, 10.15] ].forEach(([x, z]) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.22, 12), lambert(0x161616));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.5 - FY, z);
    office.add(wheel);
  });

  const glassFrame = lambert(0x243044);
  const lead = ZONE_DEFS[0];
  const gh = 1.55;
  const edges = [
    { x: (lead.x0 + lead.x1) / 2, z: lead.z0, w: lead.x1 - lead.x0, rot: 0, gap: false },
    { x: lead.x0, z: (lead.z0 + lead.z1) / 2, w: lead.z1 - lead.z0, rot: Math.PI / 2, gap: false },
    { x: lead.x1, z: (lead.z0 + lead.z1) / 2, w: lead.z1 - lead.z0, rot: Math.PI / 2, gap: false }
  ];
  edges.forEach((e) => {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(e.w, gh), leadGlass);
    pane.position.set(e.x, gh / 2, e.z);
    pane.rotation.y = e.rot;
    office.add(pane);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(e.w, 0.06, 0.06), glassFrame);
    bar.position.set(e.x, gh, e.z);
    bar.rotation.y = e.rot;
    office.add(bar);
  });
  const doorW = 0.95;
  const southW = (lead.x1 - lead.x0 - doorW) / 2;
  [-1, 1].forEach((s) => {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(southW, gh), leadGlass);
    pane.position.set((lead.x0 + lead.x1) / 2 + s * (doorW / 2 + southW / 2), gh / 2, lead.z1);
    office.add(pane);
  });

  ZONE_DEFS.forEach(addCarpet);
  const discMat = labelMaterial(0x1e9a68, 'LOUNGE', true);
  sharpen(renderer, discMat.map);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(LOUNGE.disc, 40), discMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(LOUNGE.x, 0.04, LOUNGE.z);
  disc.receiveShadow = true;
  office.add(disc);
  obstacles.push({ type: 'circle', x: LOUNGE.x, z: LOUNGE.z, r: LOUNGE.disc + 0.15 });

  buildProps();
}

function buildProps() {
  const potGeo = new THREE.CylinderGeometry(0.16, 0.12, 0.24, 7);
  const leafGeo = new THREE.IcosahedronGeometry(0.22, 0);
  const spots = [
    [-11.15, -7.35, 1], [11.05, -7.35, 1], [11.05, 7.7, 0.9], [-11.15, 7.7, 0.9],
    [-10.9, -0.9, 0.75], [2.6, 1.55, 0.85], [-3.4, 1.7, 0.8], [7.2, 2.55, 0.7]
  ];
  const pots = batch(potGeo, lambert(0xf7f4ef), spots.length, false);
  const leaves = batch(leafGeo, lambert(0x3f9a45), spots.length * 2, false);
  scene.add(pots, leaves);
  spots.forEach(([x, z, s], i) => {
    put(pots, i, x, FY + 0.12 * s, z, s);
    put(leaves, i * 2, x, FY + 0.38 * s, z, s);
    put(leaves, i * 2 + 1, x + 0.08 * s, FY + 0.52 * s, z + 0.04, s * 0.7);
  });

  const sofaMat = lambert(0x3aa89a);
  [[LOUNGE.x - 2.05, LOUNGE.z, Math.PI / 2], [LOUNGE.x + 2.05, LOUNGE.z, -Math.PI / 2]].forEach(([x, z, ry]) => {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.22, 0.48), sofaMat);
    seat.position.y = 0.24;
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.36, 0.1), sofaMat);
    back.position.set(0, 0.46, -0.2);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.48), sofaMat);
    armL.position.set(-0.64, 0.36, 0);
    const armR = armL.clone();
    armR.position.x = 0.64;
    g.add(seat, back, armL, armR);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    office.add(g);
  });

  const lamp = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.15, 6), lambert(0x2a241e));
  pole.position.y = 0.58;
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.22, 7), new THREE.MeshLambertMaterial({ color: 0xf0e2b8, emissive: 0xf0d7a0, emissiveIntensity: 0.35 }));
  shade.position.y = 1.2;
  lamp.add(pole, shade);
  lamp.position.set(2.55, 0, 1.85);
  office.add(lamp);

  const counter = new THREE.Group();
  counter.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.72, 1.3), lambert(0xf3efe8))).position.y = 0.36;
  const machine = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.36), lambert(0x2a3038));
  machine.position.set(0, 0.9, -0.25);
  counter.add(machine);
  const mug = lambert(0xf7f7f5);
  for (let i = 0; i < 3; i++) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.1, 8), mug);
    cup.position.set(-0.18 + i * 0.16, 0.78, 0.3);
    counter.add(cup);
  }
  counter.position.set(-11.05, 0, -1.05);
  office.add(counter);

  const rack = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.38), lambert(0x171b22));
  box.position.y = 0.72;
  rack.add(box);
  for (let i = 0; i < 8; i++) {
    const lampMat = new THREE.MeshLambertMaterial({
      color: 0x102018,
      emissive: i % 2 ? 0x39ff7a : 0xffb03a,
      emissiveIntensity: 0.35
    });
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.02), lampMat);
    bulb.position.set(0, 0.28 + i * 0.13, 0.2);
    rack.add(bulb);
    serverLamps.push(lampMat);
  }
  rack.position.set(11.15, 0, -7.35);
  office.add(rack);

  [{ x: 6.7, accent: '#46e08a' }, { x: 9.3, accent: '#7ec8ff' }].forEach((spec) => {
    const screen = screenTexture();
    screen.accent = spec.accent;
    sharpen(renderer, screen.tex);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.76), new THREE.MeshBasicMaterial({ map: screen.tex }));
    panel.position.set(spec.x, 1.55, -7.55);
    office.add(panel);
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.86, 0.05), lambert(0x1a1e24));
    bezel.position.set(spec.x, 1.55, -7.6);
    office.add(bezel);
    wallScreens.push(screen);
  });
}

function buildGraph() {
  const nodes = [];
  const line = (x0, z0, x1, z1, step) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.ceil(len / step));
    for (let i = 0; i <= n; i++) nodes.push({ x: x0 + (x1 - x0) * i / n, z: z0 + (z1 - z0) * i / n });
  };
  line(-11.2, -3.35, 11.2, -3.35, 1.55);
  line(-11.2, 2.55, 11.2, 2.55, 1.55);
  line(-6.85, -7.2, -6.85, 7.7, 1.55);
  line(5.15, -7.2, 5.15, 7.7, 1.55);
  line(-11.2, -7.15, -7.4, -7.15, 1.4);
  line(-6.2, -7.15, 4.5, -7.15, 1.55);
  line(5.7, -7.15, 10.6, -7.15, 1.4);
  line(-11.2, -2.45, -7.4, -2.45, 1.4);
  line(5.7, -2.45, 11.1, -2.45, 1.4);
  line(-11.2, 3.35, -7.4, 3.35, 1.4);
  line(-6.2, 3.35, -2.6, 3.35, 1.3);
  line(-1.4, 3.35, 11.1, 3.35, 1.55);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    nodes.push({ x: LOUNGE.x + Math.cos(a) * 3.25, z: LOUNGE.z + Math.sin(a) * 3.25 });
  }
  graph = nodes;
}

function segmentBlocked(a, b) {
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    for (const o of obstacles) {
      if (o.type === 'circle') {
        const dx = x - o.x;
        const dz = z - o.z;
        if (dx * dx + dz * dz < o.r * o.r) return true;
      } else if (x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1) return true;
    }
  }
  return false;
}

function route(from, to) {
  if (!segmentBlocked(from, to)) return [to];
  const nodes = graph;
  const all = nodes.concat([from, to]);
  const start = nodes.length;
  const goal = nodes.length + 1;
  const adj = Array.from({ length: all.length }, () => []);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dz = nodes[i].z - nodes[j].z;
      if (dx * dx + dz * dz > 2.35 * 2.35) continue;
      if (segmentBlocked(nodes[i], nodes[j])) continue;
      adj[i].push(j);
      adj[j].push(i);
    }
  }
  [[start, from], [goal, to]].forEach(([idx, pt]) => {
    let best = 0;
    let bestD = Infinity;
    for (let j = 0; j < nodes.length; j++) {
      const d = Math.hypot(nodes[j].x - pt.x, nodes[j].z - pt.z);
      if (d < bestD) { bestD = d; best = j; }
      if (d < 4.4 && !segmentBlocked(pt, nodes[j])) {
        adj[idx].push(j);
        adj[j].push(idx);
      }
    }
    if (!adj[idx].length) {
      adj[idx].push(best);
      adj[best].push(idx);
    }
  });
  const prev = new Array(all.length).fill(-1);
  const q = [start];
  prev[start] = start;
  while (q.length) {
    const cur = q.shift();
    if (cur === goal) break;
    for (const n of adj[cur]) if (prev[n] < 0) { prev[n] = cur; q.push(n); }
  }
  if (prev[goal] < 0) return [to];
  const path = [];
  let cur = goal;
  const guard = new Set();
  while (cur !== start && !guard.has(cur)) {
    guard.add(cur);
    if (cur !== goal) path.push(all[cur]);
    cur = prev[cur];
  }
  path.reverse();
  path.push(to);
  return path;
}

function addLoungeStools() {
  const n = loungeSeats.length;
  if (!n) return;
  const seat = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.08, 0.46), lambert(0x3aa89a), n);
  const leg = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.24, 0.1), lambert(0x2a241e), n);
  const back = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.32, 0.08), lambert(0x2f8f84), n);
  seat.frustumCulled = false;
  leg.frustumCulled = false;
  back.frustumCulled = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  loungeSeats.forEach((s, i) => {
    m.makeTranslation(s.x, 0.3, s.z);
    seat.setMatrixAt(i, m);
    m.makeTranslation(s.x, 0.14, s.z);
    leg.setMatrixAt(i, m);
    q.setFromEuler(new THREE.Euler(0, s.face || 0, 0));
    m.compose(
      new THREE.Vector3(s.x - Math.sin(s.face || 0) * 0.22, 0.46, s.z - Math.cos(s.face || 0) * 0.22),
      q,
      new THREE.Vector3(1, 1, 1)
    );
    back.setMatrixAt(i, m);
  });
  office.add(seat, leg, back);
}

function makeLoungeSeats(n) {
  const seats = [];
  [LOUNGE.r1, LOUNGE.r2].forEach((r, ring) => {
    const count = Math.round((Math.PI * 2 * r) / 0.78);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + ring * 0.2;
      const x = LOUNGE.x + Math.cos(a) * r;
      const z = LOUNGE.z + Math.sin(a) * r;
      const inside = ZONE_DEFS.some((def) => x > def.x0 + 0.15 && x < def.x1 - 0.15 && z > def.z0 + 0.15 && z < def.z1 - 0.15);
      if (inside) continue;
      if (x < -11.3 || x > 11.3 || z < -7.4 || z > 7.9) continue;
      seats.push({
        x, z,
        face: Math.atan2(LOUNGE.x - x, LOUNGE.z - z)
      });
    }
  });
  if (seats.length < n) {
    for (let i = seats.length; i < n; i++) {
      seats.push({ x: LOUNGE.x + ((i % 8) - 3.5) * 0.7, z: 2.15, face: 0 });
    }
  }
  return seats.slice(0, Math.max(n, seats.length));
}

function effective(entry) {
  if (!entry || typeof entry !== 'object') return { state: 'idle', task: '', with: [] };
  const state = entry.state;
  if (state === 'offline') return { state: 'offline', task: String(entry.task || ''), with: [] };
  if (state === 'idle') return { state: 'idle', task: '', with: [] };
  if (state !== 'working' && state !== 'collaborating') return { state: 'idle', task: '', with: [] };
  const t = Date.parse(entry.updated_at || '');
  if (!Number.isFinite(t) || Date.now() - t > STALE_MS) return { state: 'idle', task: '', with: [] };
  return {
    state,
    task: String(entry.task || '').slice(0, 40),
    with: Array.isArray(entry.with) ? entry.with.map(String) : []
  };
}

function simFor(bot, now) {
  if (bot.id === 'sr-planner-agent') return { state: 'offline', task: 'Parked', with: [] };
  if (bot.id === 'kelvin') return { state: 'working', task: 'Weekly SEO check', with: [] };
  const bucket = Math.floor(now / 28000);
  const n = (hash(bot.id) + bucket * 3) % 10;
  const task = SIM_TASKS[hash(bot.id + ':' + bucket) % SIM_TASKS.length];
  if (n < 6) return { state: 'working', task, with: [] };
  if (n < 8) return { state: 'collaborating', task: 'Handoff to lead', with: ['kelvin'] };
  return { state: 'idle', task: '', with: [] };
}

function destFor(bot) {
  if (bot.state === 'offline') return bot.desk;
  if (bot.id === 'kelvin' && (bot.state === 'working' || bot.state === 'collaborating')) return bot.desk;
  if (bot.state === 'working') return bot.desk;
  if (bot.state === 'collaborating') return bot.handoff || HAND_SPOTS[0];
  return bot.lounge;
}

function assignHandoffs() {
  const people = agents.filter((a) => a.state === 'collaborating' && a.id !== 'kelvin')
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  people.forEach((bot, i) => {
    const spot = HAND_SPOTS[i % HAND_SPOTS.length];
    const ring = Math.floor(i / HAND_SPOTS.length);
    bot.handoff = {
      x: spot.x,
      z: spot.z + ring * 0.45,
      face: Math.atan2(KELVIN_FOCUS.x - spot.x, KELVIN_FOCUS.z - spot.z)
    };
  });
}

function paintBot(bot) {
  const hex = bot.state === 'offline' ? 0xb0b4bc : bot.hex;
  const color = new THREE.Color(hex);
  const dark = color.clone().multiplyScalar(0.72);
  const cap = color.clone().multiplyScalar(0.8);
  bot.colors.forEach((slot) => {
    const c = slot.role === 'dark' ? dark : slot.role === 'cap' ? cap : color;
    slot.mesh.setColorAt(slot.i, c);
    slot.mesh.instanceColor.needsUpdate = true;
  });
  chairMesh.setColorAt(bot.index, color);
  chairMesh.instanceColor.needsUpdate = true;
  const on = bot.state === 'working' || (bot.id === 'kelvin' && bot.state === 'collaborating');
  screenMesh.setColorAt(bot.index, new THREE.Color(on ? ON_COLORS[bot.index % ON_COLORS.length] : 0x24343c));
  screenMesh.instanceColor.needsUpdate = true;
}

function apply(first) {
  const now = performance.now();
  const statusMap = new Map();
  if (lastStatus && Array.isArray(lastStatus.bots)) {
    lastStatus.bots.forEach((entry) => { if (entry && entry.id) statusMap.set(entry.id, entry); });
  }
  agents.forEach((bot) => {
    const next = simulating ? simFor(bot, now) : effective(statusMap.get(bot.id));
    bot.state = next.state;
    bot.task = next.task;
    bot.with = next.with;
  });
  assignHandoffs();
  agents.forEach((bot) => {
    paintBot(bot);
    const dest = destFor(bot);
    const same = bot.dest && Math.hypot(bot.dest.x - dest.x, bot.dest.z - dest.z) < 0.08;
    bot.dest = dest;
    if (first || bot.state === 'offline') {
      bot.rig.root.position.set(dest.x, 0, dest.z);
      bot.path = [];
      bot.settled = true;
      bot.walking = false;
      bot.face = dest.face || 0;
      bot.rig.root.rotation.y = bot.face;
    } else if (!same) {
      bot.path = route(
        { x: bot.rig.root.position.x, z: bot.rig.root.position.z },
        { x: dest.x, z: dest.z }
      );
      bot.settled = false;
    }
    bot.tag.querySelector('.short').textContent = shortName(bot.name);
    const bits = [bot.name, STATE_WORD[bot.state] || 'Idle'];
    if (bot.task) bits.push(bot.task);
    if (bot.state === 'collaborating' && bot.with && bot.with.length) {
      bits.push('with ' + bot.with.map((id) => (byId.get(id) ? byId.get(id).name : id)).join(', '));
    }
    bot.tag.querySelector('.full').textContent = bits.join(' · ');
  });
  refreshTags();
  renderHud();
}

function refreshTags() {
  agents.forEach((bot) => {
    const hot = bot.id === hoverId || bot.id === pinned;
    bot.tag.classList.toggle('on', hot);
    const show = hot || bot.state === 'working' || bot.state === 'collaborating' || bot.state === 'offline';
    bot.tag.classList.toggle('show', show);
  });
  rosterEl.querySelectorAll('.bot-row').forEach((row) => {
    row.classList.toggle('hot', row.dataset.id === hoverId || row.dataset.id === pinned);
  });
}

function renderHud() {
  const counts = { working: 0, idle: 0, collaborating: 0, offline: 0 };
  agents.forEach((bot) => { counts[bot.state] = (counts[bot.state] || 0) + 1; });
  countsEl.replaceChildren();
  [['working', 'working'], ['collaborating', 'together'], ['idle', 'idle'], ['offline', 'offline']].forEach(([key, word]) => {
    const el = document.createElement('span');
    el.className = 'count ' + key;
    const dot = document.createElement('i');
    el.append(dot, document.createTextNode(counts[key] + ' ' + word));
    countsEl.appendChild(el);
  });
  simPill.hidden = !simulating;
  liveEl.hidden = simulating;
  liveEl.textContent = feedOk ? 'Live' : 'No feed';
  liveEl.classList.toggle('bad', !feedOk);
  simBtn.textContent = simulating ? 'Stop Simulation' : 'Simulate Work';
  simBtn.classList.toggle('on', simulating);
  window.__office.simulating = simulating;

  const nextSig = agents.map((a) => a.id + a.state + a.task).join('|') + (simulating ? 'S' : 'L');
  if (nextSig === sig) return;
  sig = nextSig;
  rosterEl.replaceChildren();
  ORDER.forEach((dept) => {
    const group = agents.filter((a) => a.dept === dept);
    if (!group.length) return;
    const h = document.createElement('div');
    h.className = 'dept';
    h.textContent = DEPT_NAME[dept];
    rosterEl.appendChild(h);
    group.forEach((bot) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'bot-row';
      row.dataset.id = bot.id;
      const dot = document.createElement('i');
      dot.style.background = '#' + bot.hex.toString(16).padStart(6, '0');
      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = bot.name;
      const st = document.createElement('span');
      st.className = 'st ' + bot.state;
      st.textContent = STATE_WORD[bot.state] || 'Idle';
      row.append(dot, nm, st);
      if (bot.task) {
        const task = document.createElement('span');
        task.className = 'task';
        task.textContent = bot.task;
        row.append(task);
      }
      row.addEventListener('pointerenter', () => { hoverId = bot.id; refreshTags(); });
      row.addEventListener('pointerleave', () => { if (hoverId === bot.id) hoverId = null; refreshTags(); });
      row.addEventListener('click', () => { pinned = pinned === bot.id ? null : bot.id; refreshTags(); });
      rosterEl.appendChild(row);
    });
  });

  activityEl.replaceChildren();
  if (simulating) {
    const note = document.createElement('div');
    note.className = 'act';
    note.textContent = 'Simulated in this browser only.';
    activityEl.appendChild(note);
    agents.filter((a) => a.state === 'working' || a.state === 'collaborating').slice(0, 6).forEach((bot) => {
      const line = document.createElement('div');
      line.className = 'act';
      const b = document.createElement('b');
      b.textContent = bot.name;
      line.append(b, document.createTextNode(' ' + (bot.task || STATE_WORD[bot.state])));
      activityEl.appendChild(line);
    });
  } else if (lastStatus && Array.isArray(lastStatus.history)) {
    lastStatus.history.slice(-6).reverse().forEach((row) => {
      const line = document.createElement('div');
      line.className = 'act';
      const who = byId.get(row.id);
      const b = document.createElement('b');
      b.textContent = who ? who.name : row.id;
      const when = document.createElement('span');
      const d = new Date(row.at || '');
      when.textContent = Number.isNaN(d.getTime()) ? '' : ' ' + londonTime(d);
      line.append(b, document.createTextNode(' ' + (row.task || row.state || '')), when);
      activityEl.appendChild(line);
    });
  }
}

function stepAgent(bot, dt) {
  if (bot.path.length) {
    const target = bot.path[0];
    const dx = target.x - bot.rig.root.position.x;
    const dz = target.z - bot.rig.root.position.z;
    const dist = Math.hypot(dx, dz);
    const step = bot.speed * dt;
    bot.walking = true;
    bot.settled = false;
    if (dist <= step || dist < 0.001) {
      bot.rig.root.position.x = target.x;
      bot.rig.root.position.z = target.z;
      bot.path.shift();
    } else {
      bot.rig.root.position.x += (dx / dist) * step;
      bot.rig.root.position.z += (dz / dist) * step;
      bot.face = Math.atan2(dx, dz);
    }
  }
  if (!bot.path.length) {
    bot.walking = false;
    bot.settled = true;
    bot.face = bot.dest ? (bot.dest.face || 0) : 0;
  }
  bot.rig.root.rotation.y = angLerp(bot.rig.root.rotation.y, bot.face, 1 - Math.exp(-8 * dt));
}

function applyPose(bot, dt, time) {
  const rig = bot.rig;
  const standingCollab = bot.state === 'collaborating' && bot.id !== 'kelvin';
  const sit = bot.settled && !bot.walking && !standingCollab;
  const typing = sit && (bot.state === 'working' || (bot.id === 'kelvin' && bot.state === 'collaborating'));
  const carrying = standingCollab;
  rig.folder.scale.setScalar(carrying ? 1 : 0.0001);
  rig.arms[0].shoulder.rotation.z = 0.18;
  rig.arms[1].shoulder.rotation.z = -0.18;
  rig.arms[0].shoulder.rotation.x = 0;
  rig.arms[1].shoulder.rotation.x = 0;
  rig.arms[0].elbow.rotation.x = 0;
  rig.arms[1].elbow.rotation.x = 0;
  rig.legs[0].hip.rotation.x = 0;
  rig.legs[1].hip.rotation.x = 0;
  rig.legs[0].knee.rotation.x = 0;
  rig.legs[1].knee.rotation.x = 0;
  rig.chest.rotation.x = 0;
  if (bot.walking) {
    bot.phase += dt * 7.5;
    const s = Math.sin(bot.phase);
    rig.hips.position.y = HIP_STAND + Math.abs(Math.cos(bot.phase)) * 0.018;
    rig.legs[0].hip.rotation.x = s * 0.55;
    rig.legs[1].hip.rotation.x = -s * 0.55;
    rig.legs[0].knee.rotation.x = Math.max(0, -s) * 0.7;
    rig.legs[1].knee.rotation.x = Math.max(0, s) * 0.7;
    rig.arms[0].shoulder.rotation.x = -s * 0.45;
    if (carrying) {
      rig.arms[1].shoulder.rotation.x = -1.05;
      rig.arms[1].elbow.rotation.x = -0.7;
    } else {
      rig.arms[1].shoulder.rotation.x = s * 0.45;
    }
    rig.chest.rotation.x = 0.06;
  } else if (sit) {
    rig.hips.position.y = HIP_SIT;
    rig.legs[0].hip.rotation.x = -1.5;
    rig.legs[1].hip.rotation.x = -1.5;
    rig.legs[0].knee.rotation.x = 1.5;
    rig.legs[1].knee.rotation.x = 1.5;
    const type = typing ? Math.sin(time * 9 + bot.seed) * 0.14 : 0;
    rig.arms[0].shoulder.rotation.x = -0.55;
    rig.arms[1].shoulder.rotation.x = -0.55;
    rig.arms[0].elbow.rotation.x = -0.7 + type;
    rig.arms[1].elbow.rotation.x = -0.7 - type;
    rig.chest.rotation.x = 0.06;
  } else {
    rig.hips.position.y = HIP_STAND;
    if (carrying) {
      rig.arms[1].shoulder.rotation.x = -1.05;
      rig.arms[1].elbow.rotation.x = -0.75;
      rig.arms[0].shoulder.rotation.x = -0.15;
    }
  }
}

function syncBots() {
  agents.forEach((bot) => {
    bot.rig.root.updateMatrixWorld(true);
    bot.parts.forEach((part) => part.mesh.setMatrixAt(part.i, part.anchor.matrixWorld));
  });
  botMeshes.forEach((mesh) => { mesh.instanceMatrix.needsUpdate = true; });
}

function separateWalkers() {
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    if (!a.walking) continue;
    for (let j = i + 1; j < agents.length; j++) {
      const b = agents[j];
      if (!b.walking) continue;
      const dx = b.rig.root.position.x - a.rig.root.position.x;
      const dz = b.rig.root.position.z - a.rig.root.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.001 && d < 0.42) {
        const push = (0.42 - d) * 0.35;
        a.rig.root.position.x -= (dx / d) * push;
        a.rig.root.position.z -= (dz / d) * push;
        b.rig.root.position.x += (dx / d) * push;
        b.rig.root.position.z += (dz / d) * push;
      }
    }
  }
}

function pickBot(ev) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(botMeshes, false);
  for (const hit of hits) {
    const ids = hit.object.userData.ids;
    const id = ids && ids[hit.instanceId];
    if (id) return id;
  }
  return null;
}

function bindPointer() {
  view.addEventListener('pointermove', (ev) => {
    if (ev.target.closest && ev.target.closest('.tag')) return;
    const id = pickBot(ev);
    if (id !== hoverId) {
      hoverId = id;
      refreshTags();
      view.style.cursor = id ? 'pointer' : '';
    }
  });
  view.addEventListener('pointerdown', (ev) => {
    if (ev.target.closest && ev.target.closest('.tag')) return;
    const id = pickBot(ev);
    pinned = id && pinned === id ? null : id;
    refreshTags();
  });
}

function mountBots(list) {
  const byDept = new Map(ORDER.map((id) => [id, []]));
  list.forEach((bot) => {
    const dept = deptOf(bot);
    bot.dept = dept;
    if (!byDept.has(dept)) byDept.set(dept, []);
    byDept.get(dept).push(bot);
  });
  const seats = new Map();
  ZONE_DEFS.forEach((def) => {
    const group = byDept.get(def.id) || [];
    seats.set(def.id, desksFor(def, group.length));
  });
  loungeSeats = makeLoungeSeats(list.length);
  addLoungeStools();

  const n = list.length;
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const geos = workstationGeos();
  const badges = badgeGeos();
  const headM = batch(new THREE.BoxGeometry(0.34, 0.32, 0.32), bodyMat, n, true);
  const capM = batch(new THREE.BoxGeometry(0.36, 0.08, 0.36), bodyMat, n, false);
  const torsoM = batch(new THREE.BoxGeometry(0.42, 0.36, 0.28), bodyMat, n, true);
  const thighM = batch(new THREE.BoxGeometry(0.13, 0.22, 0.13), bodyMat, n * 2, false);
  const shinM = batch(shinGeo(), bodyMat, n * 2, false);
  const upperM = batch(new THREE.BoxGeometry(0.11, 0.24, 0.11), bodyMat, n * 2, false);
  const foreM = batch(foreGeo(), bodyMat, n * 2, false);
  const eyeM = batch(new THREE.BoxGeometry(0.055, 0.06, 0.03), lambert(0x1a1a1a), n * 2, false);
  const folderM = batch(new THREE.BoxGeometry(0.16, 0.2, 0.04), lambert(0xd7b07a), n, false);
  const deskM = batch(geos.desk, lambert(0x2a3140), n, true);
  chairMesh = batch(geos.chair, bodyMat, n, true);
  const monitorM = batch(geos.monitor, lambert(0x16191e), n, false);
  screenMesh = batch(geos.screen, new THREE.MeshBasicMaterial({ color: 0xffffff }), n, false);
  const badgeMesh = {};
  ORDER.forEach((dept) => {
    const kind = ACCESSORY[dept];
    const count = (byDept.get(dept) || []).length;
    if (!count || badgeMesh[kind]) return;
    badgeMesh[kind] = batch(badges[kind], lambert(BADGE_COLOR[kind]), count, false);
  });
  botMeshes = [headM, capM, torsoM, thighM, shinM, upperM, foreM, eyeM, folderM, ...Object.values(badgeMesh)];
  scene.add(headM, capM, torsoM, thighM, shinM, upperM, foreM, eyeM, folderM, deskM, chairMesh, monitorM, screenMesh, ...Object.values(badgeMesh));
  const badgeIndex = {};
  const tagId = (mesh, i, id) => {
    if (!mesh.userData.ids) mesh.userData.ids = [];
    mesh.userData.ids[i] = id;
  };

  list.forEach((raw, index) => {
    const dept = raw.dept;
    const group = byDept.get(dept);
    const gi = group.indexOf(raw);
    const hex = PALETTE[dept][gi % PALETTE[dept].length];
    const rig = makeRig();
    office.add(rig.root);
    const desk = seats.get(dept)[gi];
    const lounge = loungeSeats[index % loungeSeats.length];
    const tag = document.createElement('div');
    tag.className = 'tag';
    const short = document.createElement('div');
    short.className = 'short';
    const full = document.createElement('div');
    full.className = 'full';
    tag.append(short, full);
    tag.addEventListener('click', (ev) => {
      ev.stopPropagation();
      pinned = pinned === raw.id ? null : raw.id;
      refreshTags();
    });
    const label = new CSS2DObject(tag);
    label.position.set(0, 1.22, 0);
    label.center.set(0.5, 1);
    rig.root.add(label);

    const bot = {
      ...raw, dept, hex, index, rig, tag, desk, lounge,
      state: 'idle', task: '', with: [],
      path: [], dest: null, walking: false, settled: true, face: 0,
      phase: 0, seed: hash(raw.id) % 10, speed: 2.05 + (hash(raw.id) % 5) * 0.08,
      parts: [], colors: []
    };
    const add = (mesh, anchor, i, role) => {
      bot.parts.push({ mesh, anchor, i });
      if (role) bot.colors.push({ mesh, i, role });
      tagId(mesh, i, raw.id);
    };
    add(headM, rig.head, index, 'body');
    add(capM, rig.cap, index, 'cap');
    add(torsoM, rig.torso, index, 'body');
    add(thighM, rig.legs[0].thigh, index * 2, 'dark');
    add(thighM, rig.legs[1].thigh, index * 2 + 1, 'dark');
    add(shinM, rig.legs[0].shin, index * 2, 'dark');
    add(shinM, rig.legs[1].shin, index * 2 + 1, 'dark');
    add(upperM, rig.arms[0].upper, index * 2, 'body');
    add(upperM, rig.arms[1].upper, index * 2 + 1, 'body');
    add(foreM, rig.arms[0].fore, index * 2, 'body');
    add(foreM, rig.arms[1].fore, index * 2 + 1, 'body');
    add(eyeM, rig.eyes[0], index * 2);
    add(eyeM, rig.eyes[1], index * 2 + 1);
    add(folderM, rig.folder, index);
    const kind = ACCESSORY[dept] || 'clip';
    const bi = badgeIndex[kind] || 0;
    badgeIndex[kind] = bi + 1;
    if (badgeMesh[kind]) add(badgeMesh[kind], rig.badge, bi);

    put(deskM, index, desk.x, FY, desk.z);
    put(chairMesh, index, desk.x, FY, desk.z);
    put(monitorM, index, desk.x, FY, desk.z);
    put(screenMesh, index, desk.x, FY, desk.z);
    chairMesh.setColorAt(index, new THREE.Color(hex));
    screenMesh.setColorAt(index, new THREE.Color(0x24343c));

    agents.push(bot);
    byId.set(raw.id, bot);
  });
  chairMesh.instanceColor.needsUpdate = true;
  screenMesh.instanceColor.needsUpdate = true;
}

function dropShadows() {
  if (!shadowsOn) return;
  shadowsOn = false;
  renderer.shadowMap.enabled = false;
  dir.castShadow = false;
  scene.traverse((obj) => {
    if (obj.isMesh || obj.isInstancedMesh) obj.castShadow = false;
  });
}

let screenAcc = 0;
let simAcc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, fpsStamp ? (now - last) / 1000 : 0.016);
  last = now;
  const time = now / 1000;
  if (simulating) {
    simAcc += dt;
    if (simAcc > 28) {
      simAcc = 0;
      apply(false);
    }
  }
  agents.forEach((bot) => stepAgent(bot, dt));
  separateWalkers();
  agents.forEach((bot) => applyPose(bot, dt, time));
  syncBots();
  stepYard(dt, time);
  screenAcc += dt;
  if (screenAcc > 0.25) {
    screenAcc = 0;
    wallScreens.forEach((screen) => drawScreen(screen, time, screen.accent));
    const blink = Math.floor(time * 3);
    serverLamps.forEach((mat, i) => {
      mat.emissiveIntensity = (blink + i) % 4 === 0 ? 1.15 : 0.18;
    });
  }
  const parts = londonParts(new Date());
  clockEl.textContent = parts.label + '  ·  ' + londonTime(new Date());
  if (parts.minute !== lastMinute) {
    lastMinute = parts.minute;
    updateSky(parts);
  }
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  frames += 1;
  if (now - fpsStamp > 1000) {
    fps = Math.round(frames * 1000 / (now - fpsStamp));
    frames = 0;
    fpsStamp = now;
    window.__office.fps = fps;
    window.__office.calls = renderer.info.render.calls;
    if (SHOW_FPS) fpsEl.textContent = fps + ' fps · ' + renderer.info.render.calls + ' draws';
    if (fps < 30) lowFps += 1;
    else lowFps = 0;
    if (lowFps >= 3) dropShadows();
  }
}
let last = 0;

async function loadJSON(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) throw new Error(url + ' ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function bindChrome() {
  simBtn.addEventListener('click', () => {
    simulating = !simulating;
    simAcc = 0;
    sig = '';
    apply(false);
  });
  document.querySelectorAll('#skybar button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.sky;
      if (key === 'now') skyLock = null;
      else if (key === 'evening') skyLock = 'dusk';
      else skyLock = key;
      updateSky(londonParts(new Date()));
    });
  });
  fullBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'f' && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
      else document.exitFullscreen();
    }
  });
  view.addEventListener('dblclick', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  });
  let cursorTimer = 0;
  const wake = () => {
    document.body.classList.remove('hide-cursor');
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(() => document.body.classList.add('hide-cursor'), 4000);
  };
  document.addEventListener('pointermove', wake);
  wake();
  window.addEventListener('resize', resize);
  if (SHOW_FPS) fpsEl.hidden = false;
}

async function boot() {
  resize();
  buildYard(scene);
  buildShell();
  buildGraph();
  let bots;
  try {
    bots = await loadJSON('data/bots.json');
  } catch (err) {
    throw new Error('Could not read data/bots.json');
  }
  if (!Array.isArray(bots)) throw new Error('data/bots.json must be a list');
  try {
    lastStatus = await loadJSON('status.json');
    feedOk = true;
  } catch (err) {
    lastStatus = null;
    feedOk = false;
  }
  mountBots(bots);
  bindPointer();
  bindChrome();
  apply(true);
  syncBots();
  updateSky(londonParts(new Date()));
  wallScreens.forEach((screen) => drawScreen(screen, 0, screen.accent));
  window.__office.booted = true;
  window.__office.bots = agents.length;
  requestAnimationFrame(frame);
  setInterval(async () => {
    try {
      lastStatus = await loadJSON('status.json');
      feedOk = true;
    } catch (err) {
      feedOk = false;
    }
    if (!simulating) apply(false);
    else renderHud();
  }, POLL_MS);
}

window.__office = { booted: false, fps: 0, calls: 0, simulating, bots: 0 };
boot().catch((err) => {
  console.error(err);
  const d = document.createElement('div');
  d.className = 'fatal';
  d.textContent = 'The 3D office did not start. ' + (err && err.message ? err.message : '');
  document.body.appendChild(d);
});
