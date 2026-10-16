import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://localhost:5180/'); await p.waitForFunction(() => window.__game, null, { timeout: 30000 }); await p.waitForFunction(() => window.__game.modelLoaded?.() || location.search.includes('greybox'), null, { timeout: 60000 }).catch(() => console.log('MODEL NOT LOADED')); await p.waitForTimeout(1500);
const S = (sec, c) => p.evaluate(([s, c]) => { window.__game.sim(s, c); return window.__game.state(); }, [sec, c]);
const shot = async n => { await p.waitForTimeout(400); await p.screenshot({ path: `../shots/${process.env.P ?? ""}${n}.png` }); };
await S(0.5, {}); await shot('01_start');
const log = []; let st; let shots = new Set();
for (let i = 0; i < 700; i++) {
  const air = st && !st.grounded;
  st = await S(0.05, air ? { thrust: st.up[1] > 0.5 && st.pos[1] < 45 && st.vy < -2, brake: 0 } : { throttle: 1 });
  log.push(`${(i*0.05).toFixed(2)} ${JSON.stringify(st)}`);
  if (!shots.has('ramp') && st.grounded && st.normal[1] < 0.6 && st.normal[1] > 0) { shots.add('ramp'); await shot('02_on_ramp'); }
  if (!shots.has('inv') && st.grounded && st.normal[1] < -0.5) { shots.add('inv'); await shot('03_inverted'); }
  if (!shots.has('thr') && !st.grounded && air && st.pos[1] < 45 && st.vy < -2 && st.up[1] > 0.5) { shots.add('thr'); await S(0.3, { thrust: true }); await shot('04_thrusting'); }
  if (shots.has('thr') && st.grounded && st.normal[1] > 0.9 && st.contacts == 4) { await S(0.3, {}); await shot('05_landed'); break; }
}
await p.evaluate(() => window.__game.setCam(1)); await shot('06_wide_profile');
console.log(log.filter((_, i) => i % 10 === 0).join('\n'));
console.log('FINAL', JSON.stringify(st), 'shots', [...shots]); console.log('ERRORS', errs);
await b.close();
