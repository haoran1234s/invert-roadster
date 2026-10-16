import * as THREE from 'three';
import type { Vehicle } from './vehicle';
import type { Controls } from './input';
import { Combo } from './combo';
export type Grade = 'S' | 'A' | 'B' | 'C';
export const GRADE_MULT: Record<Grade, number> = { S: 2, A: 1.5, B: 1, C: 1 };
export const GRADE_RANK: Record<string, number> = { C: 0, B: 1, A: 2, S: 3 };
export interface Landing { grade: Grade; vy: number; align: number; x: number; z: number; air: number }
// inverted 500/s, airtime 200/s, flips need real player rotation (pitch -> 空翻, roll -> 侧翻), landing grade by touchdown vertical speed
export class Scoring {
  score = 0; stunt = 0; invertedSec = 0; bestInverted = 0; airSec = 0; flips = 0; rolls = 0;
  msgs: { t: string; ttl: number; big?: boolean }[] = [];
  wasInvertedThisRun = false; crashed = false; landing: Landing | null = null; onLand: ((l: Landing) => void) | null = null;
  combo = new Combo(p => this.add(p), (t, b) => this.msg(t, b));
  private wasAir = false; private airborneFor = 0; private lastAirVy = 0; private pitchAcc = 0; private rollAcc = 0; private invSeg = false;
  msg(t: string, big = false) { this.msgs.push({ t, ttl: big ? 2.6 : 1.8, big }); if (this.msgs.length > 5) this.msgs.shift(); }
  reset() { this.score = 0; this.stunt = 0; this.invertedSec = 0; this.bestInverted = 0; this.airSec = 0; this.flips = 0; this.rolls = 0; this.wasInvertedThisRun = false; this.crashed = false; this.landing = null; this.wasAir = false; this.airborneFor = 0; this.msgs = []; this.pitchAcc = this.rollAcc = 0; this.invSeg = false; this.combo.reset(); }
  add(p: number) { this.stunt += p; this.score += p; }
  update(dt: number, v: Vehicle, c: Controls, w: THREE.Vector3) {
    for (const m of this.msgs) m.ttl -= dt; this.msgs = this.msgs.filter(m => m.ttl > 0);
    this.combo.update(dt, v.grounded, v.vel.length() > 25);
    const inverted = v.grounded && v.normal.y < -0.2;
    if (inverted) { this.invertedSec += dt; this.bestInverted = Math.max(this.bestInverted, this.invertedSec); this.add(500 * dt); if (!this.invSeg) { this.invSeg = true; this.wasInvertedThisRun = true; this.combo.trick('倒挂', 300); } }
    else if (v.grounded && v.normal.y > 0.5) this.invSeg = false;
    const air = !v.grounded;
    if (air) {
      this.airborneFor += dt; this.lastAirVy = v.vel.y;
      if (this.airborneFor > 0.4) { this.airSec += dt; this.add(200 * dt); }
      // only player-driven rotation counts (stabilizer-assisted turning is ignored)
      if (c.pitch) this.pitchAcc += Math.abs(w.dot(v.right)) * dt;
      if (c.roll) this.rollAcc += Math.abs(w.dot(v.fwd)) * dt;
      if (this.pitchAcc >= Math.PI * 2) { this.pitchAcc -= Math.PI * 2; this.flips++; this.combo.trick('空翻', 800); }
      if (this.rollAcc >= Math.PI * 2) { this.rollAcc -= Math.PI * 2; this.rolls++; this.combo.trick('侧翻', 800); }
    } else if (this.wasAir && this.airborneFor > 0.6) {
      const align = v.up.dot(v.normal), vy = Math.abs(this.lastAirVy);
      if (align < 0.5 || vy > 14) { this.crashed = true; this.msg(vy > 14 ? '坠毁！下降太快' : '翻车！', true); this.combo.break('翻车'); }
      else {
        const grade: Grade = vy < 2 && align > 0.95 ? 'S' : vy < 5 && align > 0.9 ? 'A' : vy < 9 && align > 0.75 ? 'B' : 'C';
        this.landing = { grade, vy, align, x: v.pos.x, z: v.pos.z, air: this.airSec };
        this.msg(`落地评级 ${grade}`, true); this.onLand?.(this.landing);
        if (grade === 'S') this.combo.trick('完美落地', 500); else if (grade === 'C') this.combo.break('落地太重');
      }
      this.airSec = 0; this.pitchAcc = this.rollAcc = 0;
    }
    if (!air) this.airborneFor = 0;
    this.wasAir = air;
  }
}
