// Geometry builder: stacks colored primitives into one merged geometry per material channel.
// Every piece of the puzzle is built with this, so a piece costs only a few draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

// texture tiling per channel (world units -> uv)
const UVS = { body: 0.45, brick: 1.3, water: 0.35, letters: 0.45 };

function worldUV(g, k, plainTops = false) {
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { if (plainTops) { u = 0.1; v = 0.06; } else { u = p.getX(i) * k; v = p.getZ(i) * k; } uv[i * 2] = u; uv[i * 2 + 1] = v; continue; }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u * k; uv[i * 2 + 1] = v * k;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export class Builder {
  constructor() { this.groups = {}; this.glows = []; }

  add(geo, color, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && !(name === 'uv' && o.uv)) g.deleteAttribute(name);
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ');
    _q.setFromEuler(_e);
    _p.set(o.x || 0, o.y || 0, o.z || 0);
    _s.set(o.sx || 1, o.sy || 1, o.sz || 1);
    g.applyMatrix4(_m.compose(_p, _q, _s));
    const ch = o.ch || 'body';
    if (!o.uv) worldUV(g, UVS[ch] ?? 1, ch === 'brick');
    const n = g.attributes.position.count, a = new Float32Array(n * 3);
    _c.set(color || 0xffffff);
    for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    g.clearGroups();
    (this.groups[ch] ||= []).push(g);
    return this;
  }

  // box with its bottom at y
  box(x, y, z, w, h, d, color, o = {}) {
    const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0);
    return this.add(g, color, { ...o, x, y, z });
  }
  // box centered at (x,y,z)
  boxC(x, y, z, w, h, d, color, o = {}) {
    return this.add(new THREE.BoxGeometry(w, h, d), color, { ...o, x, y, z });
  }
  // cylinder, bottom at y (or centered with o.c)
  cyl(x, y, z, r, h, color, o = {}) {
    const g = new THREE.CylinderGeometry(o.rt ?? r, r, h, o.seg ?? 12);
    if (!o.c) g.translate(0, h / 2, 0);
    return this.add(g, color, { ...o, x, y, z });
  }
  // vertical laser-cut plate: shape in local XY, thickness t along local z
  plate(shp, t, x, y, z, color, o = {}) {
    const g = new THREE.ExtrudeGeometry(shp, { depth: t, bevelEnabled: false, curveSegments: o.cs ?? 6 });
    g.translate(0, 0, -t / 2);
    return this.add(g, color, { ...o, x, y, z });
  }
  // horizontal slab: polygon in (x,z), from y to y+h
  slab(pts, y, h, color, o = {}) {
    const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
    g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
    return this.add(g, color, o);
  }
  // night glow sprite anchor
  glow(x, y, z, size, color) { this.glows.push({ x, y, z, size, color }); return this; }

  build() {
    const out = {};
    for (const k in this.groups) {
      out[k] = mergeGeometries(this.groups[k], false);
      this.groups[k].forEach(g => g.dispose());
    }
    return out;
  }
}

// ---------- 2D helpers ----------
export const shape = pts => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));

export function roundRect(path, w, h, r, cx = 0, cy = 0) {
  const x = cx - w / 2, y = cy - h / 2;
  path.moveTo(x + r, y); path.lineTo(x + w - r, y); path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r); path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h); path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r); path.quadraticCurveTo(x, y, x + r, y);
  return path;
}

// stylised maple leaf, height ~2*s
const LEAF_R = [[0, 1], [0.2, 0.6], [0.42, 0.72], [0.34, 0.28], [0.72, 0.5], [0.66, 0.3], [0.95, 0.2],
  [0.55, -0.12], [0.62, -0.34], [0.1, -0.26], [0.05, -0.62], [0.05, -0.95]];
export function leafPts(s = 1) {
  const L = [...LEAF_R].reverse().map(([x, y]) => [-x, y]);
  return [...LEAF_R, ...L.slice(0, -1)].map(([x, y]) => [x * s, y * s]);
}

// scalloped cloud outline (tree canopies)
export function cloudPts(R, lobes = 7, amp = 0.14, sq = 0.82, ph = 0, n = 44) {
  const a = [];
  for (let i = 0; i < n; i++) {
    const t = i / n * Math.PI * 2;
    const r = R * (1 - amp + amp * Math.abs(Math.cos(t * lobes / 2 + ph)));
    a.push([Math.cos(t) * r, Math.sin(t) * r * sq]);
  }
  return a;
}

// rounded rectangle outline in (x,z) with an optional gentle wobble (plywood base boards)
export function blob(x0, z0, x1, z1, r, amp = 0, freq = 3, phase = 0, segs = 8) {
  const corners = [[x1 - r, z1 - r, 0], [x0 + r, z1 - r, 0.5], [x0 + r, z0 + r, 1], [x1 - r, z0 + r, 1.5]];
  const P = [];
  for (const [cx, cz, a0] of corners) for (let i = 0; i <= segs; i++) {
    const a = (a0 + i / segs * 0.5) * Math.PI;
    P.push([cx + r * Math.cos(a), cz + r * Math.sin(a), Math.cos(a), Math.sin(a)]);
  }
  const res = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.round(d / 0.45));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      let nx = a[2] + (b[2] - a[2]) * t, nz = a[3] + (b[3] - a[3]) * t;
      const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
      res.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, nx, nz]);
    }
  }
  return res.map(([x, z, nx, nz]) => {
    const w = amp * Math.sin(phase + (x * 0.9 + z * 0.7) * freq * 0.5);
    return [x + nx * w, z + nz * w];
  });
}

// push polygon points out (d>0) or in (d<0) from the centroid
export function grow(pts, d) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(([x, z]) => {
    const dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz) || 1;
    return [x + dx / l * d, z + dz / l * d];
  });
}

// windows evenly spaced along polygon edges, facing outward
export function edgeWindows(b, pts, edges, y, h, w, gap, o = {}) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const out = o.out ?? 0.015;
  for (const i of edges) {
    const a = pts[i], c = pts[(i + 1) % pts.length];
    const dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz);
    const n = Math.floor((len + gap) / (w + gap));
    if (n < 1) continue;
    const ry = Math.atan2(-dz, dx);
    let nx = dz / len, nz = -dx / len;
    const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
    if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }
    const total = n * w + (n - 1) * gap, start = (len - total) / 2 + w / 2;
    for (let k = 0; k < n; k++) {
      const t = (start + k * (w + gap)) / len;
      const x = a[0] + dx * t + nx * out, z = a[1] + dz * t + nz * out;
      b.box(x, y, z, w, h, 0.05, o.color || 0, { ry, ch: o.ch || 'glow' });
      if (o.sill) b.box(x + nx * 0.02, y - 0.05, z + nz * 0.02, w + 0.08, 0.05, 0.06, o.sill, { ry });
    }
  }
}
