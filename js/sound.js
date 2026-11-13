// Tiny synthesized sounds: wooden knocks, chimes and a music-box birthday tune. No audio files.
const KEY = 'lt.muted';

export class Sound {
  constructor() {
    const q = new URLSearchParams(location.search);
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch { /* private mode */ }
    // the preview pane used for testing always starts muted
    this.muted = q.has('mute') || /Claude\//.test(navigator.userAgent) || saved === '1';
    this.ctx = null;
  }
  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem(KEY, m ? '1' : '0'); } catch { /* ignore */ }
    if (m && this.ctx) this.ctx.suspend();
  }
  ensure() {
    if (this.muted) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.2, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  env(g, t, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  knock(pitch = 1, vol = 1, delay = 0) {
    const c = this.ensure(); if (!c) return;
    const t = c.currentTime + delay;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500 * pitch; bp.Q.value = 3.5;
    const g = c.createGain(); this.env(g, t, 0.45 * vol, 0.07);
    src.connect(bp).connect(g).connect(this.master); src.start(t); src.stop(t + 0.1);
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(720 * pitch, t); o.frequency.exponentialRampToValueAtTime(240 * pitch, t + 0.07);
    const g2 = c.createGain(); this.env(g2, t, 0.32 * vol, 0.1);
    o.connect(g2).connect(this.master); o.start(t); o.stop(t + 0.12);
  }
  bell(f, t, dur = 1.2, vol = 0.22) {
    const c = this.ctx; if (!c) return;
    [[1, 1], [2, 0.28], [3.01, 0.08]].forEach(([m, a]) => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * m;
      const g = c.createGain(); this.env(g, t, vol * a, dur / m);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
    });
  }
  tap() { this.knock(1.7, 0.35); }
  place() { this.knock(1, 1); this.knock(1.3, 0.45, 0.07); }
  nope() {
    const c = this.ensure(); if (!c) return;
    const t = c.currentTime, o = c.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.16);
    const g = c.createGain(); this.env(g, t, 0.28, 0.2);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.22);
  }
  chime() {
    const c = this.ensure(); if (!c) return;
    const t = c.currentTime + 0.05;
    this.bell(1046.5, t, 1.0); this.bell(1318.5, t + 0.12, 1.0); this.bell(1568, t + 0.24, 1.3);
  }
  birthday() {
    const c = this.ensure(); if (!c) return;
    const n = { G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99 };
    const song = [['G4', .75], ['G4', .25], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2],
      ['G4', .75], ['G4', .25], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2],
      ['G4', .75], ['G4', .25], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 1], ['A4', 2],
      ['F5', .75], ['F5', .25], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 3]];
    let t = c.currentTime + 0.3; const beat = 0.36;
    for (const [k, d] of song) { this.bell(n[k] * 2, t, Math.min(1.6, d * beat * 3), 0.2); t += d * beat; }
  }
}
