import type { Vehicle } from './vehicle';
import type { Scoring } from './scoring';
const CY = '#e8f4ff';
export class Hud {
  ctx: CanvasRenderingContext2D;
  constructor(private cv: HTMLCanvasElement) { this.ctx = cv.getContext('2d')!; }
  gauge(x: number, y: number, r: number, label: string, unit: string, val: number, max: number, text: string) {
    const c = this.ctx; c.fillStyle = 'rgba(8,12,22,0.5)'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.strokeStyle = CY; c.fillStyle = CY; c.lineWidth = 1;
    c.globalAlpha = 0.35; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(x, y, r * 0.78, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i <= 40; i++) { const a = Math.PI * 0.75 + i / 40 * Math.PI * 1.5; const l = i % 5 ? 0.9 : 0.84; c.beginPath(); c.moveTo(x + Math.cos(a) * r * l, y + Math.sin(a) * r * l); c.lineTo(x + Math.cos(a) * r * 0.97, y + Math.sin(a) * r * 0.97); c.stroke(); }
    c.globalAlpha = 1; c.lineWidth = 3; const k = Math.max(0, Math.min(1, val / max));
    c.beginPath(); c.arc(x, y, r * 0.88, Math.PI * 0.75, Math.PI * 0.75 + k * Math.PI * 1.5); c.stroke();
    c.textAlign = 'center'; c.font = `bold ${r * 0.34}px Consolas, monospace`; c.fillText(text, x, y + r * 0.1);
    c.font = `${r * 0.16}px Consolas, monospace`; c.globalAlpha = 0.8; c.fillText(unit, x, y + r * 0.38); c.fillText(label, x, y + r + r * 0.28); c.globalAlpha = 1;
  }
  draw(v: Vehicle, s: Scoring, info: { cam: string; level: string; stars: { label: string; ok: boolean }[]; hint: string; fps: number; debug?: string; compact?: boolean; sections?: string[]; phase?: number; phaseFrac?: number; banner?: string; bannerA?: number; objective?: string; speedFx?: number; radar?: { alt: number; vy: number; ideal: number; inBand: boolean; prompt: string } }) {
    const cv = this.cv, c = this.ctx, dpr = Math.min(devicePixelRatio || 1, info.compact ? 1.5 : 2); const W = innerWidth, H = innerHeight;
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    // speed lines (screen-space streaks)
    const fx = info.speedFx ?? 0;
    if (fx > 0) { c.save(); c.strokeStyle = '#e8f4ff'; c.lineWidth = 1.5; const cx = W / 2, cy = H * 0.45, n = Math.round(26 * fx);
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, r0 = Math.max(W, H) * (0.32 + Math.random() * 0.2), len = 40 + 120 * fx * Math.random(); c.globalAlpha = 0.15 + 0.35 * fx * Math.random();
        c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len)); c.stroke(); } c.restore(); }
    const r = info.compact ? Math.min(44, W / 20) : Math.min(70, W / 16); const y = info.compact ? H - r - 34 : H - r - 40; const pitch = Math.asin(Math.max(-1, Math.min(1, v.fwd.y))) * 180 / Math.PI;
    const g0 = info.compact ? W * 0.465 - r * 3.45 : W / 2 - r * 3.4;
    this.gauge(g0, y, r, 'DOWNFORCE', 'KG', v.downforceN / 9.81, 5000, Math.round(v.downforceN / 9.81).toString());
    this.gauge(g0 + r * 2.3, y, r, 'G-FORCE', 'G', v.gForce, 5, v.gForce.toFixed(1));
    this.gauge(g0 + r * 4.6, y, r, 'PITCH', 'DEG', Math.abs(pitch), 90, Math.round(pitch).toString());
    this.gauge(g0 + r * 6.9, y, r, 'ALTITUDE', 'FT', v.pos.y * 3.28, 300, Math.max(0, Math.round((v.pos.y - 0.9) * 3.28)).toString());
    // wireframe car icon (side view) rotated by pitch, flipped when inverted
    c.save(); c.translate(W / 2 + r * 1.1, y - r * 1.55); c.rotate(-pitch * Math.PI / 180); if (v.up.y < 0) c.scale(1, -1);
    c.strokeStyle = CY; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-26, 4); c.lineTo(-24, -3); c.lineTo(-8, -6); c.lineTo(4, -12); c.lineTo(16, -10); c.lineTo(26, -2); c.lineTo(26, 4); c.closePath(); c.stroke();
    for (const wx of [-15, 15]) { c.beginPath(); c.arc(wx, 5, 4, 0, Math.PI * 2); c.stroke(); } c.restore();
    // gas bar
    const bw = info.compact ? 200 : 300; const bx = W / 2 - bw / 2, by = H - 22; c.strokeStyle = CY; c.strokeRect(bx, by, bw, 8); c.fillStyle = v.gas > 0.25 ? '#dff' : '#f55'; c.fillRect(bx + 1, by + 1, (bw - 2) * v.gas, 6);
    c.font = '11px Consolas'; c.fillStyle = CY; c.textAlign = 'right'; c.fillText('COLD GAS', bx - 8, by + 8);
    // top-left: live tag + level
    c.textAlign = 'left'; c.fillStyle = '#e33'; c.beginPath(); c.arc(24, 28, 5, 0, 7); c.fill(); c.fillStyle = CY; c.font = 'bold 15px Consolas'; c.fillText('INVERT LIVE', 36, 33);
    c.font = '14px "Microsoft YaHei", sans-serif'; c.fillText(`关卡 ${info.level}`, 20, 58);
    info.stars.forEach((st, i) => { c.fillStyle = st.ok ? '#ffd23f' : '#667'; c.fillText(`${st.ok ? '★' : '☆'} ${st.label}`, 20, 82 + i * 20); });
    // top-right: score + combo + speed
    c.textAlign = 'right'; c.fillStyle = CY; c.font = 'bold 28px Consolas'; c.fillText(Math.round(s.score).toString().padStart(6, '0'), W - 20, 40);
    c.font = '15px Consolas'; const cb = s.combo; c.fillText(`RUN ${Math.round(s.stunt)}   连招 x${cb.mult}`, W - 20, 62);
    c.fillText(`${Math.round(v.vel.length() * 3.6)} KM/H`, W - 20, 84); c.fillText(`CAM: ${info.cam}`, W - 20, 104);
    if (info.debug) { c.textAlign = 'left'; c.font = '12px Consolas'; c.fillStyle = '#7f7'; c.fillText(info.debug, info.compact ? W * 0.3 : 20, info.compact ? 20 : H - 8); c.textAlign = 'right'; c.fillStyle = CY; }
    // level progress bar with sections
    if (info.sections) {
      const n = info.sections.length, pw = Math.min(460, W * 0.42), px = W / 2 - pw / 2, py = info.compact ? 40 : 38, sw = pw / n;
      c.textAlign = 'center'; c.font = `${info.compact ? 11 : 12}px "Microsoft YaHei", sans-serif`;
      for (let i = 0; i < n; i++) {
        const done = i < info.phase!, cur = i === info.phase;
        c.fillStyle = done ? 'rgba(61,255,160,0.85)' : 'rgba(232,244,255,0.18)'; c.fillRect(px + i * sw + 1, py, sw - 2, 6);
        if (cur) { c.fillStyle = '#ffc23a'; c.fillRect(px + i * sw + 1, py, (sw - 2) * info.phaseFrac!, 6); }
        c.fillStyle = cur ? '#ffc23a' : done ? '#3dffa0' : '#aab'; c.fillText(info.sections[i], px + i * sw + sw / 2, py + 20);
      }
      const mx = px + (info.phase! + info.phaseFrac!) * sw; c.fillStyle = '#fff'; c.beginPath(); c.moveTo(mx, py - 2); c.lineTo(mx - 5, py - 9); c.lineTo(mx + 5, py - 9); c.fill();
      c.font = `bold ${info.compact ? 15 : 18}px "Microsoft YaHei", sans-serif`; c.fillStyle = '#ffc23a'; c.fillText(`当前：${info.sections[info.phase!]}`, W / 2, py + 44);
    }
    if (info.objective) { c.textAlign = 'center'; c.font = `bold ${info.compact ? 14 : 17}px "Microsoft YaHei", sans-serif`; const ow = c.measureText(info.objective).width + 24; const oy = info.sections ? (info.compact ? 100 : 104) : (info.compact ? 44 : 46); c.fillStyle = 'rgba(10,14,24,0.55)'; c.fillRect(W / 2 - ow / 2, oy - 18, ow, 26); c.fillStyle = '#ffc23a'; c.fillText(info.objective, W / 2, oy); }
    if (info.banner) { c.globalAlpha = info.bannerA ?? 1; c.font = `bold ${info.compact ? 15 : 19}px "Microsoft YaHei", sans-serif`; const tw = c.measureText(info.banner).width + 30; c.fillStyle = 'rgba(10,14,24,0.6)'; c.fillRect(W / 2 - tw / 2, H * 0.42 - 24, tw, 36); c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(info.banner, W / 2, H * 0.42); c.globalAlpha = 1; }
    // combo chain
    if (cb.chain.length) {
      c.textAlign = 'right'; c.font = `bold ${info.compact ? 13 : 16}px "Microsoft YaHei", sans-serif`; const txt = cb.chain.slice(-5).join(' → ');
      const tw = c.measureText(txt).width + 20, cy = info.compact ? 126 : 130; c.fillStyle = 'rgba(10,14,24,0.55)'; c.fillRect(W - 14 - tw, cy - 18, tw, 46);
      c.fillStyle = '#ff7bd5'; c.fillText(txt, W - 24, cy); c.fillStyle = '#ffd23f'; c.fillText(`连招 x${cb.mult}  +${cb.pts}`, W - 24, cy + 21);
      const idle = Math.min(1, cb.idleT / 2); c.fillStyle = 'rgba(255,123,213,0.8)'; c.fillRect(W - 14 - tw, cy + 26, tw * (1 - idle), 3);
    }
    if (cb.flair > 0) { // named combo popup with flair
      const k = cb.flair / 2.2, sc = 1 + Math.max(0, k - 0.8) * 2.5; c.save(); c.translate(W / 2, H * 0.6); c.scale(sc, sc); c.rotate(Math.sin(cb.flair * 9) * 0.03 * k);
      c.globalAlpha = Math.min(1, cb.flair * 1.5); c.textAlign = 'center'; c.font = `900 ${info.compact ? 34 : 56}px "Microsoft YaHei", sans-serif`;
      c.shadowColor = '#ff3a8a'; c.shadowBlur = 30; c.lineWidth = 6; c.strokeStyle = '#3a0a28'; c.strokeText(cb.lastNamed, 0, 0);
      const g = c.createLinearGradient(0, -40, 0, 10); g.addColorStop(0, '#fff6a0'); g.addColorStop(1, '#ff8a2a'); c.fillStyle = g; c.fillText(cb.lastNamed, 0, 0);
      c.shadowBlur = 0; c.font = `bold ${info.compact ? 13 : 17}px "Microsoft YaHei", sans-serif`; c.fillStyle = '#ff7bd5'; c.fillText('★ 连招达成 ★', 0, info.compact ? 26 : 34);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + cb.flair; const r0 = 140 * (1.2 - k); c.fillStyle = i % 2 ? '#ffd23f' : '#ff7bd5'; c.fillRect(Math.cos(a) * r0 * 1.8, Math.sin(a) * r0 * 0.5 - 15, 6, 6); }
      c.restore(); c.globalAlpha = 1;
    }
    // radar altitude + vertical speed + ideal brake zone
    if (info.radar) {
      const R = info.radar, gh = Math.min(260, H * 0.42), gx = info.compact ? W - 70 : W - 90, gy = H * 0.5 - gh / 2 + 40, top = Math.max(60, Math.min(160, R.ideal * 2.2, R.alt * 1.4));
      const yOf = (h: number) => gy + gh - Math.min(1, Math.max(0, h / top)) * gh;
      c.fillStyle = 'rgba(10,14,24,0.6)'; c.fillRect(gx - 8, gy - 26, 62, gh + 52); c.strokeStyle = CY; c.strokeRect(gx, gy, 14, gh);
      const b0 = yOf(R.ideal * 1.25), b1 = yOf(R.ideal * 0.8); c.fillStyle = R.inBand ? 'rgba(61,255,160,0.85)' : 'rgba(61,255,160,0.35)'; c.fillRect(gx + 1, b0, 12, Math.max(3, b1 - b0));
      c.fillStyle = 'rgba(255,60,60,0.5)'; c.fillRect(gx + 1, b1, 12, gy + gh - b1);
      const my2 = yOf(R.alt); c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(gx + 16, my2); c.lineTo(gx + 26, my2 - 6); c.lineTo(gx + 26, my2 + 6); c.fill();
      c.textAlign = 'left'; c.font = 'bold 12px Consolas'; c.fillStyle = CY; c.fillText('RADAR', gx - 4, gy - 12); c.fillText(`${R.alt.toFixed(0)}m`, gx + 22, my2 + 18);
      c.fillStyle = R.vy < -14 ? '#f55' : R.vy < -5 ? '#ffc23a' : '#3dffa0'; c.fillText(`${R.vy.toFixed(1)}`, gx - 4, gy + gh + 16); c.font = '10px Consolas'; c.fillText('m/s', gx + 34, gy + gh + 16);
      if (R.prompt) { c.textAlign = 'center'; c.font = `900 ${info.compact ? 22 : 30}px "Microsoft YaHei", sans-serif`; c.fillStyle = R.inBand ? '#3dffa0' : '#ff5050'; c.fillText(R.prompt, W / 2, H * 0.72); }
    }
    // messages
    c.textAlign = 'center'; c.font = 'bold 22px "Microsoft YaHei", sans-serif';
    let my = H * 0.26; s.msgs.forEach(m => { c.globalAlpha = Math.min(1, m.ttl); c.font = m.big ? `900 ${info.compact ? 28 : 40}px "Microsoft YaHei", sans-serif` : `bold ${info.compact ? 17 : 22}px "Microsoft YaHei", sans-serif`; c.fillStyle = m.big ? '#ffd23f' : '#fff'; c.fillText(m.t, W / 2, my); my += m.big ? (info.compact ? 34 : 46) : (info.compact ? 22 : 30); }); c.globalAlpha = 1;
    if (info.hint) { c.font = '12px "Microsoft YaHei", sans-serif'; c.fillStyle = '#8899aa'; c.fillText(info.hint, W / 2, 20); }
  }
}
