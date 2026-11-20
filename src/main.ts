import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/600.css';
import '@fontsource/pinyon-script/400.css';
import './style.css';

import { site } from './config';
import { h, $ } from './dom';
import { unlock, media, WrongPassphrase } from './vault';
import { Sky } from './sky';
import { Binary } from './binary';
import { Score } from './score';
import { showMemory } from './viewer';
import { runFinale } from './finale';
import { reducedMotion } from './motion';
import type { Content, MediaRef } from './types';

const sky = new Sky($<HTMLCanvasElement>('#sky'));
const score = new Score(site.sound.volume, site.sound.defaultOn);

// ---------------- gate ----------------
const g = site.gate;
$('#gate-title').textContent = g.to;
$('.gate .line').textContent = g.line;
$('label[for=pass]').textContent = g.label;
$('#pass-hint').textContent = g.hint;
const form = $<HTMLFormElement>('#gate-form');
const input = $<HTMLInputElement>('#pass');
const submit = $<HTMLButtonElement>('#gate-form button');
const msg = $('#pass-msg');
submit.textContent = g.button;
document.title = site.title;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!input.value.trim()) { input.focus(); return; }
  score.prime(); // inside the tap, so the browser allows sound
  submit.disabled = true; submit.textContent = g.opening; msg.textContent = '';
  try {
    const content = await unlock(input.value);
    enter(content);
  } catch (err) {
    submit.disabled = false; submit.textContent = g.button;
    msg.textContent = err instanceof WrongPassphrase ? g.wrong : g.offline;
    form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
    input.select();
  }
});
input.focus({ preventScroll: true });

// ---------------- sound toggle ----------------
const soundBtn = $<HTMLButtonElement>('#sound');
const paintSound = () => {
  soundBtn.setAttribute('aria-pressed', String(score.enabled));
  $('.sound-label', soundBtn).textContent = score.enabled ? 'Sound on' : 'Sound off';
};
soundBtn.addEventListener('click', () => { score.prime(); score.toggle(); paintSound(); });

// ---------------- story ----------------
function enter(c: Content) {
  const story = $('#story');
  story.replaceChildren(hero(c), since(c), constellation(c), menu(c), letter(c), mixtape(c), finale(c),
    h('p', { class: 'foot' }, `Made for ${c.her.nickname}, with all my heart. 21 November 2026.`));
  story.hidden = false;
  scrollTo(0, 0);
  $('#gate').classList.add('gone');
  setTimeout(() => $('#gate').remove(), 1500);
  soundBtn.classList.add('ready'); paintSound();
  score.start();
  prefetch(c);
  watchScroll();
  inkLetter();
}

function prefetch(c: Content) {
  const refs: MediaRef[] = [c.together.photo, c.letter.photo];
  c.memories.forEach((m) => m.media.forEach((x) => refs.push(x.poster ?? x.file)));
  c.memories.forEach((m) => m.media.forEach((x) => x.poster && refs.push(x.file)));
  refs.push(c.finale.poster, c.finale.montage);
  refs.forEach((r) => media(r).catch(() => {}));
}

