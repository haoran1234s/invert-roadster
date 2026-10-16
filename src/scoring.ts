import * as THREE from 'three';
import type { Vehicle } from './vehicle';
export type Grade = 'S' | 'A' | 'B' | 'C';
export const GRADE_MULT: Record<Grade, number> = { S: 2, A: 1.5, B: 1, C: 1 };
export const GRADE_RANK: Record<string, number> = { C: 0, B: 1, A: 2, S: 3 };
export interface Landing { grade: Grade; vy: number; align: number; x: number; z: number; air: number }
// Scoring: inverted 500/s, airtime 200/s, each full air rotation 800 (x combo), landing grade multiplies stunt points at run end.
export class Scoring {
  score = 0; stunt = 0; combo = 1; comboTimer = 0; invertedSec = 0; bestInverted = 0; airSec = 0; flips = 0; flipAcc = 0;
  msgs: { t: string; ttl: number; big?: boolean }[] = [];
  wasInvertedThisRun = false; crashed = false; landing: Landing | null = null; onLand: ((l: Landing) => void) | null = null;
  private wasAir = false; private lastUp = new THREE.Vector3(0, 1, 0); private airborneFor = 0; private lastAirVy = 0;
  msg(t: string, big = false) { this.msgs.push({ t, ttl: big ? 2.6 : 2.0, big }); if (this.msgs.length > 5) this.msgs.shift(); }
  bump() { this.combo = Math.min(8, this.combo + 1); this.comboTimer = 4; }
  reset() { this.score = 0; this.stunt = 0; this.combo = 1; this.comboTimer = 0; this.invertedSec = 0; this.bestInverted = 0; this.airSec = 0; this.flips = 0; this.flipAcc = 0; this.wasInvertedThisRun = false; this.crashed = false; this.landing = null; this.wasAir = false; this.airborneFor = 0; this.msgs = []; }
  add(p: number) { this.stunt += p; this.score += p; }
  update(dt: number, v: Vehicle) {
    for (const m of this.msgs) m.ttl -= dt; this.msgs = this.msgs.filter(m => m.ttl > 0);
    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 1; }
    const inverted = v.grounded && v.normal.y < -0.2;
    if (inverted) { this.invertedSec += dt; this.bestInverted = Math.max(this.bestInverted, this.invertedSec); this.add(500 * dt); if (!this.wasInvertedThisRun) { this.wasInvertedThisRun = true; this.bump(); this.msg(`倒挂！ 连击 x${this.combo}`); } }
    const air = !v.grounded;
    if (air) {
      this.airborneFor += dt; this.lastAirVy = v.vel.y;
      if (this.airborneFor > 0.4) { this.airSec += dt; this.add(200 * dt); }
      this.flipAcc += this.lastUp.angleTo(v.up);
      if (this.flipAcc >= Math.PI * 2) { this.flipAcc -= Math.PI * 2; this.flips++; this.bump(); const p = 800 * this.combo; this.add(p); this.msg(`空翻 360° +${p}  x${this.combo}`); }
    } else if (this.wasAir && this.airborneFor > 0.6) {
      const align = v.up.dot(v.normal), vy = Math.abs(this.lastAirVy);
      if (align < 0.5) { this.crashed = true; this.combo = 1; this.msg('翻车！', true); }
      else {
        const grade: Grade = vy < 4 && align > 0.96 ? 'S' : vy < 7 && align > 0.9 ? 'A' : vy < 11 && align > 0.75 ? 'B' : 'C';
        this.landing = { grade, vy, align, x: v.pos.x, z: v.pos.z, air: this.airSec };
        this.msg(`落地评级 ${grade}`, true); this.onLand?.(this.landing);
      }
      this.airSec = 0; this.flipAcc = 0;
    }
    if (!air) this.airborneFor = 0;
    this.wasAir = air; this.lastUp.copy(v.up);
  }
}
