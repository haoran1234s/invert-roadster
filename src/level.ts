import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import RAPIER from '@dimforge/rapier3d-compat';
export interface LevelData { id: string; name: string; desc: string; start: { pos: number[]; yawDeg: number }; runway: { length: number; width: number; zStart: number; lightSpacing: number }; ramp: { z0: number; radius: number; width: number; endDeg: number; segments: number }; checkpoints: { pos: number[]; yawDeg: number; z: number }[]; stars: { type: string; value: number; label: string }[]; }

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
  const key = new THREE.DirectionalLight(0xfff0dd, 2.4); key.position.set(-120, 160, 120); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff9a70, 1.0); rim.position.set(60, 40, -300); scene.add(rim);
  const tex = (draw: (x: CanvasRenderingContext2D, n: number) => void, n = 256, rx = 1, ry = 1) => { const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d')!; draw(x, n); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = matchMedia('(pointer: coarse)').matches ? 1 : 4; t.colorSpace = THREE.SRGBColorSpace; return t; };
  // ground: lighter with 10m grid
  const gridTex = tex((x, n) => { x.fillStyle = '#4b5361'; x.fillRect(0, 0, n, n); x.strokeStyle = '#7d8798'; x.lineWidth = 3; x.strokeRect(0, 0, n, n); x.strokeStyle = '#5d6676'; x.lineWidth = 1; x.beginPath(); x.moveTo(n / 2, 0); x.lineTo(n / 2, n); x.moveTo(0, n / 2); x.lineTo(n, n / 2); x.stroke(); }, 128, 100, 100);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshLambertMaterial({ map: gridTex }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  world.createCollider(RAPIER.ColliderDesc.cuboid(1000, 1, 1000).setTranslation(0, -1, 0).setFriction(1));
  const R = L.runway;
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(R.width, R.length), new THREE.MeshLambertMaterial({ map: tex((x, n) => { x.fillStyle = '#6a707c'; x.fillRect(0, 0, n, n); for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},0.06)`; x.fillRect(Math.random() * n, Math.random() * n, 3, 3); } x.fillStyle = '#7c8390'; x.fillRect(0, 0, n, n * 0.08); }, 256, 2, R.length / 20) }));
  rw.rotation.x = -Math.PI / 2; rw.position.set(0, 0.01, R.zStart - R.length / 2); scene.add(rw);
  // center dashes
  const dashGeo = new THREE.PlaneGeometry(0.4, 4); dashGeo.rotateX(-Math.PI / 2);
  const nD = Math.floor(R.length / 12); const dashes = new THREE.InstancedMesh(dashGeo, new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }), nD);
  const m = new THREE.Matrix4(); for (let i = 0; i < nD; i++) { m.makeTranslation(0, 0.02, R.zStart - i * 12); dashes.setMatrixAt(i, m); } scene.add(dashes);
  // red edge lights
  const nL = Math.floor(R.length / R.lightSpacing) * 2;
  const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }), nL);
  for (let i = 0; i < nL / 2; i++) for (const s of [-1, 1]) { m.makeTranslation(s * (R.width / 2 + 0.4), 0.2, R.zStart - i * R.lightSpacing); lights.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), m); }
  scene.add(lights);
  // curved ramp: arc toward -Z, past vertical into overhang
  const A = L.ramp; const W = A.width / 2; const end = A.endDeg * Math.PI / 180;
  const pts: THREE.Vector3[] = [];
  const pos: number[] = []; const idx: number[] = []; const uv: number[] = [];
  const thick = 1.2;
  for (let i = 0; i <= A.segments; i++) {
    const t = end * i / A.segments; const y = A.radius - A.radius * Math.cos(t); const z = A.z0 - A.radius * Math.sin(t);
    pts.push(new THREE.Vector3(0, y, z));
    // inner surface (driving) then outer skin offset outward from center
    const oy = y - Math.cos(t) * thick, oz = z - Math.sin(t) * thick;
    pos.push(-W, y, z, W, y, z, -W, oy, oz, W, oy, oz); const v = A.radius * t / 6; uv.push(0, v, 1, v, 0, v, 1, v);
  }
  for (let i = 0; i < A.segments; i++) {
    const a = i * 4, b = (i + 1) * 4;
    idx.push(a, b, a + 1, a + 1, b, b + 1); // inner
    idx.push(a + 2, a + 3, b + 2, a + 3, b + 3, b + 2); // outer
    idx.push(a, a + 2, b, a + 2, b + 2, b); idx.push(a + 1, b + 1, a + 3, a + 3, b + 1, b + 3); // sides
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const rampMesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, emissive: 0x222838, map: tex((x, n) => { x.fillStyle = '#b9c0cc'; x.fillRect(0, 0, n, n); x.fillStyle = '#e8eef8'; x.fillRect(0, 0, n * 0.04, n); x.fillRect(n * 0.96, 0, n * 0.04, n); x.fillStyle = '#ffb030'; x.beginPath(); x.moveTo(n * 0.3, n * 0.75); x.lineTo(n * 0.5, n * 0.45); x.lineTo(n * 0.7, n * 0.75); x.lineTo(n * 0.62, n * 0.75); x.lineTo(n * 0.5, n * 0.58); x.lineTo(n * 0.38, n * 0.75); x.fill(); }) }));
  scene.add(rampMesh);
  // collider only inner driving surface (double triangles irrelevant for raycast)
  const ip: number[] = []; const ii: number[] = [];
  for (let i = 0; i <= A.segments; i++) { ip.push(pos[i * 12], pos[i * 12 + 1], pos[i * 12 + 2], pos[i * 12 + 3], pos[i * 12 + 4], pos[i * 12 + 5]); }
  for (let i = 0; i < A.segments; i++) { const a = i * 2, b = a + 2; ii.push(a, b, a + 1, a + 1, b, b + 1); }
  world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(ip), new Uint32Array(ii)).setFriction(0.8).setCollisionGroups(0x00020002));
  // neon edges
  const neon = new THREE.MeshBasicMaterial({ color: 0xff3a4a });
  const neonG: THREE.BufferGeometry[] = []; for (const s of [-1, 1]) { const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(s * (W + 0.1), p.y, p.z))); neonG.push(new THREE.TubeGeometry(c, 120, 0.18, 6)); }
  scene.add(new THREE.Mesh(mergeGeometries(neonG), neon)); // merged: 1 draw call
  // truss legs
  const truss = new THREE.MeshLambertMaterial({ color: 0x7a8494, emissive: 0x1a1e28 });
  const legs: THREE.BufferGeometry[] = [];
  for (let i = 8; i <= A.segments; i += 8) { const p = pts[i]; if (p.y < 3) continue; for (const s of [-1, 1]) { legs.push(new THREE.BoxGeometry(0.6, p.y, 0.6).translate(s * (W + 1.5), p.y / 2, p.z - 3)); } }
  const tb = new THREE.CylinderGeometry(3, 4, 30, 12).translate(-60, 15, 80);
  const hg = new THREE.CylinderGeometry(22, 22, 50, 24, 1, false, 0, Math.PI); hg.rotateZ(Math.PI / 2); hg.rotateY(Math.PI / 2); hg.translate(70, 0, 160);
  scene.add(new THREE.Mesh(mergeGeometries([...legs, tb, hg].map(g => g.toNonIndexed())), truss)); // merged static props
  // tower + hangar props (swappable later)
  const tower = new THREE.Group();
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(6, 5, 5, 16), new THREE.MeshStandardMaterial({ color: 0x223344, emissive: 0x335577, emissiveIntensity: 0.8 })); cab.position.y = 32; tower.add(cab);
  tower.position.set(-60, 0, 80); scene.add(tower);
  // --- orientation aids (all unlit, merged/instanced) ---
  const edgeG: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) edgeG.push(new THREE.PlaneGeometry(0.5, R.length).rotateX(-Math.PI / 2).translate(sx * (R.width / 2 - 0.6), 0.025, R.zStart - R.length / 2));
  scene.add(new THREE.Mesh(mergeGeometries(edgeG), new THREE.MeshBasicMaterial({ color: 0x6fc9d8 })));
  // chevrons pointing toward ramp (-Z)
  const chev = new THREE.Shape(); chev.moveTo(0, 3); chev.lineTo(4, -1); chev.lineTo(2.6, -1); chev.lineTo(0, 1.4); chev.lineTo(-2.6, -1); chev.lineTo(-4, -1); chev.closePath();
  const cg = new THREE.ShapeGeometry(chev); cg.rotateX(-Math.PI / 2); const zs: number[] = []; for (let z = 215; z > 15; z -= 25) zs.push(z);
  const chevs = new THREE.InstancedMesh(cg, new THREE.MeshBasicMaterial({ color: 0xffc23a }), zs.length);
  zs.forEach((z, i) => { m.makeTranslation(0, 0.03, z); chevs.setMatrixAt(i, m); }); scene.add(chevs);
  // distance boards (distance to ramp entry)
  for (const d of [200, 100, 50]) for (const sx of [-1, 1]) {
    const t = tex((x, n) => { x.fillStyle = '#10131c'; x.fillRect(0, 0, n, n / 2); x.strokeStyle = '#ffc23a'; x.lineWidth = 8; x.strokeRect(4, 4, n - 8, n / 2 - 8); x.fillStyle = '#ffffff'; x.font = 'bold 72px Consolas, monospace'; x.textAlign = 'center'; x.fillText(d + 'm', n / 2, n / 4 + 26); }, 256);
    t.repeat.set(1, 0.5); t.offset.set(0, 0.5);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
    board.position.set(sx * (R.width / 2 + 5), 4.5, A.z0 + d); scene.add(board);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3, 0.25), new THREE.MeshBasicMaterial({ color: 0x222831 })); post.position.set(sx * (R.width / 2 + 5), 1.5, A.z0 + d); scene.add(post);
  }
  // landing zone (behind start: the car flies backwards off the overhang)
  const lz = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(40, 110).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x23e08a, transparent: true, opacity: 0.18, depthWrite: false })); pad.position.set(0, 0.04, 285); lz.add(pad);
  const bg: THREE.BufferGeometry[] = []; for (const sx of [-1, 1]) bg.push(new THREE.PlaneGeometry(0.6, 110).rotateX(-Math.PI / 2).translate(sx * 20, 0.05, 285)); for (const z of [230, 340]) bg.push(new THREE.PlaneGeometry(40, 0.6).rotateX(-Math.PI / 2).translate(0, 0.05, z));
  lz.add(new THREE.Mesh(mergeGeometries(bg), new THREE.MeshBasicMaterial({ color: 0x3dffa0 })));
  const lt = tex((x, n) => { x.clearRect(0, 0, n, n); x.fillStyle = '#3dffa0'; x.font = 'bold 54px "Microsoft YaHei", sans-serif'; x.textAlign = 'center'; x.fillText('LANDING 落地区', n, 80); }, 512); lt.repeat.set(1, 0.25); lt.offset.set(0, 0.75);
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(24, 3).rotateX(-Math.PI / 2).rotateY(Math.PI), new THREE.MeshBasicMaterial({ map: lt, transparent: true, depthWrite: false })); lbl.position.set(0, 0.06, 320); lz.add(lbl);
  scene.add(lz);
  // stars
  const sg = new THREE.BufferGeometry(); const sp: number[] = []; for (let i = 0; i < 800; i++) { const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y) * 0.8 + 0.2; v.multiplyScalar(900); sp.push(v.x, v.y, v.z); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, fog: false, transparent: true, opacity: 0.7 })));
}
