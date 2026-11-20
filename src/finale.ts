import { h } from './dom';
import { media } from './vault';
import { Binary } from './binary';
import { reducedMotion, sleep, easeInOut } from './motion';
import type { Content } from './types';
import type { Score } from './score';
import type { Sky } from './sky';

/**
 * The finale: every memory spirals into the two stars, they flare,
 * and the two years play back as a short film that ends on her smile.
 */
export async function runFinale(c: Content, score: Score, sky: Sky, thumbs: string[], onExit: () => void) {
  const still = reducedMotion();
  const canvas = h('canvas', { 'aria-hidden': 'true' });
  const orbit = h('div', { class: 'orbit', 'aria-hidden': 'true' });
  const flash = h('div', { class: 'flash' });
  const film = h('div', { class: 'film' });
  const lines = h('div', { class: 'lines', 'aria-live': 'polite' });
  const skip = h('button', { class: 'skip', type: 'button' }, 'Skip');
  const again = h('button', { class: 'pill', type: 'button' }, 'Watch it again');
  const back = h('button', { class: 'pill ghost', type: 'button' }, 'Back to the stars');
  const controls = h('div', { class: 'controls', hidden: true }, again, back);
  const el = h('div', { class: 'finale', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Year three' }, canvas, orbit, film, flash, lines, skip, controls);
  document.body.append(el);
  document.body.classList.add('locked');
  sky.stop();
  requestAnimationFrame(() => el.classList.add('open'));

  let done = false;
  let skipTo: (() => void) | null = null;
  const montageP = media(c.finale.montage, true);
  const posterP = media(c.finale.poster, true).catch(() => '');

  const exit = () => {
    done = true;
    document.removeEventListener('keydown', onKey);
    score.intensity = 0;
    el.classList.remove('open');
    setTimeout(() => { el.remove(); binary.destroy(); }, 1200);
    document.body.classList.remove('locked');
    sky.start();
    onExit();
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') exit(); };
  document.addEventListener('keydown', onKey);
  back.addEventListener('click', exit);
  skip.addEventListener('click', () => skipTo?.());

  // ---- 1. memories fall into the two stars ----
  const binary = new Binary(canvas, 1);
  binary.cy = 0.5;
  binary.start();
  score.intensity = 0.9;
  const imgs = thumbs.map((src) => { const i = h('img', { src, alt: '' }); orbit.append(i); return i; });
  if (!still) {
    const n = imgs.length, T = 4200, t0 = performance.now();
    await new Promise<void>((res) => {
      skipTo = res;
      binary.onFrame = (cx, cy, t) => {
        const p = Math.min(1, (t - t0) / T);
        binary.speed = 0.35 + p * p * 5;
        binary.glow = 1 + p * 1.8;
        imgs.forEach((img, i) => {
          const local = Math.min(1, Math.max(0, (p - (i / n) * 0.35) / 0.65));
          const e = easeInOut(local);
          const r = (1 - e) * Math.min(innerWidth, innerHeight) * 0.42 + 4;
          const a = (i / n) * 6.283 + e * 7;
          const s = 1 - e * 0.85;
          img.style.transform = `translate(${cx + Math.cos(a) * r - 32}px, ${cy + Math.sin(a) * r * 0.75 - 32}px) scale(${s})`;
          img.style.opacity = String(local < 0.02 ? local * 50 : 1 - Math.pow(e, 6));
        });
        if (p >= 1) res();
      };
    });
    binary.onFrame = undefined;
  } else {
    await sleep(800);
  }
  orbit.replaceChildren();
  if (done) return;

  // ---- 2. flare, then the film ----
  flash.style.opacity = '1';
  score.chime();
  await sleep(still ? 200 : 900);
  binary.stop();
  canvas.remove();

  let video: HTMLVideoElement | null = null;
  try {
    const [src, poster] = await Promise.all([montageP, posterP]);
    if (poster) film.append(h('div', { class: 'bg', style: `background-image:url(${poster})` }));
    video = h('video', { src, playsinline: true, muted: true, preload: 'auto', 'aria-label': 'Two years, in a few seconds' });
    video.muted = true;
    film.append(video);
  } catch { /* film unavailable: go straight to the words */ }
  film.classList.add('on');
  flash.style.opacity = '0';

  const playFilm = () => new Promise<void>((res) => {
    if (!video) return res();
    skipTo = () => { video!.currentTime = Math.max(0, video!.duration - 0.05); video!.pause(); res(); };
    video.onended = () => res();
    video.currentTime = 0;
    video.play().catch(() => res());
  });

  const words = async () => {
    skip.hidden = true;
    el.classList.add('lines-on');
    lines.replaceChildren();
    const L = c.finale.lines;
    for (let i = 0; i < L.length; i++) {
      if (done) return;
      const cls = i === L.length - 2 ? 'big' : i === L.length - 1 ? 'small' : '';
      const p = h('p', { class: cls }, L[i]);
      lines.append(p);
      requestAnimationFrame(() => p.classList.add('show'));
      await sleep(still ? 300 : i === L.length - 2 ? 2600 : 1700);
    }
    controls.hidden = false;
    again.focus({ preventScroll: true });
  };

  again.addEventListener('click', async () => {
    controls.hidden = true; skip.hidden = false;
    el.classList.remove('lines-on');
    lines.replaceChildren();
    await playFilm();
    await words();
  });

  await playFilm();
  if (!done) await words();
}
