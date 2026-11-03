// HALLOWEENVR story: the night of the film told as five chapters. Each chapter
// sets the time of day, the cast and where you start, then walks you through
// a few objectives. Stealth chapters fail (and restart in place, so VR isn't
// interrupted) if the wrong person gets a good look at you.
import * as THREE from '../vendor/three.module.js';
import { behind } from './cine.js?v=6';

const V = THREE.Vector3;
const SAVE = 'halloweenvr.chapters';

export const CHAPTERS = [
  { id: 1, title: 'Nichols Hardware', when: 'October 30, 1978 · 11:58 PM', time: 'night', clock: 23 * 60 + 58 },
  { id: 2, title: 'Haddonfield High', when: 'October 31, 1978 · 3:40 PM', time: 'dusk', clock: 15 * 60 + 40 },
  { id: 3, title: "Judith's Grave", when: 'October 31, 1978 · 7:10 PM', time: 'night', clock: 19 * 60 + 10 },
  { id: 4, title: 'Halloween Night', when: 'October 31, 1978 · 9:40 PM', time: 'night', clock: 21 * 60 + 40 },
  { id: 5, title: 'The Final Girl', when: 'October 31, 1978 · 11:50 PM', time: 'night', clock: 23 * 60 + 50 },
];
export function unlocked() { try { return Math.max(1, Math.min(5, +(localStorage.getItem(SAVE) || 1))); } catch (e) { return 1; } }
function unlock(n) { try { if (n > unlocked()) localStorage.setItem(SAVE, String(n)); } catch (e) {} }

export class Story {
  constructor(ctx) { Object.assign(this, ctx); this.night.story = this; this.ch = null; this.busy = false; this.status = ''; }

