// frame-time p50/p95/max + hitch on first thrust, measured by an in-page rAF probe (works on old & new builds)
import { chromium, devices } from 'playwright';
const url = process.argv[2] || 'http://localhost:5180/'; const mobile = process.argv[3] === 'm'; const q = process.argv[4] || '';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = mobile ? await b.newContext({ ...devices['iPhone 13 landscape'] }) : await b.newContext({ viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
const t0 = Date.now();
await p.goto(url + `?level=1&play=1&notut${q ? '&q=' + encodeURIComponent(q) : ''}`);
await p.waitForFunction(() => window.__game?.modelLoaded?.(), null, { timeout: 180000 });
const loadS = (Date.now() - t0) / 1000;
await p.evaluate(() => { window.__ft = []; let l = performance.now(); const f = () => { const n = performance.now(); window.__ft.push(n - l); l = n; requestAnimationFrame(f); }; requestAnimationFrame(f); });
await p.keyboard.down('KeyW'); await p.waitForTimeout(5000);
const mark = await p.evaluate(() => window.__ft.length); await p.keyboard.down('Space'); await p.waitForTimeout(2500); await p.keyboard.up('Space'); await p.keyboard.up('KeyW');
await p.waitForTimeout(1500);
const r = await p.evaluate(m => { const a = window.__ft.slice(5); const s = [...a].sort((x, y) => x - y); const q = f => +s[Math.min(s.length - 1, Math.floor(s.length * f))].toFixed(1); const th = window.__ft.slice(m, m + 6); return { frames: a.length, p50: q(.5), p95: q(.95), max: q(1), thrustHitch: +Math.max(...th).toFixed(1), stats: window.__game.stats?.() }; }, mark);
console.log(mobile ? 'MOBILE' : 'DESKTOP', JSON.stringify({ loadS, ...r }), 'errs', errs.slice(0, 2));
await b.close();
