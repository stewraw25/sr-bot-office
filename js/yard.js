/* Smallholding around the hut: barn, stables, animals, vans, wizard.
   Blocky vehicles and the wheel helper follow the same primitive style as
   agent-office-3d's props. Movement is gentle and local — nothing here is status. */
import * as THREE from 'three';
import { lambert, basic, grassTexture, brandMaterial } from './kit.js';

const animals = { horses: [], poodles: [], ducks: [], chickens: [], wizard: null, clouds: [], chickenMeshes: null };
const _m1 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

function wheel(parent, x, y, z, r) {
  const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.16, 12), lambert(0x141414));
  w.rotation.z = Math.PI / 2;
  w.position.set(x, y, z);
  parent.add(w);
}

function caravan(scene, x, z, s, color, roofColor = 0xf4f1ea) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.15 * s, 0.85 * s, 2.1 * s), lambert(color));
  body.position.y = 0.7 * s;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.2 * s, 0.12 * s, 2.2 * s), lambert(roofColor));
  roof.position.y = 1.16 * s;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.55 * s, 0.32 * s), lambert(0x6a4630));
  door.position.set(0.58 * s, 0.7 * s, 0.3 * s);
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.04 * s, 0.28 * s, 0.4 * s), basic(0xb7d4e8));
  win.position.set(0.58 * s, 0.85 * s, -0.35 * s);
  g.add(body, roof, door, win);
  wheel(g, 0.48 * s, 0.28 * s, 0.55 * s, 0.22 * s);
  wheel(g, -0.48 * s, 0.28 * s, 0.55 * s, 0.22 * s);
  wheel(g, 0.48 * s, 0.28 * s, -0.55 * s, 0.22 * s);
  wheel(g, -0.48 * s, 0.28 * s, -0.55 * s, 0.22 * s);
  g.position.set(x, 0, z);
  scene.add(g);
}

function tree(scene, x, z, s) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 0.7 * s, 6), lambert(0x6b4630));
  trunk.position.y = 0.35 * s;
  const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 * s, 0), lambert(0x3f8a3a));
  leaf.position.y = 0.95 * s;
  const leaf2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38 * s, 0), lambert(0x4e9a44));
  leaf2.position.set(0.2 * s, 1.25 * s, 0.1 * s);
  g.add(trunk, leaf, leaf2);
  g.position.set(x, 0, z);
  scene.add(g);
}

function pitchedRoof(parent, w, d, y, color) {
  const mat = lambert(color);
  const left = new THREE.Mesh(new THREE.BoxGeometry(w * 0.56, 0.1, d), mat);
  left.position.set(-w * 0.22, y, 0);
  left.rotation.z = 0.42;
  const right = new THREE.Mesh(new THREE.BoxGeometry(w * 0.56, 0.1, d), mat);
  right.position.set(w * 0.22, y, 0);
  right.rotation.z = -0.42;
  parent.add(left, right);
}

export function buildYard(scene) {
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 70),
    new THREE.MeshLambertMaterial({ map: grassTexture() })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.02;
  scene.add(grass);

  const dirt = new THREE.Mesh(new THREE.CircleGeometry(1.45, 16), lambert(0x8a6844));
  dirt.rotation.x = -Math.PI / 2;
  dirt.position.set(-5.5, 0.01, -11.6);
  scene.add(dirt);
  const mound = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.38, 6), lambert(0x6e5034));
  mound.position.set(-4.6, 0.18, -12.15);
  scene.add(mound);

  const gravel = new THREE.Mesh(new THREE.BoxGeometry(12, 0.04, 3.4), lambert(0x9a9288));
  gravel.position.set(-10.2, 0.02, 11.0);
  scene.add(gravel);

  buildBarn(scene);
  buildStables(scene);
  buildFence(scene);
  buildPond(scene);
  buildVehicles(scene);
  buildCritters(scene);
  buildWizard(scene);
  [[-18.4, -4.2], [-18.6, 8.2], [17.6, -5.4], [17.2, 6.4], [-5.5, -14.2], [9.5, 13.2]].forEach(([x, z], i) => tree(scene, x, z, 0.7 + (i % 3) * 0.2));

  caravan(scene, -8.2, -12.6, 0.9, 0xffffff, 0xf7f7f5);
  caravan(scene, -1.4, -13.2, 0.8, 0xdfeadf);
  caravan(scene, 6.4, -12.4, 0.78, 0xf0d8c0);
  caravan(scene, -22, -17.5, 0.42, 0xefe6d6);
  caravan(scene, 20, -16.2, 0.4, 0xe4eee6);

  for (let i = 0; i < 5; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 + k * 0.2, 0), lambert(0xfffaf4));
      p.position.set(k * 0.7, 0.2 * k, (k % 2) * 0.3);
      c.add(p);
    }
    c.position.set(-18 + i * 9, 11 + (i % 2) * 1.5, -20 - i);
    scene.add(c);
    animals.clouds.push(c);
  }
}

