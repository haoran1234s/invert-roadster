import type { Vehicle } from './vehicle';
import type { Scoring } from './scoring';
const CY = '#e8f4ff';
export class Hud {
  ctx: CanvasRenderingContext2D;
  constructor(private cv: HTMLCanvasElement) { this.ctx = cv.getContext('2d')!; }
  gauge(x: number, y: number, r: number, label: string, unit: string, val: number, max: number, text: string) {
    const c = this.ctx; c.strokeStyle = CY; c.fillStyle = CY; c.lineWidth = 1;
    c.globalAlpha = 0.35; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(x, y, r * 0.78, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i <= 40; i++) { const a = Math.PI * 0.75 + i / 40 * Math.PI * 1.5; const l = i % 5 ? 0.9 : 0.84; c.beginPath(); c.moveTo(x + Math.cos(a) * r * l, y + Math.sin(a) * r * l); c.lineTo(x + Math.cos(a) * r * 0.97, y + Math.sin(a) * r * 0.97); c.stroke(); }
    c.globalAlpha = 1; c.lineWidth = 3; const k = Math.max(0, Math.min(1, val / max));
    c.beginPath(); c.arc(x, y, r * 0.88, Math.PI * 0.75, Math.PI * 0.75 + k * Math.PI * 1.5); c.stroke();
    c.textAlign = 'center'; c.font = `bold ${r * 0.34}px Consolas, monospace`; c.fillText(text, x, y + r * 0.1);
    c.font = `${r * 0.16}px Consolas, monospace`; c.globalAlpha = 0.8; c.fillText(unit, x, y + r * 0.38); c.fillText(label, x, y + r + r * 0.28); c.globalAlpha = 1;
  }
  draw(v: Vehicle, s: Scoring, info: { cam: string; level: string; stars: { label: string; ok: boolean }[]; hint: string; fps: number; debug?: string; compact?: boolean }) {
    const cv = this.cv, c = this.ctx, dpr = Math.min(devicePixelRatio || 1, info.compact ? 1.5 : 2); const W = innerWidth, H = innerHeight;
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
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
    c.font = '15px Consolas'; c.fillText(`RUN ${Math.round(s.run)}   COMBO x${s.combo}`, W - 20, 62);
    c.fillText(`${Math.round(v.vel.length() * 3.6)} KM/H`, W - 20, 84); c.fillText(`CAM: ${info.cam}`, W - 20, 104);
    if (info.debug) { c.textAlign = 'left'; c.font = '12px Consolas'; c.fillStyle = '#7f7'; c.fillText(info.debug, info.compact ? W * 0.3 : 20, info.compact ? 20 : H - 8); c.textAlign = 'right'; c.fillStyle = CY; }
    // messages
    c.textAlign = 'center'; c.font = 'bold 22px "Microsoft YaHei", sans-serif';
    s.msgs.forEach((m, i) => { c.globalAlpha = Math.min(1, m.ttl); c.fillStyle = '#fff'; c.fillText(m.t, W / 2, H * 0.28 + i * 30); }); c.globalAlpha = 1;
    if (info.hint) { c.font = '12px "Microsoft YaHei", sans-serif'; c.fillStyle = '#8899aa'; c.fillText(info.hint, W / 2, 20); }
  }
}
