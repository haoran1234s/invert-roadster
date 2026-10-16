import * as THREE from 'three';
import type { Vehicle } from './vehicle';
export class Scoring {
  score = 0; run = 0; combo = 1; comboTimer = 0; invertedSec = 0; bestInverted = 0; airSec = 0; flipAcc = 0; msgs: { t: string; ttl: number }[] = [];
  wasInvertedThisRun = false; safeLandAfterInvert = false; private wasAir = false; private lowThrust = false; private lastUp = new THREE.Vector3(0, 1, 0); private airborneFor = 0; crashed = false; savedThisRun = false;
  msg(t: string) { this.msgs.push({ t, ttl: 2.2 }); if (this.msgs.length > 4) this.msgs.shift(); }
  add(pts: number, label?: string) { const p = Math.round(pts * this.combo); this.run += p; this.score += p; if (label) { this.msg(`${label} +${p}`); this.combo = Math.min(8, this.combo + 1); this.comboTimer = 3; } }
  reset() { this.run = 0; this.combo = 1; this.invertedSec = 0; this.airSec = 0; this.flipAcc = 0; this.wasInvertedThisRun = false; this.wasAir = false; this.lowThrust = false; this.crashed = false; this.savedThisRun = false; }
  update(dt: number, v: Vehicle) {
    for (const m of this.msgs) m.ttl -= dt; this.msgs = this.msgs.filter(m => m.ttl > 0);
    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 1; }
    const inverted = v.grounded && v.normal.y < -0.2;
    if (inverted) { this.invertedSec += dt; this.bestInverted = Math.max(this.bestInverted, this.invertedSec); this.run += 100 * dt * this.combo; this.score += 100 * dt * this.combo; if (!this.wasInvertedThisRun) { this.wasInvertedThisRun = true; this.msg('倒挂！'); } }
    const air = !v.grounded;
    if (air) {
      this.airborneFor += dt;
      if (this.airborneFor > 0.4) { this.airSec += dt; this.run += 50 * dt; this.score += 50 * dt; }
      // flip accumulation: angle change of up vector
      this.flipAcc += this.lastUp.angleTo(v.up); if (this.flipAcc >= Math.PI * 2) { this.flipAcc -= Math.PI * 2; this.add(500, '空翻 360°'); }
      const alt = v.pos.y; if (v.thrusting && alt < 15 && v.vel.y < -2) this.lowThrust = true;
    } else if (this.wasAir && this.airborneFor > 0.6) {
      const align = v.up.dot(v.normal);
      if (align < 0.5) { this.crashed = true; this.combo = 1; this.msg('翻车！连击清零'); }
      else {
        if (this.airSec > 1) this.add(Math.round(this.airSec * 100), `腾空 ${this.airSec.toFixed(1)}s`);
        if (this.lowThrust && !this.savedThisRun) { this.savedThisRun = true; this.add(500, '推进器救车'); }
        if (align > 0.97 && Math.abs(v.vel.y) < 9) this.add(300, '完美落地');
        else this.add(100, '落地');
        if (this.wasInvertedThisRun) this.safeLandAfterInvert = true;
      }
      this.airSec = 0; this.flipAcc = 0; this.lowThrust = false;
    }
    if (!air) this.airborneFor = 0;
    this.wasAir = air; this.lastUp.copy(v.up);
  }
}