function buildBarn(scene) {
  const g = new THREE.Group();
  const wall = lambert(0x8d5a34);
  const trim = lambert(0x5c3a24);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(8.2, 3.1, 0.2), wall)).position.set(0, 1.55, -3.3);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.1, 6.6), wall)).position.set(-4.1, 1.55, 0);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.1, 6.6), wall)).position.set(4.1, 1.55, 0);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 0.08), basic(0xc5e6f4));
  glass.material.transparent = true;
  glass.material.opacity = 0.45;
  glass.position.set(0, 1.4, 3.28);
  g.add(glass);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.12), trim)).position.set(-2.4, 1.2, 3.3);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.12), trim)).position.set(2.4, 1.2, 3.3);
  pitchedRoof(g, 9.2, 7.2, 3.35, 0x3a2a24);
  const win = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.08), basic(0xd5ecf8));
  win.position.set(-2.2, 1.8, -3.2);
  g.add(win);
  g.scale.setScalar(0.55);
  g.position.set(15.35, 0, 1.15);
  scene.add(g);
}

function buildStables(scene) {
  const g = new THREE.Group();
  const wood = lambert(0x7a4e30);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(6.4, 2.2, 0.16), wood)).position.set(0, 1.1, -1.5);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 3), wood)).position.set(-3.2, 1.1, 0);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 3), wood)).position.set(3.2, 1.1, 0);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 3), wood)).position.set(0, 1.1, 0);
  pitchedRoof(g, 7, 3.4, 2.45, 0x3a2e28);
  const hay = lambert(0xd2b15a);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 1.4), hay)).position.set(-1.5, 0.25, 0.2);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 1.2), hay)).position.set(1.5, 0.2, 0.1);
  g.scale.setScalar(0.7);
  g.position.set(-16.2, 0, -10.1);
  scene.add(g);
}

function buildFence(scene) {
  const posts = lambert(0xc2a06a);
  const x0 = -18.6;
  const x1 = -13.6;
  const z0 = -11.5;
  const z1 = -7.7;
  const spots = [];
  for (let x = x0; x <= x1 + 0.01; x += 1.6) spots.push([x, z0], [x, z1]);
  for (let z = z0 + 1.6; z < z1 - 0.01; z += 1.6) spots.push([x0, z], [x1, z]);
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), posts, spots.length);
  mesh.frustumCulled = false;
  const m = new THREE.Matrix4();
  spots.forEach(([x, z], i) => {
    m.makeTranslation(x, 0.45, z);
    mesh.setMatrixAt(i, m);
  });
  scene.add(mesh);
  const rail = (x, z, w, d) => {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), posts);
    r.position.set(x, 0.55, z);
    scene.add(r);
    const r2 = r.clone();
    r2.position.y = 0.28;
    scene.add(r2);
  };
  rail((x0 + x1) / 2, z0, x1 - x0, 0.08);
  rail((x0 + x1) / 2, z1, x1 - x0, 0.08);
  rail(x0, (z0 + z1) / 2, 0.08, z1 - z0);
  rail(x1, (z0 + z1) / 2, 0.08, z1 - z0);
}

