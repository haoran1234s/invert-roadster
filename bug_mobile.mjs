import { chromium, devices } from 'playwright';
const bases = process.argv.slice(2).length ? process.argv.slice(2) : ['http://localhost:5180/', 'https://haoran1234s.github.io/invert-roadster/'];
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const out = [];
async function run(base, label, orient) {
  const d = { ...devices['iPhone 13'], hasTouch: true, isMobile: true };
  if (orient === 'landscape') Object.assign(d, devices['iPhone 13 landscape'], { hasTouch: true, isMobile: true });
  const ctx = await b.newContext(d);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(base.replace(/\?.*$/, '') + (base.includes('?') ? '' : '') + (base.endsWith('/') ? '' : '/') + '?noadapt', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.__game, null, { timeout: 120000 }).catch(e => errs.push('wait __game: ' + e));
  await p.waitForTimeout(1200);
  const info = await p.evaluate(() => {
    const ui = document.querySelector('.ui'); const b1 = document.querySelector('#b1'); const b2 = document.querySelector('#b2');
    const tc = document.querySelector('#tc'); const rot = document.querySelector('#rot');
    const cs = el => el ? getComputedStyle(el) : null;
    return {
      uiShow: ui?.classList.contains('show'), uiZ: cs(ui)?.zIndex, uiPE: cs(ui)?.pointerEvents, uiDisp: cs(ui)?.display,
      b1: !!b1, b2: !!b2, b1Rect: b1?.getBoundingClientRect(),
      tcPE: cs(tc)?.pointerEvents, tcDisp: cs(tc)?.display, rotDisp: cs(rot)?.display, rotZ: cs(rot)?.zIndex,
      canvasPE: cs(document.querySelector('canvas'))?.pointerEvents,
      touchActive: window.__game?.perf?.()?.touch,
      inner: [innerWidth, innerHeight],
      listeners: (() => { try { return getEventListeners?.(document)?.touchstart?.length; } catch { return 'n/a'; } })(),
    };
  });
  await p.screenshot({ path: `../shots/bug_mobile_${label}_${orient}_menu.png` });
  // try tap 开始游戏
  let tapStart = null;
  try {
    if (await p.$('#b1')) {
      await p.locator('#b1').tap({ timeout: 5000 });
      await p.waitForTimeout(800);
      tapStart = await p.evaluate(() => ({ url: location.search, uiShow: document.querySelector('.ui')?.classList.contains('show'), st: window.__game?.state?.()?.st }));
    } else tapStart = 'no #b1';
  } catch (e) { tapStart = 'tap fail: ' + e.message; }
  await p.screenshot({ path: `../shots/bug_mobile_${label}_${orient}_after_start.png` });
  // go back to menu if needed
  await p.evaluate(() => window.__game?.ui?.main?.());
  await p.waitForTimeout(400);
  let tapSelect = null, tapL1 = null;
  try {
    await p.locator('#b2').tap({ timeout: 5000 });
    await p.waitForTimeout(600);
    tapSelect = await p.evaluate(() => ({ html: document.querySelector('.ui .box')?.innerText?.slice(0, 200), cards: document.querySelectorAll('.card').length, locked: document.querySelectorAll('.card.locked').length }));
    await p.screenshot({ path: `../shots/bug_mobile_${label}_${orient}_select.png` });
    const c1 = p.locator('.card[data-l="1"]');
    if (await c1.count()) {
      await c1.tap({ timeout: 5000 });
      await p.waitForTimeout(2500);
      tapL1 = await p.evaluate(() => ({ url: location.href, search: location.search, st: window.__game?.state?.()?.st, pos: window.__game?.state?.()?.pos, uiShow: document.querySelector('.ui')?.classList.contains('show') }));
    } else tapL1 = 'no card 1';
  } catch (e) { tapSelect = tapSelect || ('select fail: ' + e.message); tapL1 = 'L1 fail: ' + e.message; }
  await p.screenshot({ path: `../shots/bug_mobile_${label}_${orient}_after_L1.png` });
  // also try click (mouse) as control
  await p.goto(base.replace(/\?.*$/, '') + '?noadapt', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__game, null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(800);
  let clickOk = null;
  try {
    await p.locator('#b2').click({ timeout: 5000, force: true });
    await p.waitForTimeout(500);
    clickOk = await p.evaluate(() => document.querySelectorAll('.card').length);
  } catch (e) { clickOk = 'click fail: ' + e.message; }
  const row = { base, label, orient, info, tapStart, tapSelect, tapL1, clickOk, errs };
  out.push(row); console.log(JSON.stringify(row, null, 0).slice(0, 800));
  await ctx.close();
}
for (const base of bases) {
  const label = base.includes('github') ? 'live' : 'local';
  for (const o of ['landscape', 'portrait']) await run(base, label, o);
}
console.log('DONE', out.length); await b.close();
