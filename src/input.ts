export interface Controls { throttle: number; brake: number; steer: number; thrust: boolean; boost: boolean; pitch: number; roll: number; fan: boolean; }
export const emptyControls = (): Controls => ({ throttle: 0, brake: 0, steer: 0, thrust: false, boost: false, pitch: 0, roll: 0, fan: false });
const down = new Set<string>();
export const pressedOnce: string[] = [];
addEventListener('keydown', e => { if (!down.has(e.code)) pressedOnce.push(e.code); down.add(e.code); if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); });
addEventListener('keyup', e => down.delete(e.code));
addEventListener('blur', () => down.clear());
let padPrev: boolean[] = [];
export function readControls(): Controls {
  const k = (c: string) => down.has(c);
  const c: Controls = {
    throttle: k('KeyW') ? 1 : 0, brake: k('KeyS') ? 1 : 0,
    steer: (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0),
    thrust: k('Space'), boost: k('KeyF'), fan: k('ShiftLeft') || k('ShiftRight'),
    pitch: (k('ArrowUp') ? 1 : 0) - (k('ArrowDown') ? 1 : 0),
    roll: (k('ArrowRight') ? 1 : 0) - (k('ArrowLeft') ? 1 : 0) + (k('KeyE') ? 1 : 0) - (k('KeyQ') ? 1 : 0),
  };
  const pad = navigator.getGamepads?.()[0];
  if (pad) {
    const dz = (v: number) => Math.abs(v) < 0.15 ? 0 : v;
    c.throttle = Math.max(c.throttle, pad.buttons[7]?.value ?? 0);
    c.brake = Math.max(c.brake, pad.buttons[6]?.value ?? 0);
    c.steer = c.steer || dz(pad.axes[0]);
    c.pitch = c.pitch || -dz(pad.axes[3]);
    c.roll = c.roll || dz(pad.axes[2]);
    c.thrust = c.thrust || !!pad.buttons[0]?.pressed;
    c.boost = c.boost || !!pad.buttons[2]?.pressed;
    c.fan = c.fan || !!pad.buttons[5]?.pressed;
    const map: [number, string][] = [[3, 'KeyC'], [8, 'KeyR'], [9, 'KeyR']];
    for (const [i, code] of map) { const p = !!pad.buttons[i]?.pressed; if (p && !padPrev[i]) pressedOnce.push(code); padPrev[i] = p; }
  }
  return c;
}