function buildPond(scene) {
  const pond = new THREE.Mesh(new THREE.CircleGeometry(2.15, 20), lambert(0x2f86b0));
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(-15.6, 0.02, 4.0);
  scene.add(pond);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(1.25, 16), lambert(0x49a8cc));
  inner.rotation.x = -Math.PI / 2;
  inner.position.set(-15.7, 0.03, 4.1);
  scene.add(inner);
  const reeds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), lambert(0x3e8a3c), 5);
  reeds.frustumCulled = false;
  const rm = new THREE.Matrix4();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 1.2;
    rm.makeTranslation(-15.6 + Math.cos(a) * 1.9, 0.25, 4.0 + Math.sin(a) * 1.6);
    reeds.setMatrixAt(i, rm);
  }
  scene.add(reeds);
}

function buildVehicles(scene) {
  const van = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.55, 3.35), lambert(0xf7f8f6));
  body.position.y = 1.15;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.85), basic(0xc5dde6));
  cab.position.set(0, 1.45, 1.15);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.12, 3.38), lambert(0x1d4e89));
  stripe.position.y = 0.72;
  const brand = brandMaterial(['STEWART RAWSON', 'ELECTRICAL'], '#1d4e89', '#f7f8f6');
  const side = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.7), brand);
  side.position.set(0.74, 1.25, -0.15);
  side.rotation.y = Math.PI / 2;
  const side2 = side.clone();
  side2.position.x = -0.74;
  side2.rotation.y = -Math.PI / 2;
  const roofBrand = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.15), brand);
  roofBrand.rotation.order = 'YXZ';
  roofBrand.rotation.y = Math.PI / 2;
  roofBrand.rotation.x = -Math.PI / 2;
  roofBrand.position.set(0, 1.94, -0.2);
  van.add(body, cab, stripe, side, side2, roofBrand);
  wheel(van, 0.72, 0.38, 1.05, 0.36);
  wheel(van, -0.72, 0.38, 1.05, 0.36);
  wheel(van, 0.72, 0.38, -1.05, 0.36);
  wheel(van, -0.72, 0.38, -1.05, 0.36);
  van.position.set(-11.3, 0, 11.05);
  van.rotation.y = 0.45;
  scene.add(van);

  const sec = new THREE.Group();
  const sb = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 2.15), lambert(0x173e66));
  sb.position.y = 0.9;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.42, 0.55), basic(0xd0e4ee));
  glass.position.set(0, 1.22, 0.75);
  const sbrand = brandMaterial('SR SECURITY', '#f4f7fb', '#173e66');
  const ss = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.36), sbrand);
  ss.position.set(0.59, 0.95, -0.05);
  ss.rotation.y = Math.PI / 2;
  const ss2 = ss.clone();
  ss2.position.x = -0.59;
  ss2.rotation.y = -Math.PI / 2;
  const sroof = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.9), sbrand);
  sroof.rotation.order = 'YXZ';
  sroof.rotation.y = Math.PI / 2;
  sroof.rotation.x = -Math.PI / 2;
  sroof.position.set(0, 1.5, -0.05);
  sec.add(sb, glass, ss, ss2, sroof);
  wheel(sec, 0.58, 0.32, 0.65, 0.3);
  wheel(sec, -0.58, 0.32, 0.65, 0.3);
  wheel(sec, 0.58, 0.32, -0.62, 0.3);
  wheel(sec, -0.58, 0.32, -0.62, 0.3);
  sec.position.set(-7.4, 0, 10.7);
  sec.rotation.y = -0.15;
  scene.add(sec);

  const tesla = new THREE.Group();
  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.32, 2.3), lambert(0x121212));
  lower.position.y = 0.34;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 1.2), lambert(0x161616));
  cabin.position.set(0, 0.68, -0.02);
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.1, 0.66), lambert(0x141414));
  hatch.position.set(0, 0.82, -0.72);
  hatch.rotation.x = -0.35;
  const tglass = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 0.86), basic(0x1a242c));
  tglass.position.set(0, 0.8, 0.04);
  tesla.add(lower, cabin, hatch, tglass);
  wheel(tesla, 0.68, 0.3, 0.95, 0.3);
  wheel(tesla, -0.68, 0.3, 0.95, 0.3);
  wheel(tesla, 0.68, 0.3, -0.95, 0.3);
  wheel(tesla, -0.68, 0.3, -0.95, 0.3);
  tesla.position.set(-6.0, 0, 12.6);
  tesla.rotation.y = -0.35;
  scene.add(tesla);
}

