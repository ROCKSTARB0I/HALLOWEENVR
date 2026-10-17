// HALLOWEENVR collision world. The street is a flat plane; houses add walls
// (2D segments with a height band), floors (rects and stair ramps), furniture
// boxes, and doors that swing. Everything that moves asks this for floor
// height, wall push-out and line of sight.
import * as THREE from '../vendor/three.module.js';

const CELL = 3;

export class Door {
  constructor(o) {
    Object.assign(this, { hx: 0, hz: 0, cx: 1, cz: 0, w: 0.9, y0: 0, y1: 2.1, swing: 1, angle: 0, target: 0, locked: false, hp: 5, broken: false, kind: 'door', house: null, pivot: null, max: 1.75 }, o);
    this.vel = 0;
  }
  // end of the leaf in world space
  tip() { const a = this.angle * this.swing, c = Math.cos(a), s = Math.sin(a);
    return [this.hx + (this.cx * c - this.cz * s) * this.w, this.hz + (this.cx * s + this.cz * c) * this.w]; }
  isOpen() { return Math.abs(this.angle) > 0.5 || this.broken; }
  update(dt) {
    if (this.target !== null) { const d = this.target - this.angle; this.vel += d * 30 * dt; }
    this.vel *= Math.exp(-6 * dt); this.angle += this.vel * dt;
    if (this.angle < 0) { this.angle = 0; this.vel = Math.abs(this.vel) > 1.5 ? -this.vel * 0.2 : 0; }
    if (this.angle > this.max) { this.angle = this.max; this.vel = 0; }
    if (this.pivot) this.pivot.rotation.y = -this.angle * this.swing + this.baseRot;
  }
}

