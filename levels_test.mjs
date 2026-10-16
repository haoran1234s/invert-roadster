// Scripted per-level runs. usage: node levels_test.mjs [levels=1,2,3,4,5] [url]
import { chromium } from 'playwright';
const want = (process.argv[2] || '1,2,3,4,5').split(',').map(Number); const base = process.argv[3] || 'http://localhost:5180/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const out = {};
for (const lv of want) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`${base}?level=${lv}&play=1&q=${process.env.Q || '极高'}&noadapt`); await p.waitForFunction(() => window.__game, null, { timeout: 60000 });
  const S = (sec, c) => p.evaluate(([s, c]) => { window.__game.sim(s, c); return window.__game.state(); }, [sec, c]);
  const strat = process.env['S' + lv] || 'best';
  let s = await S(0.1, {}); let t = 0; let doneIdx = 0; const log = [];
  while (s.st !== 'result' && t < 120) {
    let c = {};
    if (lv === 1 || lv === 3) {
      if (s.grounded) c = (strat === 'best' && s.normal[1] < -0.1) ? { brake: +(process.env.BR || 0), fan: true } : { throttle: 1, fan: s.normal[1] < 0.95 && strat !== 'nofan' };
      else {
        // in air: optional back-flips with pitch while high, then stabilize + thrust to soften landing
        const flipsWanted = strat === 'best' ? 1 : strat === 'flip1' ? 1 : 0;
        if (s.flips < flipsWanted && s.pos[1] > 50) c = { pitch: 1 };
        else c = { thrust: s.up[1] > 0.5 && s.pos[1] < 45 && s.vy < -2 };
      }
    } else if (lv === 2) { const R = [[150,0],[70,0],[-10,0],[-90,0]]; const nx = R.find(q => q[0] < s.pos[2]) ?? [0, 0]; c = { throttle: 1, boost: s.gas > 0.2 && strat === 'best', steer: Math.max(-1, Math.min(1, (nx[1] - s.pos[0]) * (+process.env.SG || 0.03))) }; }
    else if (lv === 4) {
      const r = [190, 150, 110][Math.min(2, s.hoverIdx)];
      const dz = s.pos[2] - r; // >0: ring ahead (-Z)
      if (s.grounded) { doneIdx = s.hoverIdx; c = dz > 3 ? (s.speed < 8 ? { throttle: 0.5 } : {}) : s.speed > 0.6 ? { brake: 1 } : { thrust: true }; }
      else c = { thrust: s.hoverIdx === doneIdx && (s.pos[1] < 8 || s.vy < -1) };
    } else if (lv === 5) {
      if (s.grounded) c = { throttle: 1 };
      else { const fw = strat === 'best' ? 1 : strat === 'flip1' ? 1 : 0; if (s.flips < fw && s.pos[1] > 10 && s.vy > -12) c = { pitch: -1 }; else c = { thrust: s.up[1] > 0.6 && s.vy < -5 && s.pos[1] < 15 }; }
    }
    s = await S(0.05, c); t += 0.05; if (Math.round(t * 20) % 20 === 0) log.push(`${t.toFixed(1)} ${s.st} p=${s.pos} v=${s.speed} g=${s.grounded} inv=${s.inv} fl=${s.flips} gas=${s.gas} h=${s.hoverIdx}/${s.hoverT} rings=${s.rings}`);
  }
  const r = await p.evaluate(() => window.__game.result());
  out[lv] = r ? { stars: r.stars, total: r.total, grade: r.grade, inv: r.inv, flips: r.flips, t: r.runT, gas: r.gas, reason: r.reason, landing: r.landing && { vy: +r.landing.vy.toFixed(1), z: +r.landing.z.toFixed(1), x: +r.landing.x.toFixed(1) } } : 'NO RESULT';
  if (process.env.V) console.log(log.join('\n'));
  if (process.env.SHOT) { await p.evaluate(() => window.__game.sim(2.1, {})); await p.waitForTimeout(800); await p.screenshot({ path: `../shots/v2_result_L${lv}.png` }); await p.evaluate(() => document.querySelector('#rp').click()); await p.waitForTimeout(6000); await p.screenshot({ path: `../shots/v2_replay_L${lv}.png` }); }
  console.log('L' + lv, strat, JSON.stringify(out[lv]), 'errs', errs);
  await p.close();
}
await b.close();
