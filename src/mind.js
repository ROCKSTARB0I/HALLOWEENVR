// HALLOWEENVR director and minds. The cast keep their evening routines until
// they notice something: they see only what's lit and in front of them, hear
// doors and screams through walls, investigate, panic, lock themselves in,
// hide in closets, phone the sheriff, and run. Dr. Loomis hunts with a
// revolver. The Shape can't die; he only gets back up.
import * as THREE from '../vendor/three.module.js';
import { Person } from './flesh.js?v=3';

const V = THREE.Vector3;
const R = Math.random, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const _v = new V(), _v2 = new V();

export const CAST = {
  annie: { name: 'Annie', sex: 'f', height: 1.67, skin: 0xe2b8a0, hair: 0x2e1a0e, hairStyle: 'feather', shirt: 0x24324e, pants: 0x30425c, shoes: 0x3a2a1c, iris: [0.32, 0.2, 0.1], seed: 3 },
  lynda: { name: 'Lynda', sex: 'f', height: 1.65, skin: 0xe8c0a6, hair: 0xc8a05a, hairStyle: 'long', shirt: 0x8a2e2e, pants: 0x34485e, shoes: 0x5a3a24, iris: [0.25, 0.45, 0.6], seed: 5 },
  bob: { name: 'Bob', sex: 'm', height: 1.84, skin: 0xd8ae90, hair: 0x4a2e16, hairStyle: 'feather', shirt: 0x6a5032, pants: 0x2e3e56, shoes: 0x2a1e14, iris: [0.3, 0.22, 0.12], seed: 9, stubble: true, mustache: true },
  laurie: { name: 'Laurie', sex: 'f', height: 1.7, skin: 0xe6bea6, hair: 0x6a3a1c, hairStyle: 'shoulder', shirt: 0x9ab2cc, pants: 0x7a6a52, shoes: 0x4a3828, iris: [0.28, 0.36, 0.3], seed: 11 },
  elrod: { name: 'Mrs. Elrod', sex: 'f', height: 1.6, skin: 0xdab49e, hair: 0xa8a6a2, hairStyle: 'bun', robe: 0xc49a90, shirt: 0xc49a90, pants: 0xc49a90, shoes: 0x8a6a6a, iris: [0.4, 0.42, 0.45], seed: 13 },
  loomis: { name: 'Dr. Loomis', sex: 'm', height: 1.78, skin: 0xd4a88e, hair: 0x9a9894, hairStyle: 'balding', coat: 0x7a6a4a, shirt: 0xd0ccc0, pants: 0x34322e, shoes: 0x1e1a16, iris: [0.36, 0.38, 0.42], seed: 17, stubble: true },
  brackett: { name: 'Sheriff Brackett', sex: 'm', height: 1.83, skin: 0xcca088, hair: 0x5a4632, hairStyle: 'short', shirt: 0xa89060, pants: 0x4e3e28, shoes: 0x1a140e, iris: [0.3, 0.26, 0.2], seed: 19, mustache: true, belt: 0x2a1e12 },
};
const FEMALE = (n) => CAST[n].sex === 'f';

class Npc {
  constructor(key, night) {
    this.key = key; this.night = night; this.def = CAST[key];
    this.body = new Person(night.scene, this.def);
    this.hp = key === 'loomis' || key === 'brackett' ? 150 : 100;
    this.pos = new V(); this.floorY = 0; this.yaw = 0; this.speed = 0; this.want = 0;
    this.state = 'off'; this.path = []; this.aware = 0; this.fear = 0; this.seen = 0; this.lastSeen = null; this.say = 0;
    this.activity = null; this.timer = 0; this.alive = true; this.dead = false; this.escaped = false; this.cool = 0;
    this.body.root.visible = false;
  }
  get name() { return this.def.name; }
  head(out = new V()) { return this.body.B.head.getWorldPosition(out); }
  setPos(p, yaw = this.yaw) { this.pos.copy(p); this.floorY = p.y; this.yaw = yaw; this.body.root.visible = true; this.body.place(p.x, p.y, p.z, yaw); }
}

export class Night {
  constructor(ctx) {
    Object.assign(this, ctx);
    this.W = this.world; this.t = 0; this.people = []; this.N = {};
    for (const k of Object.keys(CAST)) { const n = new Npc(k, this); this.people.push(n); this.N[k] = n; }
    this.buildNav();
    this.buildCars();
    this.lights = [0, 1].map(() => { const s = new THREE.SpotLight(0xfff2d8, 0, 26, 0.32, 0.5, 1.6); this.scene.add(s, s.target); return s; });
    this.calls = 0; this.policeCalled = false; this.kills = 0; this.over = false; this.tally = {}; this.phoneState = {};
    this.dawn = 25 * 60; this.clockStart = 21 * 60 + 40;    // 9:40 PM; one real second ~ 16 game seconds
    this.inCar = null;
  }

