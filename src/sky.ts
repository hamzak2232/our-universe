import { reducedMotion } from './motion';

interface Star { x: number; y: number; r: number; a: number; tw: number; ph: number; d: number; warm: boolean }
interface Shoot { x: number; y: number; vx: number; vy: number; life: number }

/** The fixed night sky behind everything. Cheap: one 2D canvas, paused when hidden. */
export class Sky {
  private ctx: CanvasRenderingContext2D;
  private stars: Star[] = [];
  private shoots: Shoot[] = [];
  private w = 0; private h = 0; private dpr = 1;
  private px = 0; private py = 0; private tx = 0; private ty = 0;
  private scroll = 0;
  private raf = 0; private last = 0;
  private still = reducedMotion();

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    addEventListener('resize', () => this.resize(), { passive: true });
    addEventListener('pointermove', (e) => { this.tx = e.clientX / this.w - 0.5; this.ty = e.clientY / this.h - 0.5; }, { passive: true });
    addEventListener('scroll', () => { this.scroll = scrollY; if (this.still) this.frame(performance.now()); }, { passive: true });
    document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.start()));
    this.start();
  }

  private resize() {
    this.dpr = Math.min(devicePixelRatio || 1, 1.75);
    this.w = innerWidth; this.h = innerHeight;
    this.canvas.width = this.w * this.dpr; this.canvas.height = this.h * this.dpr;
    const n = Math.min(320, Math.round((this.w * this.h) / 4200));
    this.stars = Array.from({ length: n }, () => {
      const d = Math.random();
      return { x: Math.random(), y: Math.random(), d, r: 0.35 + d * d * 1.25, a: 0.25 + Math.random() * 0.6,
        tw: 0.4 + Math.random() * 1.6, ph: Math.random() * 6.28, warm: Math.random() < 0.18 };
    });
    this.frame(performance.now());
  }

  shootingStar() {
    if (this.still) return;
    this.shoots.push({ x: this.w * (0.15 + Math.random() * 0.4), y: this.h * (0.08 + Math.random() * 0.2), vx: 9, vy: 3.2, life: 1 });
  }

  start() { if (!this.still && !this.raf) this.raf = requestAnimationFrame((t) => this.loop(t)); }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }

  private loop(t: number) {
    this.raf = requestAnimationFrame((tt) => this.loop(tt));
    if (t - this.last < 1000 / 40) return; // ~40fps is plenty for a sky
    this.last = t;
    this.frame(t);
  }

  private frame(t: number) {
    const { ctx, w, h, dpr } = this;
    this.px += (this.tx - this.px) * 0.04; this.py += (this.ty - this.py) * 0.04;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const s = t / 1000;
    for (const st of this.stars) {
      const par = st.d * 18;
      let y = (st.y * h - this.scroll * (0.02 + st.d * 0.06)) % h; if (y < 0) y += h;
      const x = st.x * w + this.px * par;
      const a = this.still ? st.a : st.a * (0.62 + 0.38 * Math.sin(s * st.tw + st.ph));
      ctx.globalAlpha = a;
      ctx.fillStyle = st.warm ? '#ffd9a0' : '#fff6e6';
      ctx.beginPath(); ctx.arc(x, y + this.py * par, st.r, 0, 6.283); ctx.fill();
    }
    for (const sh of this.shoots) {
      const g = ctx.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * 14, sh.y - sh.vy * 14);
      g.addColorStop(0, `rgba(255,240,210,${sh.life})`); g.addColorStop(1, 'rgba(255,240,210,0)');
      ctx.globalAlpha = 1; ctx.strokeStyle = g; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(sh.x - sh.vx * 14, sh.y - sh.vy * 14); ctx.stroke();
      sh.x += sh.vx; sh.y += sh.vy; sh.life -= 0.018;
    }
    this.shoots = this.shoots.filter((x) => x.life > 0);
    ctx.globalAlpha = 1;
  }
}
