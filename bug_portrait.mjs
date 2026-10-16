import { chromium, devices } from 'playwright';
const base = process.argv[2] || 'http://localhost:5180/';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ ...devices['iPhone 13'], hasTouch: true, isMobile: true });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push('c:' + m.text()); });
await p.goto(base + '?noadapt'); await p.waitForFunction(() => window.__game, null, { timeout: 90000 }); await p.waitForTimeout(1000);
const info = await p.evaluate(() => ({ menuOpen: document.body.classList.contains('menu-open'), rot: getComputedStyle(document.querySelector('#rot')).display, ui: document.querySelector('.ui')?.classList.contains('show'), b2: !!document.querySelector('#b2') }));
console.log('info', info);
await p.screenshot({ path: '../shots/bug_mobile_portrait_1menu.png' });
// tap 选择关卡
await p.locator('#b2').tap(); await p.waitForTimeout(800);
console.log('after b2', await p.evaluate(() => ({ html: document.querySelector('.ui h2')?.textContent, cards: [...document.querySelectorAll('.card')].map(c => c.dataset.l + (c.classList.contains('locked') ? 'L' : '')) })));
await p.screenshot({ path: '../shots/bug_mobile_portrait_2select.png' });
await p.locator('.card[data-l="1"]').tap(); await p.waitForTimeout(3000);
console.log('after L1', await p.evaluate(() => ({ search: location.search, st: window.__game?.state?.()?.st, menuOpen: document.body.classList.contains('menu-open'), ui: document.querySelector('.ui')?.classList.contains('show'), phase: window.__game?.state?.()?.phase })));
await p.screenshot({ path: '../shots/bug_mobile_portrait_3play.png' });
// fresh: 开始游戏
await p.goto(base + '?noadapt'); await p.waitForFunction(() => window.__game); await p.waitForTimeout(800);
await p.locator('#b1').tap(); await p.waitForTimeout(3000);
console.log('after start', await p.evaluate(() => ({ search: location.search, st: window.__game?.state?.()?.st, phase: window.__game?.state?.()?.phase })));
await p.screenshot({ path: '../shots/bug_mobile_portrait_4start.png' });
console.log('ERRS', errs); await b.close();
