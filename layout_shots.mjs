import { chromium, devices } from 'playwright';
const base = process.argv[2] || 'http://localhost:5180/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const VPS = { iphone13: { ...devices['iPhone 13 landscape'] }, android20x9: { viewport: { width: 800, height: 360 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent }, phone16x9: { viewport: { width: 640, height: 360 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent } };
const out = {};
for (const [name, d] of Object.entries(VPS)) {
  const ctx = await b.newContext({ ...d, hasTouch: true }); const p = await ctx.newPage();
  await p.goto(`${base}?level=7&play=1&noadapt&notut&q=中`); await p.waitForFunction(() => window.__game?.modelLoaded?.(), null, { timeout: 180000 });
  let s = await p.evaluate(() => window.__game.state());
  for (let i = 0; i < 400 && !(s.pos[2] < -60 && !s.grounded); i++) s = await p.evaluate(c => { window.__game.sim(0.05, c); return window.__game.state(); }, s.grounded ? (s.speed > 46 ? { brake: .5 } : { throttle: 1 }) : {});
  await p.evaluate(() => window.__game.release()); await p.waitForTimeout(900);
  // overlap check: radar box drawn on canvas -> compare against DOM rects of top buttons and big buttons
  const rects = await p.evaluate(() => [...document.querySelectorAll('#tc .b, #tc .stick, #menuBtn')].map(e => { const r = e.getBoundingClientRect(); return [e.textContent.trim().slice(-2), Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; }));
  out[name] = rects; await p.screenshot({ path: `../shots/v4_layout_${name}.png` }); await ctx.close();
}
console.log(JSON.stringify(out)); await b.close();