  // ------------------------------------------------------------ chapters
  begin(n) {
    const C = CHAPTERS[n - 1]; this.ch = C; this.step = 0; this.t = 0; this.busy = true; this.flags = {};
    this.reset();
    this.env(C.time);
    this.night.clockStart = C.clock; this.night.chapter = n;
    this['setup' + n]();
    document.getElementById('fade').classList.remove('on');
    if (this.sound.ok) this.sound.tension = Math.max(this.sound.tension || 0, 0.75);   // the score swells under the opening shots
    this.cine.play(this.introShots(n), () => { this.busy = false; this['afterIntro' + n]?.(); }, { title: `${n} &middot; ${C.title.toUpperCase()}`, sub: C.when });
  }
  // where Michael stands and which way his body faces when a chapter starts
  me() { return { pos: this.start.clone(), yaw: this.startYaw + Math.PI }; }
  fwd(yaw) { return new V(Math.sin(yaw), 0, Math.cos(yaw)); }
  head(n) { return () => n.head(new V()); }
  introShots(n) {
    const M = this.town.mission, N = this.night.N, me = this.me(), ahead = me.pos.clone().addScaledVector(this.fwd(me.yaw), 9).add(new V(0, 1.3, 0));
    const tail = { from: behind(me.pos, me.yaw), at: ahead, dur: 3.2, hold: me };
    if (n === 1) return [{ from: (k) => new V(-72, 6.5, -108).lerp(new V(-60, 5.2, -110), k), at: this.head(N.brackett), dur: 5, hold: { ...me, hidden: true } }, tail];
    if (n === 2) return [{ from: (k) => new V(84, 2.8, -58).lerp(new V(84.5, 2.2, -63), k), at: this.head(N.laurie), dur: 5, hold: me }, { ...tail, at: this.head(N.laurie) }];
    if (n === 3) return [{ from: (k) => new V(-55, 3.2, 62).lerp(new V(-50, 2.4, 65), k), at: this.head(N.loomis), dur: 4.5, hold: { ...me, hidden: true } },
      { from: (k) => new V(-40.4, 1.05, 81.0).lerp(new V(-40.1, 0.9, 81.4), k), at: new V(-40, 0.5, 82.6), dur: 3, fov: 45, hold: { ...me, hidden: true } }, { ...tail, at: M.cemeteryGate.clone().setY(1.4) }];
    if (n === 4) return [{ from: (k) => new V(-8, 3.6, 3.5).lerp(new V(-14, 2.8, 5.5), k), at: this.head(N.loomis), dur: 4.5, hold: { ...me, hidden: true } },
      { from: (k) => new V(30, 1.8, 3).lerp(new V(26, 1.7, 2), k), at: new V(24, 3.5, -17), dur: 3.5, hold: { ...me, hidden: true } }, { ...tail, at: new V(-24, 3, -20) }];
    if (n === 5) return [{ from: new V(19, 1.7, 3.5), at: this.head(N.laurie), dur: 4, hold: { ...me, hidden: true } }, { ...tail, at: new V(24, 2.5, 16) }];
    return [tail];
  }
  complete() {
    if (this.busy) return; this.busy = true;
    this.sound.ok && this.sound.sting(true);
    const next = this.ch.id + 1; unlock(Math.min(5, next));
    const go = () => { document.getElementById('fade').classList.add('on'); setTimeout(() => { if (next <= 5) this.begin(next); else this.ending(); }, 900); };
    const shots = this.outroShots(this.ch.id);
    if (shots) this.cine.play(shots, go); else go();
  }
  outroShots(n) {
    const M = this.town.mission, N = this.night.N, S = this.shape, here = S.pos.clone(), yawB = S.bodyYaw;
    if (n === 1) { const a = here.clone(), hold = () => ({ pos: a.clone().add(new V(-5 * this.cine.k, 0, 0)), yaw: -Math.PI / 2, speed: 1.3 }); return [{ from: a.clone().add(new V(3.5, 1.5, 1.6)), at: () => hold().pos.clone().setY(1.5), dur: 4, hold }]; }
    if (n === 2) { const L = N.laurie; return [{ from: () => L.head(new V()).add(new V(0.8, 0.1, 1.2)), at: () => here.clone().setY(1.5), dur: 3.5, hold: { pos: here, yaw: yawB, hidden: true } }]; }
    if (n === 3) return [{ from: M.wagon.clone().add(new V(3.5, 1.7, 4.5)), at: M.wagon.clone().setY(1), dur: 3.5, hold: { pos: M.wagon.clone().add(new V(1.4, 0, -2.6)), yaw: -Math.PI / 2 } }];
    if (n === 4) { const w = this.town.houses.wallace; return [{ from: new V(24, 1.6, -1), at: new V(24, 4.6, -18), dur: 4, hold: { pos: here, yaw: yawB, hidden: true }, tick: (k) => { if (k > 0.55) for (const L of Object.values(w.lights)) if (L.zone) L.on = false; } }]; }
    return null;
  }
  fail(n) {
    if (this.busy) return; this.busy = true;
    this.sound.ok && this.sound.sting(false);
    const me = this.shape.headPos(new V()), here = this.shape.pos.clone(), yawB = this.shape.bodyYaw;
    this.cine.play([{ from: me, at: this.head(n), dur: 1.9, fov: 40, hold: { pos: here, yaw: yawB, hidden: true }, tick: (k) => { n.body.pose.look = me; n.body.pose.reach = true; } }],
      () => { document.getElementById('fade').classList.add('on'); setTimeout(() => this.begin(this.ch.id), 900); });
  }
  spotted(n) { if (this.ch && this.ch.id <= 3) this.fail(n); }

