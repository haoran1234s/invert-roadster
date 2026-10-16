import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import vehicleData from './data/vehicle.json';
import thrusterData from './data/thrusters.json';
import level1 from './data/level1.json';
import { buildLevel, type LevelData } from './level';
import { Vehicle } from './vehicle';
import { Vapor } from './particles';
import { Scoring } from './scoring';
import { Hud } from './hud';
import { CamRig, CAMS } from './camera';
import { initTouch, isTouch, touch } from './touch';
import { readControls, pressedOnce, emptyControls, type Controls } from './input';

await RAPIER.init();
const L = level1 as LevelData;
const Q = new URLSearchParams(location.search);
const DEBUG = Q.has('debug'); const MOBILE = isTouch || Q.has('mobile');
const BASE_DPR = Math.min(devicePixelRatio, MOBILE ? 1.5 : 2);
const renderer = new THREE.WebGLRenderer({ antialias: !MOBILE, powerPreference: 'high-performance', preserveDrawingBuffer: Q.has('shots') });
renderer.setPixelRatio(BASE_DPR); renderer.setSize(innerWidth, innerHeight); renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, MOBILE ? 1500 : 3000);
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
// bloom at reduced internal resolution on mobile; can be disabled by adaptive quality
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.9, 0.5, 0.6); composer.addPass(bloom);
let scale = 1; let bloomOn = !Q.has('nobloom');
function applySize() {
  const pr = BASE_DPR * scale; renderer.setPixelRatio(pr); composer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  if (MOBILE) bloom.setSize(Math.round(innerWidth * pr / 2), Math.round(innerHeight * pr / 2));
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
applySize(); addEventListener('resize', applySize); addEventListener('orientationchange', () => setTimeout(applySize, 200));
// adaptive quality: measure real frame time over 2s windows; drop resolution, then bloom; recover when headroom
let qT = 0, qN = 0, qSum = 0; const qMin = MOBILE ? 0.6 : 0.7;
function adapt(dtMs: number) {
  if (Q.has('noadapt')) return; qSum += dtMs; qN++; qT += dtMs; if (qT < 2000) return;
  const avg = qSum / qN; qT = qSum = qN = 0;
  if (avg > 20) { if (scale > qMin + 1e-3) { scale = Math.max(qMin, scale * 0.85); applySize(); } else if (bloomOn) bloomOn = false; }
  else if (avg < 13) { if (!bloomOn && !Q.has('nobloom')) bloomOn = true; else if (scale < 1) { scale = Math.min(1, scale / 0.85); applySize(); } }
}
initTouch(Q.has('touch'));
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); world.timestep = 1 / 60;
buildLevel(L, scene, world);
const car = new Vehicle(vehicleData, thrusterData, world, scene);
const vapor = new Vapor(scene); const score = new Scoring(); const hud = new Hud(document.getElementById('hud') as HTMLCanvasElement); const rig = new CamRig(camera);
let checkpoint = 0;
function reset() { const cp = L.checkpoints[checkpoint]; car.reset(cp.pos, cp.yawDeg); score.reset(); rig.update(1, car, true); }
reset();
const starOk = () => L.stars.map(s => ({ label: s.label, ok: s.type === 'invertedSec' ? score.bestInverted >= s.value : s.type === 'safeLandAfterInvert' ? score.safeLandAfterInvert : score.run >= s.value || score.score >= s.value && s.type !== 'score' }));
const earned = L.stars.map(() => false);
let wasGround = true; const tmp = new THREE.Vector3(), tmpD = new THREE.Vector3(), tmpB = new THREE.Vector3();
function fixedStep(c: Controls) {
  const dt = 1 / 60;
  car.step(dt, c); world.step(); car.sync(); score.update(dt, car);
  for (const cp of L.checkpoints.slice(1)) { const i = L.checkpoints.indexOf(cp); if (i > checkpoint && car.pos.z < cp.z && car.grounded && car.normal.y > 0.9 && car.pos.z > L.ramp.z0) checkpoint = i; }
  // vapor jets
  if (car.thrusting || car.boosting) for (const nz of thrusterData.nozzles) {
    if (!!(nz as any).boost !== car.boosting && !(car.thrusting && !(nz as any).boost)) continue;
    const p = tmp.set(nz.pos[0], nz.pos[1], nz.pos[2]).applyQuaternion(car.quat).add(car.pos);
    const d = tmpD.set(nz.dir[0], nz.dir[1], nz.dir[2]).applyQuaternion(car.quat).multiplyScalar(28).add(car.vel);
    for (let k = 0; k < (MOBILE ? 2 : 3); k++) vapor.emit(p, d, 0.7, 4);
  }
  if (car.grounded && !wasGround && car.vel.length() > 3) vapor.burst(tmpB.copy(car.pos).addScaledVector(car.normal, -0.5), 260);
  wasGround = car.grounded; vapor.update(dt);
  starOk().forEach((s, i) => { if (s.ok && !earned[i]) { earned[i] = true; score.msg(`★ ${s.label}`); } });
}
let forced: Controls | null = null; let acc = 0; let last = performance.now(); let fps = 60; let fc = 0, ft = 0;
const ftimes: number[] = [];
function frame() {
  const now = performance.now(); const dt = Math.min(0.1, (now - last) / 1000); ftimes.push(now - last); adapt(now - last); if (ftimes.length > 600) ftimes.shift(); last = now; fc++; ft += dt; if (ft > 0.5) { fps = Math.round(fc / ft); fc = 0; ft = 0; }
  const c = forced ?? mergeTouch(readControls());
  while (pressedOnce.length) { const k = pressedOnce.shift(); if (k === 'KeyR') reset(); if (k === 'KeyC') rig.next(); if (k === 'KeyT') car.V.air.stabilize = car.V.air.stabilize ? 0 : 3; }
  if (!forced) { acc += dt; let n = 0; while (acc >= 1 / 60 && n < 5) { fixedStep(c); acc -= 1 / 60; n++; } if (n === 5) acc = 0; }
  rig.update(dt, car); render();
  requestAnimationFrame(frame);
}
renderer.info.autoReset = false;
const HINT = MOBILE ? '' : 'W/S 油门刹车  A/D 转向  Shift 吸地  空格 推进器  方向键/QE 空中姿态  F 喷射  C 镜头  R 重置  T 稳定辅助';
const starInfo = L.stars.map(s => ({ label: s.label, ok: false }));
function render() {
  renderer.info.reset(); if (bloomOn) composer.render(); else renderer.render(scene, camera);
  starInfo.forEach((s, i) => s.ok = earned[i]);
  hud.draw(car, score, { cam: CAMS[rig.mode], level: `L1 ${L.name}`, stars: starInfo, fps, hint: HINT, debug: DEBUG ? `${fps} FPS  ${(ftimes[ftimes.length - 1] ?? 0).toFixed(1)}ms  calls ${renderer.info.render.calls}  tris ${renderer.info.render.triangles}  res x${(BASE_DPR * scale).toFixed(2)}  bloom ${bloomOn ? 'on' : 'off'}` : '', compact: MOBILE });
}
requestAnimationFrame(frame);
function mergeTouch(c: Controls): Controls {
  if (!touch.active) return c;
  const air = !car.grounded;
  if (touch.y > 0) c.throttle = Math.max(c.throttle, touch.y); else if (touch.y < 0) c.brake = Math.max(c.brake, -touch.y);
  if (touch.x) c.steer = c.steer || touch.x;
  if (air) { c.pitch = c.pitch || touch.y; c.roll = c.roll || touch.x; }
  c.thrust ||= touch.thrust; c.fan ||= touch.fan; c.boost ||= touch.boost;
  return c;
}
// test hooks
(window as any).__game = {
  sim(sec: number, c: Partial<Controls>) { forced = { ...emptyControls(), ...c }; for (let i = 0; i < Math.round(sec * 60); i++) fixedStep(forced); rig.update(1 / 60, car, true); },
  perf() { const a = ftimes.slice(-120); return { avgMs: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1), calls: renderer.info.render.calls, scale: +(BASE_DPR * scale).toFixed(2), bloom: bloomOn, touch: { ...touch }, tris: renderer.info.render.triangles, w: renderer.domElement.width, h: renderer.domElement.height }; },
  release() { forced = null; }, setCam(i: number) { rig.mode = i; rig.update(1 / 60, car, true); }, reset,
  state: () => ({ pos: car.pos.toArray().map(x => +x.toFixed(2)), up: car.up.toArray().map(x => +x.toFixed(2)), normal: car.normal.toArray().map(x => +x.toFixed(2)), speed: +car.vel.length().toFixed(1), vy: +car.vel.y.toFixed(1), grounded: car.grounded, contacts: car.contacts, gas: +car.gas.toFixed(2), df: Math.round(car.downforceN / 9.81), score: Math.round(score.score), inv: +score.bestInverted.toFixed(2), stars: [...earned], crashed: score.crashed, msgs: score.msgs.map(m => m.t) }),
};
