import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { isTouch } from './touch';
import type { Controls } from './input';
const G = 9.81;
const v3 = (a: { x: number; y: number; z: number }) => new THREE.Vector3(a.x, a.y, a.z);

export class Vehicle {
  body: RAPIER.RigidBody; collider: RAPIER.Collider; mesh = new THREE.Group(); wheels: THREE.Object3D[] = []; wheelXZ: number[][] = []; modelLoaded = false; wheelModel = false; private pendingWheel: THREE.Object3D | null = null;
  mass: number; gas = 1; time = 0; lastGround = -99; contacts = 0; normal = new THREE.Vector3(0, 1, 0);
  up = new THREE.Vector3(); fwd = new THREE.Vector3(); right = new THREE.Vector3(); quat = new THREE.Quaternion(); pos = new THREE.Vector3(); vel = new THREE.Vector3();
  downforceN = 0; gForce = 1; thrusting = false; boosting = false; private prevVel = new THREE.Vector3(); private prevNormal = new THREE.Vector3(0, 1, 0); private steerVis = 0; private wheelSpin = 0;
  constructor(public V: any, public T: any, private world: RAPIER.World, scene: THREE.Scene, envMap: THREE.Texture | null = null) {
    const h = V.body.halfExtents;
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true).setAngularDamping(V.air.angularDamping).setLinearDamping(0.02));
    this.collider = world.createCollider(RAPIER.ColliderDesc.cuboid(h[0], h[1], h[2]).setDensity(V.body.density).setFriction(0.3).setRestitution(0.05).setCollisionGroups(0x00010001), this.body);
    this.mass = this.body.mass();
    // placeholder model: silver body + black glass roof
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, metalness: 0.9, roughness: 0.25 });
    const shell = new THREE.Mesh(new THREE.BoxGeometry(h[0] * 2, h[1] * 2, h[2] * 2), bodyMat);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(h[0] * 2, h[1] * 1.2, 1.2), bodyMat); nose.position.set(0, -h[1] * 0.4, -h[2] - 0.4);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(h[0] * 1.6, 0.42, h[2] * 1.15), new THREE.MeshStandardMaterial({ color: 0x050608, metalness: 0.5, roughness: 0.05 })); roof.position.set(0, h[1] + 0.2, 0.2);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(h[0] * 1.9, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: 0xff1020 })); tail.position.set(0, 0.12, h[2] + 0.01);
    const head = new THREE.Mesh(new THREE.BoxGeometry(h[0] * 1.6, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0xddeeff })); head.position.set(0, -0.05, -h[2] - 1.0);
    const placeholder = new THREE.Group(); placeholder.add(shell, nose, roof, tail, head); placeholder.name = 'placeholder'; this.mesh.add(placeholder);
    const wg = new THREE.CylinderGeometry(V.wheels.radius, V.wheels.radius, 0.32, 20); wg.rotateZ(Math.PI / 2);
    const wm = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });
    for (let i = 0; i < 4; i++) { const pivot = new THREE.Group(); const w = new THREE.Mesh(wg, wm); const hub = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, V.wheels.radius * 1.4), new THREE.MeshStandardMaterial({ color: 0x666666 })); w.add(hub); pivot.add(w); this.mesh.add(pivot); this.wheels.push(pivot); }
    scene.add(this.mesh);
    this.wheelXZ = V.wheels.positions.map((p: number[]) => [p[0], p[2]]);
    const url = (V.modelOverride as string) || ((isTouch || location.search.includes('mobile')) && V.modelMobile ? V.modelMobile : V.model);
    if (url && !location.search.includes('greybox')) {
      const gl = new GLTFLoader(); const dr = new DRACOLoader(); dr.setDecoderPath('./draco/'); gl.setDRACOLoader(dr);
      gl.load(url, g => {
        const root = g.scene; const names = ['wheel_FL', 'wheel_FR', 'wheel_RL', 'wheel_RR'];
        const nodes = names.map(n => root.getObjectByName(n));
        if (nodes.every(Boolean)) {
          root.updateMatrixWorld(true);
          nodes.forEach((n, i) => {
            const hub = new THREE.Vector3().setFromMatrixPosition(n!.matrixWorld); const sc = new THREE.Vector3().setFromMatrixScale(n!.matrixWorld);
            this.wheelXZ[i] = [hub.x, hub.z];
            n!.removeFromParent(); n!.position.set(0, 0, 0); n!.scale.copy(sc);
            const pivot = this.wheels[i]; const spin = new THREE.Group(); spin.add(n!);
            pivot.clear(); pivot.add(spin); // model wheel replaces greybox wheel: pivot steers (y), spin rotates (x)
          });
        } else this.wheels.forEach(w => w.visible = false); // wheels baked into body
        root.traverse(o => { if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).frustumCulled = false; const mesh = o as THREE.Mesh; mesh.castShadow = true; mesh.receiveShadow = true; const m = mesh.material as THREE.MeshStandardMaterial;
          if (m.isMeshStandardMaterial) { // car paint: physical clearcoat over the Hunyuan PBR maps
            const pm = new THREE.MeshPhysicalMaterial({ map: m.map, normalMap: m.normalMap, roughnessMap: m.roughnessMap, metalnessMap: m.metalnessMap, color: m.color, metalness: m.metalness, roughness: Math.min(m.roughness, 0.5),
              clearcoat: 1, clearcoatRoughness: 0.06, envMap: envMap ?? null, envMapIntensity: 1.4 });
            mesh.material = pm; m.dispose();
          } } });
        placeholder.visible = false; this.mesh.add(root); this.modelLoaded = true; dr.dispose(); if (this.pendingWheel) this.setWheelModel(this.pendingWheel);
      }, undefined, e => console.warn('car model failed, using greybox', e));
    }
  }
  // swap in a dedicated wheel model (axis along glTF Z, radius ~0.59) on each spin node; left wheels mirrored
  setWheelModel(w: THREE.Object3D) {
    if (!this.modelLoaded) { this.pendingWheel = w; return; }
    const k = this.V.wheels.radius * 0.97 / 0.59;
    this.wheels.forEach((pivot, i) => {
      const spin = pivot.children[0]; if (!spin) return;
      spin.children.forEach(c => c.visible = false);
      const c = w.clone(); c.rotation.y = Math.PI / 2; c.scale.set(k, k, k * 1.0); if (i % 2 === 0) c.scale.z *= -1; // mirror: rim faces outward
      c.traverse(o => { o.castShadow = true; }); spin.add(c);
    });
    this.wheelModel = true;
  }
  extBoost = 0; retro = false; G = G;
  reset(p: number[], yawDeg: number) {
    this.extBoost = 0;
    this.body.setTranslation({ x: p[0], y: p[1], z: p[2] }, true);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawDeg * Math.PI / 180);
    this.body.setRotation(q, true); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true); this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.gas = 1; this.lastGround = -99; this.prevVel.set(0, 0, 0);
  }
  get attached() { return this.time - this.lastGround < this.V.downforce.graceSec; }
  get grounded() { return this.contacts > 0; }
  step(dt: number, c: Controls) {
    const V = this.V, T = this.T, b = this.body, m = this.mass;
    this.time += dt;
    this.pos.copy(v3(b.translation())); this.quat.copy(b.rotation() as any);
    this.up.set(0, 1, 0).applyQuaternion(this.quat); this.fwd.set(0, 0, -1).applyQuaternion(this.quat); this.right.set(1, 0, 0).applyQuaternion(this.quat);
    this.vel.copy(v3(b.linvel())); const w = v3(b.angvel());
    const W = V.wheels; const lift = 0.7; const maxLen = W.rest + W.radius; const dir = this.up.clone().negate();
    let contacts = 0; const nSum = new THREE.Vector3(); let load = 0;
    for (let i = 0; i < 4; i++) {
      const lp = W.positions[i]; const o = new THREE.Vector3(lp[0], lp[1], lp[2]).applyQuaternion(this.quat).add(this.pos); const ro = o.clone().addScaledVector(this.up, lift);
      const hit = this.world.castRayAndGetNormal(new RAPIER.Ray(ro, dir), maxLen + lift, true, undefined, undefined, this.collider, b);
      let dist = maxLen;
      if (hit) {
        dist = ((hit as any).timeOfImpact ?? (hit as any).toi) - lift; const n = v3(hit.normal); if (n.dot(dir) > 0) n.negate();
        const comp = maxLen - dist; const r = o.clone().sub(this.pos); const pv = this.vel.clone().add(w.clone().cross(r));
        let F = W.stiffness * comp - W.damping * pv.dot(this.up); if (comp > W.rest) F += W.stiffness * 6 * (comp - W.rest); if (F < 0) F = 0;
        load += F; b.applyImpulseAtPoint(this.up.clone().multiplyScalar(F * dt), o, true);
        contacts++; nSum.add(n);
      }
      const wl = this.wheels[i]; wl.position.set(this.wheelXZ[i][0], lp[1] - Math.max(0.05, dist - W.radius), this.wheelXZ[i][1]);
      wl.rotation.y = i < 2 ? -this.steerVis * 0.45 : 0; (wl.children[0] as THREE.Object3D).rotation.x = this.wheelSpin;
    }
    this.contacts = contacts;
    this.prevNormal.copy(this.normal); if (contacts) { this.lastGround = this.time; this.normal.copy(nSum.normalize()); }
    const speed = this.vel.length();
    // downforce: k v^2 + fan constant (fan boosted with Shift)
    const fanN = c.thrust && this.gas > 0 ? 0 : V.downforce.fanKg * G * (c.fan ? 1.6 : 1); // fans off while lift thrusters fire (allows take-off)
    this.downforceN = this.attached ? V.downforce.k * speed * speed + fanN : 0;
    if (this.attached) b.applyImpulse(this.normal.clone().multiplyScalar(-this.downforceN * dt), true);
    const n = this.normal;
    this.thrusting = false; this.boosting = false; this.retro = false;
    if (contacts >= 2) {
      const f = this.fwd.clone().addScaledVector(n, -this.fwd.dot(n)).normalize();
      const s = new THREE.Vector3().crossVectors(f, n).normalize();
      const vf = this.vel.dot(f), vs = this.vel.dot(s);
      // lateral grip, friction-circle limited
      const maxLat = V.grip.mu * load * dt; let lat = -vs * m * 0.9; lat = THREE.MathUtils.clamp(lat, -maxLat, maxLat);
      b.applyImpulse(s.clone().multiplyScalar(lat), true);
      let a = 0; const E = V.engine;
      if (c.throttle > 0) a += E.accel * c.throttle * Math.max(0, 1 - vf / E.topSpeed);
      if (c.brake > 0) a += vf > 1 ? -E.brake * c.brake : -E.reverse * c.brake * (vf > -15 ? 1 : 0);
      a -= vf * 0.01; // rolling/air drag
      b.applyImpulse(f.clone().multiplyScalar(a * m * dt), true);
      const sgn = vf >= 0 ? 1 : -1;
      const yaw = -c.steer * V.grip.maxYawRate * Math.min(1, Math.abs(vf) / 6) / (1 + Math.abs(vf) / 45) * sgn;
      const wn = w.dot(n); const newYaw = wn + (yaw - wn) * 0.25;
      // arcade surface alignment: rotate up toward surface normal (pitch/roll), keep yaw about n
      const ax = new THREE.Vector3().crossVectors(this.up, n); const ang = Math.asin(Math.min(1, ax.length()));
      const align = ax.lengthSq() > 1e-9 ? ax.normalize().multiplyScalar(ang * 18) : ax.set(0, 0, 0);
      // feed-forward curvature: angular rate needed to follow curved surface ~ (prevNormal->n)/dt
      const curv = new THREE.Vector3().crossVectors(this.prevNormal, n).divideScalar(dt);
      w.copy(n).multiplyScalar(newYaw).add(align).add(curv.addScaledVector(n, -curv.dot(n)));
      b.setAngvel(w, true);
      this.wheelSpin += vf * dt / W.radius;
    } else if (!contacts) {
      // air control
      const ra = V.air.rotAccel * dt;
      w.addScaledVector(this.right, c.pitch * ra).addScaledVector(this.fwd, -c.roll * ra);
      if (!c.pitch && !c.roll && V.air.stabilize > 0) {
        const axis = new THREE.Vector3().crossVectors(this.up, new THREE.Vector3(0, 1, 0));
        let ang = Math.asin(Math.min(1, axis.length())); if (this.up.y < 0) ang = Math.PI - ang;
        if (axis.lengthSq() < 1e-6 && this.up.y < 0) axis.copy(this.fwd);
        axis.normalize().multiplyScalar(ang * V.air.stabilize);
        // keep yaw spin, damp the rest toward target
        const yawW = new THREE.Vector3(0, w.y, 0);
        const target = axis.add(yawW.multiplyScalar(0.9));
        w.lerp(target, 0.06);
      }
      b.setAngvel(w, true);
    }
    // thrusters
    this.retro = false;
    if (c.thrust && this.gas > 0) {
      this.thrusting = true;
      if (!contacts && this.vel.y < -1 && this.up.y > 0.7) { // 喷气缓降: strong vertical retro-thrust while falling nose-level
        this.retro = true; this.gas -= dt / T.tankSec * 1.4; b.applyImpulse({ x: 0, y: (T.retroG ?? 2.6) * this.G * m * dt, z: 0 }, true);
      } else { this.gas -= dt / T.tankSec; b.applyImpulse(this.up.clone().multiplyScalar(T.liftG * this.G * m * dt), true); }
    }
    if (this.extBoost > 0) { this.extBoost -= dt; this.boosting = true; b.applyImpulse(this.fwd.clone().multiplyScalar(T.boostG * 1.6 * G * m * dt), true); }
    if (c.boost && this.gas > 0) { this.boosting = true; this.gas -= dt / T.tankSec * 0.7; b.applyImpulse(this.fwd.clone().multiplyScalar(T.boostG * G * m * dt), true); }
    if (!this.thrusting && !this.boosting) this.gas = Math.min(1, this.gas + dt * (contacts ? T.regenGround : T.regenAir) / 1);
    this.gas = Math.max(0, this.gas);
    this.steerVis += (c.steer - this.steerVis) * 0.2;
    const acc = this.vel.clone().sub(this.prevVel).divideScalar(dt); acc.y += G; this.gForce += (acc.length() / G - this.gForce) * 0.1; this.prevVel.copy(this.vel);
  }
  sync() { this.mesh.position.copy(v3(this.body.translation())); this.mesh.quaternion.copy(this.body.rotation() as any); }
}
