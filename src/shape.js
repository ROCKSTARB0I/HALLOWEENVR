// The Shape: the player. A full skinned body under the camera (coveralls,
// boots, bare hands, the mask) whose arms reach for the tracked hands by
// two-bone IK and whose legs walk with you. The right hand never lets go of
// the kitchen knife unless it's buried in a wall; the left hand strangles.
import * as THREE from '../vendor/three.module.js';
import { Person, BI } from './flesh.js?v=6';
import { Pin } from './kinetic.js?v=6';

const V = THREE.Vector3, Q = THREE.Quaternion;
const _v = new V(), _v2 = new V(), _v3 = new V(), _q = new Q(), _q2 = new Q();
const UP = new V(0, 1, 0);

export const MICHAEL = { name: 'Michael', sex: 'm', height: 1.93, skin: 0xd2b49c, shirt: 0x283041, pants: 0x283041, shoes: 0x0e0c0b, belt: 0x222a38, build: 1.1, boots: true,
  mask: true, hairStyle: 'mask', hair: 0x3b2c20, seed: 31, iris: [0.02, 0.02, 0.02] };

function makeKnife() {
  // 8" chef's knife: tapered steel blade, brass-riveted wood handle
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(0.021, 0); s.bezierCurveTo(0.024, -0.08, 0.02, -0.15, 0.002, -0.215); s.lineTo(0, -0.215); s.lineTo(-0.003, -0.2); s.lineTo(-0.003, 0); s.lineTo(0, 0);
  const bg = new THREE.ExtrudeGeometry(s, { depth: 0.0022, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0012, bevelSegments: 1, steps: 1 });
  bg.translate(-0.009, 0, -0.0011);
  const steel = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, metalness: 1, roughness: 0.22 });
  const blade = new THREE.Mesh(bg, steel); blade.castShadow = true; g.add(blade);
  // a blood skin on the blade that thickens with every kill
  const blood = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ color: 0x3a0303, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2 }));
  blood.scale.set(1.04, 1.0, 1.25); blood.position.y = -0.0005; g.add(blood);
  const wood = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.6 });
  const hg = new THREE.BoxGeometry(0.024, 0.115, 0.016); hg.translate(-0.002, 0.065, 0);
  const handle = new THREE.Mesh(hg, wood); handle.castShadow = true; g.add(handle);
  const brass = new THREE.MeshStandardMaterial({ color: 0xb89a5a, metalness: 1, roughness: 0.3 });
  for (const y of [0.03, 0.065, 0.1]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.0175, 8).rotateX(Math.PI / 2), brass); r.position.set(-0.002, y, 0); g.add(r); }
  const bol = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.008, 0.012), steel); bol.position.set(-0.001, 0.004, 0); g.add(bol);
  g.userData.blood = blood;
  return g;
}

function segSeg(p1, q1, p2, q2, c1, c2) {   // closest points between two segments
  const d1 = _v.subVectors(q1, p1).clone(), d2 = _v.subVectors(q2, p2).clone(), r = _v.subVectors(p1, p2).clone();
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s, t;
  const c = d1.dot(r), b = d1.dot(d2), den = a * e - b * b;
  s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
  t = (b * s + f) / e;
  if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
  c1.copy(p1).addScaledVector(d1, s); c2.copy(p2).addScaledVector(d2, t);
  return c1.distanceTo(c2);
}

