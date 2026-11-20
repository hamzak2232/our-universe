// Encrypts the private content + media into public/vault/ so the public
// repository and website never contain readable photos, videos or words.
//
//   npm run encrypt                      (reads ../our-universe-PRIVATE)
//   npm run encrypt -- "C:\path\to\our-universe-PRIVATE"
//
// The passphrase is read from passphrase.txt inside the private folder.
import { webcrypto as crypto } from 'node:crypto';
import { readFile, writeFile, readdir, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.resolve(process.argv[2] ?? path.join(root, '..', 'our-universe-PRIVATE'));
const out = path.join(root, 'public', 'vault');
const ITER = 310000;
const MIME = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', mp4: 'video/mp4', mp3: 'audio/mpeg', m4a: 'audio/mp4' };

// Must match normalise() in src/vault.ts
const normalise = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const exists = (p) => stat(p).then(() => true, () => false);
if (!(await exists(path.join(src, 'content.json')))) {
  console.error(`Could not find content.json in ${src}\nPass the private folder path: npm run encrypt -- "C:\\path\\to\\our-universe-PRIVATE"`);
  process.exit(1);
}
const pass = normalise(await readFile(path.join(src, 'passphrase.txt'), 'utf8'));
if (pass.length < 4) { console.error('passphrase.txt is empty or too short.'); process.exit(1); }

const salt = crypto.getRandomValues(new Uint8Array(16));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);

async function seal(bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  const outb = new Uint8Array(12 + ct.length); outb.set(iv); outb.set(ct, 12);
  return outb;
}
const rid = () => Buffer.from(crypto.getRandomValues(new Uint8Array(10))).toString('hex');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const content = JSON.parse(await readFile(path.join(src, 'content.json'), 'utf8'));
const mediaDir = path.join(src, 'media');
const done = new Map();
let total = 0;
async function walk(v) {
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = await walk(v[i]); return v; }
  if (v && typeof v === 'object') { for (const k of Object.keys(v)) v[k] = await walk(v[k]); return v; }
  if (typeof v === 'string' && /\.(webp|jpe?g|png|mp4|mp3|m4a)$/i.test(v)) {
    if (done.has(v)) return done.get(v);
    const file = path.join(mediaDir, v);
    if (!(await exists(file))) { console.error(`Missing media file: media/${v}`); process.exit(1); }
    const id = rid();
    const sealed = await seal(await readFile(file));
    await writeFile(path.join(out, `${id}.bin`), sealed);
    total += sealed.length;
    const ref = `m:${id}:${MIME[v.split('.').pop().toLowerCase()]}`;
    done.set(v, ref);
    console.log(`  ${v.padEnd(32)} ${(sealed.length / 1024).toFixed(0).padStart(6)} KB`);
    return ref;
  }
  return v;
}
await walk(content);
await writeFile(path.join(out, 'content.bin'), await seal(new TextEncoder().encode(JSON.stringify(content))));
await writeFile(path.join(out, 'vault.json'), JSON.stringify({ v: 1, iter: ITER, salt: Buffer.from(salt).toString('base64') }));
console.log(`\nEncrypted ${done.size} media files (${(total / 1048576).toFixed(1)} MB) into public/vault/`);
