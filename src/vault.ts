import type { Content, MediaRef } from './types';

const BASE = import.meta.env.BASE_URL + 'vault/';
let key: CryptoKey | null = null;

// Must match normalise() in scripts/encrypt.mjs
const normalise = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const month = (p: string) => { const i = MONTHS.indexOf(p.slice(0, 3)); return i < 0 || !/^[a-z]+$/.test(p) ? null : String(i + 1); };
const pad = (s: string) => s.padStart(2, '0');
const year = (s: string) => (s.length === 2 ? '20' + s : s);

/** Accepts 21/11/2024, 21-11-24, 21 Nov 2024, 2024-11-21, 21112024 … */
export function candidates(raw: string): string[] {
  const s = raw.trim().toLowerCase();
  const out = new Set<string>();
  const plain = normalise(s);
  if (plain) out.add(plain);
  let parts = s.split(/[^a-z0-9]+/).filter(Boolean);
  const glued = plain.match(/^(\d{1,2})([a-z]+)(\d{2,4})$/);
  if (glued) parts = glued.slice(1);
  if (parts.length === 3) {
    let [a, b, c] = parts;
    if (month(a) && /^\d+$/.test(b)) [a, b] = [b, month(a)!];
    else if (month(b)) b = month(b)!;
    if ([a, b, c].every((p) => /^\d+$/.test(p))) {
      if (a.length === 4) out.add(pad(c) + pad(b) + a);
      else out.add(pad(a) + pad(b) + year(c));
    }
  }
  if (/^\d{6}$/.test(plain)) out.add(plain.slice(0, 4) + '20' + plain.slice(4));
  if (/^20\d{6}$/.test(plain)) out.add(plain.slice(6, 8) + plain.slice(4, 6) + plain.slice(0, 4));
  return [...out].slice(0, 4);
}

async function open(k: CryptoKey, buf: ArrayBuffer): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(buf, 0, 12) }, k, new Uint8Array(buf, 12));
}

async function fetchBuf(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url, { cache: 'force-cache' });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return r.arrayBuffer();
}

export class WrongPassphrase extends Error {}

export async function unlock(input: string): Promise<Content> {
  if (!crypto?.subtle) throw new Error('This browser can’t open the page (secure context required).');
  const [meta, sealed] = await Promise.all([
    fetch(BASE + 'vault.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('vault'); return r.json(); }),
    fetchBuf(BASE + 'content.bin'),
  ]);
  const salt = Uint8Array.from(atob(meta.salt), (c) => c.charCodeAt(0));
  for (const pass of candidates(input)) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    const k = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: meta.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    try {
      const plain = await open(k, sealed);
      key = k;
      return JSON.parse(new TextDecoder().decode(plain)) as Content;
    } catch { /* wrong key, try next */ }
  }
  throw new WrongPassphrase();
}

// ---- media: decrypted lazily, one at a time, cached as object URLs ----
const cache = new Map<string, Promise<string>>();
const queue: { ref: MediaRef; resolve: (u: string) => void; reject: (e: unknown) => void }[] = [];
let busy = false;

async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const job = queue.shift()!;
    try {
      const [, id, mime] = job.ref.split(':');
      const plain = await open(key!, await fetchBuf(BASE + id + '.bin'));
      job.resolve(URL.createObjectURL(new Blob([plain], { type: mime })));
    } catch (e) { job.reject(e); }
  }
  busy = false;
}

/** Returns an object URL for an encrypted media ref. `urgent` jumps the queue. */
export function media(ref: MediaRef, urgent = false): Promise<string> {
  let p = cache.get(ref);
  if (p) {
    if (urgent) { const i = queue.findIndex((j) => j.ref === ref); if (i > 0) queue.unshift(...queue.splice(i, 1)); }
    return p;
  }
  p = new Promise<string>((resolve, reject) => {
    const job = { ref, resolve, reject };
    urgent ? queue.unshift(job) : queue.push(job);
  });
  p.catch(() => cache.delete(ref));
  cache.set(ref, p);
  pump();
  return p;
}
