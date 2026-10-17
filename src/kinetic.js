// HALLOWEENVR physics: rigid bodies (position + orientation) solved with
// substepped XPBD (Müller et al. 2020). Bodies are capsules; joints are ball
// sockets with swing cones, twist limits and hinges; contacts carry static
// and kinetic friction. Hands, knives and walls attach through `Pins`.
import * as THREE from '../vendor/three.module.js';

const V = THREE.Vector3, Q = THREE.Quaternion;
const _a = new V(), _b = new V(), _c = new V(), _d = new V(), _e = new V(), _q = new Q(), _q2 = new Q();
export const GRAV = -9.81;

export class Body {
  constructor(mass, radius, a, b) {
    this.x = new V(); this.q = new Q(); this.v = new V(); this.w = new V();
    this.px = new V(); this.pq = new Q();
    this.m = mass; this.im = mass > 0 ? 1 / mass : 0;
    this.r = radius; this.a = a.clone(); this.b = b.clone();   // capsule ends in body space
    const L = a.distanceTo(b);
    // isotropic inertia keeps the world inverse inertia a scalar
    const I = mass * (L * L / 12 + radius * radius * 0.5); this.ii = mass > 0 ? 1 / I : 0;
    this.ground = 0; this.friction = 0.7; this.rig = null; this.name = '';
  }
  worldPoint(local, out) { return out.copy(local).applyQuaternion(this.q).add(this.x); }
  prevPoint(local, out) { return out.copy(local).applyQuaternion(this.pq).add(this.px); }
  // generalized inverse mass for a correction along n applied at world offset r
  wpos(r, n) { _e.crossVectors(r, n); return this.im + this.ii * _e.lengthSq(); }
  applyPos(p, r, sign) {               // p = impulse-like correction vector
    this.x.addScaledVector(p, this.im * sign);
    _e.crossVectors(r, p).multiplyScalar(this.ii * sign);
    this.rot(_e);
  }
  rot(om) {                            // q += 0.5 * [om,0] * q
    _q.set(om.x, om.y, om.z, 0).multiply(this.q);
    this.q.x += 0.5 * _q.x; this.q.y += 0.5 * _q.y; this.q.z += 0.5 * _q.z; this.q.w += 0.5 * _q.w; this.q.normalize();
  }
}

// generic positional constraint between body points (b2 may be null = world point)
function solvePoint(b1, l1, b2, l2orWorld, compliance, h, maxDist = 0) {
  const p1 = b1.worldPoint(l1, _a);
  const p2 = b2 ? b2.worldPoint(l2orWorld, _b) : _b.copy(l2orWorld);
  _c.subVectors(p2, p1); let len = _c.length();
  if (len <= maxDist + 1e-7) return 0;
  const C = len - maxDist; _c.multiplyScalar(1 / len);
  const r1 = _d.subVectors(p1, b1.x), w1 = b1.wpos(r1, _c);
  let w2 = 0, r2 = null;
  if (b2) { r2 = new V().subVectors(p2, b2.x); w2 = b2.wpos(r2, _c); }
  const lam = C / (w1 + w2 + compliance / (h * h));
  const P = _c.multiplyScalar(lam);
  b1.applyPos(P, r1, 1); if (b2) b2.applyPos(P, r2, -1);
  return lam;
}
function solveRot(b1, b2, axis, angle, h, compliance = 0) {   // rotate b1 by +, b2 by -, about world axis
  const w = b1.ii + (b2 ? b2.ii : 0) + compliance / (h * h); if (w <= 0) return;
  const lam = angle / w;
  b1.rot(_e.copy(axis).multiplyScalar(lam * b1.ii));
  if (b2) b2.rot(_e.copy(axis).multiplyScalar(-lam * b2.ii));
}

