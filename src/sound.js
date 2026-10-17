// HALLOWEENVR sound. Nothing is a recording: every voice, step, blade, bell
// and gunshot is synthesized, placed with HRTF panners, muffled through walls,
// and sent into a room or street reverb. The score is an original 5/4 piano
// ostinato over a low drone, with stingers.
import * as THREE from '../vendor/three.module.js';

const V = THREE.Vector3;
const R = Math.random;
const VOWELS = { a: [850, 1220, 2810], e: [530, 1840, 2480], i: [300, 2300, 3000], o: [570, 840, 2410], u: [370, 950, 2400], ae: [700, 1700, 2600] };

export class Sound {
  constructor(world) { this.W = world; this.ok = false; this.listener = new V(); this.listenerZone = null; this.loops = []; }
  start() {
    if (this.ok) return;
    const C = this.C = new (window.AudioContext || window.webkitAudioContext)();
    this.master = C.createGain(); this.master.gain.value = 0.9;
    const comp = C.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
    this.master.connect(comp).connect(C.destination);
    // noise buffers
    const n = C.sampleRate * 2, wb = C.createBuffer(1, n, C.sampleRate), bb = C.createBuffer(1, n, C.sampleRate);
    const w = wb.getChannelData(0), b = bb.getChannelData(0); let last = 0;
    for (let i = 0; i < n; i++) { w[i] = R() * 2 - 1; last = (last + 0.02 * w[i]) / 1.02; b[i] = last * 3.5; }
    this.white = wb; this.brown = bb;
    // reverbs: a tight room and a long, low street
    this.room = this.reverb(0.7, 2.6); this.street = this.reverb(2.4, 3.4);
    this.room.connect(this.master); this.street.connect(this.master);
    this.roomSend = C.createGain(); this.roomSend.connect(this.room); this.streetSend = C.createGain(); this.streetSend.connect(this.street);
    this.music = C.createGain(); this.music.gain.value = 0; this.music.connect(this.master); this.music.connect(this.streetSend);
    this.ambience(); this.breath(); this.score();
    this.ok = true;
  }
  reverb(secs, decay) {
    const C = this.C, len = Math.floor(C.sampleRate * secs), buf = C.createBuffer(2, len, C.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (R() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 200 ? i / 200 : 1); }
    const cv = C.createConvolver(); cv.buffer = buf; return cv;
  }
  noise(brown = false) { const s = this.C.createBufferSource(); s.buffer = brown ? this.brown : this.white; s.loop = true; s.loopStart = R(); return s; }

  // a spatial output chain for one sound at pos; returns the input node
  at(pos, gain = 1, opts = {}) {
    const C = this.C, g = C.createGain(); g.gain.value = gain;
    let out = g;
    if (pos) {
      const p = C.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = opts.ref || 1.2; p.rolloffFactor = opts.roll || 1.3; p.maxDistance = 200;
      p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
      // through walls: muffle and quieten
      const occl = this.occluded(pos);
      if (occl) { const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 650; g.connect(f); out = f; g.gain.value *= 0.55; }
      out.connect(p); out = p;
    }
    out.connect(this.master);
    const sz = this.W.zoneAt(pos?.x ?? this.listener.x, (pos?.y ?? this.listener.y) - 0.5, pos?.z ?? this.listener.z);
    const send = C.createGain(); send.gain.value = (opts.wet ?? 1) * (sz ? 0.35 : 0.22); out.connect(send); send.connect(sz ? this.roomSend : this.streetSend);
    return g;
  }
  occluded(pos) {
    const L = this.listener;
    return this.W.blocked(L.x, L.y, L.z, pos.x, pos.y, pos.z, false);
  }
  env(param, t0, pts) { param.setValueAtTime(pts[0][1], t0 + pts[0][0]); for (let i = 1; i < pts.length; i++) param.linearRampToValueAtTime(pts[i][1], t0 + pts[i][0]); }

