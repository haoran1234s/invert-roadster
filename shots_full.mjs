import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:5180/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() !== 'log') errs.push(m.type() + ': ' + m.text()); });
await p.goto(url + '?noadapt'); await p.waitForFunction(() => window.__game?.modelLoaded?.(), null, { timeout: 90000 });
const L = async (n, pos, t) => { await p.evaluate(([a, b]) => window.__game.look(a, b), [pos, t]); await p.waitForTimeout(300); await p.screenshot({ path: `../shots/full_${n}.png` }); };
await L('wheels_left', [-5, 1.2, 230], [0, 0.4, 230]); await L('wheels_right', [5, 1.2, 231], [0, 0.4, 230]);
await L('tower', [10, 15, 170], [-80, 15, 95]); await L('runway_overview', [30, 40, 330], [0, 0, 120]); await L('ramp_landmark', [0, 10, 120], [-190, 30, -170]);
console.log('ERRS', errs); await b.close();
