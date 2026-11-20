# Our Universe

A private second-anniversary experience for Mano, 21 November 2026.

Live at **https://hamzak2232.github.io/our-universe/** once deployed.

## How privacy works

GitHub Pages sites are public, and on a free GitHub account the repository must be public too.
So this project never puts readable photos, videos or words online:

- Every photo, video and every personal sentence (letter, captions, menu) is **encrypted with AES‑256** into `public/vault/`.
- The page decrypts them **inside her browser** only after the right date is typed.
- Anyone else who finds the link or the repository sees a starry page with a date box, and a folder of unreadable `.bin` files.
- The page also asks search engines not to index it.

The key is the date (`21/11/2024`). It also accepts `21-11-2024`, `21 Nov 2024`, `21112024` and similar forms.
A date stops casual visitors completely. It is not bank-grade: someone who downloaded the files *and* guessed the key is a date could eventually try every date.
To make it stronger, change it to a phrase only she knows (see "Changing the password" below).

## The chapters

1. **For Mano** – one star and a date box. Opening it also starts the music.
2. **Two stars** – the single star splits into a binary pair, two stars orbiting each other.
3. **The day you said it back** – a live count of every day, hour and second since 21.11.2024.
4. **The constellation** – seven stars, seven memories (photos and video clips). Visiting all of them draws the letter M.
5. **The Mano Menu** – everything she loves, priced for one. "I'd like the same" doubles every order: *phir to 2 mangwana parhain ge, ma'am*.
6. **The letter** – written in ink that appears as she reads.
7. **Side B** – your songs, each opening on Spotify or YouTube.
8. **Begin year three** – every memory falls into the two stars, they flare, and two years play back as a short film that ends on her smile in F‑9 Park.

The background music is an original score generated live by the page (`src/score.ts`), so there is no audio file and no copyright problem.

## Test it on your computer (Windows)

1. Install **Node.js LTS** from https://nodejs.org (accept the defaults).
2. Open the `our-universe` folder, click the address bar, type `cmd`, press Enter.
3. Run:
   ```
   npm install
   npm run dev
   ```
4. Open the address it prints (usually http://localhost:5173) and enter the date.
5. Press `Ctrl + C` in the window to stop it.

## Changing words, photos or the password

The readable originals live in a separate folder, **`our-universe-PRIVATE`**. Never upload that folder.
Put it next to this one:

```
Documents\
  our-universe\            <- this project (the one that goes to GitHub)
  our-universe-PRIVATE\    <- content.json, passphrase.txt, media\
```

1. Edit `our-universe-PRIVATE\content.json` in Notepad to change any text (letter, captions, menu, songs, finale lines).
2. To change a photo or video, put the new file in `our-universe-PRIVATE\media\` and write its file name in `content.json`.
3. To change the password, edit `our-universe-PRIVATE\passphrase.txt`. Spaces, punctuation and capitals are ignored. Also update the hint in `src\config.ts`.
4. In the `our-universe` folder, run:
   ```
   npm run encrypt
   ```
   This rebuilds `public\vault\`.
5. Upload the new `public\vault` folder to GitHub, replacing the old one (delete the old `vault` files first). The site redeploys by itself.

**Adding a short song excerpt:** put an `.mp3` in `media\`, then add `"excerpt": "file-name.mp3"` to that track in `content.json`, then run `npm run encrypt`. A "Play a bit" button appears, and the background score fades down while it plays. Keep excerpts short (under 30 seconds) because the files are publicly downloadable, even though they are encrypted.

## Project structure

```
index.html                 the shell and the date gate
src/config.ts              public settings: gate wording, sound volume (no private data)
src/main.ts                builds every chapter
src/vault.ts               in-browser decryption, lazy media loading
src/sky.ts / binary.ts     the night sky and the two orbiting stars
src/score.ts               the generative music
src/viewer.ts              the memory viewer
src/finale.ts              the finale sequence
src/style.css              all styling
public/vault/              encrypted content + media (safe to publish)
scripts/encrypt.mjs        turns the PRIVATE folder into public/vault
.github/workflows/deploy.yml   builds and publishes to GitHub Pages on every push
```

Built with Vite and TypeScript. The only runtime dependencies are three self-hosted fonts:
Instrument Serif, Instrument Sans and Pinyon Script (all SIL Open Font License).
