import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:5180/?noadapt'); await p.waitForFunction(() => window.__game?.modelLoaded?.(), null, { timeout: 60000 });
await p.evaluate(() => { const g = window.__game; g.sim(1.2, { throttle: 0.4, steer: 0.6 }); g.setCam(2); g.sim(0.05, { throttle: 0.4, steer: 0.6 }); });
await p.waitForTimeout(500); await p.screenshot({ path: '/workspace/roadster_game/shots/model_desktop_07_closeup.png' }); await b.close();
