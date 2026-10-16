import { chromium, devices } from 'playwright';
const base = process.argv[2] || 'http://localhost:5180/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [];
async function page(mobile) {
  const ctx = mobile ? await b.newContext({ ...devices['iPhone 13 landscape'] }) : await b.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => localStorage.setItem('invert.progress', JSON.stringify({ 1: 3, 2: 3, 3: 3, 4: 2, 5: 2 })));
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); return p;
}
const wait = p => p.waitForFunction(() => window.__game?.modelLoaded?.(), null, { timeout: 120000 });
for (const mobile of [false, true]) {
  const pre = mobile ? 'v2_mobile_' : 'v2_';
  const p = await page(mobile); await p.goto(base + '?noadapt'); await wait(p); await p.waitForTimeout(800);
  await p.screenshot({ path: `../shots/${pre}menu.png` });
  await p.click('#b2'); await p.waitForTimeout(400); await p.screenshot({ path: `../shots/${pre}level_select.png` });
  await p.click('#bk'); await p.click('#b3'); await p.waitForTimeout(300); if (!mobile) await p.screenshot({ path: `../shots/v2_settings.png` });
  await p.close();
}
const view = { 1: [3, { throttle: 1 }], 2: [3, { throttle: 1 }], 3: [3, { throttle: 1 }], 4: [1.5, { throttle: 0.5 }], 5: [8.6, { throttle: 1 }] };
for (const lv of [1, 2, 3, 4, 5]) {
  const p = await page(false); await p.goto(`${base}?level=${lv}&play=1&noadapt`); await wait(p);
  await p.evaluate(([s, c]) => window.__game.sim(s, c), view[lv]); if (lv === 4) await p.evaluate(() => { window.__game.sim(1.5, { brake: 1 }); window.__game.sim(1.6, { thrust: true }); });
  await p.waitForTimeout(600); await p.screenshot({ path: `../shots/v2_L${lv}.png` }); await p.close();
}
console.log('ERRS', errs); await b.close();
