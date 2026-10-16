import * as THREE from 'three';
export class Vapor {
  N = 4000; pos: Float32Array; col: Float32Array; vel: Float32Array; life: Float32Array; max: Float32Array; i = 0; pts: THREE.Points;
  constructor(scene: THREE.Scene) {
    this.pos = new Float32Array(this.N * 3).fill(-9999); this.col = new Float32Array(this.N * 3); this.vel = new Float32Array(this.N * 3); this.life = new Float32Array(this.N); this.max = new Float32Array(this.N).fill(1);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!; const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    this.pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.3, map: new THREE.CanvasTexture(c), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.pts.frustumCulled = false; scene.add(this.pts);
  }
  emit(p: THREE.Vector3, v: THREE.Vector3, life: number, spread: number) {
    const i = this.i = (this.i + 1) % this.N;
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([v.x + (Math.random() - .5) * spread, v.y + (Math.random() - .5) * spread, v.z + (Math.random() - .5) * spread], i * 3);
    this.life[i] = this.max[i] = life * (0.7 + Math.random() * 0.6);
  }
  burst(p: THREE.Vector3, n: number) { for (let k = 0; k < n; k++) { const d = new THREE.Vector3().randomDirection(); d.y = Math.abs(d.y) * 0.4; this.emit(p.clone().addScaledVector(d, 1.5), d.multiplyScalar(4 + Math.random() * 8), 2.5, 1); } }
  update(dt: number) {
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) continue; this.life[i] -= dt; const k = Math.max(0, this.life[i] / this.max[i]);
      const j = i * 3; for (let a = 0; a < 3; a++) { this.vel[j + a] *= 1 - 1.8 * dt; this.pos[j + a] += this.vel[j + a] * dt; }
      this.vel[j + 1] += 0.6 * dt; const c = 0.16 * k; this.col[j] = this.col[j + 1] = c; this.col[j + 2] = c * 1.05;
      if (this.life[i] <= 0) this.pos[j + 1] = -9999;
    }
    (this.pts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; (this.pts.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}