function watchScroll() {
  let pending = false;
  const root = document.documentElement;
  const update = () => {
    pending = false;
    const max = root.scrollHeight - innerHeight;
    root.style.setProperty('--dawn', (max > 0 ? Math.min(1, scrollY / max) : 0).toFixed(3));
  };
  addEventListener('scroll', () => { if (!pending) { pending = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

const img = (ref: MediaRef, alt: string, cls = '') => {
  const el = h('img', { alt, class: cls, decoding: 'async' });
  media(ref).then((u) => (el.src = u)).catch(() => {});
  return el;
};

// 1. two stars
function hero(c: Content) {
  const canvas = h('canvas', { class: 'binary', 'aria-hidden': 'true' });
  const b = new Binary(canvas, 0);
  b.cy = 0.36;
  requestAnimationFrame(() => { b.splitTarget = 1; });
  return h('section', { class: 'ch hero', 'aria-label': 'Opening' },
    canvas,
    h('div', { class: 'hero-text' },
      h('p', { class: 'hello' }, c.opening.hello),
      h('h1', {}, c.opening.line),
      h('p', { class: 'sub' }, c.opening.sub)),
    h('div', { class: 'cue', 'aria-hidden': 'true' }));
}

// 2. the day it began, and how long it has been
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
function since(c: Content) {
  const [y, m, d] = c.together.since.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const big = h('span', { class: 'big' }, '0');
  const tick = h('span', { class: 'tick' });
  const now0 = new Date();
  const isDay = now0.getMonth() === m - 1 && now0.getDate() === d;
  const years = now0.getFullYear() - y;
  const days = () => Math.floor((Date.now() - start.getTime()) / 86400000);
  const fmt = (n: number) => n.toLocaleString('en-US');
  const paintTick = () => {
    const ms = Date.now() - start.getTime();
    tick.textContent = `${fmt(Math.floor(ms / 3600000))} hours, ${fmt(Math.floor(ms / 60000))} minutes, ${fmt(Math.floor(ms / 1000))} seconds, and counting.`;
  };
  paintTick();
  let timer = 0, counted = false;
  const sec = h('section', { class: 'ch since', 'aria-label': 'Since' },
    h('div', { class: 'wrap' },
      h('figure', {}, img(c.together.photo, c.together.photoAlt)),
      h('div', {},
        h('p', { class: 'date' }, c.together.sinceLabel),
        h('h2', {}, c.together.sinceLine),
        h('p', { class: 'count' }, big, h('span', { class: 'unit' }, 'days of us'), tick,
          isDay && years > 0 ? h('span', { class: 'today' }, `Exactly ${WORDS[years] ?? years} years today.`) : null))));
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) {
      if (!counted) {
        counted = true;
        const target = days();
        if (reducedMotion()) big.textContent = fmt(target);
        else {
          const t0 = performance.now();
          const step = (t: number) => {
            const p = Math.min(1, (t - t0) / 2200);
            big.textContent = fmt(Math.round(target * (1 - Math.pow(1 - p, 4))));
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      }
      if (!timer) timer = window.setInterval(paintTick, 1000);
    } else { clearInterval(timer); timer = 0; }
  }, { threshold: 0.3 }).observe(sec);
  return sec;
}

// 3. constellation of memories that spells M
const POINTS = [[8, 86], [16, 47], [26, 12], [50, 60], [74, 12], [84, 47], [92, 86]];
function constellation(c: Content) {
  const n = Math.min(c.memories.length, POINTS.length);
  const seen = new Set<number>();
  const map = h('div', { class: 'map', role: 'group', 'aria-label': 'Memories' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
  const segs: SVGLineElement[] = [];
  for (let i = 0; i < n - 1; i++) {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', String(POINTS[i][0])); l.setAttribute('y1', String(POINTS[i][1]));
    l.setAttribute('x2', String(POINTS[i + 1][0])); l.setAttribute('y2', String(POINTS[i + 1][1]));
    svg.append(l); segs.push(l);
  }
  map.append(svg);
  const status = h('p', { class: 'map-status', 'aria-live': 'polite' });
  const done = h('p', { class: 'map-done' }, c.constellation.complete);
  const paint = () => {
    status.textContent = seen.size === n ? `All ${n} visited.` : `${seen.size} of ${n} visited`;
    segs.forEach((l, i) => l.classList.toggle('on', seen.has(i) && seen.has(i + 1)));
    if (seen.size === n && !map.classList.contains('complete')) {
      map.classList.add('complete');
      setTimeout(() => { done.classList.add('show'); sky.shootingStar(); score.chime(); }, 1400);
    }
  };
  const stars = c.memories.slice(0, n).map((mem, i) => {
    const [x, y] = POINTS[i];
    const cls = ['star', x < 20 ? 'edge-l' : x > 80 ? 'edge-r' : '', y < 20 ? '' : y > 70 ? 'up' : ''].filter(Boolean).join(' ');
    const b = h('button', { class: cls, type: 'button', style: `--x:${x};--y:${y};--i:${i}`, 'aria-label': `Memory ${i + 1} of ${n}: ${mem.title}` },
      h('span', { class: 'dot' }), h('span', { class: 'label', 'aria-hidden': 'true' }, mem.title));
    b.addEventListener('click', () => open(i));
    map.append(b);
    return b;
  });
  const open = (i: number) => {
    seen.add(i); stars[i].classList.add('seen'); paint();
    const nextUnseen = [...Array(n).keys()].map((k) => (i + 1 + k) % n).find((k) => !seen.has(k));
    const next = nextUnseen ?? (i + 1 < n ? i + 1 : undefined);
    showMemory(c.memories[i], {
      hasNext: next !== undefined,
      onNext: () => open(next!),
      onClose: () => {},
      score,
      returnFocus: stars[i],
    });
  };
  const all = h('button', { class: 'textbtn', type: 'button' }, 'Open them in order');
  all.addEventListener('click', () => open([...Array(n).keys()].find((k) => !seen.has(k)) ?? 0));
  paint();
  return h('section', { class: 'ch', id: 'stars', 'aria-label': 'Memories' },
    h('div', { class: 'wrap' }, h('h2', {}, c.constellation.title), h('p', { class: 'lede' }, c.constellation.hint)),
    map,
    h('div', { class: 'map-foot' }, status, all),
    done);
}

// 4. the inside joke, as a menu
function menu(c: Content) {
  const qtys: HTMLElement[] = [];
  const items = c.menu.items.map((it) => {
    const q = h('span', { class: 'qty' }, '×1'); qtys.push(q);
    return h('li', {}, h('h3', {}, it.name), h('span', { class: 'leader', 'aria-hidden': 'true' }), q, h('p', {}, it.note));
  });
  const punch = h('p', { class: 'punch', 'aria-live': 'polite' });
  const btn = h('button', { class: 'order', type: 'button' }, c.menu.button);
  btn.addEventListener('click', () => {
    btn.disabled = true;
    qtys.forEach((q, i) => setTimeout(() => { q.textContent = '×2'; q.classList.add('bump'); }, reducedMotion() ? 0 : 140 * i));
    setTimeout(() => {
      punch.replaceChildren(h('span', { class: 'say' }, c.menu.punchline), h('span', { class: 'after' }, c.menu.after));
    }, reducedMotion() ? 0 : 140 * qtys.length + 300);
  });
  return h('section', { class: 'ch menu-ch', 'aria-label': c.menu.title },
    h('div', { class: 'wrap' },
      h('article', { class: 'menu-card' },
        h('h2', {}, c.menu.title), h('p', { class: 'sub' }, c.menu.subtitle),
        h('ul', {}, items), btn, punch)));
}

// 5. the letter
function letter(c: Content) {
  const L = c.letter;
  return h('section', { class: 'ch letter-ch', 'aria-label': 'Letter' },
    h('div', { class: 'wrap' },
      h('article', { class: 'letter' },
        h('p', { class: 'greet ink' }, L.greeting),
        L.paragraphs.map((p) => h('p', { class: 'ink' }, p)),
        h('p', { class: 'closing ink' }, L.closing)),
      h('figure', { class: 'tucked' }, img(L.photo, L.photoAlt))));
}
function inkLetter() {
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('inked'); io.unobserve(e.target); }
  }), { threshold: 0.5, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.ink').forEach((p) => io.observe(p));
}

// 6. side B
let excerptAudio: HTMLAudioElement | null = null;
function mixtape(c: Content) {
  const M = c.mixtape;
  const rows = M.tracks.map((t, i) => {
    const q = encodeURIComponent(`${t.title} ${t.artist}`.trim());
    const links = h('span', { class: 'links' },
      h('a', { href: `https://open.spotify.com/search/${q}`, target: '_blank', rel: 'noopener noreferrer' }, 'Spotify'),
      h('a', { href: `https://www.youtube.com/results?search_query=${q}`, target: '_blank', rel: 'noopener noreferrer' }, 'YouTube'));
    if (t.excerpt) {
      const b = h('button', { type: 'button' }, 'Play a bit');
      b.addEventListener('click', async () => {
        if (excerptAudio && !excerptAudio.paused && excerptAudio.dataset.i === String(i)) { excerptAudio.pause(); return; }
        excerptAudio?.pause();
        document.querySelectorAll('.tracks button').forEach((x) => (x.textContent = 'Play a bit'));
        excerptAudio = new Audio(await media(t.excerpt!, true));
        excerptAudio.dataset.i = String(i);
        excerptAudio.onpause = excerptAudio.onended = () => { score.duck(false); b.textContent = 'Play a bit'; };
        score.duck(true); b.textContent = 'Pause';
        excerptAudio.play().catch(() => score.duck(false));
      });
      links.prepend(b);
    }
    return h('li', {}, h('span', { class: 'n' }, String(i + 1)), h('span', { class: 't' }, t.title), h('span', { class: 'a' }, t.artist || '\u00a0'), links);
  });
  return h('section', { class: 'ch', 'aria-label': M.title },
    h('div', { class: 'wrap' }, h('h2', {}, M.title), h('p', { class: 'lede' }, M.intro), h('ol', { class: 'tracks' }, rows), h('p', { class: 'score-note' }, M.scoreNote)));
}

// 7. finale
function finale(c: Content) {
  const btn = h('button', { class: 'begin', type: 'button' }, c.finale.button);
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    excerptAudio?.pause();
    const refs = [c.together.photo, ...c.memories.map((m) => m.media[0].poster ?? m.media[0].file), c.letter.photo];
    const thumbs = (await Promise.all(refs.map((r) => media(r).catch(() => '')))).filter(Boolean);
    await runFinale(c, score, sky, thumbs, () => { btn.disabled = false; $('#stars')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' }); });
  });
  return h('section', { class: 'ch finale-ch', 'aria-label': 'Finale' },
    h('div', {}, h('p', { class: 'kicker' }, c.finale.kicker), btn));
}
