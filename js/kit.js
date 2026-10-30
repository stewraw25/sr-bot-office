/* Shared low-poly pieces for SR Bot Office.
   Flat materials, desk/chair blocks, and the jointed toy rig are adapted from
   agent-office-3d (c) 2026 Jeffery Sha, MIT — see third_party/agent-office-3d-LICENSE.
   Boxy limb proportions and the warm wood texture are adapted from
   hermes-virtual-office (c) 2026 Hermes Virtual Office Contributors, MIT.
   Three.js itself is MIT and loaded from jsDelivr. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const HIP_STAND = 0.48;
export const HIP_SIT = 0.4;

const cache = new Map();

export function lambert(color) {
  const key = 'L' + color;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    cache.set(key, m);
  }
  return m;
}

export function basic(color, opts = {}) {
  return new THREE.MeshBasicMaterial({ color, ...opts });
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function sharpen(renderer, tex) {
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

/** Honey planks. Bands run across the floor the way a cutaway office reads on a TV. */
export function woodTexture() {
  const t = canvasTex(512, 512, (g) => {
    const rows = ['#e4b67a', '#d0924e', '#c47e3c', '#e8c08a', '#b87438', '#db9a56'];
    const h = 512 / rows.length;
    rows.forEach((color, i) => {
      g.fillStyle = color;
      g.fillRect(0, i * h, 512, h - 3);
      g.fillStyle = 'rgba(70,36,12,0.22)';
      g.fillRect(0, i * h + h - 3, 512, 3);
      g.strokeStyle = 'rgba(90,48,16,0.16)';
      g.beginPath();
      const y = i * h + h * 0.45;
      g.moveTo(0, y);
      g.bezierCurveTo(120, y - 4, 240, y + 5, 512, y - 1);
      g.stroke();
    });
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  return t;
}

export function grassTexture() {
  const t = canvasTex(256, 256, (g) => {
    g.fillStyle = '#5ea246';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = i % 3 ? '#73b856' : '#3f8634';
      g.fillRect((i * 47) % 256, (i * 91) % 256, 2, 3);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(18, 18);
  return t;
}

export function labelMaterial(hex, text, square) {
  const w = 1024;
  const h = square ? 1024 : 256;
  const t = canvasTex(w, h, (g) => {
    g.fillStyle = '#' + hex.toString(16).padStart(6, '0');
    g.fillRect(0, 0, w, h);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = square ? 150 : 118;
    const font = (s) => `800 ${s}px Arial, Helvetica, sans-serif`;
    g.font = font(size);
    const maxW = w - 80;
    while (g.measureText(text).width > maxW && size > 36) {
      size -= 4;
      g.font = font(size);
    }
    g.lineWidth = Math.max(6, size * 0.08);
    g.strokeStyle = 'rgba(0,0,0,0.28)';
    g.strokeText(text, w / 2, h / 2 + 4);
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.fillText(text, w / 2, h / 2 + 4);
  });
  return new THREE.MeshLambertMaterial({ map: t });
}

export function brandMaterial(lines, fg, bg) {
  const arr = Array.isArray(lines) ? lines : [lines];
  const size = arr.length > 1 ? 72 : 84;
  const t = canvasTex(1024, 320, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, 1024, 320);
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `800 ${size}px Arial, Helvetica, sans-serif`;
    arr.forEach((line, i) => {
      const y = 160 + (i - (arr.length - 1) / 2) * (size + 12);
      g.fillText(line, 512, y);
    });
  });
  return new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide });
}

export function screenTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 144;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { canvas: c, ctx, tex, phase: Math.random() * 6 };
}

export function drawScreen(screen, time, accent) {
  const { ctx, canvas: c, tex } = screen;
  ctx.fillStyle = '#10202c';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let y = 20; y < 130; y += 22) ctx.fillRect(12, y, 232, 1);
  for (let i = 0; i < 10; i++) {
    const h = 24 + (Math.sin(time * 0.9 + screen.phase + i * 0.7) * 0.5 + 0.5) * 78;
    ctx.fillStyle = i % 2 ? accent : '#8fd0ff';
    ctx.fillRect(16 + i * 23, 128 - h, 14, h);
  }
  tex.needsUpdate = true;
}

function shifted(geo, x, y, z) {
  geo.translate(x, y, z);
  return geo;
}

