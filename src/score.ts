/**
 * An original, generative ambient score built with the Web Audio API.
 * Nothing is downloaded: chords and melody are composed live, so there is
 * no copyright concern and no audio file to load.
 */
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// D major: Dmaj9, Bm11, Gmaj9, A6sus
const CHORDS = [
  [50, 57, 61, 64, 66],
  [47, 54, 57, 62, 64],
  [43, 50, 54, 57, 62],
  [45, 52, 57, 59, 62],
];
const MELODY = [74, 76, 78, 81, 83, 86, 88, 90];
const BAR = 8; // seconds per chord

export class Score {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private bus!: GainNode;
  private timer = 0;
  private nextBar = 0;
  private bar = 0;
  private lastNote = 3;
  private on: boolean;
  private ducked = false;
  intensity = 0; // 0..1, raised during the finale

  constructor(private volume: number, initiallyOn: boolean) {
    let stored: string | null = null;
    try { stored = localStorage.getItem('ou-sound'); } catch { /* storage unavailable */ }
    this.on = stored ? stored === 'on' : initiallyOn;
  }

  get enabled() { return this.on; }

  /** Must be called synchronously inside a user gesture (tap / key). */
  prime() {
    if (this.ctx) { this.ctx.resume(); return; }
    try {
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = 'playback'; // play even when an iPhone is on silent
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.ctx.resume();
      this.build();
    } catch { this.ctx = null; }
  }

  private build() {
    const ctx = this.ctx!;
    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    this.bus = ctx.createGain();
    const dry = ctx.createGain(); dry.gain.value = 0.55;
    const wet = ctx.createGain(); wet.gain.value = 0.7;
    const verb = ctx.createConvolver(); verb.buffer = this.impulse(4.8);
    this.bus.connect(dry).connect(this.master);
    this.bus.connect(verb).connect(wet).connect(this.master);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      document.hidden ? this.ctx.suspend() : this.on && this.ctx.resume();
    });
  }

  private impulse(sec: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return buf;
  }

  /** Begin playing (fades in) if sound is enabled. */
  start() {
    if (!this.ctx) return;
    if (!this.timer) {
      this.nextBar = this.ctx.currentTime + 0.2;
      this.timer = window.setInterval(() => this.schedule(), 250);
      this.schedule();
    }
    this.apply(4);
  }

  toggle() {
    this.on = !this.on;
    try { localStorage.setItem('ou-sound', this.on ? 'on' : 'off'); } catch { /* ignore */ }
    if (this.on) { this.ctx?.resume(); if (!this.timer) this.start(); }
    this.apply(1.2);
    return this.on;
  }

  /** Lower the score while a video with sound or a song excerpt plays. */
  duck(d: boolean) { this.ducked = d; this.apply(0.8); }

  private apply(fade: number) {
    if (!this.ctx) return;
    const g = this.master.gain, t = this.ctx.currentTime;
    const target = this.on ? (this.ducked ? 0.08 : this.volume) : 0;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(target, t + fade);
  }

  /** A soft bell, used when the constellation completes. */
  chime() {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime + 0.05;
    [86, 90, 93, 98].forEach((m, i) => this.pluck(hz(m), t + i * 0.18, 0.16));
  }

  private schedule() {
    const ctx = this.ctx!;
    while (this.nextBar < ctx.currentTime + 1.5) {
      const chord = CHORDS[this.bar % CHORDS.length];
      const t0 = this.nextBar;
      chord.forEach((m, i) => this.pad(hz(m), t0, BAR + 3.5, i === 0 ? 0.05 : 0.032));
      // sparse melody, one beat = 1s
      const density = 0.32 + this.intensity * 0.35;
      for (let beat = 0; beat < BAR; beat++) {
        if (Math.random() > density) continue;
        const step = Math.round((Math.random() - 0.5) * 3);
        this.lastNote = Math.max(0, Math.min(MELODY.length - 1, this.lastNote + step));
        const when = t0 + beat + (Math.random() < 0.3 ? 0.5 : 0);
        this.pluck(hz(MELODY[this.lastNote]), when, 0.09);
        if (Math.random() < 0.18) this.pluck(hz(MELODY[this.lastNote] - 12), when + 0.02, 0.05);
      }
      this.nextBar += BAR; this.bar++;
    }
  }

  private pad(f: number, t: number, dur: number, vol: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.3;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 2.8);
    g.gain.setValueAtTime(vol, t + dur - 3.5);
    g.gain.linearRampToValueAtTime(0, t + dur);
    g.connect(lp).connect(this.bus);
    for (const [type, det] of [['sine', -4], ['triangle', 5]] as const) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
      o.connect(g); o.start(t); o.stop(t + dur + 0.1);
    }
  }

  private pluck(f: number, t: number, vol: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    g.connect(lp).connect(this.bus);
    [[1, 1], [2, 0.22], [3, 0.06]].forEach(([mult, amp]) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * mult;
      const og = ctx.createGain(); og.gain.value = amp;
      o.connect(og).connect(g); o.start(t); o.stop(t + 3.3);
    });
  }
}
