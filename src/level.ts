import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
export interface LevelData { id: string; name: string; desc: string; start: { pos: number[]; yawDeg: number }; runway: { length: number; width: number; zStart: number; lightSpacing: number }; ramp: { z0: number; radius: number; width: number; endDeg: number; segments: number }; checkpoints: { pos: number[]; yawDeg: number; z: number }[]; stars: { type: string; value: number; label: string }[]; }

export function buildLevel(L: LevelData, scene: THREE.Scene, world: RAPIER.World) {
  scene.background = new THREE.Color(0x05070d);
  scene.fog = new THREE.Fog(0x05070d, 120, 700);
  scene.add(new THREE.HemisphereLight(0x8899cc, 0x111111, 0.6));
  const moon = new THREE.DirectionalLight(0xaabbff, 1.2); moon.position.set(-80, 120, 60); scene.add(moon);
  for (const z of [-20, 120]) { const s = new THREE.PointLight(0xffffff, 900, 300, 1.4); s.position.set(70, 60, z); scene.add(s); }
  // ground + runway
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  world.createCollider(RAPIER.ColliderDesc.cuboid(1000, 1, 1000).setTranslation(0, -1, 0).setFriction(1));
  const R = L.runway;
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(R.width, R.length), new THREE.MeshStandardMaterial({ color: 0x24272e, roughness: 0.85 }));
  rw.rotation.x = -Math.PI / 2; rw.position.set(0, 0.01, R.zStart - R.length / 2); scene.add(rw);
  // center dashes
  const dashGeo = new THREE.PlaneGeometry(0.4, 4); dashGeo.rotateX(-Math.PI / 2);
  const nD = Math.floor(R.length / 12); const dashes = new THREE.InstancedMesh(dashGeo, new THREE.MeshBasicMaterial({ color: 0x777777 }), nD);
  const m = new THREE.Matrix4(); for (let i = 0; i < nD; i++) { m.makeTranslation(0, 0.02, R.zStart - i * 12); dashes.setMatrixAt(i, m); } scene.add(dashes);
  // red edge lights
  const nL = Math.floor(R.length / R.lightSpacing) * 2;
  const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }), nL);
  for (let i = 0; i < nL / 2; i++) for (const s of [-1, 1]) { m.makeTranslation(s * (R.width / 2 + 0.4), 0.2, R.zStart - i * R.lightSpacing); lights.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), m); }
  scene.add(lights);
  // curved ramp: arc toward -Z, past vertical into overhang
  const A = L.ramp; const W = A.width / 2; const end = A.endDeg * Math.PI / 180;
  const pts: THREE.Vector3[] = [];
  const pos: number[] = []; const idx: number[] = [];
  const thick = 1.2;
  for (let i = 0; i <= A.segments; i++) {
    const t = end * i / A.segments; const y = A.radius - A.radius * Math.cos(t); const z = A.z0 - A.radius * Math.sin(t);
    pts.push(new THREE.Vector3(0, y, z));
    // inner surface (driving) then outer skin offset outward from center
    const oy = y - Math.cos(t) * thick, oz = z - Math.sin(t) * thick;
    pos.push(-W, y, z, W, y, z, -W, oy, oz, W, oy, oz);
  }
  for (let i = 0; i < A.segments; i++) {
    const a = i * 4, b = (i + 1) * 4;
    idx.push(a, b, a + 1, a + 1, b, b + 1); // inner
    idx.push(a + 2, a + 3, b + 2, a + 3, b + 3, b + 2); // outer
    idx.push(a, a + 2, b, a + 2, b + 2, b); idx.push(a + 1, b + 1, a + 3, a + 3, b + 1, b + 3); // sides
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const rampMesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x8a8d93, roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide, flatShading: false }));
  scene.add(rampMesh);
  // collider only inner driving surface (double triangles irrelevant for raycast)
  const ip: number[] = []; const ii: number[] = [];
  for (let i = 0; i <= A.segments; i++) { ip.push(pos[i * 12], pos[i * 12 + 1], pos[i * 12 + 2], pos[i * 12 + 3], pos[i * 12 + 4], pos[i * 12 + 5]); }
  for (let i = 0; i < A.segments; i++) { const a = i * 2, b = a + 2; ii.push(a, b, a + 1, a + 1, b, b + 1); }
  world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(ip), new Uint32Array(ii)).setFriction(0.8).setCollisionGroups(0x00020002));
  // neon edges
  const neon = new THREE.MeshBasicMaterial({ color: 0xff1a2a });
  for (const s of [-1, 1]) { const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(s * (W + 0.1), p.y, p.z))); scene.add(new THREE.Mesh(new THREE.TubeGeometry(c, 200, 0.18, 6), neon)); }
  // truss legs
  const truss = new THREE.MeshStandardMaterial({ color: 0x333840, metalness: 0.6, roughness: 0.5 });
  for (let i = 8; i <= A.segments; i += 8) { const p = pts[i]; if (p.y < 3) continue; for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, p.y, 0.6), truss); leg.position.set(s * (W + 1.5), p.y / 2, p.z - 3); scene.add(leg); } }
  // tower + hangar props (swappable later)
  const tower = new THREE.Group(); const tb = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 30, 12), truss); tb.position.y = 15; tower.add(tb);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(6, 5, 5, 16), new THREE.MeshStandardMaterial({ color: 0x223344, emissive: 0x335577, emissiveIntensity: 0.8 })); cab.position.y = 32; tower.add(cab);
  tower.position.set(-60, 0, 80); scene.add(tower);
  const hangar = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 50, 24, 1, false, 0, Math.PI), truss); hangar.rotation.z = Math.PI / 2; hangar.rotation.y = Math.PI / 2; hangar.position.set(70, 0, 160); scene.add(hangar);
  // stars
  const sg = new THREE.BufferGeometry(); const sp: number[] = []; for (let i = 0; i < 1500; i++) { const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y) + 0.05; v.multiplyScalar(900); sp.push(v.x, v.y, v.z); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, fog: false })));
}
