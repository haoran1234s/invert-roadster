import { chromium, devices } from 'playwright';
const url = process.argv[2] || 'http://localhost:5180/'; const mobile = process.argv[3] === 'm';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = mobile ? await b.newContext({ ...devices['iPhone 13 landscape'] }) : await b.newContext({ viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(url); await p.waitForFunction(() => window.__game, null, { timeout: 30000 });
await p.evaluate(() => window.__game.sim(9, { throttle: 1 })); // on ramp, live loop
await p.waitForTimeout(6000);
console.log(mobile ? 'MOBILE' : 'DESKTOP', JSON.stringify(await p.evaluate(() => window.__game.perf())), 'errs', errs);
await b.close();