export class Shape {
  constructor(scene, world, phys, camera, dolly, fx) {
    this.scene = scene; this.W = world; this.phys = phys; this.camera = camera; this.dolly = dolly; this.fx = fx;
    this.body = new Person(scene, MICHAEL);
    this.body.mesh.traverse?.(() => {});
    this.dressCoveralls();
    this.headHidden = true; this.body.B.head.scale.setScalar(0.001);
    this.floorY = 0; this.yaw = 0; this.pitch = 0; this.tilt = 0; this.bodyYaw = 0;
    this.speed = 0; this.unseen = false; this.stepDist = 0;
    // Evil Within: stalking the unaware builds his strength in three tiers
    this.evil = { tier: 1, pts: 0, t3: 0 }; this.stunned = 0;
    this.knife = makeKnife(); scene.add(this.knife);
    this.knifeHeld = true; this.knifeTip = new V(); this.knifeBase = new V(); this.prevTip = new V(); this.tipVel = new V(); this.bladeDir = new V(0, -1, 0);
    this.stuck = null; this.embedded = null; this.blood = 0;
    this.hand = { l: { pos: new V(), quat: new Q(), prev: new V(), vel: new V(), angVel: 0, prevQ: new Q() }, r: { pos: new V(), quat: new Q(), prev: new V(), vel: new V() } };
    this.grip = 'icepick';
    this.stab = 0; this.grabbing = null; this.grabT = 0; this.desk = { reach: 0 };
    this.down = 0; this.hp = 6; this.events = [];
    // WebXR grip space: origin in the curled fingers, -Z along the handle toward the thumb,
    // +X out of the back of the right hand, +Y back along the forearm. The hand model hangs
    // fingers-down (wrist +Y, thumb +Z, palm inward), so a half turn about Y lines it up.
    this.handOffset = new Q().setFromAxisAngle(new V(0, 1, 0), Math.PI);
    this.wristOff = new V(0, 0.08, 0);
    this.knifeOffset = new Q(); this.knifePos = new V(); this.setGrip('icepick');
  }
  // ice pick: blade out of the little-finger side; forward: out of the thumb side
  // mechanic's coveralls: pointed collar, front zip, chest pocket with a flap, belt loops
  dressCoveralls() {
    const P = this.body, s = P.s, B = P.B, rest = P.rest;
    const cloth = new THREE.MeshStandardMaterial({ color: 0x2a3244, roughness: 0.95 }), dark = new THREE.MeshStandardMaterial({ color: 0x1c2230, roughness: 0.9 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x8a8a84, metalness: 1, roughness: 0.35 });
    const at = (bone, x, y, z) => new V(x * s, y * s, z * s).sub(rest[BI[bone]]);
    const add = (bone, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.copy(at(bone, x, y, z)); m.rotation.set(rx, ry, rz); m.castShadow = true; B[bone].add(m); return m; };
    for (const sd of [-1, 1]) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.075 * sd, -0.012, 0.01, 0.02 * sd, -0.1, 0.02], 3)); g.setIndex([0, 1, 2]); g.computeVertexNormals();
      add('chest', g, new THREE.MeshStandardMaterial({ color: 0x2a3244, roughness: 0.95, side: THREE.DoubleSide }), 0.012 * sd, 1.505, 0.075, -0.25, 0, 0);
      add('chest', new THREE.BoxGeometry(0.075 * s, 0.07 * s, 0.012 * s), dark, 0.075 * sd, 1.35, 0.11, -0.12, 0, 0).visible = sd < 0;   // pocket
      add('chest', new THREE.BoxGeometry(0.08 * s, 0.025 * s, 0.016 * s), cloth, 0.075 * sd, 1.39, 0.113, -0.18, 0, 0).visible = sd < 0;  // flap
    }
    add('chest', new THREE.BoxGeometry(0.008 * s, 0.26 * s, 0.006 * s), metal, 0, 1.36, 0.118, -0.12);
    add('spine', new THREE.BoxGeometry(0.008 * s, 0.2 * s, 0.006 * s), metal, 0, 1.13, 0.103, 0.02);
    add('hips', new THREE.BoxGeometry(0.33 * s * 1.0, 0.035 * s, 0.22 * s), dark, 0, 1.02, 0.0);
  }
  setGrip(g) { this.grip = g; this.knifeOffset.setFromAxisAngle(new V(1, 0, 0), g === 'icepick' ? -Math.PI / 2 : Math.PI / 2); this.knifePos.set(0, -0.004, g === 'icepick' ? 0.045 : -0.045); }

  // feet position (camera xz)
  get pos() { this.camera.getWorldPosition(_v3); return _v3.setY(this.floorY); }
  headPos(out) { return this.camera.getWorldPosition(out); }

  move(dt, input, vr) {
    const D = this.dolly;
    // turning
    // knocked down: the view drops to the floor and tips over, then sits up and stands
    let fall = 0, rise = 1;
    if (this.down > 0) { const T = this.downDur || 4, el = T - this.down; fall = Math.min(1, el / 0.7); fall = fall * fall * (3 - 2 * fall); rise = this.down < 1.8 ? 1 - this.down / 1.8 : 0; }
    const fk = fall * (1 - rise), y = rise < 0.5 ? lerp(0.35, 1.0, rise * 2) : lerp(1.0, 1.8, (rise - 0.5) * 2);
    this.fallK = fk;
    if (!vr) { D.rotation.y = this.yaw; this.camera.position.set(0, this.down > 0 ? lerp(1.8, y, fall) : 1.8, 0); this.camera.rotation.set(lerp(this.pitch, 0.25, fk), 0, this.tilt + 1.15 * fk * (rise < 0.5 ? 1 : 0), 'YXZ'); }
    else if (input.snap) { const before = this.camera.getWorldPosition(new V()); D.rotation.y += input.snap; D.updateMatrixWorld(true); const after = this.camera.getWorldPosition(new V()); D.position.x += before.x - after.x; D.position.z += before.z - after.z; }
    D.updateMatrixWorld(true);
    // walking direction relative to where the head faces
    const fwd = this.camera.getWorldDirection(new V()); fwd.y = 0; fwd.normalize();
    const right = new V(-fwd.z, 0, fwd.x);
    const mv = new V().addScaledVector(fwd, input.move.y).addScaledVector(right, input.move.x);
    const m = Math.min(1, mv.length()); if (m > 0) mv.normalize();
    const T = this.evil.tier - 1, top = this.down > 0 ? 0 : (this.unseen ? [2.0, 2.35, 2.75][T] : [1.2, 1.38, 1.62][T]) * (this.stunned > 0 ? 0.4 : 1) * (this.slow ?? 1);
    this.stunned = Math.max(0, this.stunned - dt);
    const want = mv.multiplyScalar(top * m);
    this.vel = (this.vel || new V()).lerp(want, Math.min(1, dt * 6));
    const head = this.camera.getWorldPosition(new V());
    const p = head.clone().addScaledVector(this.vel, dt);
    if (input.noclip) { p.y = head.y; D.position.x += p.x - head.x; D.position.z += p.z - head.z; D.position.y += (input.fly || 0) * dt * 3; this.speed = this.vel.length(); return; }
    this.W.collide(p, 0.27, this.floorY, 1.9, 1.2);
    D.position.x += p.x - head.x; D.position.z += p.z - head.z;
    this.speed = Math.hypot(p.x - head.x, p.z - head.z) / Math.max(dt, 1e-4);
    // floor (stairs, porches)
    const fy = this.W.floorAt(p.x, p.z, this.floorY + 0.05, 0.6);
    this.floorY += (fy - this.floorY) * Math.min(1, dt * (fy > this.floorY ? 14 : 9));
    D.position.y = this.floorY + (vr ? (this.heightOffset ?? 0.12) - 1.2 * fk : 0);
    // footsteps
    this.stepDist += this.speed * dt;
    if (this.stepDist > 0.78) { this.stepDist = 0; this.events.push({ type: 'step', pos: p.clone().setY(this.floorY), loud: this.evil.tier === 1 ? 0.5 : 1 }); }
  }

  // hand poses: tracked controllers in VR, scripted in front of the camera on desktop
  hands(dt, input, vr, t) {
    const L = this.hand.l, R = this.hand.r;
    L.prev.copy(L.pos); R.prev.copy(R.pos); L.prevQ.copy(L.quat);
    if (vr && input.hands) {
      if (input.hands.l) { L.pos.copy(input.hands.l.pos); L.quat.copy(input.hands.l.quat); }
      if (input.hands.r) { R.pos.copy(input.hands.r.pos); R.quat.copy(input.hands.r.quat); }
    } else {
      const cq = this.camera.getWorldQuaternion(new Q()), cp = this.camera.getWorldPosition(new V());
      // right: knife held at the hip, raised and driven down on a stab
      this.stab = Math.max(0, this.stab - dt);
      const k = this.stab > 0 ? 1 - this.stab / 0.55 : 1;
      let off, rot;
      // fist upright (thumb up, blade down); cock back, drive down and forward
      if (this.stab > 0 && k < 0.35) { const u = k / 0.35; off = new V(0.2, lerp(-0.27, 0.05, u), lerp(-0.45, -0.2, u)); rot = lerp(1.57, 1.1, u); }
      else if (this.stab > 0 && k < 0.6) { const u = (k - 0.35) / 0.25; off = new V(lerp(0.2, 0.06, u), lerp(0.05, -0.3, u), lerp(-0.15, -0.72, u)); rot = lerp(1.1, 2.4, u); }
      else { const u = this.stab > 0 ? (k - 0.6) / 0.4 : 1; off = new V(lerp(0.06, 0.2, u), lerp(-0.3, -0.27, u), lerp(-0.72, -0.45, u)); rot = lerp(2.4, 1.57, u); }
      if (this.stuck && this.stab <= 0) off.set(0.1, -0.3, -0.55);
      off.y += Math.sin(t * 1.3) * 0.006;
      R.pos.copy(off).applyQuaternion(cq).add(cp); R.quat.copy(cq).multiply(_q.setFromAxisAngle(new V(1, 0, 0), rot));
      // left: relaxed, or reaching for a throat
      const g = this.grabbing;
      if (g && this.deskNeck) { const tgt = this.deskNeck.clone(); L.pos.lerp(tgt, Math.min(1, dt * 10)); L.quat.copy(cq).multiply(_q.setFromAxisAngle(new V(0, 0, 1), -1.3)); }
      else { const off2 = new V(-0.22, -0.32, -0.4); L.pos.lerp(off2.applyQuaternion(cq).add(cp), Math.min(1, dt * 12)); L.quat.copy(cq); }
    }
    L.vel.subVectors(L.pos, L.prev).multiplyScalar(1 / Math.max(dt, 1e-4)); R.vel.subVectors(R.pos, R.prev).multiplyScalar(1 / Math.max(dt, 1e-4));
    _q.copy(L.prevQ).invert().premultiply(L.quat); L.angVel = 2 * Math.acos(Math.min(1, Math.abs(_q.w))) / Math.max(dt, 1e-4);
  }

  headHide(hide) { this.body.B.head.scale.setScalar(hide ? 0.001 : 1); }
  // in cutscenes he is a shape in the dark: coveralls, hands and hair near black, the mask half-lit
  silhouette(on, mask = 0.5) {
    if (!this._mats) { this._mats = new Map(); this.body.root.traverse((o) => { if (!o.isMesh) return; for (const m of [].concat(o.material)) if (m.color && !this._mats.has(m)) this._mats.set(m, m.color.clone()); }); }
    for (const [m, c] of this._mats) m.color.copy(c).multiplyScalar(on ? (m === this.body.headMat ? mask : 0.16) : 1);
  }
  // in a cutscene the body is posed by the shot, with the knife still in his right fist
  posePuppet(dt, t) {
    const P = this.body, h = this.cineHold();
    P.root.visible = !h.hidden;
    if (!P.limp) P.place(h.pos.x, h.pos.y ?? this.floorY, h.pos.z, h.yaw);
    P.pose = { speed: h.speed || 0, look: h.look || null, tilt: h.tilt || 0, curlL: 0.95, curlR: h.curlR ?? 0.35, ...(h.pose || {}) };
    P.animate(dt, t); P.root.updateMatrixWorld(true);
    const hb = P.B.lHa, hq = hb.getWorldQuaternion(new Q()), grip = hq.clone().multiply(new Q().setFromAxisAngle(new V(0, 1, 0), Math.PI));
    this.knife.position.copy(hb.getWorldPosition(new V()).add(new V(0, -0.075, 0.01).applyQuaternion(hq))).add(this.knifePos.clone().applyQuaternion(grip));
    this.knife.quaternion.copy(grip).multiply(this.knifeOffset); this.knife.visible = this.hasKnife !== false && !h.hidden;
  }
  // place the body under the head and reach for the hands
  pose(dt, t, vr) {
    if (this.cineHold) return this.posePuppet(dt, t);
    this.body.root.visible = true;
    const P = this.body, head = this.camera.getWorldPosition(new V());
    const fwd = this.camera.getWorldDirection(new V()); fwd.y = 0; if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1); fwd.normalize();
    // camera looks down -Z; the body faces +Z in its own space
    const headYaw = Math.atan2(fwd.x, fwd.z);
    let d = headYaw - this.bodyYaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    if (Math.abs(d) > 0.75 || this.speed > 0.2) this.bodyYaw += d * Math.min(1, dt * (this.speed > 0.2 ? 6 : 3));
    const bf = new V(Math.sin(this.bodyYaw), 0, Math.cos(this.bodyYaw));
    P.place(head.x - bf.x * 0.13, this.floorY, head.z - bf.z * 0.13, this.bodyYaw);
    const eye = 1.8 * P.s / 1.03;
    const low = Math.max(0, Math.min(1, (eye - (head.y - this.floorY) - 0.12) / 0.7));
    // bones 'l' sit on the body's right side (it faces +Z), so they take the knife hand
    P.pose = { speed: this.speed, crouch: low, look: null, tilt: 0, curlL: this.knifeHeld ? 0.95 : 0.3, curlR: this.grabbing ? 0.8 : this.gripL ? 0.85 : 0.3 };
    P.animate(dt, t);
    P.root.updateMatrixWorld(true);
    // arms
    this.ik('l', this.hand.r.pos, this.hand.r.quat, bf);
    this.ik('r', this.hand.l.pos, this.hand.l.quat, bf);
    // the knife rides in the right hand
    if (this.knifeHeld) {
      this.knife.position.copy(this.hand.r.pos); this.knife.quaternion.copy(this.hand.r.quat).multiply(this.knifeOffset);
      this.knife.position.add(_v.copy(this.knifePos).applyQuaternion(this.hand.r.quat));
    } else if (this.embedded) { this.knife.position.copy(this.embedded.pos); this.knife.quaternion.copy(this.embedded.quat); }
    this.knife.updateMatrixWorld(true);
    this.prevTip.copy(this.knifeTip);
    this.knifeTip.set(0, -0.214, 0).applyMatrix4(this.knife.matrixWorld); this.knifeBase.set(0, -0.01, 0).applyMatrix4(this.knife.matrixWorld);
    this.bladeDir.subVectors(this.knifeTip, this.knifeBase).normalize();
    this.tipVel.subVectors(this.knifeTip, this.prevTip).multiplyScalar(1 / Math.max(dt, 1e-4));
    if (this.tipVel.length() > 40) this.tipVel.set(0, 0, 0);
    this.knife.userData.blood.material.opacity = Math.min(0.95, this.blood);
    this.knife.visible = this.hasKnife !== false;
  }

  ik(side, target, quat, bf) {
    const P = this.body, B = P.B, up = B[side + 'Up'], fo = B[side + 'Fo'], ha = B[side + 'Ha'];
    const r = P.rest, iU = BI[side + 'Up'], iF = BI[side + 'Fo'], iH = BI[side + 'Ha'];
    const l1 = r[iU].distanceTo(r[iF]), l2 = r[iF].distanceTo(r[iH]) + 0.07 * P.s;
    const S = up.getWorldPosition(new V());
    const wrist = target.clone().add(this.wristOff.clone().applyQuaternion(quat));
    const dv = wrist.clone().sub(S); let dist = dv.length();
    if (dist > l1 + l2 - 0.002) { dv.multiplyScalar((l1 + l2 - 0.002) / dist); dist = l1 + l2 - 0.002; }
    const dh = dv.clone().normalize();
    const cosA = Math.max(-1, Math.min(1, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist))), A = Math.acos(cosA);
    const pole = new V(side === 'l' ? -0.6 : 0.6, -1, -0.5).normalize();
    pole.applyAxisAngle(UP, this.bodyYaw);
    const n = new V().crossVectors(dh, pole).normalize();
    const perp = new V().crossVectors(n, dh);
    const eDir = dh.clone().multiplyScalar(Math.cos(A)).addScaledVector(perp, Math.sin(A)).normalize();
    const E = S.clone().addScaledVector(eDir, l1);
    const rootQ = P.root.quaternion;
    const setDir = (bone, restDir, dir) => {
      const cur = restDir.clone().applyQuaternion(rootQ);
      const wq = new Q().setFromUnitVectors(cur, dir).multiply(rootQ);
      const pq = bone.parent.getWorldQuaternion(new Q());
      bone.quaternion.copy(pq.invert().multiply(wq)); bone.updateMatrixWorld(true);
    };
    setDir(up, r[iF].clone().sub(r[iU]).normalize(), eDir);
    setDir(fo, r[iH].clone().sub(r[iF]).normalize(), S.clone().add(dv).sub(E).normalize());
    const hq = quat.clone().multiply(this.handOffset);
    if (side === 'r' && this.grabbing) hq.multiply(_q.setFromAxisAngle(new V(0, 1, 0), 0.4));
    ha.quaternion.copy(fo.getWorldQuaternion(new Q()).invert().multiply(hq)); ha.updateMatrixWorld(true);
  }

  // ---------------------------------------------------------------- violence
  // returns events for the game (hits, kills) through this.events
  fight(dt, input, people, vr) {
    const ev = this.events, phys = this.phys;
    // desktop stab trigger
    if (!vr && input.stab && this.stab <= 0 && this.knifeHeld) { if (this.stuck) this.pullOut(); else this.stab = 0.55; }
    // ---- knife already in someone
    if (this.stuck) {
      const S = this.stuck, b = S.body;
      if (!this.embedded || this.knifeHeld) S.pin.target.copy(this.knifeTip).addScaledVector(this.bladeDir, -S.depth);
      // drag a body into a wall and the blade goes through into the studs
      if (!this.embedded) {
        const wall = this.W.surfaceNear(this.knifeTip, 0.07);
        if (wall && this.knifeTip.distanceTo(S.pin.target) < 0.25) { this.embedded = { pos: this.knife.position.clone(), quat: this.knife.quaternion.clone(), wall }; ev.push({ type: 'thunk', pos: this.knifeTip.clone() }); }
      }
      if (this.embedded && this.knifeHeld && this.hand.r.pos.distanceTo(this.embedded.pos) > 0.22) { this.embedded = null; this.pullOut(); }
      else if (this.tipVel.dot(this.bladeDir) < -1.4 && !this.embedded && vr) this.pullOut();
      if (this.embedded && input.letGo && this.knifeHeld) { this.knifeHeld = false; ev.push({ type: 'leftKnife' }); }
      if (S.person) S.person.wake();
    } else if (!this.knifeHeld && this.embedded) {
      // free knife stuck in a wall with nothing on it
    }
    // take the knife back from a wall / body
    if (this.hasKnife !== false && !this.knifeHeld && (input.retake || (vr && input.gripR)) && this.hand.r.pos.distanceTo(this.knife.position) < 0.25) { this.knifeHeld = true; ev.push({ type: 'retook' }); }
    if (this.hasKnife !== false && !this.knifeHeld && !vr && input.use && this.pos.distanceTo(this.knife.position) < 1.6) { this.knifeHeld = true; this.embedded = null; this.pullOut(); }
    // ---- new contact
    if (this.knifeHeld && !this.stuck) {
      const sp = this.tipVel.length(), along = this.tipVel.dot(this.bladeDir);
      if (sp > 1.4) {
        const c1 = new V(), c2 = new V();
        for (const p of people) {
          const P = p.body; if (P.root.position.distanceToSquared(this.knifeTip) > 9 && !P.limp) continue;
          if ((p.cool || 0) > 0) continue;
          for (const cap of P.capsules(p._caps || (p._caps = []))) {
            const d = segSeg(this.knifeBase, this.knifeTip, cap.a, cap.b, c1, c2);
            if (d > cap.r + 0.01) continue;
            const n = c1.clone().sub(c2); if (n.lengthSq() < 1e-8) n.copy(this.bladeDir).negate(); n.normalize();
            const surf = c2.clone().addScaledVector(n, cap.r);
            const stab = along > 1.3, kind = stab ? 'stab' : 'cut';
            p.cool = stab ? 0.35 : 0.2;
            this.blood = Math.min(1, this.blood + (stab ? 0.18 : 0.08));
            ev.push({ type: 'hit', who: p, kind, part: cap.name, bone: cap.bone, pos: surf, normal: n, dir: this.tipVel.clone(), speed: sp });
            if (stab && P.limp) this.stickInto(p, cap.name, surf);
            break;
          }
          if (p.cool > 0) break;
        }
      }
    }
    // ---- strangling with the left hand
    const L = this.hand.l, wantGrab = (vr ? input.gripL : input.grab) && this.stunned <= 0; this.gripL = wantGrab;
    if (wantGrab && !this.grabbing) {
      let best = null, bd = vr ? 0.22 : 1.35;
      for (const p of people) {
        if (!p.body.alive && !p.body.limp) continue;
        const neck = p.body.B.neck.getWorldPosition(new V()).add(_v.set(0, 0.06, 0));
        const d = vr ? neck.distanceTo(L.pos) : neck.distanceTo(this.camera.getWorldPosition(new V()));
        if (!vr) { const dir = neck.clone().sub(this.camera.getWorldPosition(new V())).normalize(); if (dir.dot(this.camera.getWorldDirection(new V())) < 0.75) continue; }
        if (d < bd) { bd = d; best = p; }
      }
      if (best) this.grab(best, vr);
    } else if (!wantGrab && this.grabbing) this.release();
    if (this.grabbing) {
      const g = this.grabbing, P = g.body;
      this.grabT += dt;
      if (!vr) { const cp = this.camera.getWorldPosition(new V()), f = this.camera.getWorldDirection(new V()); f.y = 0; f.normalize(); const lift = Math.min(1, this.grabT / 1.2); this.deskNeck = cp.clone().addScaledVector(f, 0.55).add(_v.set(0, -0.22 + lift * 0.18, 0)); }
      g.pin.target.copy(L.pos).addScaledVector(_v.set(0, -0.02, 0), 1);
      P.grabTarget = L.pos;
      if (P.alive) {
        P.face.flush = Math.min(1, this.grabT / 5); P.face.gasp = 1; P.face.fear = 1; P.face.strain = 1;
        if (vr && L.angVel > 11 && this.grabT > 0.3) { ev.push({ type: 'snap', who: g, pos: L.pos.clone() }); }
        else if (this.grabT > 5.5) ev.push({ type: 'choked', who: g });
      }
    }
  }
  stickInto(p, partName, surf) {
    const P = p.body, b = P.rig?.bodies[partName]; if (!b) return;
    const depth = 0.06;
    const inside = surf.clone().addScaledVector(this.bladeDir, depth);
    const local = inside.clone().sub(b.x).applyQuaternion(b.q.clone().invert());
    const pin = this.phys.pin(new Pin(b, local, inside, 0.00002));
    this.stuck = { person: P, who: p, body: b, pin, depth: 0.214 * 0.5 };
    P.held = true; P.wake();
  }
  pullOut() {
    if (!this.stuck) return;
    const S = this.stuck; this.phys.unpin(S.pin); S.person.held = !!(this.grabbing && this.grabbing.body === S.person);
    this.events.push({ type: 'pullout', who: S.who, pos: this.knifeTip.clone(), dir: this.bladeDir.clone().negate() });
    this.stuck = null; this.embedded = null; this.knifeHeld = true;
  }
  grab(p, vr) {
    const P = p.body;
    if (!P.limp) P.goLimp(this.phys, null);
    const hb = P.rig.bodies.head;
    const neck = P.B.neck.getWorldPosition(new V()).add(_v.set(0, 0.05, 0));
    const local = neck.clone().sub(hb.x).applyQuaternion(hb.q.clone().invert());
    p.pin = this.phys.pin(new Pin(hb, local, this.hand.l.pos, 0.00003));
    this.grabbing = p; this.grabT = 0; P.held = true; P.strangled = P.alive; P.wake();
    this.deskNeck = neck.clone();
    this.events.push({ type: 'grab', who: p });
  }
  release() {
    const g = this.grabbing; if (!g) return;
    this.phys.unpin(g.pin); g.pin = null; const P = g.body; P.held = !!(this.stuck && this.stuck.person === P); P.strangled = false; P.grabTarget = null; P.face.gasp = 0; P.face.strain = 0;
    this.grabbing = null; this.deskNeck = null;
    this.events.push({ type: 'drop', who: g });
  }
}
const lerp = (a, b, t) => a + (b - a) * t;