export function workstationGeos() {
  const desk = mergeGeometries([
    shifted(new THREE.BoxGeometry(1.05, 0.06, 0.5), 0, 0.5, 0.46),
    shifted(new THREE.BoxGeometry(0.06, 0.46, 0.06), -0.44, 0.24, 0.28),
    shifted(new THREE.BoxGeometry(0.06, 0.46, 0.06), 0.44, 0.24, 0.28),
    shifted(new THREE.BoxGeometry(0.06, 0.46, 0.06), -0.44, 0.24, 0.64),
    shifted(new THREE.BoxGeometry(0.06, 0.46, 0.06), 0.44, 0.24, 0.64),
    shifted(new THREE.BoxGeometry(0.34, 0.02, 0.12), -0.08, 0.545, 0.36)
  ]);
  const chair = mergeGeometries([
    shifted(new THREE.BoxGeometry(0.42, 0.07, 0.4), 0, 0.3, -0.02),
    shifted(new THREE.BoxGeometry(0.42, 0.36, 0.07), 0, 0.5, -0.2),
    shifted(new THREE.BoxGeometry(0.07, 0.28, 0.07), 0, 0.14, -0.02)
  ]);
  const monitor = mergeGeometries([
    shifted(new THREE.BoxGeometry(0.08, 0.18, 0.06), 0, 0.62, 0.66),
    shifted(new THREE.BoxGeometry(0.48, 0.32, 0.045), 0, 0.8, 0.68)
  ]);
  const screen = shifted(new THREE.PlaneGeometry(0.4, 0.24), 0, 0.8, 0.708);
  return { desk, chair, monitor, screen };
}

export function badgeGeos() {
  const coin = new THREE.CylinderGeometry(0.07, 0.07, 0.028, 10);
  coin.rotateX(Math.PI / 2);
  const star = new THREE.BoxGeometry(0.12, 0.12, 0.035);
  star.rotateZ(Math.PI / 4);
  const ring = new THREE.TorusGeometry(0.055, 0.016, 6, 12);
  const handle = shifted(new THREE.BoxGeometry(0.028, 0.09, 0.02), 0, -0.1, 0);
  const mag = mergeGeometries([ring, handle]);
  return {
    monitor: new THREE.BoxGeometry(0.14, 0.1, 0.025),
    phone: new THREE.BoxGeometry(0.07, 0.12, 0.02),
    clip: new THREE.BoxGeometry(0.11, 0.14, 0.02),
    coin,
    mag,
    book: new THREE.BoxGeometry(0.12, 0.09, 0.035),
    duster: new THREE.BoxGeometry(0.16, 0.05, 0.05),
    star
  };
}

export function shinGeo() {
  const leg = new THREE.BoxGeometry(0.12, 0.2, 0.12);
  const foot = shifted(new THREE.BoxGeometry(0.13, 0.055, 0.2), 0, -0.12, 0.05);
  return mergeGeometries([leg, foot]);
}

export function foreGeo() {
  const arm = new THREE.BoxGeometry(0.1, 0.2, 0.1);
  const hand = shifted(new THREE.BoxGeometry(0.1, 0.07, 0.08), 0, -0.13, 0.02);
  return mergeGeometries([arm, hand]);
}

/** Chunky toy person. Joints match agent-office-3d's makeCharacter, squashed to a block. */
export function makeRig() {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = HIP_STAND;
  root.add(hips);

  const legs = [-1, 1].map((s) => {
    const hip = new THREE.Group();
    hip.position.set(s * 0.11, 0, 0);
    hips.add(hip);
    const thigh = new THREE.Group();
    thigh.position.y = -0.11;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.22;
    hip.add(knee);
    const shin = new THREE.Group();
    shin.position.y = -0.1;
    knee.add(shin);
    return { hip, knee, thigh, shin };
  });

  const chest = new THREE.Group();
  hips.add(chest);
  const torso = new THREE.Group();
  torso.position.y = 0.2;
  chest.add(torso);
  const badge = new THREE.Group();
  badge.position.set(0, 0.02, 0.15);
  torso.add(badge);

  const headPivot = new THREE.Group();
  headPivot.position.y = 0.44;
  chest.add(headPivot);
  const head = new THREE.Group();
  head.position.y = 0.16;
  headPivot.add(head);
  const cap = new THREE.Group();
  cap.position.y = 0.34;
  headPivot.add(cap);
  const eyes = [-1, 1].map((s) => {
    const eye = new THREE.Group();
    eye.position.set(s * 0.08, 0.17, 0.17);
    headPivot.add(eye);
    return eye;
  });

  const arms = [-1, 1].map((s) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.26, 0.28, 0);
    shoulder.rotation.z = s * -0.18;
    chest.add(shoulder);
    const upper = new THREE.Group();
    upper.position.y = -0.12;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.24;
    shoulder.add(elbow);
    const fore = new THREE.Group();
    fore.position.y = -0.11;
    elbow.add(fore);
    const hand = new THREE.Group();
    hand.position.y = -0.24;
    elbow.add(hand);
    return { shoulder, elbow, upper, fore, hand };
  });

  const folder = new THREE.Group();
  folder.scale.setScalar(0.0001);
  folder.position.set(0, 0, 0.06);
  arms[1].hand.add(folder);

  return { root, hips, chest, torso, badge, headPivot, head, cap, eyes, arms, legs, folder };
}

export function batch(geo, material, capacity, shadows) {
  const mesh = new THREE.InstancedMesh(geo, material, capacity);
  mesh.count = capacity;
  mesh.frustumCulled = false;
  mesh.castShadow = !!shadows;
  mesh.receiveShadow = false;
  return mesh;
}
