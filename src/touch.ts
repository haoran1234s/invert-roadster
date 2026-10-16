import { pressedOnce } from './input';
// On-screen touch controls (auto-shown on touch devices). Multi-touch via pointer events.
export const isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
export const touch = { x: 0, y: 0, thrust: false, fan: false, boost: false, active: false };

const css = `
#tc{position:fixed;inset:0;pointer-events:none;z-index:5;user-select:none;-webkit-user-select:none;touch-action:none}
#tc .stick{position:absolute;left:max(18px,env(safe-area-inset-left));bottom:18px;width:150px;height:150px;border-radius:50%;background:rgba(232,244,255,.07);border:2px solid rgba(232,244,255,.35);pointer-events:auto;touch-action:none}
#tc .knob{position:absolute;left:50%;top:50%;width:62px;height:62px;margin:-31px;border-radius:50%;background:rgba(232,244,255,.35);border:2px solid rgba(232,244,255,.7)}
#tc .lbl{position:absolute;width:100%;text-align:center;top:-20px;color:#9ab;font:12px "Microsoft YaHei",sans-serif}
#tc .btns{position:absolute;right:max(14px,env(safe-area-inset-right));bottom:14px;display:grid;grid-template-columns:repeat(3,78px);gap:12px;pointer-events:none}
#tc .b{width:78px;height:78px;flex-direction:column;border-radius:50%;background:rgba(232,244,255,.1);border:2px solid rgba(232,244,255,.4);color:#e8f4ff;font:bold 13px "Microsoft YaHei",sans-serif;display:flex;align-items:center;justify-content:center;pointer-events:auto;touch-action:none;text-align:center;line-height:1.1}
#tc .b.big{background:rgba(255,60,60,.18);border-color:rgba(255,90,90,.7)}
#tc .b.on{background:rgba(232,244,255,.45)}
#tc .b i{font-style:normal;font-size:24px;line-height:1}#tc .top .b i{display:none}
#tc .hint{animation:hg .7s ease-in-out infinite alternate;border-color:#ffc23a!important;box-shadow:0 0 18px 6px rgba(255,194,58,.7)}
#tc .hint::after{content:'▼';position:absolute;transform:translateY(-62px);color:#ffc23a;font-size:26px;animation:ha .7s ease-in-out infinite alternate;text-shadow:0 0 8px #000}
#tc .stick.hint::after{left:50%;top:-30px;transform:translateX(-50%)}
@media (max-height:380px){#tc .stick{width:130px;height:130px}}
@keyframes hg{from{transform:scale(1)}to{transform:scale(1.12)}}@keyframes ha{from{margin-top:0}to{margin-top:-10px}}
#tc .top{position:absolute;right:max(14px,env(safe-area-inset-right));top:110px;display:flex;flex-direction:column;gap:6px}
#tc .top .b{width:52px;height:36px;border-radius:10px;font-size:12px}
body.menu-open #tc,body.menu-open canvas{pointer-events:none!important;visibility:hidden}
body.menu-open canvas{visibility:visible;pointer-events:none!important}
body.menu-open #rot{display:none!important}
#rot{position:fixed;inset:0;z-index:9;background:#05070d;color:#e8f4ff;display:none;align-items:center;justify-content:center;flex-direction:column;font:16px "Microsoft YaHei",sans-serif;text-align:center;pointer-events:none}
#rot .ph{width:46px;height:80px;border:3px solid #e8f4ff;border-radius:8px;margin-bottom:18px;animation:r 1.6s infinite}
@keyframes r{0%,20%{transform:rotate(0)}60%,100%{transform:rotate(-90deg)}}
@media (orientation: portrait){#rot.t{display:flex}}`;

function hold(el: HTMLElement, key: 'thrust' | 'fan' | 'boost') {
  const ids = new Set<number>();
  const upd = () => { touch[key] = ids.size > 0; el.classList.toggle('on', ids.size > 0); };
  el.addEventListener('pointerdown', e => { e.preventDefault(); ids.add(e.pointerId); el.setPointerCapture(e.pointerId); upd(); });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, e => { ids.delete((e as PointerEvent).pointerId); upd(); });
}
function tap(el: HTMLElement, code: string) {
  el.addEventListener('pointerdown', e => { e.preventDefault(); pressedOnce.push(code); el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 150); });
}

