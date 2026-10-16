// 连招系统: tricks chained within one run; multiplier grows per chained trick; named combos give bonus + big popup
export const MULTS = [1, 1.5, 2, 3, 4, 5];
export interface Chain { tricks: string[]; mult: number; pts: number; named: string[] }
const NAMED: { seq: string[]; name: string; bonus: number }[] = [
  { seq: ['倒挂', '空翻'], name: '倒挂后空翻', bonus: 1500 },
  { seq: ['空翻', '空翻'], name: '双重空翻', bonus: 2000 },
  { seq: ['侧翻', '完美落地'], name: '螺旋落地', bonus: 2500 },
  { seq: ['悬崖飞跃', '反推'], name: '喷气缓降', bonus: 2000 },
  { seq: ['反推', '落点精准'], name: '精准着陆', bonus: 2500 },
  { seq: ['穿环', '穿环', '穿环'], name: '连环穿梭', bonus: 1500 },
  { seq: ['贴墙', '擦边'], name: '城市漂移', bonus: 1500 },
  { seq: ['悬停', '悬停'], name: '空中芭蕾', bonus: 1500 },
];
export class Combo {
  chain: string[] = []; pts = 0; named: string[] = []; banked: Chain[] = []; idleT = 0; flair = 0; lastNamed = '';
  constructor(private add: (p: number) => void, private msg: (t: string, big?: boolean) => void) {}
  get mult() { return MULTS[Math.min(Math.max(0, this.chain.length - 1), MULTS.length - 1)]; }
  trick(name: string, base: number) {
    this.chain.push(name); const p = Math.round(base * this.mult); this.pts += p; this.add(p); this.idleT = 0;
    this.msg(`${name} +${p}  x${this.mult}`);
    for (const n of NAMED) {
      const k = n.seq.length; if (this.chain.length < k) continue;
      if (n.seq.every((s, i) => this.chain[this.chain.length - k + i] === s)) { this.add(n.bonus); this.pts += n.bonus; this.named.push(n.name); this.lastNamed = n.name; this.flair = 2.2; this.msg(`★ ${n.name} ★ +${n.bonus}`, true); }
    }
  }
  bank() { if (this.chain.length) this.banked.push({ tricks: [...this.chain], mult: this.mult, pts: this.pts, named: [...this.named] }); this.chain = []; this.pts = 0; this.named = []; this.idleT = 0; }
  break(why: string) { if (this.chain.length) { this.msg(`连招中断：${why}`); this.bank(); } }
  update(dt: number, grounded: boolean, fast = false) { this.flair = Math.max(0, this.flair - dt); if (grounded && this.chain.length) { this.idleT += fast ? dt * 0.4 : dt; if (this.idleT > 2) this.bank(); } else this.idleT = 0; }
  reset() { this.chain = []; this.pts = 0; this.named = []; this.banked = []; this.idleT = 0; this.flair = 0; }
  all(): Chain[] { return this.chain.length ? [...this.banked, { tricks: [...this.chain], mult: this.mult, pts: this.pts, named: [...this.named] }] : this.banked; }
}
