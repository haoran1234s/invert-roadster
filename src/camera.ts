import * as THREE from 'three';
import type { Vehicle } from './vehicle';
export const CAMS = ['CHASE', 'WIDE PROFILE', 'DRONE', 'TOP-DOWN'] as const;
export class CamRig {
  mode = 0; pos = new THREE.Vector3(0, 5, 250); up = new THREE.Vector3(0, 1, 0); t = 0;
  constructor(public cam: THREE.PerspectiveCamera) {}
  next() { this.mode = (this.mode + 1) % CAMS.length; }
  update(dt: number, v: Vehicle, snap = false) {
    this.t += dt; const p = v.pos; let want: THREE.Vector3; let look = p.clone(); let upW = new THREE.Vector3(0, 1, 0); let k = 1 - Math.pow(0.002, dt);
    const m = CAMS[this.mode];
    if (m === 'CHASE') {
      const ref = v.attached ? v.normal : new THREE.Vector3(0, 1, 0);
      const back = v.vel.lengthSq() > 4 ? v.vel.clone().normalize() : v.fwd.clone();
      want = p.clone().addScaledVector(back, -10).addScaledVector(ref, 3.5); look = p.clone().addScaledVector(ref, 1.2); upW = ref.clone(); k = 1 - Math.pow(0.0005, dt);
    } else if (m === 'WIDE PROFILE') { want = new THREE.Vector3(85, 18 + p.y * 0.4, THREE.MathUtils.clamp(p.z, -40, 300)); k = 1 - Math.pow(0.05, dt); this.cam.fov = 45;
    } else if (m === 'DRONE') { want = p.clone().add(new THREE.Vector3(Math.sin(this.t * 0.3) * 22, 14, Math.cos(this.t * 0.3) * 22));
    } else { want = p.clone().add(new THREE.Vector3(0, 70, 0.01)); }
    if (m !== 'WIDE PROFILE') this.cam.fov = 70;
    if (snap) k = 1; this.pos.lerp(want, k); this.up.lerp(upW, 1 - Math.pow(0.02, dt)).normalize();
    this.cam.position.copy(this.pos); this.cam.up.copy(this.up); this.cam.lookAt(look); this.cam.updateProjectionMatrix();
  }
}