/** True if the event target is a menu / form control that must receive real clicks. */
function isUiTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el || !el.closest) return false;
  return !!el.closest('.ui, #menuBtn, input, textarea, select, button, a, [data-l]');
}

export function setMenuOpen(open: boolean) {
  document.body.classList.toggle('menu-open', open);
  if (open) { touch.x = touch.y = 0; touch.thrust = touch.fan = touch.boost = false; }
}

export function initTouch(force = false) {
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const rot = document.createElement('div'); rot.id = 'rot'; rot.innerHTML = '<div class="ph"></div>请横屏游玩<br><small style="opacity:.6">Rotate to landscape</small>'; document.body.appendChild(rot);
  if (!isTouch && !force) return false;
  rot.classList.add('t'); touch.active = true;
  const root = document.createElement('div'); root.id = 'tc';
  root.innerHTML = `<div class="stick"><div class="lbl">油门/转向 · 空中=姿态</div><div class="knob"></div></div>
  <div class="top"><div class="b" data-t="KeyC">镜头</div><div class="b" data-t="KeyT">稳定</div><div class="b" data-t="KeyR">重置</div></div>
  <div class="btns"><div class="b" data-h="fan"><i>⤓</i>吸地</div><div class="b" data-h="boost"><i>»</i>喷射</div><div class="b big" data-h="thrust"><i>▲</i>推进</div></div>`;
  document.body.appendChild(root);
  root.querySelectorAll<HTMLElement>('[data-h]').forEach(el => hold(el, el.dataset.h as any));
  root.querySelectorAll<HTMLElement>('[data-t]').forEach(el => tap(el, el.dataset.t!));
  const stick = root.querySelector<HTMLElement>('.stick')!, knob = root.querySelector<HTMLElement>('.knob')!;
  let id = -1, cx = 0, cy = 0; const R = 60;
  const move = (e: PointerEvent) => {
    let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    const dz = (v: number) => Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88;
    touch.x = dz(dx / R); touch.y = dz(-dy / R);
  };
  stick.addEventListener('pointerdown', e => { e.preventDefault(); if (id >= 0) return; id = e.pointerId; stick.setPointerCapture(id); const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; move(e); });
  stick.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
  const end = (e: PointerEvent) => { if (e.pointerId !== id) return; id = -1; touch.x = touch.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end); stick.addEventListener('lostpointercapture', end);
  // Block page scroll / pinch only on the game surface — NEVER on menu buttons.
  // A blanket document touchstart.preventDefault() kills synthetic clicks on iOS/Android,
  // which is why phones could not enter levels.
  const block = (e: Event) => {
    if (document.body.classList.contains('menu-open') || isUiTarget(e.target)) return;
    e.preventDefault();
  };
  document.addEventListener('touchmove', block, { passive: false });
  document.addEventListener('gesturestart', block, { passive: false });
  document.addEventListener('dblclick', block, { passive: false });
  // touchstart: only prevent on canvas / #tc so the browser still synthesizes clicks for .ui
  document.addEventListener('touchstart', e => {
    if (document.body.classList.contains('menu-open') || isUiTarget(e.target)) return;
    const el = e.target as HTMLElement;
    if (el === document.body || el === document.documentElement || el.tagName === 'CANVAS' || el.closest?.('#tc,#hud')) e.preventDefault();
  }, { passive: false });
  return true;
}

/** highlight the on-screen control the current prompt refers to */
export function setHintButton(k: string) {
  document.querySelectorAll('#tc .hint').forEach(e => e.classList.remove('hint'));
  if (!k) return; const el = document.querySelector(k === 'stick' ? '#tc .stick' : `#tc [data-h="${k}"]`); el?.classList.add('hint');
}