export class Joint {
  // la/lb: anchor in each body; axis: main bone axis in each body; swing: cone half-angle;
  // hinge: optional hinge axis in each body with [min,max] bend
  constructor(b1, la, b2, lb, o = {}) {
    Object.assign(this, { b1, la: la.clone(), b2, lb: lb.clone(), swing: o.swing ?? 1.2, twist: o.twist ?? 0.6,
      ax1: o.ax1?.clone(), ax2: o.ax2?.clone(), ref1: o.ref1?.clone(), ref2: o.ref2?.clone(),
      hinge1: o.hinge1?.clone(), hinge2: o.hinge2?.clone(), min: o.min ?? -2, max: o.max ?? 2, stiff: 0 });
  }
  solve(h) {
    const { b1, b2 } = this;
    solvePoint(b1, this.la, b2, this.lb, 0, h);
    if (this.hinge1) {
      const h1 = _a.copy(this.hinge1).applyQuaternion(b1.q), h2 = _b.copy(this.hinge2).applyQuaternion(b2.q);
      const cr = _c.crossVectors(h1, h2), s = cr.length();
      if (s > 1e-5) solveRot(b1, b2, cr.multiplyScalar(1 / s), Math.asin(Math.min(1, s)), h);
      // bend limit about the hinge
      const a1 = _a.copy(this.ax1).applyQuaternion(b1.q), a2 = _b.copy(this.ax2).applyQuaternion(b2.q);
      const hh = _d.copy(this.hinge1).applyQuaternion(b1.q);
      const phi = Math.atan2(_c.crossVectors(a1, a2).dot(hh), a1.dot(a2));
      const cl = Math.min(this.max, Math.max(this.min, phi));
      if (phi !== cl) solveRot(b1, b2, hh, phi - cl, h);
      return;
    }
    if (this.ax1) {
      const a1 = _a.copy(this.ax1).applyQuaternion(b1.q), a2 = _b.copy(this.ax2).applyQuaternion(b2.q);
      const ang = Math.acos(Math.max(-1, Math.min(1, a1.dot(a2))));
      if (ang > this.swing) { const n = _c.crossVectors(a1, a2); const l = n.length(); if (l > 1e-6) solveRot(b1, b2, n.multiplyScalar(1 / l), ang - this.swing, h); }
      if (this.ref1) {   // twist: compare reference axes in the plane perpendicular to the bone
        const n = _d.copy(this.ax2).applyQuaternion(b2.q);
        const r1 = _a.copy(this.ref1).applyQuaternion(b1.q), r2 = _b.copy(this.ref2).applyQuaternion(b2.q);
        r1.addScaledVector(n, -r1.dot(n)).normalize(); r2.addScaledVector(n, -r2.dot(n)).normalize();
        const tw = Math.atan2(_c.crossVectors(r1, r2).dot(n), r1.dot(r2));
        if (Math.abs(tw) > this.twist) solveRot(b1, b2, n, tw - Math.sign(tw) * this.twist, h);
      }
    }
  }
}

// a body point held to a moving world target (a hand on a throat, a knife in a wall)
export class Pin {
  constructor(body, local, target, compliance = 0) { this.body = body; this.local = local.clone(); this.target = target.clone(); this.compliance = compliance; this.maxDist = 0; this.on = true; }
  solve(h) { if (this.on) this.lambda = solvePoint(this.body, this.local, null, this.target, this.compliance, h, this.maxDist); }
}