  update(dt, camera, t) {
    if (!this.ok) return;
    const C = this.C, L = C.listener, p = camera.getWorldPosition(new V()), f = camera.getWorldDirection(new V()), u = new V(0, 1, 0).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
    this.listener.copy(p);
    if (L.positionX) { L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z; L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = u.x; L.upY.value = u.y; L.upZ.value = u.z; }
    else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z); }
    const zone = this.W.zoneAt(p.x, p.y - 1.5, p.z);
    this.windGain.gain.setTargetAtTime(zone ? 0.05 : 0.22, C.currentTime, 0.8);
    for (const l of this.loops) l.update?.(dt, t);
    this.scoreTick(t);
  }

  // ------------------------------------------------------------ ambience
  ambience() {
    const C = this.C;
    const wn = this.noise(true), lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
    this.windGain = C.createGain(); this.windGain.gain.value = 0.2;
    const lfo = C.createOscillator(), lg = C.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 260; lfo.connect(lg).connect(lp.frequency); lfo.start();
    const wn2 = this.noise(false), leafG = C.createGain(); leafG.gain.value = 0.015; const hp = C.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
    const lfo2 = C.createOscillator(), lg2 = C.createGain(); lfo2.frequency.value = 0.11; lg2.gain.value = 0.015; lfo2.connect(lg2).connect(leafG.gain); lfo2.start();
    wn.connect(lp).connect(this.windGain); wn2.connect(hp).connect(leafG).connect(this.windGain);
    this.windGain.connect(this.master); wn.start(); wn2.start();
    // distant dogs, a far train horn, now and then
    const later = () => setTimeout(() => { if (R() < 0.7) this.dog(new V((R() - 0.5) * 300, 1, (R() > 0.5 ? 1 : -1) * (80 + R() * 80))); else this.horn(); later(); }, 14000 + R() * 26000);
    later();
  }
  dog(pos) {
    const C = this.C, n = 1 + (R() * 4 | 0);
    for (let i = 0; i < n; i++) {
      const t0 = C.currentTime + i * (0.32 + R() * 0.2), o = C.createOscillator(), g = this.at(pos, 0.5, { ref: 20 });
      o.type = 'sawtooth'; this.env(o.frequency, t0, [[0, 420], [0.04, 620], [0.16, 300]]);
      const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2;
      const e = C.createGain(); this.env(e.gain, t0, [[0, 0], [0.02, 0.8], [0.18, 0]]);
      o.connect(f).connect(e).connect(g); o.start(t0); o.stop(t0 + 0.2);
    }
  }
  horn() {
    const C = this.C, t0 = C.currentTime, g = this.at(new V(-300, 5, 200), 0.6, { ref: 60 });
    for (const fq of [311, 370, 466]) { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fq; const e = C.createGain(); this.env(e.gain, t0, [[0, 0], [0.3, 0.05], [2.6, 0.05], [3.4, 0]]); const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; o.connect(f).connect(e).connect(g); o.start(t0); o.stop(t0 + 3.5); }
  }
  // Michael breathing inside the rubber mask: slow, close, muffled
  breath() {
    const C = this.C, nz = this.noise(false), bp = C.createBiquadFilter(), lp = C.createBiquadFilter(), g = C.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 1.6; lp.type = 'lowpass'; lp.frequency.value = 1400; g.gain.value = 0;
    nz.connect(bp).connect(lp).connect(g).connect(this.master); nz.start();
    this.breathG = g; this.breathF = bp; this.exert = 0;
    let phase = 0;
    this.loops.push({ update: (dt) => {
      const rate = 0.21 + this.exert * 0.16; phase = (phase + dt * rate) % 1;
      const inhale = phase < 0.42 ? Math.sin(phase / 0.42 * Math.PI) : 0, exhale = phase > 0.48 && phase < 0.95 ? Math.sin((phase - 0.48) / 0.47 * Math.PI) : 0;
      const v = (inhale * 0.06 + exhale * 0.085) * (0.8 + this.exert * 0.8) * (this.breathOn ?? 1);
      g.gain.setTargetAtTime(v, C.currentTime, 0.05); bp.frequency.setTargetAtTime(inhale > 0 ? 700 : 430, C.currentTime, 0.1);
      this.exert = Math.max(0, this.exert - dt * 0.05);
    } });
  }

  // ---------------------------------------------------------------- foley
  step(pos, surface, gain = 0.35) {
    const C = this.C, t0 = C.currentTime, g = this.at(pos, gain, { ref: 1 });
    const n = this.noise(), f = C.createBiquadFilter(), e = C.createGain();
    if (surface === 'wood') { f.type = 'lowpass'; f.frequency.value = 500; this.env(e.gain, t0, [[0, 0], [0.005, 1], [0.09, 0]]);
      const o = C.createOscillator(); o.frequency.value = 85 + R() * 20; const oe = C.createGain(); this.env(oe.gain, t0, [[0, 0.6], [0.08, 0]]); o.connect(oe).connect(g); o.start(t0); o.stop(t0 + 0.1);
      if (R() < 0.18) this.creak(pos, 0.25, 0.4); }
    else if (surface === 'grass') { f.type = 'bandpass'; f.frequency.value = 2500 + R() * 1500; f.Q.value = 0.7; this.env(e.gain, t0, [[0, 0], [0.02, 0.7], [0.06, 0.3], [0.16, 0]]); }
    else { f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 1.2; this.env(e.gain, t0, [[0, 0], [0.004, 1], [0.05, 0]]); }
    n.connect(f).connect(e).connect(g); n.start(t0); n.stop(t0 + 0.2);
  }
  creak(pos, gain = 0.4, dur = 0.8) {
    const C = this.C, t0 = C.currentTime, g = this.at(pos, gain);
    const o = C.createOscillator(); o.type = 'sawtooth'; this.env(o.frequency, t0, [[0, 60 + R() * 30], [dur * 0.5, 110 + R() * 40], [dur, 70]]);
    const am = C.createOscillator(), amg = C.createGain(); am.frequency.value = 28 + R() * 20; amg.gain.value = 0.5; am.connect(amg);
    const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100 + R() * 700; f.Q.value = 9;
    const e = C.createGain(); this.env(e.gain, t0, [[0, 0], [0.08, 0.6], [dur - 0.1, 0.5], [dur, 0]]); amg.connect(e.gain);
    o.connect(f).connect(e).connect(g); o.start(t0); am.start(t0); o.stop(t0 + dur); am.stop(t0 + dur);
  }
  thump(pos, gain = 0.8, f0 = 70) {
    const C = this.C, t0 = C.currentTime, g = this.at(pos, gain);
    const o = C.createOscillator(); this.env(o.frequency, t0, [[0, f0 * 1.6], [0.12, f0 * 0.6]]); const e = C.createGain(); this.env(e.gain, t0, [[0, 0], [0.004, 1], [0.25, 0]]);
    const n = this.noise(), f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; const ne = C.createGain(); this.env(ne.gain, t0, [[0, 0.6], [0.08, 0]]);
    o.connect(e).connect(g); n.connect(f).connect(ne).connect(g); o.start(t0); o.stop(t0 + 0.3); n.start(t0); n.stop(t0 + 0.1);
  }
  stab(pos, deep = true) {
    const C = this.C, t0 = C.currentTime, g = this.at(pos, 0.9, { wet: 0.5 });
    this.thump(pos, deep ? 0.6 : 0.3, 55);
    // wet tearing: a narrow band of noise sweeping down, with gristle clicks
    const n = this.noise(), f = C.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3; this.env(f.frequency, t0, [[0, 1800], [0.25, 380]]);
    const e = C.createGain(); this.env(e.gain, t0, [[0, 0], [0.01, 1], [0.12, 0.5], [0.32, 0]]);
    n.connect(f).connect(e).connect(g); n.start(t0); n.stop(t0 + 0.35);
    for (let i = 0; i < 4; i++) { const c = this.noise(), ce = C.createGain(), tt = t0 + 0.01 + R() * 0.12; this.env(ce.gain, tt, [[0, 0], [0.002, 0.5], [0.012, 0]]); const hf = C.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 2500; c.connect(hf).connect(ce).connect(g); c.start(tt); c.stop(tt + 0.02); }
    this.squelch(pos, 0.5, 0.15);
  }
  squelch(pos, gain = 0.5, delay = 0) {
    const C = this.C, t0 = C.currentTime + delay, g = this.at(pos, gain, { wet: 0.4 });
    const n = this.noise(true), f = C.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 6;
    this.env(f.frequency, t0, [[0, 300], [0.08, 900], [0.2, 250], [0.3, 600]]);
    const e = C.createGain(); this.env(e.gain, t0, [[0, 0], [0.02, 1.2], [0.15, 0.6], [0.35, 0]]);
    n.connect(f).connect(e).connect(g); n.start(t0); n.stop(t0 + 0.4);
  }
  slash(pos, speed) {
    const C = this.C, t0 = C.currentTime, g = this.at(pos, Math.min(0.5, speed * 0.06));
    const n = this.noise(), f = C.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.5; this.env(f.frequency, t0, [[0, 1200], [0.12, 3800], [0.25, 1600]]);
    const e = C.createGain(); this.env(e.gain, t0, [[0, 0], [0.06, 1], [0.25, 0]]); n.connect(f).connect(e).connect(g); n.start(t0); n.stop(t0 + 0.3);
  }
  snap(pos) {
    const C = this.C, t0 = C.currentTime, g = this.at(pos, 1.0);
    for (let i = 0; i < 3; i++) { const n = this.noise(), e = C.createGain(), tt = t0 + i * 0.018, f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400 + i * 500; f.Q.value = 2; this.env(e.gain, tt, [[0, 0], [0.001, 1], [0.03, 0]]); n.connect(f).connect(e).connect(g); n.start(tt); n.stop(tt + 0.04); }
    this.thump(pos, 0.4, 120);
  }
  doorSlam(pos, gain = 0.9) { this.thump(pos, gain, 55); const C = this.C, t0 = C.currentTime, g = this.at(pos, gain * 0.4), n = this.noise(), f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 3; const e = C.createGain(); this.env(e.gain, t0, [[0, 0], [0.003, 1], [0.05, 0]]); n.connect(f).connect(e).connect(g); n.start(t0); n.stop(t0 + 0.08); }
  lockClick(pos) { const C = this.C, t0 = C.currentTime, g = this.at(pos, 0.5); for (const d of [0, 0.06]) { const n = this.noise(), e = C.createGain(), f = C.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3000; this.env(e.gain, t0 + d, [[0, 0], [0.001, 1], [0.015, 0]]); n.connect(f).connect(e).connect(g); n.start(t0 + d); n.stop(t0 + d + 0.03); } }
  splinter(pos) {
    this.thump(pos, 1, 50);
    const C = this.C, t0 = C.currentTime, g = this.at(pos, 0.8);
    for (let i = 0; i < 9; i++) { const n = this.noise(), e = C.createGain(), tt = t0 + R() * 0.25, f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600 + R() * 2600; f.Q.value = 4; this.env(e.gain, tt, [[0, 0], [0.002, 0.8], [0.04 + R() * 0.05, 0]]); n.connect(f).connect(e).connect(g); n.start(tt); n.stop(tt + 0.12); }
  }
  gunshot(pos, shotgun = false) {
    const C = this.C, t0 = C.currentTime, g = this.at(pos, 1.6, { ref: 4, roll: 0.6, wet: 2.2 });
    const n = this.noise(), e = C.createGain(), f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = shotgun ? 3500 : 6000;
    this.env(e.gain, t0, [[0, 0], [0.001, 1.6], [0.02, 0.6], [shotgun ? 0.5 : 0.3, 0]]);
    n.connect(f).connect(e).connect(g); n.start(t0); n.stop(t0 + 0.6);
    const o = C.createOscillator(); this.env(o.frequency, t0, [[0, 160], [0.15, 38]]); const oe = C.createGain(); this.env(oe.gain, t0, [[0, 1.5], [0.25, 0]]); o.connect(oe).connect(g); o.start(t0); o.stop(t0 + 0.3);
    // the street throws it back off the houses
    const d = C.createDelay(1); d.delayTime.value = 0.32; const fb = C.createGain(); fb.gain.value = 0.32; const dl = C.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 1500;
    g.connect(d); d.connect(dl).connect(fb).connect(d); dl.connect(this.master); setTimeout(() => { fb.disconnect(); }, 3000);
  }
  click(pos) { this.lockClick(pos); }
  bodyFall(pos) { this.thump(pos, 0.9, 45); setTimeout(() => this.thump(pos, 0.4, 60), 140); }

  // --------------------------------------------------------------- voices
  // formant source: glottal saw through three vowel resonances
  voice(pos, { f0 = 220, dur = 1, vowel = 'a', gain = 0.5, contour = null, rasp = 0.1, vib = 0.02, male = false } = {}) {
    const C = this.C, t0 = C.currentTime, out = this.at(pos, gain, { ref: 1.5 });
    const o = C.createOscillator(); o.type = 'sawtooth';
    if (contour) this.env(o.frequency, t0, contour.map(([t, k]) => [t * dur, f0 * k])); else o.frequency.value = f0;
    const vb = C.createOscillator(), vg = C.createGain(); vb.frequency.value = 5.5 + R() * 1.5; vg.gain.value = f0 * vib; vb.connect(vg).connect(o.frequency);
    const src = C.createGain(); o.connect(src);
    const nz = this.noise(), ng = C.createGain(); ng.gain.value = rasp; nz.connect(ng).connect(src);
    const env = C.createGain();
    const fm = VOWELS[vowel] || VOWELS.a, sc = male ? 0.85 : 1.12;
    for (let i = 0; i < 3; i++) { const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fm[i] * sc; bp.Q.value = 6 + i * 3; const bg = C.createGain(); bg.gain.value = [1, 0.6, 0.3][i]; src.connect(bp).connect(bg).connect(env); }
    const sh = C.createWaveShaper(); const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.5); } sh.curve = curve;
    env.connect(sh).connect(out);
    return { o, vb, nz, env, t0, stop: (t) => { o.stop(t); vb.stop(t); nz.stop(t); } };
  }
  scream(pos, female = true, intensity = 1) {
    const dur = 1.2 + R() * 1.0, f0 = female ? 560 + R() * 220 : 330 + R() * 120;
    const v = this.voice(pos, { f0, dur, vowel: R() < 0.7 ? 'a' : 'ae', gain: 0.95 * intensity, contour: [[0, 0.8], [0.1, 1.05], [0.6, 1.0], [1, 0.72]], rasp: 0.35, vib: 0.035, male: !female });
    const { env, t0 } = v; this.env(env.gain, t0, [[0, 0], [0.06, 1], [dur * 0.75, 0.8], [dur, 0]]);
    v.o.start(t0); v.vb.start(t0); v.nz.start(t0); v.stop(t0 + dur + 0.05);
    return dur;
  }
  gasp(pos, female = true) {
    const v = this.voice(pos, { f0: female ? 280 : 160, dur: 0.5, vowel: 'a', gain: 0.25, rasp: 1.5, male: !female });
    const { env, t0 } = v; this.env(env.gain, t0, [[0, 0], [0.1, 1], [0.45, 0]]); v.o.start(t0); v.vb.start(t0); v.nz.start(t0); v.stop(t0 + 0.5);
  }
  choke(pos, female = true, dur = 1.2) {
    const C = this.C, t0 = C.currentTime, g = this.at(pos, 0.45);
    const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = female ? 190 : 110;
    const am = C.createOscillator(), amg = C.createGain(); am.frequency.value = 9 + R() * 6; amg.gain.value = 0.6; am.connect(amg);
    const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 4;
    const n = this.noise(), nf = C.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1100; nf.Q.value = 2; const ng = C.createGain(); ng.gain.value = 0.5;
    const e = C.createGain(); this.env(e.gain, t0, [[0, 0], [0.1, 0.7], [dur - 0.15, 0.5], [dur, 0]]); amg.connect(e.gain);
    o.connect(f).connect(e); n.connect(nf).connect(ng).connect(e); e.connect(g);
    o.start(t0); am.start(t0); n.start(t0); o.stop(t0 + dur); am.stop(t0 + dur); n.stop(t0 + dur);
  }
  // muffled speech: syllables with shifting vowels, timed to the caption
  talk(pos, female, secs, gain = 0.32) {
    const C = this.C, base = female ? 210 + R() * 30 : 118 + R() * 20, keys = Object.keys(VOWELS);
    let t = 0;
    while (t < secs) {
      const d = 0.09 + R() * 0.13, gap = R() < 0.15 ? 0.2 : 0.03;
      const v = this.voice(pos, { f0: base * (0.9 + R() * 0.25), dur: d, vowel: keys[(R() * keys.length) | 0], gain, rasp: 0.06, vib: 0.01, male: !female });
      const t0 = C.currentTime + t; v.env.gain.setValueAtTime(0, t0); v.env.gain.linearRampToValueAtTime(1, t0 + d * 0.3); v.env.gain.linearRampToValueAtTime(0, t0 + d);
      v.o.start(t0); v.vb.start(t0); v.nz.start(t0); v.stop(t0 + d + 0.02);
      t += d + gap;
    }
  }

  // ------------------------------------------------------- machines, bells
  phoneRing(pos) {   // a 1970s bell ringer: two seconds on, four off
    const C = this.C, self = { on: true, t: 0 };
    const ring = () => {
      if (!self.on) return;
      const t0 = C.currentTime, g = this.at(pos, 0.55, { ref: 1.5 });
      for (const fq of [1180, 1460, 2950]) { const o = C.createOscillator(); o.frequency.value = fq; const e = C.createGain(); e.gain.value = 0; const am = C.createOscillator(); am.type = 'square'; am.frequency.value = 20; const ag = C.createGain(); ag.gain.value = 0.15; am.connect(ag).connect(e.gain); const env = C.createGain(); this.env(env.gain, t0, [[0, 0], [0.02, 1], [1.95, 1], [2.05, 0]]); o.connect(e).connect(env).connect(g); o.start(t0); am.start(t0); o.stop(t0 + 2.1); am.stop(t0 + 2.1); }
      self.timer = setTimeout(ring, 6000);
    };
    ring(); self.stop = () => { self.on = false; clearTimeout(self.timer); };
    return self;
  }
  siren(getPos) {
    const C = this.C, o = C.createOscillator(); o.type = 'sawtooth';
    const lfo = C.createOscillator(), lg = C.createGain(); lfo.frequency.value = 0.18; lg.gain.value = 380; lfo.connect(lg).connect(o.frequency); o.frequency.value = 900;
    const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
    const p = C.createPanner(); p.panningModel = 'HRTF'; p.refDistance = 8; p.rolloffFactor = 1;
    const g = C.createGain(); g.gain.value = 0.25; o.connect(f).connect(g).connect(p).connect(this.master); p.connect(this.streetSend);
    o.start(); lfo.start();
    const self = { update: () => { const q = getPos(); p.positionX.value = q.x; p.positionY.value = q.y; p.positionZ.value = q.z; }, stop: () => { g.gain.setTargetAtTime(0, C.currentTime, 0.4); setTimeout(() => { o.stop(); lfo.stop(); }, 2000); this.loops.splice(this.loops.indexOf(self), 1); } };
    this.loops.push(self); return self;
  }
  engine(getPos, getRev) {
    const C = this.C, o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 38;
    const o2 = C.createOscillator(); o2.type = 'square'; o2.frequency.value = 19;
    const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
    const p = C.createPanner(); p.panningModel = 'HRTF'; p.refDistance = 3; p.rolloffFactor = 1.2;
    const g = C.createGain(); g.gain.value = 0.25; o.connect(f); o2.connect(f); f.connect(g).connect(p).connect(this.master);
    o.start(); o2.start();
    const self = { update: () => { const q = getPos(), r = getRev(); p.positionX.value = q.x; p.positionY.value = q.y; p.positionZ.value = q.z; o.frequency.value = 32 + r * 40; o2.frequency.value = (32 + r * 40) / 2; f.frequency.value = 200 + r * 500; },
      stop: () => { g.gain.setTargetAtTime(0, C.currentTime, 0.3); setTimeout(() => { o.stop(); o2.stop(); }, 1500); this.loops.splice(this.loops.indexOf(self), 1); } };
    this.loops.push(self); return self;
  }
  tv(pos) {    // an old black-and-white picture through the wall: dialogue murmur and a thin score
    const C = this.C, g = this.at(pos, 0.18, { ref: 1.5 });
    const n = this.noise(), f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 0.8; const ng = C.createGain(); ng.gain.value = 0.05; n.connect(f).connect(ng).connect(g); n.start();
    let on = true; const talkLoop = () => { if (!on) return; this.talk(pos, R() > 0.5, 1 + R() * 2, 0.12); setTimeout(talkLoop, 1500 + R() * 2500); };
    talkLoop();
    return { stop: () => { on = false; n.stop(); } };
  }

  // ---------------------------------------------------------------- score
  score() {
    this.tension = 0; this.beat = 0; this.nextT = 0;
    // an original ostinato in 5/4: two bars, ten eighths each
    this.seq = [76, 72, 69, 72, 76, 74, 71, 68, 71, 74, 76, 72, 69, 72, 77, 76, 72, 69, 71, 64];
    this.bass = [45, 45, 44, 43];
  }
  piano(midi, t0, gain = 0.2) {
    const C = this.C, f = 440 * Math.pow(2, (midi - 69) / 12), g = C.createGain(); g.connect(this.music);
    this.env(g.gain, t0, [[0, 0], [0.004, gain], [0.4, gain * 0.35], [2.2, 0]]);
    for (const [k, a] of [[1, 1], [2.003, 0.45], [3.01, 0.22], [4.02, 0.12], [5.04, 0.06]]) { const o = C.createOscillator(); o.type = k === 1 ? 'triangle' : 'sine'; o.frequency.value = f * k; const og = C.createGain(); og.gain.value = a; o.connect(og).connect(g); o.start(t0); o.stop(t0 + 2.3); }
    const n = this.noise(), nf = C.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = f * 4; const ne = C.createGain(); this.env(ne.gain, t0, [[0, 0.08], [0.02, 0]]); n.connect(nf).connect(ne).connect(g); n.start(t0); n.stop(t0 + 0.03);
  }
  drone(midi, t0, dur) {
    const C = this.C, f = 440 * Math.pow(2, (midi - 69) / 12), g = C.createGain(); g.connect(this.music);
    this.env(g.gain, t0, [[0, 0], [0.6, 0.12], [dur - 0.4, 0.1], [dur, 0]]);
    for (const k of [1, 1.003, 2.001]) { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * k; const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; o.connect(lp).connect(g); o.start(t0); o.stop(t0 + dur); }
  }
  scoreTick(t) {
    const C = this.C;
    this.tension = Math.max(0, this.tension - 0.0006);
    const want = this.tension > 0.25 ? Math.min(1, this.tension) : 0;
    this.music.gain.setTargetAtTime(want * 0.55, C.currentTime, 1.5);
    if (want <= 0) { this.nextT = 0; return; }
    if (!this.nextT || this.nextT < C.currentTime) this.nextT = C.currentTime + 0.05;
    while (this.nextT < C.currentTime + 0.25) {
      const i = this.beat % this.seq.length, eighth = 60 / 170;
      this.piano(this.seq[i], this.nextT, 0.16 + (i % 10 === 0 ? 0.05 : 0));
      if (i % 10 === 0) { const b = this.bass[((this.beat / 10) | 0) % this.bass.length]; this.piano(b - 12, this.nextT, 0.22); this.piano(b, this.nextT, 0.14); if (this.tension > 0.6) this.drone(b - 12, this.nextT, eighth * 10); }
      if (i % 10 === 6 && this.tension > 0.5) this.piano(this.bass[((this.beat / 10) | 0) % this.bass.length] - 12, this.nextT, 0.16);
      this.nextT += eighth; this.beat++;
    }
  }
  sting(big = false) {
    if (!this.ok) return;
    const C = this.C, t0 = C.currentTime, g = C.createGain(); g.connect(this.master); g.connect(this.streetSend);
    this.env(g.gain, t0, [[0, 0], [0.02, big ? 0.5 : 0.3], [big ? 2.5 : 1.4, 0]]);
    for (const m of big ? [33, 40, 45, 46, 52] : [57, 58, 63]) { const f = 440 * Math.pow(2, (m - 69) / 12); const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const lp = C.createBiquadFilter(); lp.type = 'lowpass'; this.env(lp.frequency, t0, [[0, 3000], [1.5, 400]]); o.connect(lp).connect(g); o.start(t0); o.stop(t0 + 2.6); }
    this.tension = Math.min(1, this.tension + (big ? 0.5 : 0.3));
  }
}
