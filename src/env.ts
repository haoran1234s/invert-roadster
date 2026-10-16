import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
// Hunyuan scenery dressing (visual only; colliders stay procedural). Falls back to greybox on failure.
export type LevelHandles = { runway: THREE.Mesh; dashes: THREE.Object3D; lights: THREE.Object3D; props: THREE.Object3D[] };
const loader = new GLTFLoader(); const draco = new DRACOLoader(); draco.setDecoderPath('./draco/'); loader.setDRACOLoader(draco);
export const loadGLB = (url: string) => new Promise<THREE.Group>((res, rej) => loader.load(url, g => res(g.scene), undefined, rej));
const firstMesh = (g: THREE.Object3D) => { let m: THREE.Mesh | null = null; g.traverse(o => { if (!m && (o as THREE.Mesh).isMesh) m = o as THREE.Mesh; }); return m as THREE.Mesh | null; };

export function loadScenery(dir: string, scene: THREE.Scene, h: LevelHandles, runway: { length: number; width: number; zStart: number }, envMap: THREE.Texture | null) {
  const done: Promise<unknown>[] = [];
  // runway modules: instanced tiles replace the plain runway plane, dashes and edge lights (they are in the model)
  done.push(loadGLB(dir + 'runway.glb').then(g => {
    const m = firstMesh(g); if (!m) return; const mat = m.material as THREE.MeshStandardMaterial;
    mat.emissive = new THREE.Color(0x2a3040); mat.roughness = 0.9; mat.metalness = 0;
    const sx = runway.width / 0.29, tileLen = 1.165 * sx, n = Math.ceil(runway.length / tileLen);
    const inst = new THREE.InstancedMesh(m.geometry, mat, n); const M = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { M.compose(new THREE.Vector3(0, -0.012, runway.zStart - tileLen * (i + 0.5)), new THREE.Quaternion(), new THREE.Vector3(sx, 1, sx)); inst.setMatrixAt(i, M); }
    scene.add(inst); h.runway.visible = false; h.dashes.visible = false; h.lights.visible = false;
  }));
  done.push(loadGLB(dir + 'tower_hangar.glb').then(g => {
    g.scale.setScalar(90); g.position.set(-80, 0, 95); g.rotation.y = Math.PI / 2; scene.add(g); h.props.forEach(p => p.visible = false);
  }));
  done.push(loadGLB(dir + 'ramp_landmark.glb').then(g => {
    g.scale.setScalar(90); g.position.set(-190, 0, -170); g.rotation.y = Math.PI * 0.3;
    g.traverse(o => { const mm = (o as THREE.Mesh).material as THREE.MeshStandardMaterial; if (mm?.isMeshStandardMaterial) { mm.emissive = new THREE.Color(0x1a1e2a); } });
    scene.add(g);
  }));
  // tame envmap/brightness on dressing
  return Promise.allSettled(done).then(r => { scene.traverse(o => { const mm = (o as THREE.Mesh).material as THREE.MeshStandardMaterial; if (mm?.isMeshStandardMaterial && envMap && !mm.envMap) { mm.envMap = envMap; mm.envMapIntensity = 0.5; } }); r.forEach(x => x.status === 'rejected' && console.warn('scenery load failed, keeping greybox', (x as PromiseRejectedResult).reason)); return r.filter(x => x.status === 'fulfilled').length; });
}
