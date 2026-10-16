import { chromium, devices } from 'playwright';
const base = process.argv[2] || 'http://localhost:5180/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [];
for (const mobile of [false, true]) {
  const tag = mobile ? 'mobile' : 'desktop';
  const ctx = mobile ? await b.newContext({ ...devices['iPhone 13 landscape'], hasTouch: true }) : await b.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => localStorage.setItem('invert.progress', JSON.stringify({ 1: 3, 2: 3, 3: 3, 4: 2, 5: 2, 6: 3, 7: 3 })));
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e)));
  const shotAt = async (lv, want, ctl, name, max = 900) => {
    await p.goto(`${base}?level=${lv}&play=1&noadapt&notut&q=中`); await p.waitForFunction(() => window.__game?.modelLoaded?.(), null, { timeout: 180000 });
    // drive the real frame loop with sims, letting rAF update prompt each step
    for (let i = 0; i < max; i++) {
      const s = await p.evaluate(c => { window.__game.sim(0.05, c); return window.__game.state(); }, ctl(await p.evaluate(() => window.__game.state())));
      await p.evaluate(() => window.__game.release());
      await p.waitForTimeout(30);
      if (await p.evaluate(() => window.__game.prompt()) === want) { await p.evaluate(() => window.__game.sim(0, {})); await p.waitForTimeout(350); await p.screenshot({ path: `../shots/v4_prompt_${name}_${tag}.png` }); return true; }
    }
    console.log('missed', name, tag); return false;
  };
  await shotAt(1, 'go', () => ({}), 'start', 40);
  await shotAt(1, 'ramp', s => ({ throttle: 1 }), 'ramp');
  await shotAt(1, 'inv', s => ({ throttle: 1, fan: s.normal[1] < 0.95 }), 'inverted');
  await shotAt(7, 'brake', s => s.grounded ? (s.speed > 46 ? { brake: .5 } : { throttle: 1 }) : {}, 'brake');
  await shotAt(8, 'wall', s => ({ throttle: 1 }), 'wall');
  await p.goto(`${base}?noadapt`); await p.waitForFunction(() => window.__game?.ready?.(), null, { timeout: 180000 }); await p.click('#b6'); await p.waitForTimeout(400); await p.screenshot({ path: `../shots/v4_help_${tag}.png` });
  await ctx.close();
}
console.log('ERRS', errs); await b.close();
