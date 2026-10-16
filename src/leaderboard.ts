// 排行榜: interface so an online backend can be plugged in later (implement Leaderboard and swap `board`)
export interface Entry { name: string; score: number; time?: number; grade?: string; date: number }
export interface Leaderboard {
  top(board: string, n?: number): Promise<Entry[]>;
  submit(board: string, e: Entry): Promise<number>; // returns 1-based rank or 0 if not in top
  qualifies(board: string, score: number): Promise<boolean>;
}
const KEY = 'invert.lb.';
export class LocalLeaderboard implements Leaderboard {
  constructor(private max = 10) {}
  private load(b: string): Entry[] { try { return JSON.parse(localStorage.getItem(KEY + b) ?? '[]'); } catch { return []; } }
  async top(b: string, n = this.max) { return this.load(b).slice(0, n); }
  async qualifies(b: string, score: number) { const l = this.load(b); return score > 0 && (l.length < this.max || score > l[l.length - 1].score); }
  async submit(b: string, e: Entry) {
    const l = this.load(b); l.push(e); l.sort((x, y) => y.score - x.score || (x.time ?? 0) - (y.time ?? 0)); const r = l.indexOf(e) + 1;
    localStorage.setItem(KEY + b, JSON.stringify(l.slice(0, this.max))); return r <= this.max ? r : 0;
  }
  boards(): string[] { return Object.keys(localStorage).filter(k => k.startsWith(KEY)).map(k => k.slice(KEY.length)); }
}
export const board: Leaderboard & { boards?: () => string[] } = new LocalLeaderboard();
export const lastName = () => localStorage.getItem('invert.name') ?? '';
export const saveName = (n: string) => localStorage.setItem('invert.name', n);
