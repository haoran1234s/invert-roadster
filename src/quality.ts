export type QName = '极高' | '高' | '中+' | '中';
export interface Quality { name: QName; dpr: number; shadow: number; gtao: boolean; bloom: boolean; msaa: number; carLod: 'hi' | 'mid' | 'low'; particles: number; sky: '4k' | '2k'; shadowRange: number }
export const QUALITIES: Record<QName, Quality> = {
  '极高': { name: '极高', dpr: 2, shadow: 2048, gtao: true, bloom: true, msaa: 4, carLod: 'hi', particles: 1, sky: '4k', shadowRange: 40 },
  '高': { name: '高', dpr: 1.5, shadow: 1024, gtao: false, bloom: true, msaa: 2, carLod: 'hi', particles: 0.8, sky: '4k', shadowRange: 30 },
  '中+': { name: '中+', dpr: 1.25, shadow: 1024, gtao: false, bloom: false, msaa: 0, carLod: 'mid', particles: 0.6, sky: '2k', shadowRange: 12 },
  '中': { name: '中', dpr: 1, shadow: 0, gtao: false, bloom: false, msaa: 0, carLod: 'low', particles: 0.4, sky: '2k', shadowRange: 12 },
};
export const ORDER: QName[] = ['极高', '高', '中+', '中'];
const KEY = 'invert.quality', AUTO = 'invert.qauto';
const isPhone = () => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
/** GPU renderer string heuristic */
export function gpuTier(): { renderer: string; low: boolean; high: boolean } {
  let r = '';
  try { const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); const e = gl?.getExtension('WEBGL_debug_renderer_info'); r = String(e ? gl!.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER) ?? ''); (gl?.getExtension('WEBGL_lose_context'))?.loseContext(); } catch {}
  const low = /swiftshader|llvmpipe|software|mali-[gt]?[4-7]\d\b|mali-4|adreno \(tm\) [3-5]\d\d|powervr|intel.*hd graphics [2-5]\d\d\b|sgx/i.test(r);
  const high = /rtx|radeon rx|apple m\d|geforce gtx 1[06-9]|geforce rtx|arc a/i.test(r);
  return { renderer: r, low, high };
}
/** user choice > auto benchmark result > heuristic default (desktop 高, phone 中+, low GPU 中) */
export function loadQuality(q?: string | null): Quality & { auto: boolean } {
  const user = (q || localStorage.getItem(KEY)) as QName | null;
  if (user && QUALITIES[user]) return { ...QUALITIES[user], auto: false };
  const a = localStorage.getItem(AUTO) as QName | null;
  if (a && QUALITIES[a]) return { ...QUALITIES[a], auto: true };
  const g = gpuTier(); const n: QName = g.low ? '中' : isPhone() ? '中+' : '高';
  return { ...QUALITIES[n], auto: true };
}
export function saveQuality(n: QName) { localStorage.setItem(KEY, n); }
export function saveAutoQuality(n: QName) { localStorage.setItem(AUTO, n); }
export function clearUserQuality() { localStorage.removeItem(KEY); }
// progress: best stars per level
const PKEY = 'invert.progress';
export function loadProgress(): Record<string, number> { try { return JSON.parse(localStorage.getItem(PKEY) || '{}'); } catch { return {}; } }
export function saveStars(level: number, stars: number) { const p = loadProgress(); if ((p[level] ?? 0) < stars) { p[level] = stars; localStorage.setItem(PKEY, JSON.stringify(p)); } }
export function unlocked(level: number) { return level === 1 || (loadProgress()[level - 1] ?? 0) >= 1; }
