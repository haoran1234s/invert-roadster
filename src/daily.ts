import type { LevelData } from './level';
// 每日挑战: deterministic level from the Asia/Shanghai date. Built only from verified-completable modules (same geometry ranges
// as the scripted-tested levels), plus one daily modifier. 1★ is always "complete the module" (safe landing / finish).
export function shanghaiDate(d = new Date()): string { const t = new Date(d.getTime() + 8 * 3600e3); return t.toISOString().slice(0, 10).replace(/-/g, ''); }
function rng(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const MODS = { lowG: '低重力', doubleThrust: '双倍推进', oneBoost: '只能一次喷射' } as const;
export type ModKey = keyof typeof MODS;
const PAL = [
  { sky: [0x0d1d45, 0x3b3f78, 0xd9785a], fog: [0x4a4470, 250, 1200], ground: 'grid' },
  { sky: [0x2a5fa8, 0x8fb6e0, 0xf2c58a], fog: [0xe2c398, 300, 1500], ground: 'sand', stars: false },
  { sky: [0x1c3d7a, 0x6f8fc0, 0xf0a070], fog: [0xc08a6a, 350, 1600], ground: 'rock', stars: false },
  { sky: [0x05060e, 0x141a33, 0x3a2a55], fog: [0x1a1d30, 150, 900], ground: 'asphalt' },
];
const cp = (z = 230) => ({ pos: [0, 1.2, z], yawDeg: 0, z: 999 });
export function dailyLevel(date = shanghaiDate()): LevelData {
  const r = rng(+date * 2654435761 % 2 ** 31); const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length) % a.length];
  const tpl = pick(['loop', 'kicker', 'rings'] as const); const mod = pick(Object.keys(MODS) as ModKey[]); const env = pick(PAL) as any;
  const base: any = { id: 'D' + date, name: `每日挑战 ${date.slice(4, 6)}/${date.slice(6)}`, daily: true, board: 'daily-' + date, mods: [mod], start: { pos: [0, 1.2, 230], yawDeg: 0 }, checkpoints: [cp()], env, scenery: false };
  if (mod === 'lowG') base.gravity = 0.6; if (mod === 'oneBoost') base.boostOnce = true; if (mod === 'doubleThrust') base.thrustMult = 2;
  const modTxt = `今日规则：${MODS[mod]}`;
  base.tpl = tpl;
  if (tpl === 'loop') {
    const radius = 46 + Math.round(r() * 6), endDeg = 168 + Math.round(r() * 6), zz = 170 + Math.round(r() * 30);
    Object.assign(base, { desc: `巨型弯道倒挂 + 落地区。${modTxt}`, hint: `全油门冲上弯道倒挂，安全落地 · ${modTxt}`, runway: { length: 520, width: 22, zStart: 260, lightSpacing: 8 }, ramps: [{ z0: 0, radius, width: 18, endDeg, segments: 130 }], zones: [{ x: 0, z: zz, w: 44, l: 120, label: '落地区' }], maxAir: 12,
      stars: [{ label: '倒挂后安全落地', all: [{ t: 'safeLand' }] }, { label: '落在落地区', all: [{ t: 'zone' }] }, { label: '得分 ≥ 8000', all: [{ t: 'safeLand' }, { t: 'score', v: 8000 }] }] });
  } else if (tpl === 'kicker') {
    const endDeg = 22 + Math.round(r() * 8), zz = -230 - Math.round(r() * 60);
    Object.assign(base, { desc: `跳台飞跃 + 空翻。${modTxt}`, hint: `全油门冲上跳台，空翻后安全落地 · ${modTxt}`, runway: { length: 760, width: 22, zStart: 260, lightSpacing: 10 }, ramps: [{ z0: 0, radius: 42, width: 18, endDeg, segments: 28 }], zones: [{ x: 0, z: zz, w: 50, l: 220, label: '落地区' }], maxAir: 16,
      stars: [{ label: '飞跃后安全落地', all: [{ t: 'safeLand' }] }, { label: '空翻 1 次并安全落地', all: [{ t: 'safeLand' }, { t: 'flips', v: 1 }] }, { label: '得分 ≥ 9000', all: [{ t: 'safeLand' }, { t: 'score', v: 9000 }] }] });
  } else {
    const n = 3 + Math.floor(r() * 3); const rings = Array.from({ length: n }, (_, i) => ({ pos: [0, 2.6, 150 - i * 70], r: 5, type: 'boost' }));
    Object.assign(base, { desc: `加速环冲刺。${modTxt}`, hint: `全油门穿过加速环冲过终点 · ${modTxt}`, runway: { length: 600, width: 22, zStart: 260, lightSpacing: 8 }, ramps: [], rings, finishZ: 150 - n * 70 - 20, timeLimit: 16,
      stars: [{ label: '16 秒内冲过终点', all: [{ t: 'finish' }] }, { label: '穿过全部加速环', all: [{ t: 'finish' }, { t: 'ringsAll' }] }, { label: `${8 + n * 0.5} 秒内完成`, all: [{ t: 'finish' }, { t: 'time', v: 8 + n * 0.5 }] }] });
  }
  return base as LevelData;
}
