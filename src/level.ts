import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import RAPIER from '@dimforge/rapier3d-compat';
export interface LevelData { id: string; name: string; desc: string; start: { pos: number[]; yawDeg: number }; runway: { length: number; width: number; zStart: number; lightSpacing: number }; ramps: { z0: number; x?: number; radius: number; width: number; endDeg: number; segments: number }[]; zones?: { x: number; z: number; w: number; l: number; label?: string; precise?: boolean }[]; rings?: { pos: number[]; r: number; type: 'boost' | 'hover' | 'gate'; hold?: number }[]; finishZ?: number; timeLimit?: number; tankSec?: number; maxAir?: number; sections?: boolean; hint?: string; hintTouch?: string; checkpoints: { pos: number[]; yawDeg: number; z: number }[]; stars: { label: string; all: { t: string; v?: any }[] }[]; }

export function buildLevel(L: LevelData, scene: THREE.Scene, world: RAPIER.World) {
  // dusk sky: gradient dome (unlit), visible horizon
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x0d1d45) }, mid: { value: new THREE.Color(0x3b3f78) }, hor: { value: new THREE.Color(0xd9785a) } },
    vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 hor; varying vec3 vp; void main(){ float h = vp.y; vec3 c = h < 0.0 ? hor * 0.55 : mix(hor, mid, smoothstep(0.0, 0.18, h)); c = mix(c, top, smoothstep(0.18, 0.7, h)); gl_FragColor = vec4(c, 1.0); }' }));
  sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky); (scene as any).userData.sky = sky;
  scene.background = new THREE.Color(0x3b3f78);
  scene.fog = new THREE.Fog(0x4a4470, 250, 1200);
  scene.add(new THREE.HemisphereLight(0xaac4ff, 0x4a4038, 1.6));
  const key = new THREE.DirectionalLight(0xfff0dd, 2.4); key.position.set(-120, 160, 120); scene.add(key); scene.add(key.target); scene.userData.key = key;
  const rim = new THREE.DirectionalLight(0xff9a70, 1.0); rim.position.set(60, 40, -300); scene.add(rim);
  const tex = (draw: (x: CanvasRenderingContext2D, n: number) => void, n = 256, rx = 1, ry = 1) => { const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d')!; draw(x, n); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = matchMedia('(pointer: coarse)').matches ? 1 : 4; t.colorSpace = THREE.SRGBColorSpace; return t; };
  // ground: lighter with 10m grid
  const gridTex = tex((x, n) => { x.fillStyle = '#4b5361'; x.fillRect(0, 0, n, n); x.strokeStyle = '#7d8798'; x.lineWidth = 3; x.strokeRect(0, 0, n, n); x.strokeStyle = '#5d6676'; x.lineWidth = 1; x.beginPath(); x.moveTo(n / 2, 0); x.lineTo(n / 2, n); x.moveTo(0, n / 2); x.lineTo(n, n / 2); x.stroke(); }, 128, 100, 100);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  world.createCollider(RAPIER.ColliderDesc.cuboid(1000, 1, 1000).setTranslation(0, -1, 0).setFriction(1));
  const R = L.runway;
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(R.width, R.length), new THREE.MeshStandardMaterial({ roughness: 0.85, map: tex((x, n) => { x.fillStyle = '#6a707c'; x.fillRect(0, 0, n, n); for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},0.06)`; x.fillRect(Math.random() * n, Math.random() * n, 3, 3); } x.fillStyle = '#7c8390'; x.fillRect(0, 0, n, n * 0.08); }, 256, 2, R.length / 20) }));
  rw.rotation.x = -Math.PI / 2; rw.position.set(0, 0.01, R.zStart - R.length / 2); rw.receiveShadow = true; scene.add(rw);
  // center dashes
  const dashGeo = new THREE.PlaneGeometry(0.4, 4); dashGeo.rotateX(-Math.PI / 2);
  const nD = Math.floor(R.length / 12); const dashes = new THREE.InstancedMesh(dashGeo, new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }), nD);
  const m = new THREE.Matrix4(); for (let i = 0; i < nD; i++) { m.makeTranslation(0, 0.02, R.zStart - i * 12); dashes.setMatrixAt(i, m); } scene.add(dashes);
  // red edge lights
  const nL = Math.floor(R.length / R.lightSpacing) * 2;
  const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }), nL);
  for (let i = 0; i < nL / 2; i++) for (const s of [-1, 1]) { m.makeTranslation(s * (R.width / 2 + 0.4), 0.2, R.zStart - i * R.lightSpacing); lights.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), m); }
  scene.add(lights);
  const truss = new THREE.MeshStandardMaterial({ color: 0x7a8494, roughness: 0.6, metalness: 0.4 });
  const rampMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.75, metalness: 0.05, emissive: 0x161a26, map: tex((x, n) => { x.fillStyle = '#b9c0cc'; x.fillRect(0, 0, n, n); x.fillStyle = '#e8eef8'; x.fillRect(0, 0, n * 0.04, n); x.fillRect(n * 0.96, 0, n * 0.04, n); x.fillStyle = '#ffb030'; x.beginPath(); x.moveTo(n * 0.3, n * 0.75); x.lineTo(n * 0.5, n * 0.45); x.lineTo(n * 0.7, n * 0.75); x.lineTo(n * 0.62, n * 0.75); x.lineTo(n * 0.5, n * 0.58); x.lineTo(n * 0.38, n * 0.75); x.fill(); }) });
  const neon = new THREE.MeshBasicMaterial({ color: 0xff3a4a });
  const legs: THREE.BufferGeometry[] = [];
  for (const A of L.ramps) {
    // curved ramp: arc toward -Z (endDeg>90 = overhang)
    const W = A.width / 2; const end = A.endDeg * Math.PI / 180; const X = A.x ?? 0;
    const pts: THREE.Vector3[] = []; const pos: number[] = []; const idx: number[] = []; const uv: number[] = [];
    const thick = 1.2;
    for (let i = 0; i <= A.segments; i++) {
      const t = end * i / A.segments; const y = A.radius - A.radius * Math.cos(t); const z = A.z0 - A.radius * Math.sin(t);
      pts.push(new THREE.Vector3(X, y, z));
      const oy = y - Math.cos(t) * thick, oz = z - Math.sin(t) * thick;
      pos.push(X - W, y, z, X + W, y, z, X - W, oy, oz, X + W, oy, oz); const v = A.radius * t / 6; uv.push(0, v, 1, v, 0, v, 1, v);
    }
    for (let i = 0; i < A.segments; i++) {
      const a = i * 4, b = (i + 1) * 4;
      idx.push(a, b, a + 1, a + 1, b, b + 1); idx.push(a + 2, a + 3, b + 2, a + 3, b + 3, b + 2);
      idx.push(a, a + 2, b, a + 2, b + 2, b); idx.push(a + 1, b + 1, a + 3, a + 3, b + 1, b + 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const rampMesh = new THREE.Mesh(g, rampMat); rampMesh.castShadow = rampMesh.receiveShadow = true; scene.add(rampMesh);
    const ip: number[] = []; const ii: number[] = [];
    for (let i = 0; i <= A.segments; i++) ip.push(...pos.slice(i * 12, i * 12 + 6));
    for (let i = 0; i < A.segments; i++) { const a = i * 2, b = a + 2; ii.push(a, b, a + 1, a + 1, b, b + 1); }
    world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(ip), new Uint32Array(ii)).setFriction(0.8).setCollisionGroups(0x00020002));
    const neonG: THREE.BufferGeometry[] = []; for (const s of [-1, 1]) { const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(X + s * (W + 0.1), p.y, p.z))); neonG.push(new THREE.TubeGeometry(c, Math.max(12, A.segments), 0.18, 6)); }
    scene.add(new THREE.Mesh(mergeGeometries(neonG), neon));
    for (let i = 8; i <= A.segments; i += 8) { const p = pts[i]; if (p.y < 3) continue; for (const s of [-1, 1]) legs.push(new THREE.BoxGeometry(0.6, p.y, 0.6).translate(X + s * (W + 1.5), p.y / 2, p.z - 3)); }
  }
  const tb = new THREE.CylinderGeometry(3, 4, 30, 12).translate(-60, 15, 80);
  const hg = new THREE.CylinderGeometry(22, 22, 50, 24, 1, false, 0, Math.PI); hg.rotateZ(Math.PI / 2); hg.rotateY(Math.PI / 2); hg.translate(70, 0, 160);
  if (legs.length) { const lm = new THREE.Mesh(mergeGeometries(legs.map(g => g.toNonIndexed())), truss); lm.castShadow = true; scene.add(lm); }
  const greyProps = new THREE.Mesh(mergeGeometries([tb, hg].map(g => g.toNonIndexed())), truss); scene.add(greyProps);
  const tower = new THREE.Group();
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(6, 5, 5, 16), new THREE.MeshStandardMaterial({ color: 0x223344, emissive: 0x335577, emissiveIntensity: 0.8 })); cab.position.y = 32; tower.add(cab);
  tower.position.set(-60, 0, 80); scene.add(tower);
  const handles = { runway: rw, dashes, lights, props: [greyProps, tower] as THREE.Object3D[], rings: [] as THREE.Mesh[] };
  // --- orientation aids ---
  const edgeG: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) edgeG.push(new THREE.PlaneGeometry(0.5, R.length).rotateX(-Math.PI / 2).translate(sx * (R.width / 2 - 0.6), 0.025, R.zStart - R.length / 2));
  scene.add(new THREE.Mesh(mergeGeometries(edgeG), new THREE.MeshBasicMaterial({ color: 0x6fc9d8 })));
  const target = L.ramps[0]?.z0 ?? L.finishZ ?? 0;
  const chev = new THREE.Shape(); chev.moveTo(0, 3); chev.lineTo(4, -1); chev.lineTo(2.6, -1); chev.lineTo(0, 1.4); chev.lineTo(-2.6, -1); chev.lineTo(-4, -1); chev.closePath();
  const cg = new THREE.ShapeGeometry(chev); cg.rotateX(-Math.PI / 2); const zs: number[] = []; for (let z = L.start.pos[2] - 15; z > target + 15; z -= 25) zs.push(z);
  if (zs.length) { const chevs = new THREE.InstancedMesh(cg, new THREE.MeshBasicMaterial({ color: 0xffc23a }), zs.length); zs.forEach((z, i) => { m.makeTranslation(0, 0.03, z); chevs.setMatrixAt(i, m); }); scene.add(chevs); }
  for (const d of [200, 100, 50]) for (const sx of [-1, 1]) {
    if (target + d > L.start.pos[2]) continue;
    const t = tex((x, n) => { x.fillStyle = '#10131c'; x.fillRect(0, 0, n, n / 2); x.strokeStyle = '#ffc23a'; x.lineWidth = 8; x.strokeRect(4, 4, n - 8, n / 2 - 8); x.fillStyle = '#ffffff'; x.font = 'bold 72px Consolas, monospace'; x.textAlign = 'center'; x.fillText(d + 'm', n / 2, n / 4 + 26); }, 256);
    t.repeat.set(1, 0.5); t.offset.set(0, 0.5);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
    board.position.set(sx * (R.width / 2 + 5), 4.5, target + d); scene.add(board);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3, 0.25), new THREE.MeshBasicMaterial({ color: 0x222831 })); post.position.set(sx * (R.width / 2 + 5), 1.5, target + d); scene.add(post);
  }
  // landing zones (green = bonus, red = precision)
  for (const Z of L.zones ?? []) {
    const col = Z.precise ? 0xff4060 : 0x3dffa0;
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(Z.w, Z.l).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.2, depthWrite: false })); pad.position.set(Z.x, 0.04 + (Z.precise ? 0.01 : 0), Z.z); scene.add(pad);
    const bg: THREE.BufferGeometry[] = []; for (const sx of [-1, 1]) bg.push(new THREE.PlaneGeometry(0.6, Z.l).rotateX(-Math.PI / 2).translate(Z.x + sx * Z.w / 2, 0.06, Z.z)); for (const sz of [-1, 1]) bg.push(new THREE.PlaneGeometry(Z.w, 0.6).rotateX(-Math.PI / 2).translate(Z.x, 0.06, Z.z + sz * Z.l / 2));
    scene.add(new THREE.Mesh(mergeGeometries(bg), new THREE.MeshBasicMaterial({ color: col })));
    const lt = tex((x, n) => { x.clearRect(0, 0, n, n); x.fillStyle = Z.precise ? '#ff6080' : '#3dffa0'; x.font = 'bold 54px "Microsoft YaHei", sans-serif'; x.textAlign = 'center'; x.fillText(Z.label ?? '落地区', n, 80); }, 512); lt.repeat.set(1, 0.25); lt.offset.set(0, 0.75);
    const lbl = new THREE.Mesh(new THREE.PlaneGeometry(24, 3).rotateX(-Math.PI / 2).rotateY(Math.PI), new THREE.MeshBasicMaterial({ map: lt, transparent: true, depthWrite: false })); lbl.position.set(Z.x, 0.07, Z.z + Z.l / 2 - 4); scene.add(lbl);
  }
  // rings: boost (vertical, cyan) / hover (horizontal light circle + beam) / gate (vertical, orange)
  for (const r of L.rings ?? []) {
    const col = r.type === 'boost' ? 0x40e8ff : r.type === 'hover' ? 0xffe060 : 0xff9a30;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r.r, r.type === 'hover' ? 0.35 : 0.5, 10, 48), new THREE.MeshBasicMaterial({ color: col }));
    ring.position.fromArray(r.pos); if (r.type === 'hover') ring.rotation.x = Math.PI / 2; scene.add(ring); handles.rings.push(ring);
    if (r.type === 'hover') { const beam = new THREE.Mesh(new THREE.CylinderGeometry(r.r, r.r, 8, 32, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })); beam.position.fromArray(r.pos); ring.userData.beam = beam; scene.add(beam); }
    else if (r.pos[1] > r.r + 1) { const pole = new THREE.Mesh(new THREE.BoxGeometry(0.4, r.pos[1] - r.r, 0.4), truss); pole.position.set(r.pos[0] + r.r + 1, (r.pos[1] - r.r) / 2, r.pos[2]); scene.add(pole); }
  }
  if (L.finishZ !== undefined) {
    const fin = new THREE.Mesh(new THREE.PlaneGeometry(R.width, 3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex((x, n) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x.fillRect(i * n / 8, j * n / 2, n / 8, n / 2); } }, 128, 4, 1) }));
    fin.position.set(0, 0.05, L.finishZ); scene.add(fin);
    const arch = new THREE.Mesh(new THREE.BoxGeometry(R.width + 4, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffc23a })); arch.position.set(0, 9, L.finishZ); scene.add(arch);
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9, 0.8), truss); p.position.set(sx * (R.width / 2 + 2), 4.5, L.finishZ); scene.add(p); }
  }
  // stars
  const sg = new THREE.BufferGeometry(); const sp: number[] = []; for (let i = 0; i < 800; i++) { const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y) * 0.8 + 0.2; v.multiplyScalar(900); sp.push(v.x, v.y, v.z); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, fog: false, transparent: true, opacity: 0.7 })));
  return handles;
}
