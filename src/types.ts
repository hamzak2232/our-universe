export type MediaRef = string; // "m:<id>:<mime>"

export interface MediaItem { file: MediaRef; poster?: MediaRef; alt: string }
export interface Memory { title: string; caption: string; flipHint?: string; media: MediaItem[] }
export interface Track { title: string; artist: string; excerpt?: MediaRef }

export interface Content {
  her: { name: string; nickname: string };
  together: { since: string; sinceLabel: string; sinceLine: string; photo: MediaRef; photoAlt: string };
  opening: { hello: string; line: string; sub: string };
  constellation: { title: string; hint: string; complete: string };
  memories: Memory[];
  menu: { title: string; subtitle: string; items: { name: string; note: string }[]; button: string; punchline: string; after: string };
  letter: { greeting: string; paragraphs: string[]; closing: string; photo: MediaRef; photoAlt: string };
  mixtape: { title: string; intro: string; scoreNote: string; tracks: Track[] };
  finale: { kicker: string; button: string; montage: MediaRef; poster: MediaRef; lines: string[] };
}
