import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import vehicleData from './data/vehicle.json';
import thrusterData from './data/thrusters.json';
import { buildLevel, type LevelData } from './level';
import { loadScenery, loadGLB } from './env';
import { Vehicle } from './vehicle';
import { Vapor } from './particles';
import { Scoring, GRADE_MULT, GRADE_RANK, type Landing } from './scoring';
import { Hud } from './hud';
import { CamRig, CAMS } from './camera';
import { initTouch, isTouch, touch } from './touch';
import { readControls, pressedOnce, emptyControls, type Controls } from './input';
import { loadQuality, saveStars, unlocked, loadProgress, type QName } from './quality';
import { UI } from './ui';
import { dailyLevel, MODS } from './daily';

await RAPIER.init();
const LEVELS = Object.values(import.meta.glob('./data/levels/*.json', { eager: true, import: 'default' }) as Record<string, LevelData>).sort((a, b) => +a.id.slice(1) - +b.id.slice(1));
const Q = new URLSearchParams(location.search);
const DAILY = Q.has('daily');
const LVL = DAILY ? 0 : THREE.MathUtils.clamp(+(Q.get('level') ?? 1) || 1, 1, LEVELS.length);
const L: LevelData = DAILY ? dailyLevel(Q.get('daily') && Q.get('daily') !== '1' ? Q.get('daily')! : undefined) : LEVELS[LVL - 1];
const BOARD = L.board ?? L.id;
const GRAV = L.gravity ?? 1;
const DEBUG = Q.has('debug'); const MOBILE = isTouch || Q.has('mobile');
const QUAL = loadQuality(Q.get('q'));
const BASE_DPR = Math.min(devicePixelRatio, QUAL.dpr);
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: Q.has('shots') });
renderer.setPixelRatio(BASE_DPR); renderer.setSize(innerWidth, innerHeight); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = QUAL.shadow > 0; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 3000);
const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: QUAL.msaa });
const composer = new EffectComposer(renderer, rt); composer.addPass(new RenderPass(scene, camera));
let gtao: GTAOPass | null = null;
if (QUAL.gtao) { gtao = new GTAOPass(scene, camera, innerWidth, innerHeight); gtao.blendIntensity = 0.85; gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1, thickness: 1, scale: 1, samples: 12 }); composer.addPass(gtao); }
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.4, 0.9); bloom.enabled = QUAL.bloom; composer.addPass(bloom);
composer.addPass(new OutputPass());
let scale = 1;
function applySize() {
  const pr = BASE_DPR * scale; renderer.setPixelRatio(pr); composer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  bloom.setSize(Math.round(innerWidth * pr / 2), Math.round(innerHeight * pr / 2));
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
applySize(); addEventListener('resize', applySize); addEventListener('orientationchange', () => setTimeout(applySize, 200));
// adaptive safety net: only when fps is bad (>40ms avg over 3s): AO off -> shadows lower/off -> resolution down
let qT = 0, qN = 0, qSum = 0, downgrades: string[] = [];
function adapt(dtMs: number) {
  if (Q.has('noadapt')) return; qSum += dtMs; qN++; qT += dtMs; if (qT < 3000) return;
  const avg = qSum / qN; qT = qSum = qN = 0; if (avg <= 40) return;
  if (gtao?.enabled) { gtao.enabled = false; downgrades.push('AO'); }
  else if (key.castShadow && key.shadow.mapSize.x > 1024) { key.shadow.mapSize.set(1024, 1024); key.shadow.map?.dispose(); key.shadow.map = null as any; downgrades.push('阴影1024'); }
  else if (scale > 0.6) { scale = Math.max(0.6, scale * 0.85); applySize(); downgrades.push('分辨率' + scale.toFixed(2)); }
  else if (key.castShadow) { key.castShadow = false; downgrades.push('阴影关'); }
  else if (bloom.enabled) { bloom.enabled = false; downgrades.push('泛光关'); }
}
initTouch(Q.has('touch'));
const world = new RAPIER.World({ x: 0, y: -9.81 * GRAV, z: 0 }); world.timestep = 1 / 60;
const handles = buildLevel(L, scene, world);
// env reflections from the procedural sky (PMREM)
const pm = new THREE.PMREMGenerator(renderer); const envScene = new THREE.Scene();
envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), (scene.userData.sky as THREE.Mesh).material as THREE.Material));
const gnd = new THREE.Mesh(new THREE.CircleGeometry(49, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4b5361 })); gnd.position.y = -2; envScene.add(gnd);
const envTex = pm.fromScene(envScene, 0.02, 0.1, 200).texture; scene.environment = envTex; scene.environmentIntensity = 0.5;
// optional equirect skybox (Hunyuan World panorama): replaces sky dome + env map when it loads
const SKY = L.env?.skyImage ? (/\.\w+$/.test(L.env.skyImage) ? L.env.skyImage : `${L.env.skyImage}_${MOBILE || QUAL.name === '中' ? '2k' : '4k'}.webp`) : '';
let skyOk = !SKY;
if (SKY) new THREE.TextureLoader().load(SKY, t => { skyOk = true; t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; scene.background = t; const sky = scene.userData.sky as THREE.Object3D; if (sky) sky.visible = false; const e = pm.fromEquirectangular(t).texture; scene.environment = e; }, undefined, () => { skyOk = true; console.warn('skyImage missing', SKY); });
if (L.env?.exposure) renderer.toneMappingExposure = L.env.exposure;
// shadows: key light follows the car
const key = scene.userData.key as THREE.DirectionalLight; const KOFF = new THREE.Vector3(-120, 160, 120).normalize().multiplyScalar(150);
key.castShadow = QUAL.shadow > 0; key.shadow.mapSize.set(QUAL.shadow || 1, QUAL.shadow || 1);
Object.assign(key.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 10, far: 400 }); key.shadow.camera.updateProjectionMatrix(); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.04;
const V: any = { ...vehicleData, modelOverride: QUAL.carLod === 'hi' ? (MOBILE ? 'models/roadster_mobilehi.glb' : 'models/roadster_hi.glb') : '' };
const TM = (L as any).thrustMult ?? 1;
const car = new Vehicle(V, { ...thrusterData, tankSec: L.tankSec ?? thrusterData.tankSec, liftG: thrusterData.liftG * TM, boostG: thrusterData.boostG * TM, retroG: 2.6 * TM } as any, world, scene, envTex);
let sceneryLoaded = -1;
const sceneryDir = QUAL.name === '中' && MOBILE ? 'models/mobile/' : 'models/desktop/';
if (!Q.has('greybox') && L.scenery !== false) loadScenery(sceneryDir, scene, handles, L.runway, envTex).then(n => sceneryLoaded = n); else sceneryLoaded = 0;
if (L.scenery === false) sceneryLoaded = 0;
if (!Q.has('greybox')) loadGLB(sceneryDir + 'wheel.glb').then(w => car.setWheelModel(w)).catch(e => console.warn('wheel model failed', e));
const P = QUAL.particles;
const vapor = new Vapor(scene); const flame = new Vapor(scene, [1.0, 0.45, 0.12], 1.1, 6, 0, 1500); const dust = new Vapor(scene, [0.30, 0.26, 0.21], 2.2, 1.2, 0.3, 2000);
let rain: THREE.Points | null = null;
if (L.env?.rain) { const N = Math.round(4000 * P); const g = new THREE.BufferGeometry(); const a = new Float32Array(N * 3); for (let i = 0; i < N * 3; i++) a[i] = (Math.random() - 0.5) * 80; g.setAttribute('position', new THREE.BufferAttribute(a, 3)); rain = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xaaccff, size: 0.12, transparent: true, opacity: 0.55, depthWrite: false })); rain.frustumCulled = false; scene.add(rain); }
const score = new Scoring(); const hud = new Hud(document.getElementById('hud') as HTMLCanvasElement); const rig = new CamRig(camera);