function buildCritters(scene) {
  for (let i = 0; i < 2; i++) {
    const h = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.55, 0.38), lambert(0x161616));
    body.position.y = 0.95;
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.5, 0.22), lambert(0x141414));
    neck.position.set(0.55, 1.25, 0);
    neck.rotation.z = -0.7;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.2), lambert(0x121212));
    head.position.set(0.82, 1.48, 0);
    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.08), lambert(0x0c0c0c));
    mane.position.set(0.35, 1.28, 0);
    const legs = [];
    [[0.35, 0.12], [0.35, -0.12], [-0.38, 0.12], [-0.38, -0.12]].forEach(([lx, lz]) => {
      const pivot = new THREE.Group();
      pivot.position.set(lx, 0.72, lz);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.1), lambert(0x101010));
      leg.position.y = -0.28;
      pivot.add(leg);
      h.add(pivot);
      legs.push(pivot);
    });
    h.add(body, neck, head, mane);
    h.position.set(-17.2 + i * 1.6, 0, -9.3);
    scene.add(h);
    animals.horses.push({
      mesh: h, legs, x: h.position.x, z: h.position.z,
      tx: h.position.x + 1.2, tz: -8.6, speed: 0.38,
      minX: -18.1, maxX: -14.2, minZ: -11.0, maxZ: -8.2
    });
  }

  const loop = [
    { x: -17.4, z: 7.4 }, { x: -14.4, z: 7.8 }, { x: -13.6, z: 6.6 },
    { x: -14.2, z: 6.5 }, { x: -17.6, z: 6.4 }, { x: -17.8, z: 7.0 }
  ];
  for (let i = 0; i < 2; i++) {
    const p = new THREE.Group();
    const fur = lambert(0xd23b3b);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), fur);
    body.position.y = 0.28;
    body.scale.set(1.25, 0.9, 0.9);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 7), fur);
    head.position.set(0.22, 0.4, 0);
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), fur);
    tail.position.set(-0.26, 0.32, 0);
    p.add(body, head, tail);
    const start = loop[i * 2];
    p.position.set(start.x, 0, start.z);
    scene.add(p);
    animals.poodles.push({ mesh: p, points: loop, i: i * 2, speed: 0.55 });
  }

  for (let i = 0; i < 6; i++) {
    const d = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lambert(0xfffaf2));
    body.scale.set(1.3, 0.75, 0.9);
    body.position.y = 0.16;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 6), lambert(0xfffaf2));
    head.position.set(0.16, 0.26, 0);
    const beak = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.04), lambert(0xe39a3a));
    beak.position.set(0.26, 0.26, 0);
    d.add(body, head, beak);
    scene.add(d);
    animals.ducks.push({ mesh: d, angle: (Math.PI * 2 * i) / 6, speed: 0.22 + (i % 3) * 0.04 });
  }

  const colors = [0xf7f1e3, 0xe6d2a8, 0xd08a45, 0xfffaf2, 0x8d5a34, 0xf0e2c0, 0xc46a3a, 0xefe6c9, 0xf4d7a8];
  const flocks = [
    { x: -16.6, z: 6.6, n: 10, sx: 2.4, sz: 1.6 },
    { x: 14.2, z: 6.6, n: 8, sx: 2.2, sz: 1.5 }
  ];
  const total = flocks.reduce((n, f) => n + f.n, 0);
  const bodies = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshLambertMaterial({ color: 0xffffff }), total);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 5, 4), new THREE.MeshLambertMaterial({ color: 0xffffff }), total);
  const beaks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.025, 0.025), lambert(0xe09a3a), total);
  const combs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.04, 0.02), lambert(0xc43838), total);
  [bodies, heads, beaks, combs].forEach((mesh) => { mesh.frustumCulled = false; scene.add(mesh); });
  animals.chickenMeshes = { bodies, heads, beaks, combs };
  let index = 0;
  flocks.forEach((f) => {
    for (let i = 0; i < f.n; i++) {
      const x = f.x + (i % 5) * 0.42;
      const z = f.z + Math.floor(i / 5) * 0.48;
      const color = new THREE.Color(colors[(index) % colors.length]);
      bodies.setColorAt(index, color);
      heads.setColorAt(index, color);
      animals.chickens.push({
        i: index, x, z, tx: x, tz: z, rot: 0, peckX: 0,
        minX: f.x - 0.3, maxX: f.x + f.sx, minZ: f.z - 0.2, maxZ: f.z + f.sz,
        wait: (i % 5) * 0.35, speed: 0.28, peck: index * 0.7, moving: i % 2 === 0
      });
      index += 1;
    }
  });
  bodies.instanceColor.needsUpdate = true;
  heads.instanceColor.needsUpdate = true;
}