  // put everyone and everything back the way the chapter expects
  reset() {
    const N = this.night, S = this.shape, P = this.phys;
    if (S.grabbing) S.release(); if (S.stuck) S.pullOut();
    { const B = S.body;   // Michael's own body back on its feet after the finale's fall
      if (B.limp && B.rig) { P.remove(B.rig); const i = P.drives.indexOf(B.rig.drive); if (i >= 0) P.drives.splice(i, 1); }
      B.limp = false; B.rig = null; B.alive = true; B.root.visible = true; B.bones.forEach((b, i) => b.quaternion.identity()); B.B.hips.position.copy(B.rest[0]); }
    S.hp = 6; S.down = 0; S.stunned = 0; S.slow = 1; S.blood = 0; S.evil = { tier: 1, pts: 0, t3: 0 }; S.embedded = null; S.knifeHeld = true; S.hasKnife = true;
    for (const n of N.people) {
      const B = n.body;
      if (B.limp && B.rig) { P.remove(B.rig); const i = P.drives.indexOf(B.rig.drive); if (i >= 0) P.drives.splice(i, 1); }
      B.limp = false; B.rig = null; B.held = false; B.strangled = false; B.alive = true; B.dying = 0; B.ragBlend = 0; B.lastRag = null;
      Object.assign(B.face, { dead: false, flush: 0, scream: 0, gasp: 0, strain: 0, talk: 0, fear: 0 });
      for (const w of B.wounds) w.bone.remove(w.m); B.wounds = [];
      B.pose = {}; B.root.visible = false;
      Object.assign(n, { hp: n.key === 'loomis' || n.key === 'brackett' ? 150 : 100, state: 'off', path: [], aware: 0, fear: 0, seeing: 0, dead: false, alive: true, escaped: false, dying: 0,
        glimpsed: false, found: null, rescued: false, fought: 0, fightCool: 0, inCar: null, pool: undefined, bleeding: false, guard: false, hunter: false, beat: null, leg: -1, ammo: 6, refuge: null, inHide: false, stamina: undefined, trapped: false, lastSeen: null, flashOn: false });
      n.body.pose.light = false;
    }
    for (const d of N.W.doors) { d.angle = 0; d.target = 0; d.vel = 0; d.broken = false; d.hp = 5; d.leaf.rotation.x = 0; d.leaf.position.set(0, 0, 0); d.locked = d.house === 'elrod' ? d === this.town.houses.elrod.doors.front : d.house === 'hardware'; d.update(0); }
    const cr = this.crimson; for (const sp of cr.splats) cr.group.remove(sp.m); for (const q of cr.pools) cr.group.remove(q.m); cr.splats = []; cr.pools = []; cr.sources = []; cr.D = [];
    for (const it of Object.values(this.town.items)) { it.mesh.visible = true; it.mesh.position.copy(it.pos); it.held = false; it.taken = false; }
    const car = N.annieCar; car.drive = null; car.away = false; car.x = car.home.x; car.z = car.home.z; car.yaw = car.home.yaw; car.g.visible = true; car.engine?.stop?.(); car.engine = null; N.carCollide(car, true);
    const cz = N.cruiser; cz.drive = null; cz.away = true; cz.coming = false; cz.x = -90; cz.z = -2; cz.siren?.stop?.(); cz.siren = null; cz.engine?.stop?.(); cz.engine = null;
    Object.assign(N, { t: 0, kills: 0, tally: {}, policeCalled: false, over: false, inCar: null, b1: false, b2: false, b3: false, b4: false, b5: false, beatsOn: false, leftHome: true, toldListen: true, stillT: 0 });
    for (const tv of this.town.tvs) { tv.audio?.stop?.(); tv.audio = null; }
    this.status = '';
  }
  at(p, faceYaw) { this.start = p.clone(); this.startYaw = faceYaw; this.place(p, faceYaw); }
  show(n, pos, yaw) { n.setPos(pos.clone(), yaw); n.floorY = pos.y; }

