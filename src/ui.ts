import { loadProgress, unlocked, saveQuality, type QName, QUALITIES } from './quality';
// DOM menus (all Chinese): main menu, level select, settings, result panel
const css = `
.ui{position:fixed;inset:0;z-index:20;display:none;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(10,14,30,.78),rgba(5,7,13,.94));font-family:"Microsoft YaHei","PingFang SC",sans-serif;color:#e8f4ff;user-select:none;-webkit-user-select:none}
.ui.show{display:flex}.ui .box{display:flex;flex-direction:column;align-items:center;gap:14px;max-width:92vw;max-height:92vh;overflow:auto;padding:10px}
.ui h1{margin:0;font-size:clamp(34px,7vw,64px);letter-spacing:6px;text-shadow:0 0 24px #ff3a4a}.ui h1 small{display:block;font-size:.32em;letter-spacing:10px;color:#9ab;text-align:center}
.ui h2{margin:0;font-size:clamp(20px,4vw,30px)}
.ui button{font:inherit;font-size:clamp(15px,2.6vw,19px);color:#e8f4ff;background:rgba(232,244,255,.08);border:2px solid rgba(232,244,255,.45);border-radius:12px;padding:10px 26px;min-width:180px;cursor:pointer;touch-action:manipulation}
.ui button:hover,.ui button:active{background:rgba(255,194,58,.25);border-color:#ffc23a}.ui button.sel{background:rgba(255,194,58,.35);border-color:#ffc23a}.ui button:disabled{opacity:.35}
.ui .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;width:min(860px,90vw)}
.ui .card{background:rgba(232,244,255,.07);border:2px solid rgba(232,244,255,.3);border-radius:14px;padding:12px;text-align:left;min-width:0}
.ui .card b{display:block;font-size:17px}.ui .card .st{color:#ffc23a;font-size:20px;letter-spacing:2px}.ui .card p{margin:4px 0 0;font-size:12px;color:#aab;line-height:1.35}
.ui .card.locked{opacity:.4}.ui .row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.ui .grade{font-size:clamp(60px,12vw,110px);font-weight:900;line-height:1;text-shadow:0 0 30px currentColor}
.ui table{border-collapse:collapse;font-size:clamp(13px,2.2vw,16px)}.ui td{padding:2px 10px}.ui td:last-child{text-align:right;color:#ffc23a}
.ui .stars{font-size:clamp(30px,6vw,44px);color:#ffc23a;letter-spacing:8px}.ui .sl{font-size:13px;color:#ccd;text-align:left}
#menuBtn{position:fixed;left:14px;top:150px;z-index:6;font:13px "Microsoft YaHei",sans-serif;color:#e8f4ff;background:rgba(10,14,24,.5);border:1px solid rgba(232,244,255,.4);border-radius:8px;padding:3px 12px;cursor:pointer}`;
export interface LevelInfo { id: number; name: string; desc: string; stars: string[] }
export class UI {
  root = document.createElement('div'); open = false;
  constructor(private levels: LevelInfo[], private cur: number, private quality: QName, private go: (lvl: number) => void, private onClose: () => void) {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    this.root.className = 'ui'; document.body.appendChild(this.root);
    const mb = document.createElement('button'); mb.id = 'menuBtn'; mb.textContent = '菜单'; mb.onclick = () => this.main(); document.body.appendChild(mb);
    addEventListener('keydown', e => { if (e.code === 'Escape') this.open ? this.close() : this.main(); });
  }
  private show(html: string) { this.root.innerHTML = `<div class="box">${html}</div>`; this.root.classList.add('show'); this.open = true; }
  close() { this.root.classList.remove('show'); this.open = false; this.onClose(); }
  private bind(id: string, f: () => void) { const e = this.root.querySelector<HTMLElement>('#' + id); if (e) e.onclick = f; }
  main() {
    this.show(`<h1>倒悬极速<small>INVERT</small></h1><button id="b1">开始游戏</button><button id="b2">选择关卡</button><button id="b3">设置</button>`);
    this.bind('b1', () => this.cur ? this.close() : this.go(1)); this.bind('b2', () => this.select()); this.bind('b3', () => this.settings());
  }
  select() {
    const p = loadProgress();
    const cards = this.levels.map(l => { const s = p[l.id] ?? 0, u = unlocked(l.id); return `<div class="card ${u ? '' : 'locked'}" data-l="${l.id}"><b>${l.id}. ${l.name}</b><span class="st">${'★'.repeat(s)}${'☆'.repeat(3 - s)}</span>${u ? '' : ' 🔒'}<p>${l.desc}</p></div>`; }).join('');
    this.show(`<h2>选择关卡</h2><div class="grid">${cards}</div><p class="sl">获得 1 颗星解锁下一关</p><button id="bk">返回</button>`);
    this.root.querySelectorAll<HTMLElement>('.card').forEach(c => c.onclick = () => { const id = +c.dataset.l!; if (unlocked(id)) id === this.cur ? this.close() : this.go(id); });
    this.bind('bk', () => this.main());
  }
  settings() {
    const qs = (Object.keys(QUALITIES) as QName[]).map(q => `<button class="${q === this.quality ? 'sel' : ''}" data-q="${q}">${q}</button>`).join('');
    this.show(`<h2>设置 · 画质</h2><div class="row">${qs}</div><p class="sl">极高：实时阴影 + 环境光遮蔽 + 高清车模；画面卡顿时会自动降级。切换后重新加载。</p><button id="bk">返回</button>`);
    this.root.querySelectorAll<HTMLElement>('[data-q]').forEach(b => b.onclick = () => { saveQuality(b.dataset.q as QName); location.reload(); });
    this.bind('bk', () => this.main());
  }
  result(r: { grade: string; ok: boolean; title: string; rows: [string, string][]; total: number; stars: boolean[]; labels: string[]; next: boolean }, act: { retry: () => void; next: () => void; replay: () => void }) {
    const gc = { S: '#ffd23f', A: '#3dffa0', B: '#6fc9d8', C: '#aab' } as any;
    this.show(`<h2>${r.title}</h2>${r.grade ? `<div class="grade" style="color:${gc[r.grade] ?? '#fff'}">${r.grade}</div>` : ''}
      <table>${r.rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}<tr><td><b>总分</b></td><td><b>${r.total}</b></td></tr></table>
      <div class="stars">${r.stars.map(s => s ? '★' : '☆').join('')}</div><div class="sl">${r.labels.map((l, i) => `${r.stars[i] ? '★' : '☆'} ${l}`).join('<br>')}</div>
      <div class="row"><button id="rt">再来一次</button><button id="nx" ${r.next ? '' : 'disabled'}>下一关</button><button id="rp">回放</button><button id="ls">关卡</button></div>`);
    this.bind('rt', () => { this.close(); act.retry(); }); this.bind('nx', act.next); this.bind('rp', () => { this.root.classList.remove('show'); this.open = false; act.replay(); }); this.bind('ls', () => this.select());
  }
}