  // ---------------------------------------------------------- navigation
  buildNav() {
    const W = this.W, nav = this.town.nav, nodes = nav.nodes.map((n) => ({ ...n, links: [] }));
    const link = (a, b) => { if (!a.links.includes(b)) a.links.push(b); if (!b.links.includes(a)) b.links.push(a); };
    for (const [a, b] of nav.edges) link(nodes[a], nodes[b]);
    const B = this.town.bounds;
    const outdoor = [];
    const inside = (x, z) => Object.values(this.town.houses).some((h) => { const b = h.wbox(-6.2, 0, -3.8, 6.2, 0, 13.2); return x > b[0] && x < b[3] && z > b[2] && z < b[5]; });
    for (let x = B.x0 + 2; x <= B.x1 - 2; x += 3.6) for (let z = B.z0 + 2; z <= B.z1 - 2; z += 3.6) {
      if (inside(x, z)) continue;
      if (W.boxes.some((b) => x > b.min.x - 0.4 && x < b.max.x + 0.4 && z > b.min.z - 0.4 && z < b.max.z + 0.4 && b.max.y < 4)) continue;
      const n = { id: nodes.length, x, y: 0, z, outside: true, links: [] }; nodes.push(n); outdoor.push(n);
    }
    for (let i = 0; i < outdoor.length; i++) for (let j = i + 1; j < outdoor.length; j++) {
      const a = outdoor[i], b = outdoor[j]; const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d < 5.2 && this.walkable(a, b)) link(a, b);
    }
    for (const n of nodes) if ((n.name === 'porch' || n.name === 'back') && n.house) {
      const near = outdoor.map((o) => ({ o, d: Math.hypot(o.x - n.x, o.z - n.z) })).filter((q) => q.d < 7).sort((a, b) => a.d - b.d);
      let c = 0; for (const q of near) { if (this.walkable(n, q.o)) { link(n, q.o); if (++c >= 3) break; } }
    }
    this.nodes = nodes; this.outdoor = outdoor;
  }
  walkable(a, b) {
    const W = this.W, y = Math.max(a.y, b.y);
    for (const w of W.walls) {
      if (w.y1 < y + 0.2 || w.y0 > y + 1.6) continue;
      const dx = b.x - a.x, dz = b.z - a.z, fx = w.bx - w.ax, fz = w.bz - w.az, den = dx * fz - dz * fx; if (Math.abs(den) < 1e-9) continue;
      const t = ((w.ax - a.x) * fz - (w.az - a.z) * fx) / den, u = ((w.ax - a.x) * dz - (w.az - a.z) * dx) / den;
      if (t > -0.02 && t < 1.02 && u > -0.05 && u < 1.05) return false;
    }
    return true;
  }
  nearestNode(p, filter = null) {
    let best = null, bd = 1e9;
    for (const n of this.nodes) { if (filter && !filter(n)) continue; const d = (n.x - p.x) ** 2 + ((n.y - p.y) * 3) ** 2 + (n.z - p.z) ** 2; if (d < bd && (Math.abs(n.y - p.y) < 1.5)) { if (d > 64 || this.W.blocked(p.x, p.y + 1, p.z, n.x, n.y + 1, n.z)) { if (d < bd && !best) { best = n; bd = d + 1e6; } continue; } bd = d; best = n; } }
    return best;
  }
  route(from, to) {
    const a = this.nearestNode(from), b = to.links ? to : this.nearestNode(to);
    if (!a || !b) return [];
    const open = new Map([[a, 0]]), came = new Map(), g = new Map([[a, 0]]), h = (n) => Math.hypot(n.x - b.x, (n.y - b.y) * 2, n.z - b.z);
    while (open.size) {
      let cur = null, cf = 1e9; for (const [n, f] of open) if (f < cf) { cf = f; cur = n; }
      if (cur === b) { const out = [cur]; while (came.has(cur)) { cur = came.get(cur); out.unshift(cur); } return out; }
      open.delete(cur);
      for (const nb of cur.links) {
        const cost = g.get(cur) + Math.hypot(nb.x - cur.x, nb.y - cur.y, nb.z - cur.z) + (nb.door?.locked ? 30 : 0);
        if (cost < (g.get(nb) ?? 1e9)) { g.set(nb, cost); came.set(nb, cur); open.set(nb, cost + h(nb)); }
      }
    }
    return [];
  }

  // ---------------------------------------------------------- cars
  buildCars() {
    this.cars = [];
    const paint = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.28, metalness: 0.55 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1, roughness: 0.2 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0c1014, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.5 });
    const tire = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.9 });
    const seat = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.8 });
    const make = (c, police = false) => {
      const g = new THREE.Group(), m = paint(c);
      const box = (w, h, d, x, y, z, mat) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
      box(1.95, 0.5, 5.3, 0, 0.55, 0, m); box(1.9, 0.06, 1.8, 0, 0.83, 1.6, m); box(1.9, 0.06, 1.3, 0, 0.83, -2.0, m);
      for (const s of [-1, 1]) { box(0.06, 0.5, 2.3, s * 0.92, 1.08, -0.15, glass); }
      box(1.8, 0.06, 2.1, 0, 1.36, -0.2, m); box(1.82, 0.5, 0.06, 0, 1.08, 0.95, glass); box(1.82, 0.48, 0.06, 0, 1.08, -1.32, glass);
      for (const s of [-1, 1]) for (const z of [-0.4, 0.95]) box(0.07, 0.55, 0.07, s * 0.9, 1.1, z === 0.95 ? 0.93 : -1.3, m);
      box(1.7, 0.45, 0.5, 0, 0.75, -0.95, seat); box(1.7, 0.6, 0.12, 0, 1.05, -1.2, seat); box(1.7, 0.45, 0.5, 0, 0.75, 0.3, seat); box(1.7, 0.6, 0.12, 0, 1.0, 0.05, seat);
      box(2.0, 0.14, 0.12, 0, 0.42, 2.66, chrome); box(2.0, 0.14, 0.12, 0, 0.42, -2.66, chrome);
      for (const s of [-1, 1]) { const hl = box(0.28, 0.16, 0.04, s * 0.65, 0.62, 2.66, new THREE.MeshBasicMaterial({ color: 0x404038 })); hl.name = 'head'; const tl = box(0.3, 0.12, 0.04, s * 0.7, 0.66, -2.66, new THREE.MeshBasicMaterial({ color: 0x300808 })); tl.name = 'tail'; }
      const wheels = [];
      for (const s of [-1, 1]) for (const z of [-1.6, 1.6]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 18).rotateZ(Math.PI / 2), tire); w.position.set(s * 0.88, 0.34, z); g.add(w); wheels.push(w); }
      if (police) { box(1.2, 0.12, 0.3, 0, 1.45, -0.2, new THREE.MeshStandardMaterial({ color: 0x222222 })); g.userData.bar = [box(0.5, 0.14, 0.26, -0.33, 1.53, -0.2, new THREE.MeshBasicMaterial({ color: 0x400000 })), box(0.5, 0.14, 0.26, 0.33, 1.53, -0.2, new THREE.MeshBasicMaterial({ color: 0x000040 }))];
        for (const s of [-1, 1]) box(0.02, 0.3, 1.2, s * 0.985, 0.6, 0.2, new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.4 })); }
      g.userData.wheels = wheels; this.scene.add(g); return g;
    };
    for (const c of this.town.cars) {
      const g = make(c.color); g.position.set(c.x, 0, c.z); g.rotation.y = c.yaw;
      const car = { g, owner: c.owner, x: c.x, z: c.z, yaw: c.yaw, home: { x: c.x, z: c.z, yaw: c.yaw }, segs: [], away: false };
      this.cars.push(car); this.carCollide(car, true);
      if (c.owner === 'wallace') this.annieCar = car;
    }
    // the sheriff's cruiser waits off the block until somebody calls
    const p = make(0x1a1a1a, true); p.position.set(-90, 0, -2); p.rotation.y = Math.PI / 2;
    this.cruiser = { g: p, x: -90, z: -2, yaw: Math.PI / 2, segs: [], away: true, police: true };
  }
  carCollide(car, on) {
    for (const s of car.segs) { const i = this.W.walls.indexOf(s); if (i >= 0) this.W.walls.splice(i, 1); }
    car.segs = [];
    // rebuild grid lazily: walls in the grid are filtered by membership
    if (!on) { this.W.grid.forEach((list) => { for (let i = list.length - 1; i >= 0; i--) if (list[i].car === car) list.splice(i, 1); }); return; }
    const c = Math.cos(car.yaw), s = Math.sin(car.yaw), pt = (x, z) => [car.x + x * c + z * s, car.z - x * s + z * c];
    const corners = [pt(-1, -2.7), pt(1, -2.7), pt(1, 2.7), pt(-1, 2.7)];
    for (let i = 0; i < 4; i++) { const a = corners[i], b = corners[(i + 1) % 4]; const w = this.W.addWall(a[0], a[1], b[0], b[1], 0, 1.4, { thick: 0.05 }); w.car = car; car.segs.push(w); }
  }
  carPoint(car, x, y, z) { const c = Math.cos(car.yaw), s = Math.sin(car.yaw); return new V(car.x + x * c + z * s, y, car.z - x * s + z * c); }

  // --------------------------------------------------------------- start
  start() {
    const S = this.town.spots, H = this.town.houses, N = this.N;
    // Annie at the Wallace sink, Laurie on the Doyle couch, Mrs. Elrod upstairs
    N.annie.setPos(new V(S.wallace.sink.x, S.wallace.sink.y, S.wallace.sink.z), S.wallace.sink.yaw); this.routine(N.annie, 'annie');
    N.laurie.setPos(new V(S.doyle.couch.x, S.doyle.couch.y, S.doyle.couch.z), S.doyle.couch.yaw); this.routine(N.laurie, 'laurie');
    N.elrod.setPos(new V(S.elrod.bed1.x, 3.3, S.elrod.bed1.z), 0); this.routine(N.elrod, 'elrod');
    // Loomis behind the hedge across from the Myers house, watching it
    const m = H.myers; const watch = m.w(1.5, 0, -14 + 4.6 - 9);
    N.loomis.setPos(new V(-22, 0, 9.2), Math.PI); N.loomis.state = 'watch'; N.loomis.post = new V(-22, 0, 9.2);
    // TVs on, with sound
    for (const tv of this.town.tvs) { tv.audio = this.sound.ok ? this.sound.tv(tv.pos) : null; }
    this.caption("Haddonfield, Illinois. October 31st, 1978.", 5);
    setTimeout(() => this.caption('Loomis is watching the front of the house. Leave by the back.', 5), 5500);
  }
  caption(text, secs) { this.ctxCaption ? this.ctxCaption(text, secs) : this.constructor.cap?.(text, secs); this._cap(text, secs); }
  _cap(text, secs) { (this.captionFn || this['caption_'])?.(text, secs); }

  // evening routines: lists of [activity, seconds]
  routine(n, key) {
    const S = this.town.spots;
    const plans = {
      annie: [['sink', 'wallace', 50], ['laundry', 'wallace', 60], ['fridge', 'wallace', 15], ['couch', 'wallace', 70], ['phone', 'wallace', 25], ['kitchenTable', 'wallace', 60], ['window', 'wallace', 20]],
      laurie: [['couch', 'doyle', 140], ['window', 'doyle', 15], ['kitchenTable', 'doyle', 40], ['couch', 'doyle', 120], ['phone', 'doyle', 25], ['bed1', 'doyle', 40]],
      elrod: [['bed1', 'elrod', 200], ['bath', 'elrod', 40], ['bed1', 'elrod', 300]],
      bob: [['bed3', 'wallace', 9999]], lynda: [['bed3', 'wallace', 9999]],
    };
    n.plan = plans[key] || []; n.step = -1; n.state = 'routine'; this.nextActivity(n);
  }
  nextActivity(n) {
    n.step = (n.step + 1) % n.plan.length;
    const [act, house, secs] = n.plan[n.step], S = this.town.spots[house];
    const spot = act === 'bath' ? { ...this.town.houses[house].nodes.bath } : S[act];
    n.activity = { act, house, secs, spot, arrived: false };
    n.target = new V(spot.x, spot.y ?? 0, spot.z);
    n.path = this.route(n.pos, n.target); n.want = 1.25;
  }

  // ---------------------------------------------------------------- update
  update(dt, t, input, vr) {
    if (this.over) return;
    this.t += dt;
    const shape = this.shape;
    // the Shape fights; events come back through shape.events
    if (!this.inCar) shape.fight(dt, input, this.people.filter((p) => p.body.root.visible), vr);
    this.interact(input, vr);
    this.handleEvents();
    // who can see him right now
    let seenBy = 0;
    const mh = shape.headPos(new V()), mChest = mh.clone().add(_v.set(0, -0.5, 0));
    const lit = this.W.lightAt(mChest.x, mChest.y, mChest.z);
    this.michaelLight = lit;
    for (const n of this.people) {
      n.cool = Math.max(0, (n.cool || 0) - dt);
      if (!n.body.root.visible || n.dead || n.escaped || n.body.limp) continue;
      const vis = this.inCar ? 0 : this.canSee(n, mChest, lit);
      n.seeing = vis;
      if (vis > 0) seenBy++;
      this.think(n, dt, vis, mChest);
      this.steer(n, dt);
    }
    shape.unseen = seenBy === 0;
    // scheduled beats of the night
    this.beats(dt);
    this.hunterLights();
    this.updateCars(dt);
    // clock and dawn
    const mins = this.clockStart + this.t * 16 / 60, hh = Math.floor(mins / 60) % 24, mm = Math.floor(mins % 60);
    const clk = `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh >= 12 && hh < 24 ? 'PM' : 'AM'}`;
    const el = document.getElementById('clock'); if (el) el.textContent = clk;
    const tl = document.getElementById('tally'); if (tl) tl.textContent = `${this.kills} dead`;
    if (this.t > this.dawn) this.end('dawn');
    if (this.sound.ok) this.sound.exert = Math.max(this.sound.exert, shape.speed > 0.5 ? 0.3 : 0);
  }
  after(dt, t) {
    for (const n of this.people) {
      if (!n.body.root.visible) continue;
      if (!n.body.limp) { n.body.place(n.pos.x, n.floorY, n.pos.z, n.yaw); }
      n.body.face.fear = n.dead ? 0 : clamp(n.fear, 0, 1);
      n.body.animate(dt, t);
      n.body.updateWounds(dt);
      if (n.dying > 0) { n.dying -= dt; n.body.dying = clamp(n.dying / 3, 0, 1); if (n.dying <= 0) { n.body.face.dead = true; n.body.face.flush *= 0.5; } }
    }
  }

  canSee(n, target, lit) {
    const eye = n.head(_v2), d = eye.distanceTo(target);
    if (d > 32) return 0;
    const fwd = _v.set(Math.sin(n.yaw + (n.body.headYaw || 0)), 0, Math.cos(n.yaw + (n.body.headYaw || 0)));
    const dir = target.clone().sub(eye); dir.y = 0; dir.normalize();
    const cos = fwd.dot(dir);
    if (cos < (d < 1.6 ? -0.2 : 0.42)) return 0;
    const range = 3 + 30 * Math.pow(lit, 0.8) * (this.shape.speed > 0.4 ? 1.25 : 0.9) + (n.light ? 10 : 0);
    if (d > range) return 0;
    if (this.W.blocked(eye.x, eye.y, eye.z, target.x, target.y, target.z)) return 0;
    return clamp((1 - d / range) * 2 * (0.4 + cos * 0.6), 0.05, 1);
  }
  hear(pos, loud, what = 'noise') {
    for (const n of this.people) {
      if (n.dead || n.body.limp || !n.body.root.visible || n.escaped) continue;
      const d = n.pos.distanceTo(pos), wall = this.W.blocked(n.pos.x, n.floorY + 1.5, n.pos.z, pos.x, pos.y + 0.5, pos.z, false);
      const reach = loud * (wall ? 0.45 : 1);
      if (d > reach) continue;
      if (n.hunter) { n.lastSeen = pos.clone(); if (n.state === 'watch' || n.state === 'patrol') { n.state = 'search'; n.path = this.route(n.pos, pos); n.want = 2.6; this.say(n, what === 'scream' ? 'Michael!' : 'What was that?'); } continue; }
      if (n.state === 'routine' || n.state === 'investigate') {
        n.fear = Math.min(1, n.fear + (what === 'scream' ? 0.55 : 0.12));
        if (n.fear > 0.75) this.panic(n, pos, what);
        else { n.state = 'investigate'; n.inv = pos.clone(); n.path = this.route(n.pos, pos); n.want = 1.1; n.timer = 10;
          this.say(n, pick(what === 'scream' ? ['Did you hear that?', 'Annie?', 'Lynda?'] : ['Hello?', "Who's there?", 'Bob? Quit fooling around.', 'Is somebody there?'])); }
      }
    }
  }

  think(n, dt, vis, mChest) {
    const shape = this.shape, mp = shape.pos;
    n.say = Math.max(0, n.say - dt);
    n.body.pose.look = null;
    if (n.hunter) return this.hunt(n, dt, vis, mChest);
    // awareness grows while they can see him
    if (vis > 0) { n.aware += vis * dt * (n.state === 'routine' ? 1.6 : 3); n.lastSeen = mp.clone(); n.body.pose.look = mChest; }
    else n.aware = Math.max(0, n.aware - dt * 0.25);
    if (n.state === 'routine' || n.state === 'investigate') {
      if (n.aware > 0.15 && n.aware < 0.9 && vis > 0 && !n.glimpsed) { n.glimpsed = true; n.fear = Math.min(1, n.fear + 0.3); this.say(n, pick(['...Hello?', 'Is someone out there?', 'Who is that?'])); this.sound.ok && this.sound.sting(false); }
      if (n.aware >= 0.9 || (vis > 0 && mp.distanceTo(n.pos) < 2.2)) return this.panic(n, mp, 'saw');
      // bodies are found
      for (const o of this.people) if (o.dead && o.body.root.visible && !n.found?.has(o)) {
        const p = o.body.B.spine.getWorldPosition(new V());
        if (p.distanceTo(n.pos) < 9 && this.canSee(n, p, Math.max(0.35, this.W.lightAt(p.x, p.y, p.z))) > 0.1) { (n.found || (n.found = new Set())).add(o); n.fear = 1; this.say(n, pick([`${o.name}?!`, 'Oh my God!', 'Oh God, no...'])); return this.panic(n, p, 'body'); }
      }
    }
    n.fear = Math.max(0, n.fear - dt * (n.state === 'routine' ? 0.01 : 0));
    switch (n.state) {
      case 'routine': return this.doRoutine(n, dt);
      case 'investigate': {
        n.timer -= dt; n.body.pose.look = n.inv;
        if (!n.path.length || n.timer < 0) { n.want = 0; n.lookAround = (n.lookAround || 0) + dt; n.body.pose.look = n.inv.clone().add(_v.set(Math.sin(this.t) * 4, 1.5, Math.cos(this.t * 0.7) * 4)); if (n.lookAround > 3.5) { n.lookAround = 0; n.state = 'routine'; n.glimpsed = false; this.say(n, pick(['Must be the wind.', 'Nothing.', 'Halloween...'])); n.step--; this.nextActivity(n); } }
        return;
      }
      case 'flee': return this.doFlee(n, dt, vis);
      case 'call': return this.doCall(n, dt, vis);
      case 'hide': {
        n.want = 0; n.body.pose.cower = n.inHide ? 1 : 0; n.body.pose.look = n.inHide ? null : mChest;
        n.fear = Math.max(0.6, n.fear);
        if (!n.inHide && !n.path.length) n.inHide = true;
        if (n.inHide && vis > 0 && mp.distanceTo(n.pos) < 3.5) { this.scream(n); n.inHide = false; n.state = 'cornered'; n.timer = 2.5; }
        return;
      }
      case 'cornered': {
        n.want = 0; n.body.pose.look = mChest; n.body.pose.hands = true; n.timer -= dt;
        if (n.key === 'laurie') this.laurieFights(n);
        if (n.timer < 0) { n.body.pose.hands = false; this.panic(n, mp, 'saw'); }
        return;
      }
      case 'down': n.timer -= dt; if (n.timer < 0 && n.body.limp && n.alive) { n.body.getUp(this.phys); n.pos.set(n.body.root.position.x, n.floorY, n.body.root.position.z); n.yaw = n.body.yaw; this.panic(n, mp, 'saw'); } return;
      case 'pound': {
        n.want = 0; n.body.pose.pound = true; n.timer -= dt; n.body.pose.look = null;
        if (R() < dt * 0.8) { this.sound.ok && this.sound.thump(n.pos.clone().add(_v.set(0, 1.4, 0)), 0.8, 90); this.say(n, pick(['Help! Please, help me!', 'Open the door!', 'Mrs. Elrod! Please!'])); }
        if (n.timer < 0 || (vis > 0 && mp.distanceTo(n.pos) < 6)) { n.body.pose.pound = false; this.panic(n, mp, 'saw', true); }
        return;
      }
      case 'seated': n.want = 0; return;
    }
  }

  doRoutine(n, dt) {
    const a = n.activity; if (!a) return;
    if (!a.arrived) {
      if (!n.path.length || n.pos.distanceTo(n.target) < 0.5) { a.arrived = true; a.left = a.secs; n.want = 0; n.yaw = a.spot.yaw ?? n.yaw; if (a.spot.y !== undefined) n.pos.copy(n.target); }
      return;
    }
    n.want = 0; a.left -= dt;
    const P = n.body.pose;
    P.sit = ['couch', 'bed3', 'kitchenTable', 'dining'].includes(a.act) ? Math.min(1, (P.sit || 0) + dt * 2) : Math.max(0, (P.sit || 0) - dt * 3);
    if (a.act === 'bed1' || a.act === 'bed3') P.sit = 1;
    P.phone = a.act === 'phone';
    P.reach = a.act === 'sink' || a.act === 'laundry' || a.act === 'fridge';
    if (a.act === 'phone' && R() < dt * 0.25 && n.say <= 0) this.say(n, pick(n.key === 'laurie' ? ['Hi, it\'s me. Is Annie there?', 'No, I\'m just watching TV.', 'Okay. Bye.'] : ['Hello? ...Hi.', 'Yeah, I know.', 'Totally.', 'I gotta go.']), 3);
    if (a.act === 'couch' && R() < dt * 0.02) this.say(n, pick(['This movie is so dumb.', 'Ugh, Halloween.']), 2.5);
    if (a.left <= 0) { P.sit = 0; P.phone = false; P.reach = false; this.nextActivity(n); }
  }

  panic(n, from, why, skipScream = false) {
    if (n.dead || n.hunter) return;
    const first = n.state !== 'flee';
    n.state = 'flee'; n.fear = 1; n.from = from.clone(); n.body.pose.sit = 0; n.body.pose.phone = false; n.body.pose.reach = false; n.body.pose.hands = false; n.body.pose.cower = 0; n.inHide = false;
    if (first && !skipScream) { this.scream(n); this.sound.ok && this.sound.sting(why === 'body'); }
    this.chooseRefuge(n);
  }
  scream(n) {
    if (!this.sound.ok) return;
    n.body.face.scream = 1; setTimeout(() => { n.body.face.scream = 0; }, 1400);
    const dur = this.sound.scream(n.head(new V()), FEMALE(n.key));
    this.hear(n.pos.clone().add(_v.set(0, 1.5, 0)), 28, 'scream');
  }
  chooseRefuge(n) {
    const mp = this.shape.pos, H = this.town.houses, zone = this.W.zoneAt(n.pos.x, n.floorY + 0.5, n.pos.z);
    const dM = mp.distanceTo(n.pos);
    // upstairs: lock yourself in a room, or the closet
    if (zone && n.floorY > 2) {
      const h = H[zone.house], opts = ['bath', 'bed1', 'bed2', 'closet', 'bed3'].map((r) => h.nodes[r]).filter((x) => x && x.room !== zone.room || x.name === 'closet');
      const pick2 = opts.map((o) => ({ o, d: Math.hypot(o.x - mp.x, o.z - mp.z) })).sort((a, b) => b.d - a.d)[0];
      if (pick2) { n.refuge = { kind: 'room', node: pick2.o, house: h }; n.path = this.route(n.pos, pick2.o); n.want = 3.4; return; }
    }
    // downstairs: phone the sheriff if he's not close, else out the far door
    if (zone && !this.policeCalled && dM > 7 && this.town.phones.find((p) => p.house === zone.house) && n.key !== 'elrod') {
      const ph = this.town.spots[zone.house].phone; n.refuge = { kind: 'phone', house: zone.house }; n.target = new V(ph.x, ph.y, ph.z); n.path = this.route(n.pos, n.target); n.want = 3.2; return;
    }
    if (zone) {
      const h = H[zone.house], doors = [h.nodes.porch, h.nodes.back].sort((a, b) => Math.hypot(b.x - mp.x, b.z - mp.z) - Math.hypot(a.x - mp.x, a.z - mp.z));
      n.refuge = { kind: 'out', node: doors[0] }; n.path = this.route(n.pos, doors[0]); n.want = 3.4; return;
    }
    // outside: the Doyle house if Laurie will open up, Mrs. Elrod's door, or run for it
    const laurie = this.N.laurie;
    const targets = [];
    if (n.key !== 'laurie' && !laurie.dead && laurie.state !== 'flee') targets.push({ k: 'doyle', node: H.doyle.nodes.porch });
    targets.push({ k: 'elrod', node: H.elrod.nodes.porch });
    for (const e of this.town.escapes) targets.push({ k: 'escape', node: this.nearestNode(e, (q) => q.outside) });
    const scored = targets.filter((x) => x.node).map((x) => { const toM = Math.hypot(x.node.x - mp.x, x.node.z - mp.z), toN = Math.hypot(x.node.x - n.pos.x, x.node.z - n.pos.z); return { ...x, s: toM - toN * 0.6 + (x.k === 'escape' ? -8 : 0) + (x.k === 'elrod' ? -4 : 0) + R() * 4 }; }).sort((a, b) => b.s - a.s);
    const c = scored[0]; n.refuge = { kind: c.k, node: c.node }; n.path = this.route(n.pos, c.node); n.want = 3.5;
    n.stamina = n.stamina ?? 9;
  }
  doFlee(n, dt, vis) {
    const mp = this.shape.pos, ref = n.refuge;
    if (vis > 0) n.body.pose.look = this.shape.headPos(new V());
    if (n.stamina !== undefined && n.want > 2.5) { n.stamina -= dt; if (n.stamina < 0) n.want = 2.2; }
    // cornered: he's in the way and close
    if (mp.distanceTo(n.pos) < 1.4 && vis > 0 && n.path.length) { n.state = 'cornered'; n.timer = 1.5 + R(); return; }
    if (n.path.length) { if (R() < dt * 0.5 && n.say <= 0) this.say(n, pick(['No! No!', 'Help!', 'Somebody help me!', 'Get away from me!'])); return; }
    n.want = 0;
    if (!ref) return this.chooseRefuge(n);
    if (ref.kind === 'room') {
      // shut and lock the door you came through, then hide
      const node = ref.node, d = node.door || (ref.house.nodes[node.name + 'Door']?.door);
      const doorNode = ref.house.nodes[node.name + 'Door'];
      if (doorNode?.door && !doorNode.door.broken) { doorNode.door.target = 0; setTimeout(() => { if (doorNode.door.angle < 0.15) { doorNode.door.locked = true; this.sound.ok && this.sound.lockClick(new V(doorNode.x, doorNode.y + 1, doorNode.z)); } }, 900); this.sound.ok && this.sound.doorSlam(new V(doorNode.x, doorNode.y + 1, doorNode.z), 0.6); }
      n.state = 'hide'; n.inHide = true; return;
    }
    if (ref.kind === 'phone') { n.state = 'call'; n.timer = 14; this.say(n, 'Hello, police? Somebody is in the house!', 4); return; }
    if (ref.kind === 'out') { n.refuge = null; return this.chooseRefuge(n); }
    if (ref.kind === 'escape') { if (Math.abs(n.pos.x) > 64) { n.escaped = true; n.body.root.visible = false; this.tally[n.key] = 'escaped'; this.caption(`${n.name} got away.`, 4); } else { const e = this.town.escapes.sort((a, b) => a.distanceTo(n.pos) - b.distanceTo(n.pos))[0]; n.path = [{ x: e.x * 1.1, y: 0, z: e.z }]; n.want = 3; } return; }
    if (ref.kind === 'doyle' || ref.kind === 'elrod') {
      const h = this.town.houses[ref.kind], door = h.doors.front;
      if (ref.kind === 'doyle' && !this.N.laurie.dead && this.N.laurie.state !== 'flee' && !door.broken) {
        // Laurie lets them in and locks up behind them
        door.locked = false; door.target = 1.6; this.say(this.N.laurie, `${n.name}?! Get inside!`, 3);
        n.path = this.route(n.pos, h.nodes.living); n.want = 2.5; n.refuge = { kind: 'room', node: h.nodes.living, house: h, lockFront: true };
        setTimeout(() => { door.target = 0; setTimeout(() => { door.locked = true; this.sound.ok && this.sound.lockClick(new V(h.nodes.frontDoor.x, 1.2, h.nodes.frontDoor.z)); }, 900); }, 2500);
        this.N.laurie.fear = Math.max(this.N.laurie.fear, 0.8); this.N.laurie.state === 'routine' && this.panic(this.N.laurie, this.shape.pos, 'told', true);
        return;
      }
      n.state = 'pound'; n.timer = 5 + R() * 3; n.refuge = null; n.yaw = Math.atan2(door.hx - n.pos.x, door.hz - n.pos.z);
    }
  }
  doCall(n, dt, vis) {
    n.want = 0; n.body.pose.phone = true; n.timer -= dt;
    if (vis > 0 && this.shape.pos.distanceTo(n.pos) < 4) { n.body.pose.phone = false; this.say(n, 'He\'s here! He\'s HERE!'); this.panic(n, this.shape.pos, 'saw', true); return; }
    if (n.timer < 0) { n.body.pose.phone = false; this.policeCalled = true; this.say(n, 'They\'re coming. Oh God, please hurry.', 3); this.dispatch(this.W.zoneAt(n.pos.x, n.floorY + 0.5, n.pos.z)?.house || 'wallace'); n.refuge = null; n.state = 'flee'; this.chooseRefuge(n); }
  }
  laurieFights(n) {
    const shape = this.shape;
    if ((n.fought || 0) >= 2 || (n.fightCool || 0) > this.t) return;
    if (shape.pos.distanceTo(n.pos) < 1.3 && R() < 0.5) {
      n.fought = (n.fought || 0) + 1; n.fightCool = this.t + 8;
      this.say(n, pick(['Get away from me!', 'NO!']));
      this.sound.ok && this.sound.stab(shape.headPos(new V()).add(_v.set(0, -0.15, 0)), false);
      this.crimson.spray(shape.headPos(new V()).add(_v.set(0, -0.2, 0)), new V(0, -0.5, 1), 10, 1.5);
      this.caption('She stabs you in the neck with a knitting needle.', 3);
      this.knockdown(4);
      this.panic(n, shape.pos, 'fought', true); n.want = 3.6;
    }
  }

  // ---------------------------------------------------------- hunters
  hunt(n, dt, vis, mChest) {
    const shape = this.shape, mp = shape.pos, P = n.body.pose;
    P.light = n.flashOn = n.state !== 'watch' || this.t > 1e9;
    if (vis > 0) { n.aware += dt * 4 * vis; n.lastSeen = mp.clone(); } else n.aware = Math.max(0, n.aware - dt * 0.4);
    if (shape.down > 0) { P.aim = false; if (vis > 0 && n.say <= 0) this.say(n, n.key === 'loomis' ? 'It was the boogeyman...' : 'Is he dead?', 4); n.want = 0; return; }
    if (n.aware > 0.5 && vis > 0) {
      if (n.state !== 'shoot') { n.state = 'shoot'; n.shotT = 0.6; this.say(n, n.key === 'loomis' ? pick(['Michael!', 'Get away from them!']) : 'Freeze! Sheriff!', 2); this.sound.ok && this.sound.sting(false); }
    }
    switch (n.state) {
      case 'watch': {
        n.want = 0; n.yaw = Math.PI; P.look = new V(-24, 4, -20);
        if (this.t > 260 || n.aware > 0.3) { n.state = 'patrol'; this.say(n, 'He came home. I know he did.', 4); }
        return;
      }
      case 'patrol': {
        if (!n.path.length) {
          const pts = [new V(-22, 0, 6.5), new V(24, 0, 6.5), new V(24, 0, -6.5), new V(-24, 0, -6.5), new V(0, 0, -6.5), new V(36, 0, 6.5), new V(-40, 0, -6.5)];
          n.path = this.route(n.pos, pts[(R() * pts.length) | 0]); n.want = 1.2;
        }
        return;
      }
      case 'search': { if (!n.path.length) { n.state = 'patrol'; } P.look = n.lastSeen; return; }
      case 'shoot': {
        n.want = 0; P.aim = true; P.look = mChest;
        n.yaw = lerpAngle(n.yaw, Math.atan2(mp.x - n.pos.x, mp.z - n.pos.z), Math.min(1, dt * 6));
        n.shotT -= dt;
        if (vis <= 0) { n.lostT = (n.lostT || 0) + dt; if (n.lostT > 1.5) { n.lostT = 0; P.aim = false; n.state = 'search'; n.path = this.route(n.pos, n.lastSeen || mp); n.want = 2.4; } return; }
        n.lostT = 0;
        if (n.shotT <= 0) {
          n.ammo = n.ammo ?? 6;
          if (n.ammo <= 0) { n.ammo = 6; n.shotT = 4; this.say(n, n.key === 'loomis' ? '...' : 'Reloading!', 1.5); this.sound.ok && this.sound.click(n.head(new V())); return; }
          n.ammo--; n.shotT = n.key === 'brackett' ? 1.1 : 0.75;
          const muzzle = n.body.B.rHa.getWorldPosition(new V());
          this.sound.ok && this.sound.gunshot(muzzle, n.key === 'brackett');
          this.flash(muzzle);
          const d = muzzle.distanceTo(mChest), hit = R() < clamp(1.15 - d / 22, 0.12, 0.85) * (shape.speed > 1 ? 0.8 : 1);
          this.hear(muzzle, 60, 'gun');
          if (hit) this.shot(mChest, muzzle);
        }
        return;
      }
    }
  }
  flash(p) { const L = { x: p.x, y: p.y, z: p.z, color: 0xffd8a0, intensity: 60, range: 9, see: 1, on: true }; this.W.lights.push(L); setTimeout(() => { L.on = false; this.W.lights.splice(this.W.lights.indexOf(L), 1); }, 70); }
  shot(at, from) {
    const shape = this.shape;
    shape.hp--; this.crimson.spray(at, at.clone().sub(from).normalize(), 14, 2.5);
    this.sound.ok && this.sound.thump(at, 0.5, 80);
    const f = document.getElementById('fade'); f.style.background = '#300'; f.style.transition = 'none'; f.style.opacity = 0.45; setTimeout(() => { f.style.transition = 'opacity 0.5s'; f.style.opacity = 0; setTimeout(() => f.style.background = '#000', 500); }, 60);
    if (shape.hp <= 0) { this.caption('You go down.', 3); this.knockdown(7); shape.hp = 6; }
  }
  knockdown(secs) {
    const shape = this.shape; shape.down = secs;
    const f = document.getElementById('fade'); f.classList.add('on');
    this.sound.ok && this.sound.bodyFall(shape.pos.clone().add(_v.set(0, 0.2, 0)));
    if (shape.grabbing) shape.release();
    const tick = () => { shape.down -= 0.25; if (shape.down > 0) setTimeout(tick, 250); else { f.classList.remove('on'); this.caption('...and you sit up.', 3); this.sound.ok && this.sound.sting(true); } };
    setTimeout(tick, 250);
  }
  dispatch(house) {
    if (this.cruiser.coming) return;
    this.cruiser.coming = true;
    const h = this.town.houses[house], stop = new V(h.x + (h.side === 'n' ? 3 : -3), 0, h.side === 'n' ? -2 : 2);
    setTimeout(() => {
      const C = this.cruiser; C.away = false; C.drive = { to: stop, speed: 11, then: () => this.brackettOut(C, house) }; C.x = -80; C.z = stop.z; C.yaw = Math.PI / 2;
      if (this.sound.ok) { C.siren = this.sound.siren(() => new V(C.x, 1.4, C.z)); C.engine = this.sound.engine(() => new V(C.x, 0.6, C.z), () => C.rev || 0); }
      this.caption('A siren, getting closer.', 3);
    }, 25000);
  }
  brackettOut(C, house) {
    const b = this.N.brackett; b.hunter = true; b.state = 'search';
    b.setPos(this.carPoint(C, -1.4, 0, 0.6), C.yaw - Math.PI / 2);
    const h = this.town.houses[house]; b.path = this.route(b.pos, h.nodes.hallF); b.want = 2.2; b.lastSeen = new V(h.nodes.hallF.x, 0, h.nodes.hallF.z);
    this.say(b, "Sheriff's department!", 3);
    C.siren?.stop(); C.siren = null;
  }
  hunterLights() {
    const hs = this.people.filter((p) => p.hunter && p.body.root.visible && !p.dead && p.flashOn);
    this.lights.forEach((s, i) => {
      const n = hs[i]; if (!n) { s.intensity = 0; return; }
      const hand = n.body.B[n.body.pose.aim ? 'rHa' : 'lHa'].getWorldPosition(new V());
      const dir = n.body.pose.look ? n.body.pose.look.clone().sub(hand).normalize() : new V(Math.sin(n.yaw), -0.25, Math.cos(n.yaw));
      s.position.copy(hand); s.target.position.copy(hand).addScaledVector(dir, 6); s.intensity = 40;
      n.light = true;
    });
  }

  // --------------------------------------------------------- the beats
  beats(dt) {
    const N = this.N, t = this.t;
    if (!this.b1 && t > 150) { this.b1 = true;   // Lynda and Bob walk up from the corner
      for (const [k, dz] of [['lynda', 0], ['bob', 0.9]]) { const n = N[k]; n.setPos(new V(-70, 0, -5.4 - dz), Math.PI / 2); n.state = 'arrive'; n.path = this.route(n.pos, this.town.houses.wallace.nodes.hallF); n.want = 1.3; }
      this.say(N.lynda, 'Totally.', 2);
    }
    for (const k of ['lynda', 'bob']) { const n = N[k]; if (n.state === 'arrive' && !n.path.length) { this.routine(n, k); } }
    if (!this.b2 && t > 420 && N.bob.state === 'routine' && !N.bob.dead) { this.b2 = true; N.bob.plan = [['fridge', 'wallace', 30], ['kitchenTable', 'wallace', 20], ['bed3', 'wallace', 9999]]; N.bob.step = -1; this.nextActivity(N.bob); this.say(N.bob, "I'm gonna get a beer.", 2.5); }
    // Annie goes out to her car at 4 minutes; she's back after a while if she drives off
    if (!this.b3 && t > 240 && N.annie.state === 'routine' && !N.annie.dead) { this.b3 = true; this.say(N.annie, "I've got to go pick up Paul.", 3); N.annie.state = 'toCar'; N.annie.path = this.route(N.annie.pos, this.carPoint(this.annieCar, -1.5, 0, 1.0)); N.annie.want = 1.4; }
    if (N.annie.state === 'toCar' && !N.annie.path.length) this.annieGetsIn();
    // Laurie calls over; if nobody answers twice, she walks across
    if (!this.b4 && t > 330 && !N.laurie.dead && N.laurie.state === 'routine') { this.b4 = true; this.ring('wallace'); }
    if (this.b4 && !this.b5 && t > 460 && !N.laurie.dead && N.laurie.state === 'routine') {
      this.b5 = true;
      const anyone = ['annie', 'lynda', 'bob'].some((k) => !N[k].dead && N[k].body.root.visible && !N[k].escaped && N[k].state !== 'flee');
      if (!anyone) { this.say(N.laurie, "Nobody's answering. That's weird.", 3); N.laurie.state = 'investigate'; N.laurie.inv = new V(this.town.houses.wallace.nodes.hallF.x, 0.3, this.town.houses.wallace.nodes.hallF.z); N.laurie.path = this.route(N.laurie.pos, this.town.houses.wallace.nodes.hallF); N.laurie.want = 1.3; N.laurie.timer = 60; }
    }
    // end when all five are dead or gone
    const vics = ['annie', 'lynda', 'bob', 'laurie', 'elrod'];
    if (vics.every((k) => N[k].dead || N[k].escaped) && !this.over && this.b1) setTimeout(() => this.end('done'), 4000), this.over = 'pending';
  }
  ring(house) {
    if (!this.sound.ok) return;
    const ph = this.town.phones.find((p) => p.house === house); if (!ph) return;
    const r = this.sound.phoneRing(ph.pos); this.hear(ph.pos, 16, 'phone');
    setTimeout(() => r.stop(), 18000);
  }
  annieGetsIn() {
    const a = this.N.annie, car = this.annieCar;
    a.state = 'seated'; a.want = 0; a.body.pose.sit = 1;
    a.setPos(this.carPoint(car, -0.45, 0.2, 0.35), car.yaw); a.inCar = car;
    this.sound.ok && this.sound.doorSlam(this.carPoint(car, -1, 1, 0.3), 0.7);
    if (this.inCar === car) { this.caption("She hasn't seen you. Grab her.", 4); a.trapped = true; return; }
    setTimeout(() => {
      if (a.dead || a.state !== 'seated') return;
      car.drive = { path: [this.carPoint(car, 0, 0, -9), new V(car.x, 0, 2), new V(90, 0, 2)], speed: 6, then: () => { a.body.root.visible = false; car.away = true; setTimeout(() => this.annieReturns(), 120000); } };
      if (this.sound.ok) car.engine = this.sound.engine(() => new V(car.x, 0.6, car.z), () => car.rev || 0);
      this.caption("Annie's car pulls out and drives off.", 3);
    }, 6000);
  }
  annieReturns() {
    const a = this.N.annie, car = this.annieCar; if (a.dead) return;
    car.x = 90; car.z = 2; car.away = false; car.g.visible = true;
    car.drive = { path: [new V(car.home.x, 0, 2), new V(car.home.x, 0, car.home.z)], speed: 6, then: () => { car.yaw = car.home.yaw; this.carCollide(car, true); a.inCar = null; a.setPos(this.carPoint(car, -1.5, 0, 0.6), car.yaw + Math.PI); a.state = 'routine'; a.plan = [['couch', 'wallace', 9999]]; a.step = -1; this.nextActivity(a); car.engine?.stop(); } };
    if (this.sound.ok) car.engine = this.sound.engine(() => new V(car.x, 0.6, car.z), () => car.rev || 0);
  }
  updateCars(dt) {
    for (const car of [...this.cars, this.cruiser]) {
      const d = car.drive; if (!d) { if (car.police && !car.away) car.g.userData.bar.forEach((b, i) => b.material.color.setHex(Math.sin(this.t * 9 + i * Math.PI) > 0 ? (i ? 0x2040ff : 0xff2020) : 0x101010)); continue; }
      if (car.segs.length) this.carCollide(car, false);
      const tgt = d.to || d.path[0], dx = tgt.x - car.x, dz = tgt.z - car.z, dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz); car.yaw = lerpAngle(car.yaw, want, Math.min(1, dt * 2.5));
      const sp = Math.min(d.speed, dist * 1.5 + 1); car.rev = sp / 12;
      car.x += Math.sin(car.yaw) * sp * dt; car.z += Math.cos(car.yaw) * sp * dt;
      for (const w of car.g.userData.wheels) w.rotation.x += sp * dt / 0.34;
      if (dist < 0.6) { if (d.path && d.path.length > 1) d.path.shift(); else { car.drive = null; car.engine && !car.police && car.engine.stop(); car.engine = null; car.rev = 0; this.carCollide(car, true); d.then?.(); } }
      if (this.N.annie.inCar === car && !this.N.annie.dead) this.N.annie.setPos(this.carPoint(car, -0.45, 0.2, 0.35), car.yaw);
      if (this.inCar === car) this.seatMichael(car);
      if (car.police) car.g.userData.bar.forEach((b, i) => b.material.color.setHex(Math.sin(this.t * 9 + i * Math.PI) > 0 ? (i ? 0x2040ff : 0xff2020) : 0x101010));
    }
    for (const car of [...this.cars, this.cruiser]) { car.g.position.set(car.x, 0, car.z); car.g.rotation.y = car.yaw; }
  }
  seatMichael(car) {
    const p = this.carPoint(car, 0.35, 0, -1.0), D = this.shape.dolly, cam = this.shape.camera;
    const before = cam.getWorldPosition(new V()); D.position.x += p.x - before.x; D.position.z += p.z - before.z; this.shape.floorY = -0.55;
  }

  // ---------------------------------------------------------- interaction
  interact(input, vr) {
    const shape = this.shape, hp = shape.headPos(new V()), fwd = shape.camera.getWorldDirection(new V());
    let prompt = '', act = null;
    if (this.inCar) {
      prompt = 'E — get out'; act = () => this.leaveCar();
      const a = this.N.annie; if (a.inCar === this.inCar && !a.dead) { prompt = 'Click / grip — take her'; if (input.stab || input.grab || input.gripL) this.carKill(); }
    } else {
      // doors in reach
      let best = null, bd = 1.7;
      for (const d of this.W.doors) {
        const mid = new V((d.hx + d.tip()[0]) / 2, d.y0 + 1.1, (d.hz + d.tip()[1]) / 2), to = mid.clone().sub(hp), dist = to.length();
        if (dist < bd && to.normalize().dot(fwd) > 0.35) { bd = dist; best = d; }
      }
      if (best) {
        if (best.broken) {} else if (best.locked) { prompt = 'E — break it down'; act = () => this.bash(best); }
        else { prompt = best.angle > 0.4 ? 'E — close' : 'E — open'; act = () => { best.target = best.angle > 0.4 ? 0 : best.max; if (this.sound.ok) this.sound.creak(new V(best.hx, best.y0 + 1.2, best.hz), 0.3, 0.7); }; }
      }
      // the back seat of Annie's car
      const car = this.annieCar;
      if (!car.away && !car.drive && !this.N.annie.inCar) { const rd = this.carPoint(car, 1.2, 1, -0.9); if (rd.distanceTo(hp) < 2.2) { prompt = 'E — get in the back seat'; act = () => this.enterCar(car); } }
      // VR punches on locked doors
      if (vr) for (const h of [shape.hand.l, shape.hand.r]) if (h.vel.length() > 3.2) for (const d of this.W.doors) {
        if (!d.locked || d.broken) continue; const [tx, tz] = d.tip(); const mx = (d.hx + tx) / 2, mz = (d.hz + tz) / 2;
        if (Math.hypot(h.pos.x - mx, h.pos.z - mz) < 0.5 && h.pos.y > d.y0 + 0.5 && h.pos.y < d.y1 && (d.lastHit || 0) < this.t - 0.35) { d.lastHit = this.t; this.bash(d); }
      }
    }
    const el = document.getElementById('prompt'); if (el) { el.textContent = vr ? prompt.replace('E —', 'A —') : prompt; el.hidden = !prompt; }
    if (input.use && act) act();
  }
  bash(d) {
    d.hp--; const p = new V(d.hx, d.y0 + 1.2, d.hz);
    this.sound.ok && (d.hp > 0 ? this.sound.thump(p, 1, 60) : this.sound.splinter(p));
    this.hear(p, 26, 'bash');
    for (const n of this.people) if (!n.dead && n.state === 'hide' && n.pos.distanceTo(p) < 6) { n.fear = 1; if (R() < 0.6) this.scream(n); }
    if (d.hp <= 0) { d.broken = true; d.locked = false; d.leaf.rotation.x = -Math.PI / 2 * 0.98; d.leaf.position.set(0, 0.05, -0.0); d.pivot.rotation.y += 0.4; this.caption('The door gives way.', 2); }
  }
  enterCar(car) {
    this.inCar = car; this.shape.body.root.visible = false; this.shape.knife.visible = true;
    this.sound.ok && this.sound.creak(this.carPoint(car, 1, 1, -0.9), 0.3, 0.5);
    this.seatMichael(car); this.caption('You wait in the back seat.', 3);
  }
  leaveCar() {
    const car = this.inCar; this.inCar = null; this.shape.body.root.visible = true;
    const p = this.carPoint(car, 1.9, 0, -0.9), D = this.shape.dolly, before = this.shape.camera.getWorldPosition(new V());
    D.position.x += p.x - before.x; D.position.z += p.z - before.z; this.shape.floorY = 0;
  }
  carKill() {
    const a = this.N.annie; if (a.dead || a.dying) return;
    this.scream(a); a.body.face.fear = 1;
    const neck = a.body.B.neck.getWorldPosition(new V());
    this.sound.ok && this.sound.choke(neck, true, 2.5);
    a.body.face.flush = 0.6; a.body.face.gasp = 1;
    setTimeout(() => {
      this.sound.ok && this.sound.stab(neck); this.crimson.spray(neck, new V(0, 0.3, 1), 40, 3);
      a.body.wound(neck.clone().add(_v.set(0, -0.04, 0.05)), new V(0, 0, 1).applyAxisAngle(new V(0, 1, 0), a.yaw), 'neck', true);
      this.kill(a, 'car');
      a.body.goLimp(this.phys); a.body.alive = false; a.dying = 2; a.state = 'dead';
      this.shape.blood = Math.min(1, this.shape.blood + 0.3);
    }, 1800);
  }

  // ---------------------------------------------------------- violence
  handleEvents() {
    const shape = this.shape, ev = shape.events, S = this.sound;
    while (ev.length) {
      const e = ev.shift();
      switch (e.type) {
        case 'step': { const z = this.W.zoneAt(e.pos.x, e.pos.y + 0.3, e.pos.z); const surf = z ? 'wood' : Math.abs(e.pos.z) < 4.1 ? 'asphalt' : Math.abs(Math.abs(e.pos.z) - 6.85) < 0.8 ? 'asphalt' : 'grass'; S.ok && S.step(e.pos, surf, 0.28); this.hear(e.pos, z ? 4.5 : 3, 'step'); break; }
        case 'hit': this.hit(e); break;
        case 'pullout': { S.ok && S.squelch(e.pos, 0.7); this.crimson.spray(e.pos, e.dir, 18, 2.2); break; }
        case 'thunk': { S.ok && S.thump(e.pos, 0.7, 120); this.caption('The blade goes through into the wall.', 2.5); break; }
        case 'grab': { const n = e.who; n.state = 'held'; S.ok && S.gasp(n.head(new V()), FEMALE(n.key)); this.hear(n.pos, 6, 'struggle'); n.chokeT = 0; if (n.inCar) n.inCar = null; break; }
        case 'drop': { const n = e.who; if (!n.dead) { n.state = 'down'; n.timer = 1.6; } break; }
        case 'choked': { const n = e.who; this.kill(n, 'choke'); shape.release(); break; }
        case 'snap': { const n = e.who; S.ok && S.snap(e.pos); this.kill(n, 'snap'); n.body.face.flush = 0.3; break; }
        case 'leftKnife': this.caption('You leave the knife where it is.', 2); break;
        case 'retook': break;
      }
    }
    // the strangled make noise
    if (shape.grabbing && shape.grabbing.body.alive) { const n = shape.grabbing; n.chokeT = (n.chokeT || 0) - 1 / 72; if (n.chokeT <= 0 && S.ok) { n.chokeT = 1.1; S.choke(n.head(new V()), FEMALE(n.key), 1.0); } }
  }
  hit(e) {
    const n = e.who, P = n.body, S = this.sound;
    if (n.dead && !P.limp) return;
    const part = e.part, stab = e.kind === 'stab';
    let dmg = { head: 85, torso: 55, pelvis: 40 }[part] ?? 22; if (!stab) dmg *= 0.35;
    const fwd = new V(Math.sin(n.yaw), 0, Math.cos(n.yaw)); if (e.dir.clone().normalize().dot(fwd) > 0.4) dmg *= 1.3;
    P.wound(e.pos, e.normal, e.bone, stab);
    S.ok && (stab ? S.stab(e.pos) : S.slash(e.pos, e.speed));
    this.crimson.spray(e.pos, e.normal.clone().add(e.dir.clone().normalize().multiplyScalar(0.3)), stab ? 26 : 12, stab ? 2.4 : 1.8);
    const bone = P.B[e.bone], local = bone.worldToLocal(e.pos.clone()), nrm = e.normal.clone();
    this.crimson.source(() => bone.localToWorld(local.clone()), () => nrm.clone().transformDirection(bone.matrixWorld).normalize(), part === 'head' || (part === 'torso' && R() < 0.4) ? 'artery' : 'vein', 25);
    this.hear(e.pos, 7, 'stab');
    if (n.dead) { P.wake(); return; }
    n.hp -= dmg;
    if (n.hp <= 0) {
      if (!P.limp) P.goLimp(this.phys, e.dir.clone().multiplyScalar(0.12).add(new V(0, 0.4, 0)));
      this.kill(n, 'knife', stab);
      if (stab && !this.shape.stuck) this.shape.stickInto(n, part, e.pos);
      return;
    }
    // hurt, not dead: scream, stagger, run
    this.scream(n); n.fear = 1; n.bleeding = true;
    if (n.hunter) { n.aware = 1; n.state = 'shoot'; n.shotT = 0.3; return; }
    if (P.limp) { n.state = 'down'; n.timer = 1.5; return; }
    this.panic(n, this.shape.pos, 'hurt', true);
  }
  kill(n, how, stuck = false) {
    if (n.dead) return;
    n.dead = true; n.alive = false; n.body.alive = false; n.dying = how === 'snap' ? 0.3 : 3; n.state = 'dead'; n.want = 0; n.path = [];
    n.body.face.scream = 0; n.body.face.gasp = 0; n.body.face.strain = 0;
    this.kills++; this.tally[n.key] = 'dead';
    this.sound.ok && this.sound.sting(true);
    if (this.sound.ok) setTimeout(() => this.sound.bodyFall(n.body.B.hips.getWorldPosition(new V())), 600);
    setTimeout(() => { const p = n.body.B.spine.getWorldPosition(new V()); this.crimson.pool(p, how === 'choke' || how === 'snap' ? 0.25 : 0.75, 0.03); }, 2500);
    if (n.key === 'lynda' && n.state !== 'routine' && this.N.laurie && !this.N.laurie.dead && n.onPhone) { /* Laurie heard it over the line */ }
  }
  say(n, text, secs = 2.5) {
    if (!n || n.dead || n.say > 0.5) return;
    n.say = secs; const d = n.pos.distanceTo(this.shape.pos), heard = d < 16;
    if (this.sound.ok) this.sound.talk(n.head(new V()), FEMALE(n.key), Math.min(secs * 0.7, 0.4 + text.length * 0.06));
    n.body.face.talk = 1; setTimeout(() => { n.body.face.talk = 0; }, Math.min(secs * 700, 400 + text.length * 60));
    if (heard) this.caption(`${n.name}: ${text}`, secs);
  }
  // --------------------------------------------------------- objective
  // who to go after next and where to walk: { text, point }
  objective() {
    const o = this.objective_(); if (!o) return o;
    // steer by the walking route (doors, stairs) rather than straight through walls
    const mp = this.shape.pos, path = this.route(mp, o.who && o.inside ? o.who.pos : o.point);
    let next = o.point, len = 0, prev = mp;
    for (const n of path) { len += Math.hypot(n.x - prev.x, n.z - prev.z); prev = n; }
    for (const n of path) { if (Math.hypot(n.x - mp.x, n.z - mp.z) > 1.4 || Math.abs(n.y - mp.y) > 1) { next = new V(n.x, n.y, n.z); break; } }
    o.next = next; o.dist = path.length ? len + Math.hypot(o.point.x - prev.x, o.point.z - prev.z) : mp.distanceTo(o.point);
    o.down = next.y < mp.y - 1; o.up = next.y > mp.y + 1;
    return o;
  }
  objective_() {
    const mp = this.shape.pos, N = this.N, H = this.town.houses, W = this.W;
    const here = W.zoneAt(mp.x, mp.y + 0.5, mp.z);
    const doorOf = (h) => { const a = h.nodes.back, b = h.nodes.porch, da = Math.hypot(a.x - mp.x, a.z - mp.z), db = Math.hypot(b.x - mp.x, b.z - mp.z); return new V((da < db ? a : b).x, 0, (da < db ? a : b).z); };
    if (here?.house === 'myers' && this.kills === 0 && !this.leftHome) return { text: 'Leave the house by the back door. Loomis is watching the front.', point: new V(H.myers.nodes.back.x, 0, H.myers.nodes.back.z) };
    if (here?.house !== 'myers') this.leftHome = true;
    const ROOM = { living: 'living room', hall: 'front hall', kitchen: 'kitchen', dining: 'dining room', bed1: 'bedroom upstairs', bed2: 'bedroom upstairs', bed3: 'main bedroom upstairs', hallU: 'upstairs hall', bath: 'bathroom upstairs', closet: 'closet upstairs', stairs: 'stairs' };
    const vics = ['annie', 'lynda', 'bob', 'laurie', 'elrod'].map((k) => N[k]).filter((n) => n.body.root.visible && !n.dead && !n.escaped);
    if (!vics.length) {
      if (!this.b1) return { text: 'Lynda and Bob are on their way to the Wallace house. Wait for them.', point: new V(H.wallace.nodes.porch.x, 0, H.wallace.nodes.porch.z) };
      if (this.N.annie.inCar && this.annieCar.away) return { text: 'Annie drove off. She will be back.', point: new V(this.annieCar.home.x, 0, this.annieCar.home.z) };
      return null;
    }
    const n = vics.map((v) => ({ v, d: v.pos.distanceTo(mp) - (W.zoneAt(v.pos.x, v.floorY + 0.5, v.pos.z)?.house === here?.house && here ? 20 : 0) })).sort((a, b) => a.d - b.d)[0].v;
    const z = W.zoneAt(n.pos.x, n.floorY + 0.5, n.pos.z), house = z ? H[z.house] : null;
    const where = n.inCar ? 'in her car, the Wallace driveway' : z ? `${house.label || 'a house'}, ${ROOM[z.room] || z.room}` : 'outside';
    const point = z && here?.house !== z.house ? doorOf(house) : n.pos.clone().setY(n.floorY);
    return { text: `${n.name} · ${where}`, point, who: n, inside: !!z && here?.house === z.house };
  }

  // --------------------------------------------------------- movement
  steer(n, dt) {
    const W = this.W;
    let v = 0;
    if (n.path.length && n.want > 0) {
      const tgt = n.path[0], dx = tgt.x - n.pos.x, dz = tgt.z - n.pos.z, dist = Math.hypot(dx, dz);
      // doors on the way: open them (unlock from inside if it's your house)
      if (tgt.door && !tgt.door.isOpen() && dist < 1.6) {
        const d = tgt.door; if (d.locked) { const zone = W.zoneAt(n.pos.x, n.floorY + 0.5, n.pos.z); if (zone && zone.house === d.house) { d.locked = false; } }
        if (!d.locked) { d.target = d.max; if (!n.creaked) { n.creaked = true; this.sound.ok && this.sound.creak(new V(d.hx, d.y0 + 1.2, d.hz), 0.25, 0.6); } } else if (n.state === 'flee') { n.path = []; this.chooseRefuge(n); return; }
        if (d.angle < 0.9) { n.speed = 0; return; }
      }
      if (dist < (n.want > 2 ? 0.7 : 0.45) || (Math.abs(tgt.y - n.floorY) > 0.1 && dist < 0.8 && false)) { n.path.shift(); n.creaked = false; }
      else { const want = Math.atan2(dx, dz); n.yaw = lerpAngle(n.yaw, want, Math.min(1, dt * (n.want > 2 ? 9 : 5))); v = n.want; }
    }
    n.speed += (v - n.speed) * Math.min(1, dt * 5);
    if (n.speed > 0.02) {
      const p = n.pos.clone(); p.x += Math.sin(n.yaw) * n.speed * dt; p.z += Math.cos(n.yaw) * n.speed * dt;
      W.collide(p, 0.24, n.floorY, 1.7, null);
      const moved = p.distanceTo(n.pos) / Math.max(dt, 1e-4);
      if (moved < 0.15 && v > 0) { n.stuck = (n.stuck || 0) + dt; if (n.stuck > 2) { n.stuck = 0; n.path.shift(); } } else n.stuck = 0;
      n.pos.x = p.x; n.pos.z = p.z;
    }
    const fy = W.floorAt(n.pos.x, n.pos.z, n.floorY + 0.05, 0.6); n.floorY += (fy - n.floorY) * Math.min(1, dt * 10); n.pos.y = n.floorY;
    n.body.pose.speed = n.speed;
    if (n.bleeding && n.speed > 0.5 && R() < dt * 4) this.crimson.spray(n.pos.clone().add(_v.set(0, 1, 0)), new V(0, -1, 0), 1, 0.3);
  }
  end(why) {
    if (this.over === true) return; this.over = true;
    const N = this.N, lines = ['annie', 'lynda', 'bob', 'laurie', 'elrod'].map((k) => `${N[k].name}: ${N[k].dead ? 'dead' : N[k].escaped ? 'got away' : 'survived'}`);
    const all = ['annie', 'lynda', 'bob', 'laurie', 'elrod'].every((k) => N[k].dead);
    this.caption(all ? 'Happy Halloween, Michael.' : why === 'dawn' ? 'The sun comes up over Haddonfield.' : 'The night is over.', 8);
    const f = document.getElementById('screen'); setTimeout(() => {
      f.hidden = false; f.querySelector('.lede').innerHTML = lines.join('<br>') + '<br><br>' + (all ? 'Nobody survived the night.' : 'Some of them will remember tonight forever.');
      f.querySelector('.actions').innerHTML = '<button onclick="location.reload()">Again</button>';
      document.exitPointerLock?.(); this.shape.camera.parent && renderer_end();
    }, 6000);
  }
}
function renderer_end() { const s = window.H?.renderer?.xr?.getSession?.(); s?.end?.(); }
const pick = (a) => a[(R() * a.length) | 0];
function lerpAngle(a, b, t) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; }
