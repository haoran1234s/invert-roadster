import { chromium, devices } from 'playwright';
const bases = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function tapEl(p, sel) {
  const box = await p.locator(sel).boundingBox();
  if (!box) throw new Error('no box ' + sel);
  await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}
async function tryBase(base, tag) {
  for (const [name, device] of [['land', devices['iPhone 13 landscape']], ['port', devices['iPhone 13']]]) {
    const ctx = await b.newContext({ ...device, hasTouch: true, isMobile: true });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    const url = base.replace(/\?.*$/, '').replace(/\/?$/, '/') + '?noadapt';
    await p.goto(url); await p.waitForFunction(() => window.__game && document.querySelector('#b2'), null, { timeout: 120000 });
    await p.waitForTimeout(1000);
    await tapEl(p, '#b2'); await p.waitForTimeout(700);
    const cards = await p.evaluate(() => ({ n: document.querySelectorAll('.card').length, l1locked: !!document.querySelector('.card[data-l="1"]')?.classList.contains('locked'), h2: document.querySelector('.ui h2')?.textContent }));
    await p.screenshot({ path: `../shots/bug_mobile_${tag}_${name}_select.png` });
    await tapEl(p, '.card[data-l="1"]');
    await p.waitForFunction(() => /level=1/.test(location.search) && window.__game?.state, null, { timeout: 120000 });
    await p.waitForFunction(() => window.__game.modelLoaded?.(), null, { timeout: 120000 }).catch(() => {});
    await p.waitForTimeout(400);
    await p.evaluate(() => window.__game.sim(1.5, { throttle: 1 }));
    const st = await p.evaluate(() => window.__game.state());
    const ok = st.speed > 1 || Math.abs(st.pos[2] - 230) > 2;
    await p.screenshot({ path: `../shots/bug_mobile_${tag}_${name}_play.png` });
    console.log(JSON.stringify({ tag, name, cards, ok, speed: st.speed, z: st.pos[2], menuOpen: await p.evaluate(() => document.body.classList.contains('menu-open')), errs }));
    await ctx.close();
  }
}
for (const base of bases) await tryBase(base, base.includes('github') ? 'live' : 'local');
await b.close();
