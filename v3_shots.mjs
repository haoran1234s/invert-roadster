import { chromium, devices } from 'playwright';
const base = process.argv[2] || 'http://localhost:5180/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = []; const only = process.env.ONLY;
const D = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');
async function page(mobile) {
  const ctx = mobile ? await b.newContext({ ...devices['iPhone 13 landscape'] }) : await b.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(d => { localStorage.setItem('invert.progress', JSON.stringify({ 1: 3, 2: 3, 3: 3, 4: 2, 5: 2, 6: 3, 7: 3, 8: 3 }));
    const e = (n, s) => ({ name: n, score: s, date: s }); localStorage.setItem('invert.lb.daily-' + d, JSON.stringify([e('阿然', 15210), e('Kai', 12040), e('小飞', 9980), e('Mia', 7300)]));
    localStorage.setItem('invert.lb.L7', JSON.stringify([e('阿然', 26590), e('Rex', 21000), e('小飞', 18311)])); }, D);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); return p;
}
const wait = p => p.waitForFunction(() => window.__game?.modelLoaded?.(), null, { timeout: 180000 });
const shot = (p, n) => p.screenshot({ path: `../shots/${n}.png` });
const sim = (p, s, c) => p.evaluate(([s, c]) => { window.__game.sim(s, c); return window.__game.state(); }, [s, c]);
if (!only || only === 'menu') for (const mobile of [false, true]) {
  const pre = mobile ? 'v3_mobile_' : 'v3_';
  const p = await page(mobile); await p.goto(base + '?noadapt'); await wait(p); await p.waitForTimeout(600);
  await shot(p, pre + 'menu'); await p.click('#b5'); await p.waitForTimeout(400); await shot(p, pre + 'leaderboard');
  await p.click('[data-b="L7"]'); await p.waitForTimeout(300); await shot(p, pre + 'leaderboard_L7'); await p.close();
}
if (!only || only === 'levels') for (const lv of [6, 7, 8]) {
  const p = await page(false); await p.goto(`${base}?level=${lv}&play=1&noadapt`); await wait(p);
  await sim(p, lv === 7 ? 2 : 3, { throttle: 1 }); await p.waitForTimeout(700); await shot(p, `v3_L${lv}`); await p.close();
}
if (!only || only === 'cliff') {
  const p = await page(false); await p.goto(`${base}?level=7&play=1&noadapt`); await wait(p);
  let s = await sim(p, 0.1, {}); let n = 0; const taken = {};
  while (s.st === 'play' && n++ < 800) {
    const c = s.grounded ? (s.speed > 46 ? { brake: 0.5 } : { throttle: 1 }) : { thrust: s.up[1] > 0.7 && s.vy < -1.5 && s.alt < (s.vy * s.vy) / 31 * 1.15 + 2.5 };
    s = await sim(p, 0.05, c);
    const k = !s.grounded && s.pos[2] < -5 && !taken.edge ? 'edge' : s.retro && s.alt < 45 && !taken.burn ? 'burn' : s.retro && s.alt < 8 && !taken.touch ? 'touch' : null;
    if (k) { taken[k] = 1; await p.evaluate(() => window.__game.setCam(0)); await p.waitForTimeout(500); await shot(p, `v3_cliff_${k}`); if (k === 'edge') { await p.evaluate(() => window.__game.setCam(1)); await p.waitForTimeout(300); await shot(p, 'v3_cliff_edge_wide'); await p.evaluate(() => window.__game.setCam(0)); } }
  }
  for (let i = 0; i < 20 && (await sim(p, 0.5, {})).st !== 'result'; i++); await sim(p, 2.1, {}); await p.waitForTimeout(800); await shot(p, 'v3_cliff_result');
  await p.fill('#nm', '阿然'); await p.click('#sv'); await p.waitForTimeout(400); await shot(p, 'v3_leaderboard_entry');
  await p.evaluate(() => document.querySelector('#rp').click()); for (let i = 0; i < 200; i++) { await p.waitForTimeout(400); if (await p.evaluate(() => window.__game.state().pos[1] < 95 && window.__game.state().pos[2] < 0)) break; }
  await shot(p, 'v3_cliff_replay_cam'); await p.close();
}
if (!only || only === 'combo') { // named combo popup (倒挂后空翻) on L1
  const p = await page(false); await p.goto(`${base}?level=1&play=1&noadapt`); await wait(p);
  let s = await sim(p, 0.1, {}); let n = 0;
  while (n++ < 600) { const c = s.grounded ? (s.normal[1] < -0.1 ? { fan: true } : { throttle: 1, fan: s.normal[1] < 0.95 }) : { pitch: 1 }; s = await sim(p, 0.05, c); if (s.combo.all.some(ch => ch.named.length)) break; }
  await sim(p, 0.3, { pitch: 1 }); await p.waitForTimeout(500); await shot(p, 'v3_combo_popup'); await p.close();
  const q = await page(false); await q.goto(`${base}?level=8&play=1&noadapt`); await q.waitForFunction(() => window.__game?.modelLoaded?.(), null, { timeout: 180000 });
  s = await sim(q, 0.1, {}); n = 0;
  while (s.st === 'play' && n++ < 600) { const tx = s.pos[2] < 200 && s.pos[2] > 60 ? 17 : 0; s = await sim(q, 0.05, { throttle: 1, steer: Math.max(-1, Math.min(1, (tx - s.pos[0]) * 0.06 - s.vx * 0.05)) }); if (s.msgs.some(m => m.includes('城市漂移'))) { await q.waitForTimeout(400); await shot(q, 'v3_combo_city'); break; } if (n === 60) { await q.waitForTimeout(300); await shot(q, 'v3_L8_wallride'); } }
  await q.close();
}
if (!only || only === 'daily') for (const mobile of [false, true]) {
  const p = await page(mobile); await p.goto(`${base}?daily=1&play=1&noadapt`); await wait(p);
  await sim(p, 2.5, { throttle: 1 }); await p.waitForTimeout(600); await shot(p, mobile ? 'v3_mobile_daily' : 'v3_daily'); await p.close();
}
if (!only || only === 'mobile') { const p = await page(true); await p.goto(`${base}?level=7&play=1&noadapt`); await wait(p); await sim(p, 8.3, { throttle: 1 }); await p.waitForTimeout(600); await shot(p, 'v3_mobile_L7_drop'); await p.close(); }
console.log('ERRS', errs); await b.close();
