export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
