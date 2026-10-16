import { board, lastName, saveName, type Entry } from './leaderboard';
import { shanghaiDate } from './daily';
import { setMenuOpen } from './touch';
import { loadProgress, unlocked, saveQuality, type QName, QUALITIES } from './quality';
// DOM menus (all Chinese): main menu, level select, settings, result panel
const css = `
.ui{position:fixed;inset:0;z-index:20;display:none;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(10,14,30,.78),rgba(5,7,13,.94));font-family:"Microsoft YaHei","PingFang SC",sans-serif;color:#e8f4ff;user-select:none;-webkit-user-select:none}
.ui.show{display:flex}.ui .box{display:flex;flex-direction:column;align-items:center;gap:14px;max-width:92vw;max-height:92vh;overflow:auto;padding:10px}
.ui h1{margin:0;font-size:clamp(34px,7vw,64px);letter-spacing:6px;text-shadow:0 0 24px #ff3a4a}.ui h1 small{display:block;font-size:.32em;letter-spacing:10px;color:#9ab;text-align:center}
.ui h2{margin:0;font-size:clamp(20px,4vw,30px)}
.ui button{font:inherit;font-size:clamp(15px,2.6vw,19px);color:#e8f4ff;background:rgba(232,244,255,.08);border:2px solid rgba(232,244,255,.45);border-radius:12px;padding:10px 26px;min-width:180px;cursor:pointer;touch-action:manipulation}
.ui button:hover,.ui button:active{background:rgba(255,194,58,.25);border-color:#ffc23a}.ui button.sel{background:rgba(255,194,58,.35);border-color:#ffc23a}.ui button:disabled{opacity:.35}
.ui .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;width:min(860px,92vw)}.ui .card{min-height:88px;touch-action:manipulation;-webkit-tap-highlight-color:rgba(255,194,58,.25)}
.ui .card{background:rgba(232,244,255,.07);border:2px solid rgba(232,244,255,.3);border-radius:14px;padding:12px;text-align:left;min-width:0}
.ui .card b{display:block;font-size:17px}.ui .card .st{color:#ffc23a;font-size:20px;letter-spacing:2px}.ui .card p{margin:4px 0 0;font-size:12px;color:#aab;line-height:1.35}
.ui .card.locked{opacity:.4}.ui .row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.ui .grade{font-size:clamp(60px,12vw,110px);font-weight:900;line-height:1;text-shadow:0 0 30px currentColor}
.ui table{border-collapse:collapse;font-size:clamp(13px,2.2vw,16px)}.ui td{padding:2px 10px}.ui td:last-child{text-align:right;color:#ffc23a}
.ui .stars{font-size:clamp(30px,6vw,44px);color:#ffc23a;letter-spacing:8px}.ui .sl{font-size:13px;color:#ccd;text-align:left}
#menuBtn{position:fixed;left:14px;top:150px;z-index:25;touch-action:manipulation;font:13px "Microsoft YaHei",sans-serif;color:#e8f4ff;background:rgba(10,14,24,.5);border:1px solid rgba(232,244,255,.4);border-radius:8px;padding:3px 12px;cursor:pointer}.ui .lb td{padding:2px 12px}.ui .lb tr.me td{color:#3dffa0;font-weight:bold}.ui input{font:inherit;font-size:17px;padding:8px 12px;border-radius:10px;border:2px solid #ffc23a;background:rgba(0,0,0,.4);color:#fff;width:180px;text-align:center}
.ui .tabs{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}.ui .tabs button{min-width:0;padding:6px 12px;font-size:14px}.ui .combo{color:#ff7bd5}.ui .daily{border-color:#ff7bd5}`;
export interface LevelInfo { id: number; name: string; desc: string; stars: string[] }
export class UI {
  root = document.createElement('div'); open = false;
  constructor(private levels: LevelInfo[], private cur: number, private quality: QName, private go: (lvl: number) => void, private onClose: () => void, private goDaily: () => void = () => {}, private assist = { get: () => false, set: (_: boolean) => {} }) {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    this.root.className = 'ui'; document.body.appendChild(this.root);
    const mb = document.createElement('button'); mb.id = 'menuBtn'; mb.textContent = '菜单'; mb.onclick = () => this.main(); document.body.appendChild(mb);
    addEventListener('keydown', e => { if (e.code === 'Escape') this.open ? this.close() : this.main(); });
  }
  private show(html: string) { this.root.innerHTML = `<div class="box">${html}</div>`; this.root.classList.add('show'); this.open = true; setMenuOpen(true); }
  close() { this.root.classList.remove('show'); this.open = false; setMenuOpen(false); this.onClose(); }
  private bind(id: string, f: () => void) { const e = this.root.querySelector<HTMLElement>('#' + id); if (!e) return; let lock = 0; const run = (ev: Event) => { if (Date.now() < lock) { ev.preventDefault(); return; } lock = Date.now() + 400; ev.preventDefault(); f(); }; e.addEventListener('pointerup', run); e.onclick = run; }
  main() {
    this.show(`<h1>倒悬极速<small>INVERT</small></h1><button id="b1">开始游戏</button><button id="b2">选择关卡</button><button id="b4" class="daily">每日挑战 · ${shanghaiDate().slice(4, 6)}/${shanghaiDate().slice(6)}</button><button id="b5">排行榜</button><button id="b6">操作说明</button><button id="b3">设置</button>`);
    this.bind('b6', () => this.help());
    this.bind('b4', () => this.goDaily()); this.bind('b5', () => this.leaderboard());
    this.bind('b1', () => this.cur ? this.close() : this.go(1)); this.bind('b2', () => this.select()); this.bind('b3', () => this.settings());
  }
  select() {
    const p = loadProgress();
    const cards = this.levels.map(l => { const s = p[l.id] ?? 0, u = unlocked(l.id); return `<div class="card ${u ? '' : 'locked'}" data-l="${l.id}"><b>${l.id}. ${l.name}</b><span class="st">${'★'.repeat(s)}${'☆'.repeat(3 - s)}</span>${u ? '' : ' 🔒'}<p>${l.desc}</p></div>`; }).join('');
    this.show(`<h2>选择关卡</h2><div class="grid">${cards}</div><p class="sl">获得 1 颗星解锁下一关</p><button id="bk">返回</button>`);
    this.root.querySelectorAll<HTMLElement>('.card').forEach(c => { let lock = 0; const go = (ev: Event) => { if (Date.now() < lock) { ev.preventDefault(); return; } lock = Date.now() + 400; ev.preventDefault(); const id = +c.dataset.l!; if (!unlocked(id)) return; id === this.cur ? this.close() : this.go(id); }; c.addEventListener('pointerup', go); c.onclick = go; });
    this.bind('bk', () => this.main());
  }
  settings() {
    const qs = (Object.keys(QUALITIES) as QName[]).map(q => `<button class="${q === this.quality ? 'sel' : ''}" data-q="${q}">${q}</button>`).join('');
    this.show(`<h2>设置 · 画质</h2><div class="row">${qs}</div><p class="sl">默认自动选择（电脑 高 / 手机 中+）。极高：实时阴影 + 环境光遮蔽 + 高清车模。卡顿时会自动降级。切换后重新加载。</p><button id="qa">恢复自动</button>
      <h2>操作提示</h2><div class="row"><button id="hn1" class="${localStorage.getItem('invert.hints') !== '0' ? 'sel' : ''}">开</button><button id="hn0" class="${localStorage.getItem('invert.hints') === '0' ? 'sel' : ''}">关</button></div><p class="sl">关键时刻在屏幕中央显示按键提示（手机上对应按钮会发光）。重新加载后生效。</p>
      <h2>喷气缓降辅助</h2><div class="row"><button id="as1" class="${this.assist.get() ? 'sel' : ''}">开</button><button id="as0" class="${this.assist.get() ? '' : 'sel'}">关</button></div><p class="sl">开启后下落接近地面时自动反推（G 键切换）。</p><button id="bk">返回</button>`);
    this.bind('qa', () => { localStorage.removeItem('invert.quality'); localStorage.removeItem('invert.qauto'); location.reload(); });
    this.bind('hn1', () => { localStorage.setItem('invert.hints', '1'); this.settings(); }); this.bind('hn0', () => { localStorage.setItem('invert.hints', '0'); this.settings(); });
    this.bind('as1', () => { this.assist.set(true); this.settings(); }); this.bind('as0', () => { this.assist.set(false); this.settings(); });
    this.root.querySelectorAll<HTMLElement>('[data-q]').forEach(b => { const f = () => { saveQuality(b.dataset.q as QName); location.reload(); }; b.onclick = f; b.addEventListener('pointerup', e => { e.preventDefault(); f(); }); });
    this.bind('bk', () => this.main());
  }
  help() {
    const rows: [string, string, string][] = [['加速 / 刹车', 'W / S', '摇杆 上 / 下'], ['转向', 'A / D', '摇杆 左 / 右'], ['吸地（贴紧弯道、倒挂）', 'Shift', '吸地 ⤓'], ['推进器 / 喷气缓降', '空格', '推进 ▲'], ['喷射加速', 'F', '喷射 »'], ['空中姿态：空翻 / 侧翻', '方向键 / Q E', '空中推摇杆'], ['切换镜头 / 稳定 / 重来', 'C / T / R', '镜头 / 稳定 / 重置'], ['喷气缓降辅助', 'G', '设置中开关'], ['菜单 / 暂停', 'Esc', '左上「菜单」']];
    this.show(`<h2>操作说明</h2><table><tr><td><b>动作</b></td><td><b>键盘</b></td><td><b>手机</b></td></tr>${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</table>
      <p class="sl">技巧：冲上弯道时按住吸地；下落进入雷达绿色区时按住推进喷气缓降，竖直速度 &lt; 2 m/s 落地得 S。</p><div class="row">${this.cur ? '<button id="hc">继续游戏</button>' : ''}<button id="bk">返回</button></div>`);
    this.bind('bk', () => this.main()); this.bind('hc', () => this.close());
  }
  async lbTable(b: string, me?: Entry) {
    const l = await board.top(b, 10); if (!l.length) return '<p class="sl">还没有记录，来创造第一个吧！</p>';
    return `<table class="lb"><tr><td>#</td><td>名字</td><td>得分</td></tr>${l.map((e, i) => `<tr class="${me && e.date === me.date && e.name === me.name ? 'me' : ''}"><td>${i + 1}</td><td>${esc(e.name)}${e.grade ? ' · ' + e.grade : ''}</td><td>${e.score}</td></tr>`).join('')}</table>`;
  }
  async leaderboard(sel?: string) {
    const daily = 'daily-' + shanghaiDate(); const tabs = [[daily, '今日挑战'], ...this.levels.map(l => ['L' + l.id, `${l.id}. ${l.name}`])];
    const cur = sel ?? (this.cur ? 'L' + this.cur : daily);
    this.show(`<h2>排行榜 · 本机</h2><div class="tabs">${tabs.map(([k, n]) => `<button data-b="${k}" class="${k === cur ? 'sel' : ''}">${n}</button>`).join('')}</div>${await this.lbTable(cur)}<button id="bk">返回</button>`);
    this.root.querySelectorAll<HTMLElement>('[data-b]').forEach(b => { const f = () => this.leaderboard(b.dataset.b); b.onclick = f; b.addEventListener('pointerup', e => { e.preventDefault(); f(); }); }); this.bind('bk', () => this.main());
  }
  result(r: { grade: string; ok: boolean; title: string; rows: [string, string][]; total: number; stars: boolean[]; labels: string[]; next: boolean; combos?: [string, string][]; board?: string; runT?: number }, act: { retry: () => void; next: () => void; replay: () => void }) {
    const gc = { S: '#ffd23f', A: '#3dffa0', B: '#6fc9d8', C: '#aab' } as any;
    this.show(`<h2>${r.title}</h2>${r.grade ? `<div class="grade" style="color:${gc[r.grade] ?? '#fff'}">${r.grade}</div>` : ''}
      <table>${r.rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}<tr><td><b>总分</b></td><td><b>${r.total}</b></td></tr></table>
      <div class="stars">${r.stars.map(s => s ? '★' : '☆').join('')}</div><div class="sl">${r.labels.map((l, i) => `${r.stars[i] ? '★' : '☆'} ${l}`).join('<br>')}</div>
      ${r.combos?.length ? `<table class="combo">${r.combos.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>` : ''}
      <div id="lbx"></div>
      <div class="row"><button id="rt">再来一次</button><button id="nx" ${r.next ? '' : 'disabled'}>下一关</button><button id="rp">回放</button><button id="ls">关卡</button></div>`);
    this.bind('rt', () => { this.close(); act.retry(); }); this.bind('nx', act.next); this.bind('rp', () => { this.root.classList.remove('show'); this.open = false; act.replay(); }); this.bind('ls', () => this.select());
    if (r.board) this.resultBoard(r);
  }
  private async resultBoard(r: { board?: string; total: number; runT?: number; grade: string }) {
    const box = this.root.querySelector<HTMLElement>('#lbx'); if (!box || !r.board) return; const b = r.board;
    const showTop = async (me?: Entry) => { box.innerHTML = `<b>排行榜 Top 10</b>${await this.lbTable(b, me)}`; };
    if (await board.qualifies(b, r.total)) {
      box.innerHTML = `<div class="row"><b style="color:#3dffa0">新纪录！进入前十</b><input id="nm" maxlength="12" placeholder="输入名字" value="${esc(lastName())}"><button id="sv">保存</button></div>`;
      const sv = async () => { const name = (box.querySelector<HTMLInputElement>('#nm')!.value.trim() || '玩家').slice(0, 12); saveName(name); const e: Entry = { name, score: r.total, time: r.runT, grade: r.grade, date: Date.now() }; await board.submit(b, e); showTop(e); };
      box.querySelector<HTMLElement>('#sv')!.onclick = sv; box.querySelector<HTMLInputElement>('#nm')!.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') sv(); };
    } else showTop();
  }
}

const esc = (t: string) => t.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