export class World {
  constructor() {
    this.walls = []; this.grid = new Map(); this.floors = []; this.ramps = []; this.boxes = []; this.doors = [];
    this.lights = []; this.zones = [];   // zones: {x0,x1,z0,z1,y0,y1,indoor,house,room}
  }
  key(i, j) { return i * 10007 + j; }
  addWall(ax, az, bx, bz, y0, y1, o = {}) {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz); if (len < 1e-4) return;
    const w = { ax, az, bx, bz, y0, y1, len, dx: dx / len, dz: dz / len, thick: o.thick ?? 0.12, see: !!o.see, low: !!o.low, mat: o.mat || 'wood' };
    this.walls.push(w);
    const i0 = Math.floor((Math.min(ax, bx) - 1) / CELL), i1 = Math.floor((Math.max(ax, bx) + 1) / CELL);
    const j0 = Math.floor((Math.min(az, bz) - 1) / CELL), j1 = Math.floor((Math.max(az, bz) + 1) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = this.key(i, j); let c = this.grid.get(k); if (!c) this.grid.set(k, c = []); c.push(w); }
    return w;
  }
  // solid box: blocks walking (as 4 segments) and is a contact surface for ragdolls and blood
  addBox(x0, y0, z0, x1, y1, z1, o = {}) {
    const b = { min: new THREE.Vector3(x0, y0, z0), max: new THREE.Vector3(x1, y1, z1), top: !!o.top };
    this.boxes.push(b);
    if (o.walk !== false) {
      const t = 0.0;
      this.addWall(x0, z0, x1, z0, y0, y1, { thick: t, low: y1 - y0 < 1.2 }); this.addWall(x1, z0, x1, z1, y0, y1, { thick: t, low: y1 - y0 < 1.2 });
      this.addWall(x1, z1, x0, z1, y0, y1, { thick: t, low: y1 - y0 < 1.2 }); this.addWall(x0, z1, x0, z0, y0, y1, { thick: t, low: y1 - y0 < 1.2 });
    }
    if (o.top) this.floors.push({ x0, x1, z0, z1, y: y1, furn: true });
    return b;
  }
  addFloor(x0, z0, x1, z1, y, o = {}) { this.floors.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y, ...o }); }
  // ramp rising from y0 at coord c0 to y1 at c1 along axis ('x' | 'z')
  addRamp(x0, z0, x1, z1, axis, c0, c1, y0, y1) { this.ramps.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), axis, c0, c1, y0, y1 }); }
  addDoor(o) { const d = new Door(o); this.doors.push(d); return d; }
  addZone(z) { this.zones.push(z); }

  zoneAt(x, y, z) {
    for (const q of this.zones) if (x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1 && y >= q.y0 - 0.2 && y < q.y1) return q;
    return null;
  }
  // highest walkable surface at or a step above y
  floorAt(x, z, y, step = 0.55) {
    let best = 0;
    for (const f of this.floors) if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1 && f.y <= y + step && f.y > best) { if (f.furn && f.y > y + 0.25) continue; best = f.y; }
    for (const r of this.ramps) if (x >= r.x0 - 0.05 && x <= r.x1 + 0.05 && z >= r.z0 - 0.05 && z <= r.z1 + 0.05) {
      const c = r.axis === 'x' ? x : z, t = Math.min(1, Math.max(0, (c - r.c0) / (r.c1 - r.c0)));
      const h = r.y0 + (r.y1 - r.y0) * t; if (h <= y + step && h > best) best = h;
    }
    return best;
  }
  near(x, z, fn) {
    const i = Math.floor(x / CELL), j = Math.floor(z / CELL), seen = this._seen || (this._seen = new Set()); seen.clear();
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const c = this.grid.get(this.key(i + a, j + b)); if (c) for (const w of c) if (!seen.has(w)) { seen.add(w); fn(w); } }
  }
  // push a vertical capsule (foot y, height h, radius r) out of walls and closed door leaves
  collide(p, r, y, h = 1.7, pushDoors = null) {
    const lo = y + 0.3, hi = y + h;
    const solve = (ax, az, bx, bz, half) => {
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
      let t = ((p.x - ax) * dx + (p.z - az) * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = ax + dx * t, qz = az + dz * t, ex = p.x - qx, ez = p.z - qz, d = Math.hypot(ex, ez), R = r + half;
      if (d < R) { if (d > 1e-5) { p.x = qx + ex / d * R; p.z = qz + ez / d * R; } else { p.x += -dz / Math.sqrt(L2) * R; p.z += dx / Math.sqrt(L2) * R; } return true; }
      return false;
    };
    for (let it = 0; it < 2; it++) {
      this.near(p.x, p.z, (w) => { if (w.y1 > lo && w.y0 < hi) solve(w.ax, w.az, w.bx, w.bz, w.thick / 2); });
      for (const d of this.doors) {
        if (d.broken || d.y1 < lo || d.y0 > hi) continue;
        if (Math.abs(p.x - d.hx) > 2 || Math.abs(p.z - d.hz) > 2) continue;
        const [tx, tz] = d.tip();
        if (pushDoors && !d.locked) {
          // walking into an unlocked leaf pushes it open, away from you
          const dx = tx - d.hx, dz = tz - d.hz, L2 = dx * dx + dz * dz;
          let t = ((p.x - d.hx) * dx + (p.z - d.hz) * dz) / L2;
          if (t > 0.15 && t < 1.05) {
            const qx = d.hx + dx * t, qz = d.hz + dz * t, dist = Math.hypot(p.x - qx, p.z - qz);
            if (dist < r + 0.05) {
              const side = Math.sign((p.x - d.hx) * -dz + (p.z - d.hz) * dx) * d.swing; // which face we're on
              // a leaf only swings one way; from the far side you're pushing it against its stop
              if (side < 0) { d.target = null; d.vel = Math.max(d.vel, pushDoors * 2.5); continue; }
            }
          }
        }
        solve(d.hx, d.hz, tx, tz, 0.03);
      }
    }
  }
  // is the 3D segment a->b blocked by walls / closed doors?
  blocked(ax, ay, az, bx, by, bz, seeThroughWindows = true) {
    const dx = bx - ax, dz = bz - az;
    const hit = (cx, cz, ex, ez, y0, y1) => {
      const fx = ex - cx, fz = ez - cz, den = dx * fz - dz * fx; if (Math.abs(den) < 1e-9) return false;
      const t = ((cx - ax) * fz - (cz - az) * fx) / den, u = ((cx - ax) * dz - (cz - az) * dx) / den;
      if (t < 0 || t > 1 || u < 0 || u > 1) return false;
      const y = ay + (by - ay) * t; return y >= y0 && y <= y1;
    };
    const L = Math.hypot(dx, dz), steps = Math.max(1, Math.ceil(L / CELL)), seen = this._seen2 || (this._seen2 = new Set()); seen.clear();
    for (let s = 0; s <= steps; s++) {
      const x = ax + dx * s / steps, z = az + dz * s / steps, i = Math.floor(x / CELL), j = Math.floor(z / CELL);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const c = this.grid.get(this.key(i + a, j + b)); if (!c) continue;
        for (const w of c) { if (seen.has(w)) continue; seen.add(w); if ((w.see && seeThroughWindows) || w.low) continue; if (hit(w.ax, w.az, w.bx, w.bz, w.y0, w.y1)) return true; }
      }
    }
    for (const d of this.doors) { if (d.broken) continue; const [tx, tz] = d.tip(); if (hit(d.hx, d.hz, tx, tz, d.y0, d.y1)) return true; }
    return false;
  }
  // brightness 0..1 at a point, from nearby lit emitters plus moonlight outdoors
  lightAt(x, y, z) {
    const zone = this.zoneAt(x, y, z);
    let L = zone ? 0.02 : 0.16;
    for (const e of this.lights) {
      if (!e.on) continue;
      const d2 = (e.x - x) ** 2 + (e.y - y) ** 2 + (e.z - z) ** 2; if (d2 > e.range * e.range) continue;
      if (e.zone && zone !== e.zone && !(e.outdoor && !zone)) continue;
      L += e.see * (1 - Math.sqrt(d2) / e.range) ** 2;
    }
    return Math.min(1, L);
  }
  // nearest wall/box surface to a point for decals: returns {x,y,z,nx,ny,nz} or null
  surfaceNear(p, maxD = 0.6) {
    let best = null, bd = maxD;
    this.near(p.x, p.z, (w) => {
      if (p.y < w.y0 || p.y > w.y1) return;
      const dx = w.bx - w.ax, dz = w.bz - w.az, L2 = dx * dx + dz * dz;
      let t = ((p.x - w.ax) * dx + (p.z - w.az) * dz) / L2; if (t < 0 || t > 1) return;
      const qx = w.ax + dx * t, qz = w.az + dz * t; let ex = p.x - qx, ez = p.z - qz; const d = Math.hypot(ex, ez);
      if (d < bd) { bd = d; const nx = -w.dz, nz = w.dx, s = Math.sign(ex * nx + ez * nz) || 1; best = { x: qx + nx * s * (w.thick / 2 + 0.005), y: p.y, z: qz + nz * s * (w.thick / 2 + 0.005), nx: nx * s, ny: 0, nz: nz * s }; }
    });
    return best;
  }
}