function buildWizard(scene) {
  const mage = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.85, 8), lambert(0x3a2d8a));
  robe.position.y = 0.48;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 7), lambert(0xf0c7a0));
  head.position.y = 1.02;
  const beard = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.1), lambert(0xd5d5d5));
  beard.position.set(0.02, 0.82, 0.08);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.48, 8), lambert(0x2a2168));
  hat.position.y = 1.38;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 8), lambert(0x2a2168));
  brim.position.y = 1.16;
  const spade = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.8, 5), lambert(0x8a5a32));
  handle.position.y = 0.4;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.03), lambert(0xb0b4b8));
  blade.position.y = 0.02;
  spade.add(handle, blade);
  spade.position.set(0.32, 0.15, 0.12);
  spade.rotation.z = 0.4;
  mage.add(robe, head, beard, hat, brim, spade);

  const digger = new THREE.Group();
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.32, 1.45), lambert(0xe2b423));
  chassis.position.y = 0.42;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.62, 0.72), lambert(0xe2b423));
  cab.position.set(0, 0.85, -0.15);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.32, 0.06), basic(0xc5e4f2));
  glass.position.set(0, 0.95, 0.22);
  const boom = new THREE.Group();
  boom.position.set(0, 0.62, 0.55);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.85), lambert(0x2a2a2a));
  arm.position.set(0, 0.15, 0.35);
  arm.rotation.x = 0.4;
  const bucket = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.26), lambert(0x333333));
  bucket.position.set(0, -0.05, 0.78);
  boom.add(arm, bucket);
  [-0.42, 0.42].forEach((x) => {
    const track = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 1.35), lambert(0x1a1a1a));
    track.position.set(x, 0.18, 0);
    digger.add(track);
  });
  digger.add(chassis, cab, glass, boom);
  mage.position.set(-6.35, 0, -11.15);
  digger.position.set(-5.15, 0, -12.05);
  scene.add(mage, digger);
  animals.wizard = { mage, digger, boom, spade };
}