  // ---------------------------------------------- chapter 1: Nichols Hardware
  setup1() {
    const M = this.town.mission, N = this.night.N, S = this.shape;
    S.hasKnife = false; S.knifeHeld = false;
    this.at(M.alleyStart, -Math.PI / 2);
    const b = N.brackett; this.show(b, M.patrol[0].clone(), Math.PI / 2);
    Object.assign(b, { hunter: true, guard: true, beat: M.patrol, walk: 1.1, state: 'patrol' });
    this.goals = [
      { text: 'Get inside Nichols Hardware. The back door is on the alley.', at: () => M.hardwareBack, done: () => this.inside('hardware') },
      { text: 'Take the pale mask from the window display.', at: () => this.town.items.mask.pos, done: () => this.town.items.mask.taken },
      { text: 'Take a knife from the counter.', at: () => this.town.items.knife.pos, done: () => this.town.items.knife.taken },
      { text: 'Take the rope from the stockroom.', at: () => this.town.items.rope.pos, done: () => this.town.items.rope.taken },
      { text: 'Get away down the alley before he sees you.', at: () => M.alleyStart, done: () => !this.inside('hardware') && this.shape.pos.distanceTo(M.hardwareBack) > 14 },
    ];
  }
  // ---------------------------------------------- chapter 2: Haddonfield High
  setup2() {
    const M = this.town.mission, N = this.night.N, S = this.shape;
    S.hasKnife = false; S.knifeHeld = false;
    this.at(M.stalkerStart, 0);
    const walk = M.walkHome, off = [0, -0.9, 0.9];
    ['laurie', 'annie', 'lynda'].forEach((k, i) => {
      const n = N[k], p = walk[0].clone().add(new V(-i * 0.6, 0.6, off[i]));
      this.show(n, p, -Math.PI / 2);
      n.state = 'scripted'; n.want = 1.15; n.path = walk.slice(1).map((q) => ({ x: q.x, y: 0, z: q.z + off[i] * (q.x > 80 ? 0 : 1) }));
    });
    this.flags.stalk = 0; this.flags.seenT = 0;
    this.goals = [
      { text: 'Watch Laurie walk home. Stay out of sight.', at: () => N.laurie.pos, done: () => this.flags.stalk >= 100 },
      { text: 'Vanish. Get out of her sight.', at: () => N.laurie.pos, done: () => this.flags.goneT > 2.5 },
    ];
  }
  update2(dt) {
    const N = this.night.N, F = this.flags, S = this.shape, mh = S.headPos(new V()), cf = S.camera.getWorldDirection(new V());
    const girls = ['laurie', 'annie', 'lynda'].map((k) => N[k]);
    const seen = girls.some((g) => g.seeing > 0);
    F.seenT = seen ? F.seenT + dt : Math.max(0, F.seenT - dt * 0.5);
    if (seen && !F.glimpse) { F.glimpse = true; this.night.say(N.laurie, "Somebody's watching us.", 3); N.laurie.fear = 0.6; N.laurie.body.pose.look = mh; }
    if (F.seenT > 1.6) return this.fail(girls.find((g) => g.seeing > 0) || N.laurie);
    const L = N.laurie, hd = L.head(new V()), d = hd.distanceTo(mh);
    if (this.step === 0 && !seen && d < 40 && hd.clone().sub(mh).normalize().dot(cf) > 0.9 && !this.night.W.blocked(mh.x, mh.y, mh.z, hd.x, hd.y, hd.z)) {
      F.stalk = Math.min(100, F.stalk + dt * Math.max(2.5, 8 - d * 0.14)); this.sound.ok && this.sound.stalk(true);
    } else this.sound.ok && this.sound.stalk(false);
    this.status = this.step === 0 ? `Stalking ${Math.floor(F.stalk)}%` : 'Vanish';
    if (this.step === 1) F.goneT = girls.some((g) => { const h = g.head(new V()); return h.distanceTo(mh) < 30 && !this.night.W.blocked(h.x, h.y, h.z, mh.x, mh.y, mh.z); }) ? 0 : (F.goneT || 0) + dt;
    // Annie and Lynda peel off at Lampkin Lane; if Laurie gets home first it's over
    if (girls[1].path.length === 0 && girls[1].state === 'scripted') { girls[1].state = 'off'; girls[1].body.root.visible = false; }
    if (girls[2].path.length === 0 && girls[2].state === 'scripted') { girls[2].state = 'off'; girls[2].body.root.visible = false; }
    if (L.path.length === 0 && this.step === 0) this.fail(L);
  }
  // ---------------------------------------------- chapter 3: Judith's Grave
  setup3() {
    const M = this.town.mission, N = this.night.N;
    this.at(M.cemeteryStart, Math.PI);
    const l = N.loomis; this.show(l, M.keeperRoute[0].clone(), Math.PI / 2);
    Object.assign(l, { hunter: true, guard: true, beat: M.keeperRoute, walk: 1.0, state: 'patrol' });
    const H = this.town.items.headstone;
    this.goals = [
      { text: "Find Judith's grave in the cemetery.", at: () => H.pos, done: () => H.held },
      { text: 'Carry her headstone back to the station wagon.', at: () => M.wagon, done: () => H.taken },
    ];
  }
  // ---------------------------------------------- chapter 4: Halloween Night
  setup4() {
    const N = this.night;
    this.at(new V(-27, 0, 10), 0);
    N.beatsOn = true; N.leftHome = false; N.toldListen = false;
    N.start();
    this.goals = [
      { text: 'Annie, Lynda and Bob are at the Wallace house tonight.', at: null, done: () => ['annie', 'lynda', 'bob'].every((k) => N.N[k].dead || N.N[k].escaped) },
    ];
  }
  // ---------------------------------------------- chapter 5: The Final Girl
  setup5() {
    const N = this.night, H = this.town.houses.doyle, L = N.N.laurie;
    this.at(this.town.houses.wallace.w(1.5, 0, -6), Math.PI);
    this.show(L, new V(26, 0, 3), Math.PI); L.state = 'scripted'; L.fear = 1; L.want = 3.4;
    L.path = [{ x: 25.5, y: 0, z: 9.5 }, H.nodes.porch, H.nodes.frontDoor, H.nodes.hallF];
    H.doors.front.locked = false;
    this.flags.loomisIn = false;
    this.goals = [
      { text: 'Laurie ran back to the Doyle house. Find her.', at: () => this.inside('doyle') ? L.pos : new V(H.nodes.back.x, 0, H.nodes.back.z), done: () => this.flags.loomisIn && this.flags.fallen },
    ];
  }
  afterIntro5() {
    const H = this.town.houses.doyle, L = this.night.N.laurie, c = H.nodes.closet;
    this.show(L, new V(c.x, 3.3, c.z), H.rot + Math.PI / 2); L.state = 'hide'; L.inHide = true; L.fear = 1; L.floorY = 3.3; L.path = [];
    H.doors.closet.locked = true; H.doors.front.target = 0; setTimeout(() => { H.doors.front.locked = true; }, 800);
  }
  update5(dt) {
    const N = this.night, L = N.N.laurie, F = this.flags;
    if (L.dead && !F.end) { F.end = true; return this.complete(); }
    // after she has fought you off, or after long enough in the house, Loomis comes in shooting
    if (!F.loomisIn && ((L.fought || 0) >= 2 || (this.inside('doyle') && (F.inT = (F.inT || 0) + dt) > 90))) {
      F.loomisIn = true; const lo = N.N.loomis, d = this.town.houses.doyle, p = d.nodes.frontDoor;
      d.doors.front.locked = false; d.doors.front.target = 1.6;
      this.show(lo, new V(p.x, 0.3, p.z), d.rot); Object.assign(lo, { hunter: true, guard: false, state: 'search', path: N.route(new V(p.x, 0.3, p.z), this.shape.pos), want: 2.6, lastSeen: this.shape.pos.clone(), ammo: 6 });
      N.say(lo, 'Laurie! Get down!', 3);
    }
    if (F.loomisIn && !F.fallen && F.shotDown) { F.fallen = true; this.finale(); }
  }
  finale() {
    this.busy = true;
    const N = this.night, S = this.shape, B = S.body, D = this.town.houses.doyle, lo = N.N.loomis;
    const here = S.pos.clone(), yawB = S.bodyYaw;
    const win = D.w(-2.6, 3.3 + 1.25, -0.45), outward = D.w(-2.6, 0, -1).sub(D.w(-2.6, 0, 0)).normalize();
    const lawn = D.w(-2.6, 0, -4.5), lawnCam = D.w(-0.2, 1.2, -9.5);
    const bang = () => { if (this.sound.ok) this.sound.gunshot(lo.head(new V()), false); N.flash(lo.body.B.rHa.getWorldPosition(new V())); };
    this.cine.play([
      { from: () => lo.head(new V()).add(new V(0.5, 0.15, 0).applyAxisAngle(new V(0, 1, 0), lo.yaw)).addScaledVector(this.fwd(lo.yaw), -1.1), at: here.clone().setY(here.y + 1.4), dur: 2.6,
        hold: { pos: here, yaw: yawB, pose: { stagger: true } }, enter: () => { lo.body.pose.aim = true; bang(); setTimeout(bang, 600); setTimeout(bang, 1150); setTimeout(bang, 1700); } },
      { from: lawnCam, at: () => B.limp ? B.B.hips.getWorldPosition(new V()) : win, dur: 3.4, fov: 50,
        enter: () => { S.cineHold = () => ({ pos: win.clone().setY(win.y - 1.0), yaw: Math.atan2(outward.x, outward.z) + Math.PI, hidden: false });
          S.posePuppet(0.016, 0); B.goLimp(this.phys, outward.clone().multiplyScalar(3.2).add(new V(0, 1.2, 0))); B.alive = false; B.dying = 0;
          if (this.sound.ok) { this.sound.splinter(win); setTimeout(() => this.sound.bodyFall(lawn), 900); } } },
      { from: lawn.clone().add(new V(3.6, 0.7, -3.2)), at: () => B.B.hips.getWorldPosition(new V()), dur: 2.6, fov: 42 },
      { from: lawn.clone().add(new V(0.6, 0.9, -2.2)), at: win.clone().add(new V(0, 0.4, 0)), dur: 3, fov: 40,
        enter: () => { const p = D.w(-2.6, 3.3, 0.7); lo.setPos(p, D.rot); lo.floorY = 3.3; lo.state = 'off'; lo.path = []; lo.body.pose = { look: lawn.clone(), light: true }; } },
      { from: lawn.clone().add(new V(3.6, 0.7, -3.2)), at: lawn.clone().setY(0.2), dur: 3.4, fov: 42, hold: { pos: lawn, yaw: 0, hidden: true }, enter: () => { B.root.visible = false; if (B.rig) { this.phys.remove(B.rig); } } },
    ], () => this.ending());
  }
  ending() {
    const f = document.getElementById('fade'); f.classList.add('on');
    setTimeout(() => { const sc = document.getElementById('screen'); sc.hidden = false; sc.querySelector('.lede').innerHTML = 'THE END'; f.classList.remove('on'); document.exitPointerLock?.(); this.ended?.(); }, 1800);
  }
  // ------------------------------------------------------------- per frame
  update(dt) {
    if (!this.ch || this.busy) return;
    this.t += dt;
    this['update' + this.ch.id]?.(dt);
    if (this.busy) return;
    const g = this.goals[this.step];
    if (g && g.done()) {
      this.step++;
      const nx = this.goals[this.step];
      if (nx) { this.sound.ok && this.sound.sting(false); }
      else this.complete();
    }
    // carrying the headstone: it rides in front of you and slows you down
    const H = this.town.items.headstone;
    if (H && H.held && !H.taken) {
      const S = this.shape, f = S.camera.getWorldDirection(new V()); f.y = 0; f.normalize();
      const p = S.pos.clone().addScaledVector(f, 0.55); p.y = S.floorY + 0.55;
      H.mesh.position.copy(p); H.mesh.rotation.set(0.2, Math.atan2(f.x, f.z) + Math.PI, 0);
      S.slow = 0.55; S.hasKnife = false; S.knifeHeld = false;
    }
    if (this.ch.id === 1) this.status = `${this.step}/5`;
  }
  inside(house) { const p = this.shape.pos; return this.night.W.zoneAt(p.x, p.y + 0.5, p.z)?.house === house; }
  objective() {
    const g = this.goals?.[this.step]; if (!g) return null;
    if (this.ch.id === 4) return this.night.objective_();
    const at = g.at?.(); if (!at) return null;
    return { text: g.text, point: at.clone ? at.clone() : new V(at.x, at.y || 0, at.z) };
  }
  // pick-ups: the mask, the knife, the rope, the headstone, and setting it down in the wagon
  pickPrompt(hp, fwd) {
    if (!this.ch || this.busy) return null;
    const I = this.town.items, M = this.town.mission;
    const near = (it, r = 1.6) => { if (!it || it.taken || it.held || !it.mesh.visible) return false;
      const p = it.mesh.position, flat = Math.hypot(p.x - hp.x, p.z - hp.z), to = p.clone().sub(hp); to.y *= 0.5;
      return flat < r && hp.y - p.y < 2.3 && to.normalize().dot(fwd) > 0.25; };
    if (this.ch.id === 1) for (const k of ['mask', 'knife', 'rope']) if (near(I[k])) return { prompt: `E — take ${I[k].label}`, act: () => this.take(k) };
    if (this.ch.id === 3) {
      const H = I.headstone;
      if (near(H, 2.0)) return { prompt: "E — pull up Judith's headstone", act: () => { H.held = true; this.sound.ok && this.sound.thump(H.mesh.position, 0.8, 60); this.sound.ok && this.sound.creak(H.mesh.position, 0.3, 0.9); } };
      if (H.held && !H.taken && this.shape.pos.distanceTo(M.wagon) < 3.2) return { prompt: 'E — put it in the back of the wagon', act: () => {
        H.held = false; H.taken = true; this.shape.slow = 1; this.shape.hasKnife = true; this.shape.knifeHeld = true;
        H.mesh.position.set(M.wagon.x, 0.95, M.wagon.z - 1.6); H.mesh.rotation.set(-Math.PI / 2, 0, 0); this.sound.ok && this.sound.thump(H.mesh.position, 0.9, 55); } };
    }
    return null;
  }
  take(k) {
    const it = this.town.items[k]; it.taken = true;
    this.sound.ok && this.sound.click(it.mesh.position);
    if (k === 'knife') { it.mesh.visible = false; this.shape.hasKnife = true; this.shape.knifeHeld = true; }
    if (k === 'rope') it.mesh.visible = false;
    if (k === 'mask') this.maskScene(it);
  }
  // he lifts the mask off the display and pulls it down over his head, then turns to us
  maskScene(it) {
    const S = this.shape, here = S.pos.clone(), yaw = S.bodyYaw, f = this.fwd(yaw), headAt = () => S.body.B.head.getWorldPosition(new V()).add(new V(0, 0.08, 0));
    const from0 = it.mesh.position.clone(), q0 = it.mesh.quaternion.clone();
    this.busy = true;
    this.cine.play([
      { from: behind(here, yaw, 2.4, 2.1, 0.6), at: headAt, dur: 2.4, hold: { pos: here, yaw, pose: { handsToFace: true } },
        tick: (k) => { const h = headAt(); it.mesh.position.lerpVectors(from0, h.clone().addScaledVector(f, 0.05), Math.min(1, k * 1.6)); it.mesh.quaternion.copy(q0).slerp(new THREE.Quaternion().setFromAxisAngle(new V(0, 1, 0), yaw), Math.min(1, k * 1.6)); },
        exit: () => { it.mesh.visible = false; this.sound.ok && (this.sound.breathOn = 1.4); } },
      { from: (k) => here.clone().addScaledVector(new V(f.z, 0, -f.x), 2.9).addScaledVector(f, -0.9 - 0.25 * k).add(new V(0, 0.95, 0)), at: () => headAt().add(new V(0, -0.3, 0)), dur: 3.0, fov: 44, hold: { pos: here, yaw: yaw + Math.PI * 0.4, tilt: 0.28 },
        tick: (k) => S.silhouette(true, 0.22 + 0.4 * Math.sin(Math.min(1, k * 1.4) * Math.PI)) },
    ], () => { this.busy = false; });
  }
}
