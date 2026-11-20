import { reducedMotion } from './motion';

/**
 * Two stars bound to each other, orbiting a shared centre.
 * `split` animates from one merged star (0) to two orbiting stars (1).
 */
export class Binary {
  private ctx: CanvasRenderingContext2D;
  private w = 0; private h = 0; private dpr = 1;
  private angle = -0.6;
  private raf = 0; private prev = 0;
  private visible = true;
  split = 0; splitTarget = 1;
  speed = 0.35; // radians / second
  glow = 1;
  cy = 0.5; // vertical position of the pair (0..1)
  onFrame?: (cx: number, cy: number, t: number) => void;
  private still = reducedMotion();
  private ro: ResizeObserver;
  private io: IntersectionObserver;

  constructor(private canvas: HTMLCanvasElement, startSplit = 0) {
    this.ctx = canvas.getContext('2d')!;
    this.split = startSplit;
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.visible ? this.start() : this.stop(); });
    this.io.observe(canvas);
    document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.visible && this.start()));
    this.resize();
  }

  private resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = r.width; this.h = r.height;
    this.canvas.width = Math.max(1, r.width * this.dpr); this.canvas.height = Math.max(1, r.height * this.dpr);
    this.draw(0);
  }

  start() { if (!this.raf) { this.prev = performance.now(); this.raf = requestAnimationFrame((t) => this.loop(t)); } }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }
  destroy() { this.stop(); this.ro.disconnect(); this.io.disconnect(); }

  private loop(t: number) {
    const dt = Math.min(0.05, (t - this.prev) / 1000); this.prev = t;
    this.split += (this.splitTarget - this.split) * Math.min(1, dt * 1.6);
    if (!this.still) this.angle += this.speed * dt;
    this.draw(t);
    this.onFrame?.(this.w / 2, this.h * this.cy, t);
    this.raf = requestAnimationFrame((tt) => this.loop(tt));
  }

  private star(x: number, y: number, core: number, color: string, halo: string) {
    const { ctx } = this;
    const g = ctx.createRadialGradient(x, y, 0, x, y, core * 9 * this.glow);
    g.addColorStop(0, halo); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, core * 9 * this.glow, 0, 6.283); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, core, 0, 6.283); ctx.fill();
  }

  private draw(_t: number) {
    const { ctx, w, h, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h * this.cy;
    const R = Math.min(w, h) * 0.27 * this.split;
    const tilt = 0.42; // orbit seen at an angle
    const core = Math.max(2.4, Math.min(w, h) * 0.014);
    // faint orbit ring
    if (this.split > 0.05) {
      ctx.globalAlpha = 0.16 * this.split;
      ctx.strokeStyle = '#f3d9a8'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(cx, cy, R, R * tilt, 0, 0, 6.283); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const a = this.angle;
    const p1 = { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R * tilt, z: Math.sin(a) };
    const p2 = { x: cx - Math.cos(a) * R, y: cy - Math.sin(a) * R * tilt, z: -Math.sin(a) };
    const pts = [
      { ...p1, color: '#ffe7bd', halo: 'rgba(233,169,85,0.55)' },
      { ...p2, color: '#f6f0ff', halo: 'rgba(160,140,230,0.5)' },
    ].sort((m, n) => m.z - n.z);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of pts) this.star(p.x, p.y, core * (1 + p.z * 0.12 * this.split), p.color, p.halo);
    ctx.globalCompositeOperation = 'source-over';
  }
}