// ---------------- run state ----------------
type St = 'play' | 'ending' | 'result' | 'replay';
let st: St = 'play', runT = 0, endT = 0, slowT = 0, panelT = -1, crashT = 0, airT = 0, ramped = false, banner = 0;
let phase = 0, phaseFrac = 0;
const rings = L.rings ?? []; const ringDone = rings.map(() => false); let hoverIdx = 0, hoverT = 0, lifted = false, noGround = true, finished = false, prevZ = 0;
const hoverRings = rings.filter(r => r.type === 'hover');
const REC_MAX = 60 * 240; const rec = new Float32Array(REC_MAX * 7); let recN = 0, replayI = 0, replayCam = 0;
let result: any = null; let landGas = 0;
// cliff / retro (喷气缓降) state
let alt = 0, cliffDone = false, retroUsed = false, retroStartAlt = 0, touchSlow = false, wallT = 0, wallDone = false, boostSpent = false, boostLock = false;
let assist = localStorage.getItem('invert.assist') === '1' || !!L.retroAssist;
const passed = new Set<number>(); const rayDown = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
const RETRO_A = () => Math.max(1, (2.6 * TM - GRAV) * 9.81); const idealH = () => car.vel.y < 0 ? car.vel.y * car.vel.y / (2 * RETRO_A()) : 0; const SECTIONS = ['起步', '上弯', '倒挂', '飞出', '落地'];
const best = LVL ? loadProgress()[LVL] ?? 0 : 0;
function setRingLook() { handles.rings.forEach((m, i) => { (m.material as THREE.MeshBasicMaterial).color.set(ringDone[i] ? 0x3dffa0 : rings[i].type === 'boost' ? 0x40e8ff : rings[i].type === 'hover' ? (rings[i] === hoverRings[hoverIdx] ? 0xffe060 : 0x8a7a40) : 0xff9a30); }); }
function reset() {
  const cp = L.checkpoints[0]; car.reset(cp.pos, cp.yawDeg); car.gas = 1; score.reset();
  alt = 0; cliffDone = retroUsed = touchSlow = wallDone = boostSpent = boostLock = false; wallT = 0; passed.clear();
  st = 'play'; runT = 0; endT = 0; slowT = 0; panelT = -1; crashT = 0; airT = 0; ramped = false; phase = 0; phaseFrac = 0; banner = 6;
  ringDone.fill(false); hoverIdx = 0; hoverT = 0; lifted = false; noGround = true; finished = false; prevZ = cp.pos[2]; recN = 0; result = null; rig.mode = 0;
  setRingLook(); rig.update(1, car, true);
}
function respawn(why: string) {
  let bestCp = L.checkpoints[0], bd = 1e9; for (const cp of L.checkpoints) { const d = car.pos.distanceTo(new THREE.Vector3().fromArray(cp.pos)); if (d < bd) { bd = d; bestCp = cp; } }
  car.reset(bestCp.pos, bestCp.yawDeg); score.combo.break('重生'); retroUsed = false; score.crashed = false; crashT = 0; airT = 0; ramped = false; phase = 0; score.msg(`${why}，已重生`, true); rig.update(1, car, true);
}
const inZone = (l: Landing | null, precise?: boolean) => !!l && (L.zones ?? []).some(z => (!precise || z.precise) && Math.abs(l.x - z.x) <= z.w / 2 && Math.abs(l.z - z.z) <= z.l / 2);
function cond(c: { t: string; v?: any }, total: number): boolean {
  const l = score.landing;
  switch (c.t) {
    case 'invertLand': return score.bestInverted >= 0.3 && !!l;
    case 'safeLand': return !!l;
    case 'score': return total >= c.v;
    case 'zone': return inZone(l);
    case 'precise': return inZone(l, true);
    case 'inv': return score.bestInverted >= c.v;
    case 'grade': return !!l && GRADE_RANK[l.grade] >= GRADE_RANK[c.v];
    case 'time': return runT <= c.v;
    case 'finish': return finished;
    case 'ringsAll': return ringDone.every((d, i) => d || rings[i].type === 'hover');
    case 'hoverAll': return hoverRings.length > 0 && hoverIdx >= hoverRings.length;
    case 'noGround': return noGround;
    case 'gas': return (score.landing ? landGas : car.gas) >= c.v;
    case 'flips': return score.flips >= c.v;
    case 'trick': return score.combo.all().some(ch => ch.tricks.includes(c.v));
    case 'named': return score.combo.all().some(ch => ch.named.includes(c.v));
  }
  return false;
}
function finalize(reason: string) {
  const l = score.landing; const mult = l ? GRADE_MULT[l.grade] : 1;
  const stunt = Math.round(score.stunt); const zoneB = inZone(l) ? 1000 : 0; const gasNow = l ? landGas : car.gas; const gasB = gasNow > 0.5 && (l || finished || reason === 'hover') ? 500 : 0;
  const total = Math.round(stunt * mult) + zoneB + gasB;
  const stars = L.stars.map(s => s.all.every(c => cond(c, total)));
  const n = stars.filter(Boolean).length; if (LVL) saveStars(LVL, n);
  const rows: [string, string][] = [['特技分', `${stunt}`]];
  if (l) rows.push([`落地评级 ${l.grade}（竖直 ${l.vy.toFixed(1)} m/s）`, `×${mult}`]);
  if (score.bestInverted > 0) rows.push(['倒挂时间', `${score.bestInverted.toFixed(2)} s`]);
  if (score.flips) rows.push(['空翻', `${score.flips} 次`]);
  if (rings.length) rows.push(['光环', `${ringDone.filter(Boolean).length + hoverIdx} / ${rings.length}`]);
  if (L.timeLimit || L.finishZ !== undefined) rows.push(['用时', `${runT.toFixed(2)} s`]);
  rows.push(['落地区', zoneB ? '+1000' : '—'], ['气罐 > 50%', gasB ? '+500' : '—']);
  if (L.mods?.length) rows.unshift(['今日规则', L.mods.map(m => (MODS as any)[m]).join(' / ')]);
  const combos: [string, string][] = score.combo.all().filter(ch => ch.tricks.length > 1 || ch.named.length).map(ch => [`连招 x${ch.mult}：${ch.tricks.join(' → ')}${ch.named.length ? '  ★' + ch.named.join('★') : ''}`, `+${ch.pts}`]);
  result = { reason, grade: reason === 'land' ? l?.grade ?? '' : '', ok: stars[0], title: stars[0] ? `挑战完成 · ${L.name}` : reason === 'timeout' ? '时间到！' : `再试一次 · ${L.name}`, rows, total, stars, labels: L.stars.map(s => s.label), next: !!LVL && LVL < LEVELS.length && unlocked(LVL + 1), combos, board: BOARD, named: score.combo.all().flatMap(ch => ch.named), tricks: score.combo.all().flatMap(ch => ch.tricks), starCount: n, landing: l, inv: +score.bestInverted.toFixed(2), runT: +runT.toFixed(2), flips: score.flips, gas: +(l ? landGas : car.gas).toFixed(2) };
  score.score = total; st = 'result'; panelT = 2;
}
score.onLand = l => {
  if (st !== 'play') return;
  landGas = car.gas;
  if (retroUsed && inZone(l, true)) score.combo.trick('落点精准', 1000);
  retroUsed = false; rig.shake = Math.min(3, l.vy / 4);
  if (L.cliffZ !== undefined && L.plateaus && l.z > (L.plateaus[1]?.z0 ?? -1e9) && car.pos.y < 5) { score.crashed = true; score.msg('坠入峡谷！', true); return; }
  dust.burst(tmpB.copy(car.pos).addScaledVector(car.normal, -0.6), Math.round(320 * P), 2.2);
  const endLanding = L.finishZ === undefined && (L.ramps.length > 0 ? ramped : true) && l.air > 1 && hoverRings.length === 0;
  if (endLanding) { st = 'ending'; endT = 0; slowT = 1.4; }
};
const tmpW = new THREE.Vector3(), tmp = new THREE.Vector3(), tmpD = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpR = new THREE.Vector3();
function fixedStep(c: Controls) {
  const dt = 1 / 60;
  if (st === 'replay') return;
  if (st === 'result') c = { ...emptyControls(), brake: 1 };
  // modifiers + retro assist
  if (L.boostOnce) { if (c.boost) boostSpent = true; else if (boostSpent) boostLock = true; if (boostLock && c.boost) { c = { ...c, boost: false }; } }
  if (!car.grounded) { rayDown.origin = { x: car.pos.x, y: car.pos.y - 0.6, z: car.pos.z }; const h = world.castRay(rayDown, 600, true, undefined, undefined, car.collider, car.body); alt = h ? (h as any).timeOfImpact ?? (h as any).toi : 600; } else alt = 0;
  if (assist && !car.grounded && car.vel.y < -3 && car.up.y > 0.7 && alt < idealH() * 1.1 + 2) c = { ...c, thrust: true };
  car.step(dt, c); world.step(); car.sync(); score.update(dt, car, c, tmpW.copy(car.body.angvel() as any));
  // 喷气缓降: tricks, plumes, ground blast ring, shake, slow-mo near touchdown
  if (L.cliffZ !== undefined && !cliffDone && !car.grounded && car.pos.z < L.cliffZ && airT > 0.3) { cliffDone = true; score.combo.trick('悬崖飞跃', 1000); }
  if (car.retro) {
    if (!retroUsed && car.vel.y < -8) { retroUsed = true; retroStartAlt = alt; const late = alt < 60 && car.vel.y < -15 ? Math.round((60 - alt) * 40) : 0; score.combo.trick('反推', 800 + late); if (late) score.msg(`极限晚刹 +${late}`, true); }
    rig.shake = Math.max(rig.shake, 0.5);
    for (const sx of [-0.8, 0.8]) for (const sz of [-1.2, 1.2]) { const p = tmp.set(sx, -0.4, sz).applyQuaternion(car.quat).add(car.pos); for (let k = 0; k < Math.max(1, Math.round(2 * P)); k++) { flame.emit(p, tmpR.set(0, -34, 0).add(car.vel), 0.22, 2); vapor.emit(p, tmpR.set(0, -30, 0).add(car.vel), 0.9, 3); } }
    if (alt < 30) { const g = tmpB.set(car.pos.x, car.pos.y - alt + 0.3, car.pos.z); const n = Math.round((30 - alt) * 0.6 * P); for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, sp = 18 + (30 - alt) * 1.2; dust.emit(g, tmpR.set(Math.cos(a) * sp, 1 + Math.random() * 3, Math.sin(a) * sp), 1.4, 1); } }
    if (retroUsed && alt < 7 && car.vel.y < 0 && !touchSlow && st === 'play') { touchSlow = true; slowT = 0.9; }
  }
  // wall ride (贴墙) + near miss (擦边)
  if (car.grounded && Math.abs(car.normal.x) > 0.45) { wallT += dt; score.combo.idleT = 0; if (wallT > 0.4 && !wallDone) { wallDone = true; score.combo.trick('贴墙', 600); } } else if (car.grounded) { wallT = 0; if (Math.abs(car.normal.x) < 0.2) wallDone = false; }
  const TR = (handles as any).traffic as any[];
  if (TR?.length && st === 'play') TR.forEach((T, i) => {
    T.z -= T.speed * dt; if (T.z < (L.finishZ ?? -400) - 40) T.z = 220; T.body.setNextKinematicTranslation({ x: T.x, y: 0.75, z: T.z }); T.mesh.position.set(T.x, 0.75, T.z);
    if (!passed.has(i) && car.pos.z < T.z - 2.5 && car.pos.z > T.z - 8 && Math.abs(car.pos.x - T.x) < 5 && !score.crashed) { passed.add(i); score.combo.trick('擦边', 600); }
    if (car.pos.z > T.z + 10) passed.delete(i);
  });
  if ((st === 'play' || st === 'ending') && recN < REC_MAX) { const o = recN * 7; rec[o] = car.pos.x; rec[o + 1] = car.pos.y; rec[o + 2] = car.pos.z; rec[o + 3] = car.quat.x; rec[o + 4] = car.quat.y; rec[o + 5] = car.quat.z; rec[o + 6] = car.quat.w; recN++; }
  // thruster vapor + flames
  if (car.thrusting || car.boosting) for (const nz of thrusterData.nozzles) {
    const isB = !!(nz as any).boost; if (isB ? !car.boosting : !car.thrusting) continue;
    const p = tmp.set(nz.pos[0], nz.pos[1], nz.pos[2]).applyQuaternion(car.quat).add(car.pos);
    const d = tmpD.set(nz.dir[0], nz.dir[1], nz.dir[2]).applyQuaternion(car.quat);
    for (let k = 0; k < Math.max(1, Math.round(2 * P)); k++) flame.emit(p, tmpR.copy(d).multiplyScalar(26).add(car.vel), 0.16, 3);
    if (!isB) for (let k = 0; k < Math.max(1, Math.round(3 * P)); k++) vapor.emit(p, tmpR.copy(d).multiplyScalar(28).add(car.vel), 0.7, 4);
  }
  if (car.grounded) airT = 0; else airT += dt;
  if (car.grounded && car.normal.y < 0.96 && car.pos.y > 0.5) ramped = true;
  // section progress (ramp levels)
  const A = L.ramps[0];
  if (L.sections && A) {
    if (phase === 0) { phaseFrac = THREE.MathUtils.clamp((L.start.pos[2] - car.pos.z) / (L.start.pos[2] - A.z0), 0, 1); if (car.grounded && car.pos.z < A.z0 && car.normal.y < 0.95) phase = 1; }
    if (phase === 1) { phaseFrac = THREE.MathUtils.clamp(Math.acos(THREE.MathUtils.clamp(car.normal.y, -1, 1)) / (Math.PI * 0.6), 0, 1); if (car.grounded && car.normal.y < -0.3) phase = 2; }
    if (phase === 2) phaseFrac = THREE.MathUtils.clamp(score.invertedSec / 1.5, 0, 1);
    if ((phase === 1 || phase === 2) && airT > 0.3) phase = 3;
    if (phase === 3) { phaseFrac = Math.min(1, airT / 5); if (car.grounded && car.normal.y > 0.9) phase = 4; }
    if (phase === 4) phaseFrac = 1;
  }
  // rings
  rings.forEach((r, i) => {
    if (ringDone[i] || r.type === 'hover') return;
    if ((prevZ - r.pos[2]) * (car.pos.z - r.pos[2]) <= 0 && Math.hypot(car.pos.x - r.pos[0], car.pos.y - r.pos[1]) < r.r) {
      ringDone[i] = true;
      if (r.type === 'boost') { car.gas = 1; car.extBoost = 1.2; score.combo.trick('穿环', 300); score.msg('加速环！气罐补满'); }
      else { score.combo.trick('穿环', 1500); score.msg('穿过空中门！', true); }
      setRingLook();
    }
  });
  prevZ = car.pos.z;
  const hr = hoverRings[hoverIdx];
  if (!car.grounded && car.thrusting) lifted = true;
  if (lifted && car.grounded && hoverIdx < hoverRings.length && st === 'play') noGround = false;
  if (hr && st === 'play') {
    const inside = !car.grounded && Math.hypot(car.pos.x - hr.pos[0], car.pos.z - hr.pos[2]) < hr.r && Math.abs(car.pos.y - hr.pos[1]) < 4;
    hoverT = inside ? hoverT + dt : Math.max(0, hoverT - dt);
    if (hoverT >= (hr.hold ?? 2)) { hoverIdx++; hoverT = 0; score.combo.trick('悬停', 1000); score.msg(`光圈 ${hoverIdx}/${hoverRings.length} 完成 +1000`, true); setRingLook(); if (hoverIdx >= hoverRings.length) finalize('hover'); }
  }
  // end conditions
  if (st === 'play') {
    runT += dt;
    if (L.finishZ !== undefined && car.pos.z < L.finishZ && !finished) { finished = true; finalize('finish'); }
    else if (L.timeLimit && runT > L.timeLimit) finalize('timeout');
    else if (score.crashed) { crashT += dt; if (crashT > 1) respawn('翻车'); }
    else if (Math.abs(car.pos.x) > 150 || car.pos.z > 560 || car.pos.z < -780 || car.pos.y < -5) respawn('驶出赛道');
    else if (airT > (L.maxAir ?? 14)) respawn('滞空过久');
  } else if (st === 'ending') { endT += dt; if (car.vel.length() < 3 || endT > 3.5) finalize('land'); }
  else if (st === 'result' && panelT > 0) { panelT -= dt; if (panelT <= 0) showResult(); }
  banner = Math.max(0, banner - dt);
  vapor.update(dt); flame.update(dt); dust.update(dt);
}
function showResult() { if (!result || ui.open) return; ui.result(result, { retry: reset, next: () => go(LVL + 1), replay: startReplay }); }
function startReplay() { if (recN < 2) return; score.msgs = []; st = 'replay'; replayI = 0; replayCam = 0; rig.mode = 0; }
function go(lvl: number) { const u = new URLSearchParams(location.search); u.delete('daily'); u.set('level', String(lvl)); u.set('play', '1'); location.search = u.toString(); }
function goDaily() { const u = new URLSearchParams(location.search); u.delete('level'); u.set('daily', '1'); u.set('play', '1'); location.search = u.toString(); }
const ui = new UI(LEVELS.map(l => ({ id: +l.id.slice(1), name: l.name, desc: l.desc, stars: l.stars.map(s => s.label) })), Q.has('play') || Q.has('level') ? LVL : 0, QUAL.name as QName, go, () => {}, goDaily, { get: () => assist, set: v => { assist = v; localStorage.setItem('invert.assist', v ? '1' : '0'); } });
if (!Q.has('play') && !Q.has('level') && !DAILY) ui.main();

