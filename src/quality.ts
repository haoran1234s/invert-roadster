export type QName = '极高' | '高' | '中';
export interface Quality { name: QName; dpr: number; shadow: number; gtao: boolean; bloom: boolean; msaa: number; carLod: 'hi' | 'mid'; particles: number }
export const QUALITIES: Record<QName, Quality> = {
  '极高': { name: '极高', dpr: 2, shadow: 2048, gtao: true, bloom: true, msaa: 4, carLod: 'hi', particles: 1 },
  '高': { name: '高', dpr: 1.5, shadow: 1024, gtao: false, bloom: true, msaa: 2, carLod: 'hi', particles: 0.8 },
  '中': { name: '中', dpr: 1, shadow: 0, gtao: false, bloom: false, msaa: 0, carLod: 'mid', particles: 0.5 },
};
const KEY = 'invert.quality';
export function loadQuality(q?: string | null): Quality { const n = (q || localStorage.getItem(KEY) || '极高') as QName; return { ...(QUALITIES[n] ?? QUALITIES['极高']) }; }
export function saveQuality(n: QName) { localStorage.setItem(KEY, n); }
// progress: best stars per level
const PKEY = 'invert.progress';
export function loadProgress(): Record<string, number> { try { return JSON.parse(localStorage.getItem(PKEY) || '{}'); } catch { return {}; } }
export function saveStars(level: number, stars: number) { const p = loadProgress(); if ((p[level] ?? 0) < stars) { p[level] = stars; localStorage.setItem(PKEY, JSON.stringify(p)); } }
export function unlocked(level: number) { return level === 1 || (loadProgress()[level - 1] ?? 0) >= 1; }
