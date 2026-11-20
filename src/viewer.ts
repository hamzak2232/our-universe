import { h } from './dom';
import { media } from './vault';
import type { Memory } from './types';
import type { Score } from './score';

interface Opts {
  hasNext: boolean;
  onNext: () => void;
  onClose: () => void;
  score: Score;
  returnFocus?: HTMLElement | null;
}

let active: { el: HTMLElement; cleanup: () => void } | null = null;

export function closeMemory(instant = false) {
  if (!active) return;
  const { el, cleanup } = active;
  active = null;
  cleanup();
  if (instant) el.remove();
  else { el.classList.remove('open'); setTimeout(() => el.remove(), 450); }
}

export function showMemory(m: Memory, o: Opts) {
  closeMemory(true);
  let video: HTMLVideoElement | null = null;
  const stage = h('div', { class: 'stage' }, h('p', { class: 'loading' }, 'Opening…'));
  const soundBtn = h('button', { class: 'pill ghost', type: 'button', hidden: true }, 'Play its sound');
  const nextBtn = h('button', { class: 'pill', type: 'button' }, o.hasNext ? 'Next star' : 'Back to the sky');
  const closeBtn = h('button', { class: 'close', type: 'button' }, 'Close');
  const title = h('h3', { id: 'mem-title' }, m.title);
  const el = h('div', { class: 'viewer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mem-title' },
    closeBtn,
    stage,
    h('div', { class: 'cap' }, title, h('p', {}, m.caption), m.flipHint && m.media.length > 1 ? h('p', { class: 'fh' }, m.flipHint) : null,
      h('div', { class: 'row' }, nextBtn, soundBtn)),
  );

  const finish = (next: boolean) => {
    if (next && o.hasNext) { o.onNext(); return; }
    closeMemory();
    o.onClose();
    o.returnFocus?.focus({ preventScroll: true });
  };
  closeBtn.addEventListener('click', () => finish(false));
  nextBtn.addEventListener('click', () => finish(o.hasNext));
  soundBtn.addEventListener('click', () => {
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted) { video.currentTime = 0; video.play().catch(() => {}); }
    soundBtn.textContent = video.muted ? 'Play its sound' : 'Mute it';
    o.score.duck(!video.muted);
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') finish(false);
    else if (e.key === 'ArrowRight' && o.hasNext) finish(true);
    else if (e.key === 'Tab') {
      const f = [...el.querySelectorAll<HTMLElement>('button:not([hidden])')];
      const i = f.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  };
  document.addEventListener('keydown', onKey);
  document.body.classList.add('locked');
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('open'));
  nextBtn.focus({ preventScroll: true });

  active = {
    el,
    cleanup: () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('locked');
      if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
      o.score.duck(false);
    },
  };
  const mine = active;

  // load media
  (async () => {
    try {
      const first = m.media[0];
      if (first.file.includes(':video/')) {
        const [src, poster] = await Promise.all([media(first.file, true), first.poster ? media(first.poster, true) : Promise.resolve('')]);
        if (active !== mine) return;
        video = h('video', { src, poster: poster || undefined, playsinline: true, muted: true, loop: true, autoplay: true, 'aria-label': first.alt });
        video.muted = true;
        stage.replaceChildren(video);
        video.play().catch(() => {});
        soundBtn.hidden = false;
      } else if (m.media.length > 1) {
        const urls = await Promise.all(m.media.map((x) => media(x.file, true)));
        if (active !== mine) return;
        const imgs = urls.map((u, i) => h('img', { src: u, alt: m.media[i].alt, class: 'flip' + (i === 0 ? ' front' : '') }));
        let at = 0;
        const flipper = h('button', { class: 'flipper', type: 'button', 'aria-label': 'Show the other photo' });
        flipper.addEventListener('click', () => {
          imgs[at].classList.remove('front'); at = (at + 1) % imgs.length; imgs[at].classList.add('front');
        });
        stage.replaceChildren(...imgs, flipper);
      } else {
        const u = await media(first.file, true);
        if (active !== mine) return;
        stage.replaceChildren(h('img', { src: u, alt: first.alt }));
      }
    } catch {
      if (active === mine) stage.replaceChildren(h('p', { class: 'loading' }, 'This one didn’t load. Close and try again.'));
    }
  })();
}