let forced: Controls | null = null; let acc = 0; let last = performance.now(); let fps = 60; let fc = 0, ft = 0;
const ftimes: number[] = []; let lookLock = false;
function frame() {
  const now = performance.now(); const rdt = Math.min(0.1, (now - last) / 1000); ftimes.push(now - last); adapt(now - last); if (ftimes.length > 600) ftimes.shift(); last = now; fc++; ft += rdt; if (ft > 0.5) { fps = Math.round(fc / ft); fc = 0; ft = 0; }
  const c = forced ?? (ui.open ? emptyControls() : mergeTouch(readControls()));
  while (pressedOnce.length) { const k = pressedOnce.shift(); if (k === 'KeyR') { if (ui.open) ui.close(); reset(); } if (k === 'KeyC') rig.next(); if (k === 'KeyG') { assist = !assist; localStorage.setItem('invert.assist', assist ? '1' : '0'); score.msg(`喷气缓降辅助：${assist ? '开' : '关'}`); } if (k === 'KeyT') car.V.air.stabilize = car.V.air.stabilize ? 0 : 3; }
  const ts = slowT > 0 ? 0.3 : 1; slowT = Math.max(0, slowT - rdt); const dt = rdt * ts;
  if (st === 'replay') {
    replayI += rdt * 60; const i = Math.floor(replayI);
    if (i >= recN - 1) { st = 'result'; car.sync(); showResult(); }
    else {
      const o = i * 7; const n = (i + 1) * 7;
      car.vel.set(rec[n] - rec[o], rec[n + 1] - rec[o + 1], rec[n + 2] - rec[o + 2]).multiplyScalar(60);
      car.pos.set(rec[o], rec[o + 1], rec[o + 2]); car.quat.set(rec[o + 3], rec[o + 4], rec[o + 5], rec[o + 6]);
      car.up.set(0, 1, 0).applyQuaternion(car.quat); car.fwd.set(0, 0, -1).applyQuaternion(car.quat);
      car.mesh.position.copy(car.pos); car.mesh.quaternion.copy(car.quat);
      const cam = L.cliffZ !== undefined && rec[o + 2] < L.cliffZ + 30 && rec[o + 1] > 22 ? 4 : Math.floor(i / 180) % 3; if (cam !== replayCam) { replayCam = cam; rig.mode = cam === 4 ? 4 : [0, 1, 2][cam]; }
    }
  } else if (!forced) { acc += dt; let n = 0; while (acc >= 1 / 60 && n < 5) { fixedStep(c); acc -= 1 / 60; n++; } if (n === 5) acc = 0; }
  if (!lookLock) rig.update(rdt, car);
  key.position.copy(car.pos).add(KOFF); key.target.position.copy(car.pos); key.target.updateMatrixWorld();
  (scene.userData.sky as THREE.Object3D)?.position.copy(camera.position);
  if (rain) { const a = rain.geometry.attributes.position as THREE.BufferAttribute; const arr = a.array as Float32Array; for (let i = 0; i < arr.length; i += 3) { arr[i + 1] -= 40 * rdt; if (arr[i + 1] < -40) arr[i + 1] += 80; } a.needsUpdate = true; rain.position.copy(camera.position); }
  render();
  requestAnimationFrame(frame);
}
renderer.info.autoReset = false;
const HINT = MOBILE ? '' : 'W/S 油门刹车  A/D 转向  Shift 吸地  空格 推进器  方向键/QE 空中姿态  F 喷射  C 镜头  R 重来  Esc 菜单';
const starInfo = L.stars.map((s, i) => ({ label: s.label, ok: best > i }));
function objective(): string {
  const parts: string[] = [];
  if (L.timeLimit || L.finishZ !== undefined) parts.push(`用时 ${runT.toFixed(1)}s${L.timeLimit ? ' / ' + L.timeLimit + 's' : ''}`);
  const nb = rings.filter(r => r.type !== 'hover').length; if (nb) parts.push(`${rings[0].type === 'gate' ? '空中门' : '加速环'} ${ringDone.filter(Boolean).length}/${nb}`);
  if (hoverRings.length) parts.push(`光圈 ${hoverIdx}/${hoverRings.length}  悬停 ${hoverT.toFixed(1)}/${hoverRings[hoverIdx]?.hold ?? 2}s`);
  if (st === 'replay') parts.unshift('▶ 回放中'); return parts.join('   ');
}
function render() {
  renderer.info.reset(); composer.render();
  const sp = car.vel.length();
  const ih = idealH(); const showRadar = st !== 'replay' && !car.grounded && (alt > 12 || L.cliffZ !== undefined) && car.vel.y < -2;
  hud.draw(car, score, { radar: showRadar ? { alt, vy: car.vel.y, ideal: ih, inBand: alt < ih * 1.25 && alt > ih * 0.8, prompt: car.retro ? '反推中' : alt < ih * 1.25 ? (alt < ih * 0.8 ? '太晚了！全力反推！' : '现在反推！') : '' } : undefined, cam: CAMS[rig.mode], level: DAILY ? L.name : `L${LVL} ${L.name}`, stars: starInfo, fps, hint: HINT,
    debug: DEBUG ? `${fps} FPS  ${(ftimes[ftimes.length - 1] ?? 0).toFixed(1)}ms  calls ${renderer.info.render.calls}  tris ${renderer.info.render.triangles}  画质 ${QUAL.name} x${(BASE_DPR * scale).toFixed(2)} ${downgrades.join(',')}` : '',
    compact: MOBILE, sections: L.sections ? SECTIONS : undefined, phase, phaseFrac, objective: objective(),
    banner: banner > 0 && st === 'play' && !ui.open ? (MOBILE ? L.hintTouch ?? L.hint ?? '' : L.hint ?? '') : '', bannerA: Math.min(1, banner), speedFx: st === 'replay' ? 0 : THREE.MathUtils.clamp((sp - 38) / 35, 0, 1) });
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
reset();
// test hooks
(window as any).__game = {
  level: LVL, levelId: L.id, ldesc: (L as any).tpl ?? '', board: BOARD, quality: QUAL.name, setAssist(v: boolean) { assist = v; }, idealH,
  sim(sec: number, c: Partial<Controls>) { forced = { ...emptyControls(), ...c }; for (let i = 0; i < Math.round(sec * 60); i++) fixedStep(forced); rig.update(1 / 60, car, true); },
  perf() { const a = ftimes.slice(-120); return { avgMs: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1), calls: renderer.info.render.calls, scale: +(BASE_DPR * scale).toFixed(2), quality: QUAL.name, downgrades, touch: { ...touch }, tris: renderer.info.render.triangles, w: renderer.domElement.width, h: renderer.domElement.height }; },
  look(p: number[], t: number[]) { lookLock = true; forced = emptyControls(); rig.mode = 0; camera.position.fromArray(p); camera.up.set(0, 1, 0); camera.lookAt(t[0], t[1], t[2]); (scene.userData.sky as THREE.Object3D)?.position.copy(camera.position); render(); },
  release() { forced = null; }, setCam(i: number) { rig.mode = i; rig.update(1 / 60, car, true); }, reset, replay: startReplay, showResult, ui,
  result: () => result, recN: () => recN,
  modelLoaded: () => car.modelLoaded && skyOk && sceneryLoaded >= 0 && (car.wheelModel || Q.has('greybox')),
  state: () => ({ st, phase: SECTIONS[phase], pos: car.pos.toArray().map(x => +x.toFixed(2)), up: car.up.toArray().map(x => +x.toFixed(2)), normal: car.normal.toArray().map(x => +x.toFixed(2)), speed: +car.vel.length().toFixed(1), vy: +car.vel.y.toFixed(1), vx: +car.vel.x.toFixed(1), grounded: car.grounded, contacts: car.contacts, gas: +car.gas.toFixed(2), df: Math.round(car.downforceN / 9.81), score: Math.round(score.score), stunt: Math.round(score.stunt), inv: +score.bestInverted.toFixed(2), flips: score.flips, alt: +alt.toFixed(1), retro: car.retro, combo: { chain: [...score.combo.chain], mult: score.combo.mult, all: score.combo.all() }, runT: +runT.toFixed(2), rings: [...ringDone], hoverIdx, hoverT: +hoverT.toFixed(2), crashed: score.crashed, landing: score.landing, msgs: score.msgs.map(m => m.t) }),
};