export class Physics {
  constructor(world) { this.world = world; this.bodies = []; this.joints = []; this.pins = []; this.sub = 8; this.time = 0; this.drives = []; this.onImpact = null; }
  add(b) { this.bodies.push(b); return b; }
  joint(j) { this.joints.push(j); return j; }
  pin(p) { this.pins.push(p); return p; }
  unpin(p) { const i = this.pins.indexOf(p); if (i >= 0) this.pins.splice(i, 1); }
  remove(rig) {
    this.bodies = this.bodies.filter((b) => b.rig !== rig);
    this.joints = this.joints.filter((j) => j.b1.rig !== rig);
    this.pins = this.pins.filter((p) => p.body.rig !== rig);
  }
  step(dt) {
    dt = Math.min(dt, 1 / 30);
    const awake = this.bodies.filter((b) => !b.rig || !b.rig.asleep);
    if (!awake.length) return;
    const h = dt / this.sub;
    for (let s = 0; s < this.sub; s++) {
      for (const b of awake) {
        if (b.im === 0) continue;
        b.px.copy(b.x); b.pq.copy(b.q);
        b.v.y += GRAV * h;
        const lin = Math.exp(-0.15 * h), ang = Math.exp(-(b.rig?.angDamp ?? 3) * h);
        b.v.multiplyScalar(lin); b.w.multiplyScalar(ang);
        b.x.addScaledVector(b.v, h);
        b.rot(_e.copy(b.w).multiplyScalar(h));
      }
      for (const j of this.joints) if (!j.b1.rig?.asleep) j.solve(h);
      for (const d of this.drives) d(h);
      for (const p of this.pins) if (!p.body.rig?.asleep) p.solve(h);
      for (const b of awake) this.contacts(b, h);
      for (const b of awake) {
        if (b.im === 0) continue;
        b.v.subVectors(b.x, b.px).multiplyScalar(1 / h);
        _q2.copy(b.pq).invert(); _q.copy(b.q).multiply(_q2);
        b.w.set(_q.x * 2 / h, _q.y * 2 / h, _q.z * 2 / h); if (_q.w < 0) b.w.negate();
      }
    }
    this.time += dt;
  }
  // capsule ends and middle against floors, walls and furniture
  contacts(b, h) {
    const W = this.world;
    for (let k = 0; k < 3; k++) {
      const loc = k === 0 ? b.a : k === 1 ? b.b : _c.addVectors(b.a, b.b).multiplyScalar(0.5);
      const lp = loc.clone(), p = b.worldPoint(lp, new V());
      // floor
      const fy = W.floorAt(p.x, p.z, p.y + 0.1, 0.3);
      if (p.y - b.r < fy) this.contact(b, lp, p, new V(0, 1, 0), fy - (p.y - b.r), h, b.friction);
      // walls (thin vertical sheets)
      W.near(p.x, p.z, (w) => {
        if (p.y < w.y0 || p.y > w.y1 + b.r) return;
        const dx = w.bx - w.ax, dz = w.bz - w.az, L2 = dx * dx + dz * dz;
        let t = ((p.x - w.ax) * dx + (p.z - w.az) * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = w.ax + dx * t, qz = w.az + dz * t, ex = p.x - qx, ez = p.z - qz, d = Math.hypot(ex, ez), R = b.r + w.thick / 2;
        if (d < R && d > 1e-5 && p.y < w.y1) this.contact(b, lp, b.worldPoint(lp, new V()), new V(ex / d, 0, ez / d), R - d, h, 0.4);
      });
      for (const d of W.doors) {
        if (d.broken || Math.abs(p.x - d.hx) > 1.5 || Math.abs(p.z - d.hz) > 1.5 || p.y > d.y1 || p.y < d.y0) continue;
        const [tx, tz] = d.tip(), dx = tx - d.hx, dz = tz - d.hz, L2 = dx * dx + dz * dz;
        let t = ((p.x - d.hx) * dx + (p.z - d.hz) * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = d.hx + dx * t, qz = d.hz + dz * t, ex = p.x - qx, ez = p.z - qz, dd = Math.hypot(ex, ez);
        if (dd < b.r && dd > 1e-5) this.contact(b, lp, b.worldPoint(lp, new V()), new V(ex / dd, 0, ez / dd), b.r - dd, h, 0.4);
      }
      for (const x of W.boxes) {
        if (p.x < x.min.x - b.r || p.x > x.max.x + b.r || p.z < x.min.z - b.r || p.z > x.max.z + b.r || p.y < x.min.y - b.r || p.y > x.max.y + b.r) continue;
        const cx = Math.max(x.min.x, Math.min(p.x, x.max.x)), cy = Math.max(x.min.y, Math.min(p.y, x.max.y)), cz = Math.max(x.min.z, Math.min(p.z, x.max.z));
        const n = new V(p.x - cx, p.y - cy, p.z - cz); let d = n.length();
        if (d < 1e-5) { n.set(0, 1, 0); d = 0; const up = x.max.y - p.y; this.contact(b, lp, p, n, up + b.r, h, 0.6); continue; }
        if (d < b.r) this.contact(b, lp, p, n.multiplyScalar(1 / d), b.r - d, h, 0.6);
      }
    }
  }
  contact(b, local, p, n, depth, h, mu) {
    const r = new V().subVectors(p, b.x);
    const w = b.wpos(r, n), lam = depth / w;
    b.applyPos(n.clone().multiplyScalar(lam), r, 1);
    // friction: undo tangential motion of the contact point this substep
    const now = b.worldPoint(local, new V()), prev = b.prevPoint(local, new V());
    const dp = now.sub(prev); dp.addScaledVector(n, -dp.dot(n));
    const dl = dp.length();
    if (dl > 1e-7) {
      const t = dp.multiplyScalar(1 / dl), wt = b.wpos(r, t);
      const corr = Math.min(dl, mu * depth * 4 + dl * 0.15);
      b.applyPos(t.multiplyScalar(-corr / wt), r, 1);
    }
    const vn = b.v.dot(n);
    if (vn < -2.5 && this.onImpact) this.onImpact(b, p, -vn);
  }
}