export function stepYard(dt, t) {
  for (const h of animals.horses) {
    const dx = h.tx - h.x;
    const dz = h.tz - h.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.15) {
      h.tx = h.minX + Math.random() * (h.maxX - h.minX);
      h.tz = h.minZ + Math.random() * (h.maxZ - h.minZ);
    } else {
      h.x += (dx / dist) * h.speed * dt;
      h.z += (dz / dist) * h.speed * dt;
      h.mesh.rotation.y = Math.atan2(dx, dz);
      const s = Math.sin(t * 3.2);
      h.legs[0].rotation.x = s * 0.35;
      h.legs[1].rotation.x = s * 0.35;
      h.legs[2].rotation.x = -s * 0.35;
      h.legs[3].rotation.x = -s * 0.35;
    }
    h.mesh.position.x = h.x;
    h.mesh.position.z = h.z;
  }
  for (const p of animals.poodles) {
    const target = p.points[p.i];
    const dx = target.x - p.mesh.position.x;
    const dz = target.z - p.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.08) p.i = (p.i + 1) % p.points.length;
    else {
      p.mesh.position.x += (dx / dist) * p.speed * dt;
      p.mesh.position.z += (dz / dist) * p.speed * dt;
      p.mesh.rotation.y = Math.atan2(dx, dz);
    }
  }
  const pond = { x: -15.6, z: 4.0, r: 1.25 };
  for (const d of animals.ducks) {
    d.angle += d.speed * dt;
    d.mesh.position.x = pond.x + Math.cos(d.angle) * pond.r;
    d.mesh.position.z = pond.z + Math.sin(d.angle) * pond.r * 0.72;
    d.mesh.position.y = 0.02;
    d.mesh.rotation.y = d.angle + Math.PI / 2;
  }
  const cm = _m1;
  const cq = _q;
  const ce = _e;
  for (const c of animals.chickens) {
    if (c.moving) {
      const dx = c.tx - c.x;
      const dz = c.tz - c.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.05) {
        c.moving = false;
        c.wait = 0.8 + Math.random() * 1.6;
      } else {
        c.x += (dx / dist) * c.speed * dt;
        c.z += (dz / dist) * c.speed * dt;
        c.rot = Math.atan2(dx, dz);
      }
      c.peckX = 0;
    } else {
      c.wait -= dt;
      c.peckX = Math.sin(t * 2.4 + c.peck) > 0.72 ? 0.7 : 0;
      if (c.wait <= 0) {
        c.tx = c.minX + Math.random() * (c.maxX - c.minX);
        c.tz = c.minZ + Math.random() * (c.maxZ - c.minZ);
        c.moving = true;
      }
    }
    ce.set(0, c.rot, 0);
    cq.setFromEuler(ce);
    _p.set(c.x, 0.16, c.z);
    _s.set(1.25, 0.85, 0.85);
    cm.compose(_p, cq, _s);
    animals.chickenMeshes.bodies.setMatrixAt(c.i, cm);
    const hx = Math.cos(c.rot) * 0.12 - Math.sin(c.rot) * 0;
    const hz = Math.sin(c.rot) * 0.12;
    ce.set(c.peckX, c.rot, 0);
    cq.setFromEuler(ce);
    _p.set(c.x + hx, 0.28, c.z + hz);
    _s.set(1, 1, 1);
    cm.compose(_p, cq, _s);
    animals.chickenMeshes.heads.setMatrixAt(c.i, cm);
    const bx = Math.cos(c.rot) * 0.18;
    const bz = Math.sin(c.rot) * 0.18;
    _p.set(c.x + bx, 0.28 - c.peckX * 0.04, c.z + bz);
    cm.compose(_p, cq, _s);
    animals.chickenMeshes.beaks.setMatrixAt(c.i, cm);
    _p.set(c.x + Math.cos(c.rot) * 0.1, 0.34, c.z + Math.sin(c.rot) * 0.1);
    cm.compose(_p, cq, _s);
    animals.chickenMeshes.combs.setMatrixAt(c.i, cm);
  }
  const meshes = animals.chickenMeshes;
  meshes.bodies.instanceMatrix.needsUpdate = true;
  meshes.heads.instanceMatrix.needsUpdate = true;
  meshes.beaks.instanceMatrix.needsUpdate = true;
  meshes.combs.instanceMatrix.needsUpdate = true;
  const w = animals.wizard;
  if (w) {
    w.spade.rotation.z = 0.25 + Math.sin(t * 1.6) * 0.45;
    w.boom.rotation.x = Math.sin(t * 0.8) * 0.25;
    w.mage.rotation.y = 2.15 + Math.sin(t * 0.4) * 0.12;
    w.digger.position.x = -5.15 + Math.sin(t * 0.25) * 0.28;
  }
  for (const c of animals.clouds) {
    c.position.x += dt * 0.35;
    if (c.position.x > 34) c.position.x = -34;
  }
}
