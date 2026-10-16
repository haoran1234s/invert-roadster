import { chromium, devices } from 'playwright';
const url = process.argv[2] || 'http://localhost:5180/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ ...devices['iPhone 13 landscape'] });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(url + '?debug=1'); await p.waitForFunction(() => window.__game, null, { timeout: 30000 }); await p.waitForFunction(() => window.__game.modelLoaded?.() || location.search.includes('greybox'), null, { timeout: 60000 }).catch(() => console.log('MODEL NOT LOADED')); await p.waitForTimeout(1500);
const vis = await p.evaluate(() => !!document.querySelector('#tc .stick') && getComputedStyle(document.querySelector('#tc')).display !== 'none');
const cdp = await ctx.newCDPSession(p);
const box = s => p.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, s);
const stick = await box('#tc .stick'), thr = await box('#tc [data-h=thrust]'), fan = await box('#tc [data-h=fan]');
const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q.x, y: q.y, id: q.id ?? i })) });
await p.screenshot({ path: '../shots/' + (process.env.P ?? 'mobile_') + '01_start.png' });
const st = () => p.evaluate(() => window.__game.state());
const s0 = await st();
// stick up+right (throttle+steer) and hold fan with second finger simultaneously (multi-touch)
await T('touchStart', [{ ...stick, id: 1 }]); await T('touchMove', [{ x: stick.x + 12, y: stick.y - 60, id: 1 }]);
await T('touchStart', [{ x: stick.x + 12, y: stick.y - 60, id: 1 }, { ...fan, id: 2 }]);
await p.waitForTimeout(300);
const mid = await p.evaluate(() => window.__game.perf().touch);
await p.waitForTimeout(5000);
const s1 = await st(); await p.screenshot({ path: '../shots/' + (process.env.P ?? 'mobile_') + '02_driving.png' });
await T('touchEnd', []);
// thrust button: hold
await T('touchStart', [{ ...thr, id: 3 }]); await p.waitForTimeout(800);
const s2 = await st(); const tThr = await p.evaluate(() => window.__game.perf().touch); await p.screenshot({ path: '../shots/' + (process.env.P ?? 'mobile_') + '03_thrust.png' }); await T('touchEnd', []);
// portrait overlay
await p.setViewportSize({ width: 390, height: 664 }); await p.waitForTimeout(500); await p.screenshot({ path: '../shots/' + (process.env.P ?? 'mobile_') + '04_portrait.png' });
const rot = await p.evaluate(() => getComputedStyle(document.getElementById('rot')).display);
console.log(JSON.stringify({ vis, mid, s0: [s0.pos, s0.speed], s1: [s1.pos, s1.speed], thrustBtn: tThr, gasAfterThrust: s2.gas, rotOverlay: rot, perf: null, errs }));
await b.close();
