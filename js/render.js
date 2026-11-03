// Canvas drawing: behind-the-car view of the lead car's brake lights.

const FOCAL = 1000, CAM_H = 1.5, HORIZON = 190;

function drawScene(ctx, w, h, sim, now) {
  // sky and ground
  ctx.fillStyle = '#9ec5e8'; ctx.fillRect(0, 0, w, HORIZON);
  ctx.fillStyle = '#4b6b3c'; ctx.fillRect(0, HORIZON, w, h - HORIZON);

  // road: perspective trapezoid, 7 m wide
  const x = w / 2, roadHalf = 3.5;
  const zNear = 1.5, zFar = 400;
  const proj = (z, lat) => [x + FOCAL * lat / z, HORIZON + FOCAL * CAM_H / z];
  const [lN, yN] = proj(zNear, -roadHalf), [rN] = proj(zNear, roadHalf);
  const [lF, yF] = proj(zFar, -roadHalf), [rF] = proj(zFar, roadHalf);
  ctx.fillStyle = '#3a3a3e';
  ctx.beginPath(); ctx.moveTo(lN, yN); ctx.lineTo(rN, yN); ctx.lineTo(rF, yF); ctx.lineTo(lF, yF); ctx.fill();

  // dashed centre line scrolls with the player's speed
  ctx.fillStyle = '#ddd';
  const dash = 4, period = 12, off = (sim.odo || 0) % period;
  for (let z0 = -off + period; z0 < zFar; z0 += period) {
    const za = Math.max(zNear, z0), zb = z0 + dash;
    if (zb <= zNear) continue;
    const [xa, ya] = proj(za, -0.08), [xa2] = proj(za, 0.08);
    const [xb, yb] = proj(zb, -0.08), [xb2] = proj(zb, 0.08);
    ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xa2, ya); ctx.lineTo(xb2, yb); ctx.lineTo(xb, yb); ctx.fill();
  }

  // lead car
  const z = sim.gap + 2;
  const cw = FOCAL * 1.8 / z, ch = FOCAL * 1.3 / z;
  const gy = HORIZON + FOCAL * CAM_H / z;      // ground contact
  const cx = x, left = cx - cw / 2, top = gy - ch;
  ctx.fillStyle = '#2c3e66'; ctx.fillRect(left, top, cw, ch);                    // body
  ctx.fillStyle = '#1d2a47'; ctx.fillRect(left + cw * 0.15, top - ch * 0.35, cw * 0.7, ch * 0.4); // cabin
  ctx.fillStyle = '#111';    ctx.fillRect(left + cw * 0.05, gy - ch * 0.12, cw * 0.9, ch * 0.12); // bumper shadow

  const lamps = sim.lamps(now);
  const lampW = cw * 0.2, lampH = ch * 0.22, lampY = top + ch * 0.22;
  drawLamp(ctx, left + cw * 0.04, lampY, lampW, lampH, lamps);
  drawLamp(ctx, left + cw * 0.96 - lampW, lampY, lampW, lampH, lamps);
  // high-mount third lamp
  drawLamp(ctx, cx - lampW * 0.5, top - ch * 0.28, lampW, lampH * 0.5, lamps);
}

// Lamp is a stack of 4 bars; `segments` of them light up from the bottom.
function drawLamp(ctx, x, y, w, h, lamps) {
  const bars = 4, bh = h / bars;
  for (let i = 0; i < bars; i++) {
    const fromBottom = bars - 1 - i;
    const on = lamps.lit && fromBottom < lamps.segments;
    const by = y + i * bh;
    if (on) {
      ctx.save();
      ctx.shadowColor = '#ff2a2a'; ctx.shadowBlur = 18 * lamps.brightness;
      ctx.fillStyle = `rgba(255, 30, 30, ${lamps.brightness})`;
      ctx.fillRect(x, by + 1, w, bh - 2);
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(110, 15, 15, 0.9)'; // unlit lens
      ctx.fillRect(x, by + 1, w, bh - 2);
    }
  }
}

function drawHud(ctx, w, h, sim, pedal, source) {
  // pedal bar
  const bx = 20, by = h - 150, bw = 26, bh = 130;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx - 6, by - 6, bw + 12, bh + 12);
  ctx.fillStyle = '#333'; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = pedal > 0.8 ? '#e33' : '#e90';
  ctx.fillRect(bx, by + bh * (1 - pedal), bw, bh * pedal);
  ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif';
  ctx.fillText('BRAKE', bx - 2, by - 12);
  ctx.fillText(Math.round(pedal * 100) + '%', bx, by + bh + 22);
  ctx.fillText(source, bx + 40, by + bh);

  // speed / gap
  ctx.font = '16px sans-serif';
  ctx.fillText(`Speed ${(sim.playerSpeed * 2.237).toFixed(0)} mph`, w - 160, h - 40);
  ctx.fillText(`Gap ${sim.gap.toFixed(0)} m`, w - 160, h - 18);
}
