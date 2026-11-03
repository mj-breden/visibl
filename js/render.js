// Canvas rendering: a driver's-eye view of the road with a lead vehicle seen from behind.
// Scene geometry is in metres and projected with a simple pinhole camera. Vehicles are drawn
// in their own metre-based coordinates (x lateral, y up) and then scaled to the screen.

const VIEW = { W: 1280, H: 720, FOCAL: 1800, CAM_H: 1.2, HORIZON: 300 };

const ENVS = {
  day: {
    label: 'Day', k: 1, carK: 1, running: 0, glow: 0.55, headlight: 0, stars: false,
    sky: [[0, [70, 130, 205]], [0.7, [150, 195, 235]], [1, [205, 225, 240]]],
    haze: [205, 225, 240], cloud: [255, 255, 255, 0.55], sun: null,
  },
  dusk: {
    label: 'Dusk', k: 0.55, carK: 0.64, running: 0.3, glow: 1, headlight: 0.08, stars: false,
    sky: [[0, [38, 52, 108]], [0.55, [150, 100, 120]], [0.85, [245, 150, 95]], [1, [255, 190, 120]]],
    haze: [225, 150, 110], cloud: [255, 190, 170, 0.3], sun: [255, 170, 90],
  },
  night: {
    label: 'Night', k: 0.13, carK: 0.36, running: 0.34, glow: 1.5, headlight: 0.28, stars: true,
    sky: [[0, [4, 6, 16]], [1, [22, 30, 52]]],
    haze: [22, 30, 52], cloud: null, sun: null,
  },
};

// Paint and body for each vehicle type.
const VEHICLES = {
  sedan:  { label: 'Sedan',  paint: [150, 158, 168] },
  suv:    { label: 'SUV',    paint: [34, 52, 88] },
  pickup: { label: 'Pickup', paint: [186, 188, 190] },
};

const rgb = (c, k = 1, a = 1) => `rgba(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0},${a})`;
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---------------------------------------------------------------- scene

let grainPattern = null;
function getGrain(ctx) {
  if (grainPattern) return grainPattern;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 90 + Math.random() * 120;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainPattern = ctx.createPattern(c, 'repeat');
  return grainPattern;
}

const proj = (z, lat) => [VIEW.W / 2 + VIEW.FOCAL * lat / z, VIEW.HORIZON + VIEW.FOCAL * VIEW.CAM_H / z];

function quad(ctx, z0, z1, l0, l1) {
  const [xa, ya] = proj(z0, l0), [xb] = proj(z0, l1), [xc, yc] = proj(z1, l1), [xd] = proj(z1, l0);
  ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, ya); ctx.lineTo(xc, yc); ctx.lineTo(xd, yc); ctx.closePath(); ctx.fill();
}

function drawSky(ctx, env, t) {
  const { W, HORIZON } = VIEW;
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
  for (const [p, c] of env.sky) g.addColorStop(p, rgb(c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, HORIZON + 1);

  if (env.sun) {
    const sg = ctx.createRadialGradient(W * 0.64, HORIZON, 0, W * 0.64, HORIZON, 520);
    sg.addColorStop(0, rgb(env.sun, 1, 0.75)); sg.addColorStop(0.3, rgb(env.sun, 1, 0.25)); sg.addColorStop(1, rgb(env.sun, 1, 0));
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, HORIZON + 1);
  }
  if (env.stars) {
    for (let i = 0; i < 110; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + hash(i + 9) * 0.6})`;
      ctx.fillRect(hash(i) * W, hash(i + 40) * (HORIZON - 40), 1.4, 1.4);
    }
  }
  if (env.cloud) {
    for (let i = 0; i < 6; i++) {
      const x = ((hash(i + 3) * (W + 500) + t * (3 + i)) % (W + 500)) - 250;
      const y = 40 + hash(i + 17) * 150, r = 60 + hash(i + 29) * 70;
      for (let j = 0; j < 4; j++) {
        const cx = x + (j - 1.5) * r * 0.55, cy = y + Math.sin(j * 2 + i) * 8, rr = r * (0.55 + hash(i * 7 + j) * 0.4);
        const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
        cg.addColorStop(0, rgb(env.cloud, 1, env.cloud[3])); cg.addColorStop(1, rgb(env.cloud, 1, 0));
        ctx.fillStyle = cg; ctx.save(); ctx.translate(cx, cy); ctx.scale(1.8, 0.55); ctx.translate(-cx, -cy);
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.fill(); ctx.restore();
      }
    }
  }
}

function ridge(ctx, base, amp, phase, colour) {
  const { W, HORIZON } = VIEW;
  ctx.fillStyle = colour; ctx.beginPath(); ctx.moveTo(0, HORIZON + 2);
  for (let x = 0; x <= W; x += 8) {
    const y = base - amp * (0.55 + 0.45 * Math.sin(x * 0.006 + phase) + 0.3 * Math.sin(x * 0.017 + phase * 2.3));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, HORIZON + 2); ctx.closePath(); ctx.fill();
}

function drawTree(ctx, env, z, lat, hM, seed) {
  const [x, y] = proj(z, lat), s = VIEW.FOCAL / z;
  if (x < -200 || x > VIEW.W + 200) return;
  const k = env.k, fog = Math.min(0.85, z / 520), green = mix([28, 62, 30], env.haze, fog);
  ctx.fillStyle = rgb([50, 38, 28], k); ctx.fillRect(x - 0.18 * s, y - hM * 0.45 * s, 0.36 * s, hM * 0.45 * s);
  // canopy: a loose cluster of leaf masses, lighter on top, dark underneath
  for (let i = 0; i < 9; i++) {
    const a = hash(seed + i * 3) * 6.28, d = hash(seed + i + 5) * 0.5;
    const cx = x + Math.cos(a) * d * hM * 0.42 * s, cy = y - hM * (0.62 + Math.sin(a) * d * 0.4) * s;
    const r = hM * (0.12 + hash(seed + i + 9) * 0.08) * s;
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r);
    g.addColorStop(0, rgb(green, k * (1.3 + hash(seed + i) * 0.4))); g.addColorStop(1, rgb(green, k * 0.55));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  }
}

function drawScene(ctx, sim, now, opt) {
  const { W, H, HORIZON, FOCAL, CAM_H } = VIEW;
  const env = ENVS[opt.env], k = env.k, odo = sim.odo || 0;

  drawSky(ctx, env, now);
  ridge(ctx, HORIZON - 6, 46, 1.3, rgb(mix([88, 112, 140], env.haze, 0.55), k * 1.1));
  ridge(ctx, HORIZON + 2, 26, 4.1, rgb(mix([40, 70, 48], env.haze, 0.35), k));

  // grass
  const gg = ctx.createLinearGradient(0, HORIZON, 0, H);
  gg.addColorStop(0, rgb(mix([70, 105, 60], env.haze, 0.5), k)); gg.addColorStop(1, rgb([44, 80, 38], k));
  ctx.fillStyle = gg; ctx.fillRect(0, HORIZON, W, H - HORIZON);

  // asphalt
  const zNear = 1.0, zFar = 900, left = -5.55, right = 3.35;
  const [lN, yN] = proj(zNear, left), [rN] = proj(zNear, right), [lF, yF] = proj(zFar, left), [rF] = proj(zFar, right);
  const road = () => { ctx.beginPath(); ctx.moveTo(lN, yN); ctx.lineTo(rN, yN); ctx.lineTo(rF, yF); ctx.lineTo(lF, yF); ctx.closePath(); };
  const base = [78, 79, 84];
  road(); ctx.fillStyle = rgb(base, k); ctx.fill();
  ctx.save(); road(); ctx.clip();
  ctx.globalAlpha = 0.16 * Math.min(1, k + 0.3); ctx.fillStyle = getGrain(ctx); ctx.fillRect(0, HORIZON, W, H - HORIZON);
  ctx.globalAlpha = 1;
  const fade = ctx.createLinearGradient(0, HORIZON, 0, H * 0.78);
  fade.addColorStop(0, rgb(mix(base, env.haze, 0.55), k, 1)); fade.addColorStop(1, rgb(base, k, 0));
  ctx.fillStyle = fade; ctx.fillRect(0, HORIZON, W, H);
  // paved shoulder and worn tyre tracks
  ctx.fillStyle = rgb([110, 108, 104], k, 0.5); quad(ctx, zNear, zFar, 2.0, right);
  ctx.fillStyle = 'rgba(0,0,0,0.07)'; quad(ctx, zNear, zFar, -1.1, -0.6); quad(ctx, zNear, zFar, 0.6, 1.1);
  // lane markings
  ctx.fillStyle = rgb([235, 235, 228], Math.min(1, k + 0.15));
  quad(ctx, zNear, zFar, 1.85, 2.0); quad(ctx, zNear, zFar, left + 0.1, left + 0.25);
  const period = 12, off = odo % period;
  for (let z0 = -off; z0 < 420; z0 += period) {
    if (z0 + 3 > zNear) quad(ctx, Math.max(z0, zNear), z0 + 3, -1.92, -1.77);
  }
  ctx.restore();

  // headlight pool on the road ahead
  if (env.headlight) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.translate(W / 2, H * 0.74); ctx.scale(1, 0.34);
    const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, 700);
    hg.addColorStop(0, `rgba(255,240,205,${env.headlight})`); hg.addColorStop(1, 'rgba(255,240,205,0)');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, 0, 700, 0, 7); ctx.fill(); ctx.restore();
  }

  // trees, far to near, scrolling with the player's odometer
  const trees = [];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 24; i++) {
      const z = (((i * 17 + (side > 0 ? 8 : 0) - odo) % 408) + 408) % 408 + 5;
      const seed = i * 13 + (side > 0 ? 7 : 0);
      trees.push({ z, lat: side * (10 + hash(seed) * 18), h: 5 + hash(seed + 3) * 4, seed });
    }
  }
  trees.sort((a, b) => b.z - a.z);
  for (const t of trees) drawTree(ctx, env, t.z, t.lat, t.h, t.seed);

  // atmospheric haze toward the horizon
  const hz = ctx.createLinearGradient(0, HORIZON - 70, 0, HORIZON + 110);
  hz.addColorStop(0, rgb(env.haze, 1, 0)); hz.addColorStop(0.45, rgb(env.haze, 1, 0.38)); hz.addColorStop(1, rgb(env.haze, 1, 0));
  ctx.fillStyle = hz; ctx.fillRect(0, HORIZON - 70, W, 180);

  // lead vehicle
  const z = sim.gap + 2.2;
  const sway = 0.06 * Math.sin(now * 0.6) + 0.03 * Math.sin(now * 1.7);
  drawVehicle(ctx, VEHICLES[opt.vehicle] ? opt.vehicle : 'sedan', env, sim.lamps(now), W / 2 + FOCAL * sway / z,
    HORIZON + FOCAL * CAM_H / z, FOCAL / z);

  drawCockpit(ctx, env);
}

// Hood and windscreen pillars so the view reads as looking out of a car.
function drawCockpit(ctx, env) {
  const { W, H } = VIEW, k = Math.max(0.25, env.k);
  const hood = ctx.createLinearGradient(0, H - 100, 0, H);
  hood.addColorStop(0, rgb([70, 74, 82], k)); hood.addColorStop(1, rgb([12, 13, 16], k));
  ctx.fillStyle = hood; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, H - 46);
  ctx.quadraticCurveTo(W / 2, H - 112, W, H - 46); ctx.lineTo(W, H); ctx.fill();
  const sheen = ctx.createLinearGradient(0, H - 100, 0, H - 40);
  sheen.addColorStop(0, `rgba(255,255,255,${0.2 * k})`); sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen; ctx.beginPath(); ctx.moveTo(0, H - 46); ctx.quadraticCurveTo(W / 2, H - 112, W, H - 46);
  ctx.lineTo(W, H - 20); ctx.quadraticCurveTo(W / 2, H - 80, 0, H - 20); ctx.fill();

  for (const s of [-1, 1]) {
    const x0 = s < 0 ? 0 : W, g = ctx.createLinearGradient(x0, 0, x0 - s * 90, 0);
    g.addColorStop(0, 'rgba(8,9,11,0.96)'); g.addColorStop(1, 'rgba(8,9,11,0)');
    ctx.fillStyle = g; ctx.fillRect(s < 0 ? 0 : W - 90, 0, 90, H);
  }
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- vehicles

let V = null; // per-draw vehicle context: { K, env, lamps, s }
const C = (r, g, b, a = 1) => `rgba(${Math.min(255, r * V.K) | 0},${Math.min(255, g * V.K) | 0},${Math.min(255, b * V.K) | 0},${a})`;
const Cc = (c, m = 1, a = 1) => C(c[0] * m, c[1] * m, c[2] * m, a);

// Symmetric rear-panel outline: top edge, widest point, and bottom edge.
function shell(ctx, top, wTop, wMid, yMid, wBot, bot) {
  ctx.beginPath(); ctx.moveTo(-wTop, top); ctx.lineTo(wTop, top);
  ctx.bezierCurveTo(wTop + 0.07, top, wMid, top - 0.06, wMid, yMid);
  ctx.bezierCurveTo(wMid, yMid - (yMid - bot) * 0.45, wBot + 0.1, bot + 0.02, wBot, bot);
  ctx.lineTo(-wBot, bot);
  ctx.bezierCurveTo(-wBot - 0.1, bot + 0.02, -wMid, yMid - (yMid - bot) * 0.45, -wMid, yMid);
  ctx.bezierCurveTo(-wMid, top - 0.06, -wTop - 0.07, top, -wTop, top); ctx.closePath();
}

function trap(ctx, yBot, hwBot, yTop, hwTop, r = 0.05) {
  ctx.beginPath(); ctx.moveTo(-hwBot, yBot); ctx.lineTo(hwBot, yBot);
  ctx.quadraticCurveTo(hwBot - 0.01, yTop - 0.05, hwTop, yTop - r * 0.6);
  ctx.quadraticCurveTo(hwTop - 0.02, yTop, hwTop - r, yTop);
  ctx.lineTo(-hwTop + r, yTop); ctx.quadraticCurveTo(-hwTop + 0.02, yTop, -hwTop, yTop - r * 0.6);
  ctx.quadraticCurveTo(-hwBot + 0.01, yTop - 0.05, -hwBot, yBot); ctx.closePath();
}

function paintFill(ctx, paint, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, Cc(paint, 0.5)); g.addColorStop(0.55, Cc(paint, 1)); g.addColorStop(1, Cc(paint, 1.28));
  return g;
}

function sheenFill(ctx, x0, x1, a = 0.12) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.35, `rgba(255,255,255,${a * V.K})`);
  g.addColorStop(0.55, 'rgba(255,255,255,0)'); g.addColorStop(1, `rgba(255,255,255,${a * 0.4 * V.K})`);
  return g;
}

function drawGlass(ctx, pathFn, y0, y1) {
  ctx.save(); ctx.beginPath(); pathFn(ctx); ctx.clip();
  ctx.fillStyle = C(10, 13, 18); ctx.fillRect(-2, y0, 4, y1 - y0);
  const sky = V.env.sky[V.env.sky.length - 2][1];
  const g = ctx.createLinearGradient(0, y1, 0, y0);
  g.addColorStop(0, rgb(sky, V.K * 1.1, 0.5)); g.addColorStop(1, rgb(sky, V.K * 0.5, 0.12));
  ctx.fillStyle = g; ctx.fillRect(-2, y0, 4, y1 - y0);
  // seat headrests and a hint of the rear shelf
  ctx.fillStyle = C(26, 28, 34);
  for (const x of [-0.28, 0.28]) { ctx.beginPath(); ctx.roundRect(x - 0.1, y0 + (y1 - y0) * 0.1, 0.2, (y1 - y0) * 0.38, 0.06); ctx.fill(); }
  // heated-glass grid and a diagonal glare
  ctx.strokeStyle = C(0, 0, 0, 0.35); ctx.lineWidth = 0.004;
  for (let i = 1; i < 7; i++) { const y = y0 + (y1 - y0) * i / 7; ctx.beginPath(); ctx.moveTo(-1, y); ctx.lineTo(1, y); ctx.stroke(); }
  ctx.fillStyle = `rgba(255,255,255,${0.09 * V.K})`;
  ctx.beginPath(); ctx.moveTo(-0.5, y0); ctx.lineTo(-0.15, y0); ctx.lineTo(0.2, y1); ctx.lineTo(-0.15, y1); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.beginPath(); pathFn(ctx); ctx.lineWidth = 0.02; ctx.strokeStyle = C(8, 8, 10); ctx.stroke(); ctx.restore();
}

function drawTyres(ctx, x0, x1, h) {
  // dark underbody between the wheels, fading to the lit road below it
  const under = ctx.createLinearGradient(0, 0, 0, h + 0.1);
  under.addColorStop(0, C(0, 0, 0, 0.1)); under.addColorStop(0.5, C(0, 0, 0, 0.7)); under.addColorStop(1, C(4, 4, 6, 0.97));
  ctx.fillStyle = under; ctx.fillRect(-x0, 0, x0 * 2, h + 0.1);
  for (const s of [-1, 1]) {
    const g = ctx.createLinearGradient(s * x0, 0, s * x1, 0);
    g.addColorStop(0, C(34, 34, 36)); g.addColorStop(0.5, C(14, 14, 15)); g.addColorStop(1, C(30, 30, 32));
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(Math.min(s * x0, s * x1), 0, x1 - x0, h + 0.15, 0.04); ctx.fill();
    ctx.strokeStyle = C(55, 55, 58, 0.5); ctx.lineWidth = 0.01; // sidewall highlight
    ctx.beginPath(); ctx.moveTo(s * (x0 + 0.03), 0.02); ctx.lineTo(s * (x0 + 0.03), h); ctx.stroke();
  }
}

function drawPlate(ctx, y, w, h) {
  ctx.fillStyle = C(30, 30, 32); ctx.beginPath(); ctx.roundRect(-w / 2 - 0.02, y - 0.02, w + 0.04, h + 0.04, 0.02); ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, C(250, 250, 244)); g.addColorStop(1, C(214, 214, 208));
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-w / 2, y, w, h, 0.015); ctx.fill();
  ctx.fillStyle = C(34, 52, 120); ctx.fillRect(-w / 2 + 0.01, y + h * 0.78, w - 0.02, h * 0.14);
  ctx.fillStyle = C(30, 30, 40);
  for (let i = 0; i < 7; i++) ctx.fillRect(-w / 2 + 0.04 + i * (w - 0.08) / 7, y + h * 0.18, (w - 0.08) / 7 * 0.62, h * 0.48);
}

function chrome(ctx, x, y, rx, ry) {
  const g = ctx.createLinearGradient(0, y + ry, 0, y - ry);
  g.addColorStop(0, C(90, 92, 96)); g.addColorStop(0.5, C(235, 238, 242)); g.addColorStop(1, C(110, 112, 118));
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
}

// A tail-lamp: a lens divided into 4 cells along its long axis. `segments` cells light for braking.
// L = { path(ctx), axis: 'x'|'y', a0, a1, b0, b1 } defined for the right-hand side of the vehicle.
function lampCells(L) {
  const n = 4, span = (L.a1 - L.a0) / n;
  return Array.from({ length: n }, (_, i) =>
    L.axis === 'x' ? { x: L.a0 + i * span, y: L.b0, w: span, h: L.b1 - L.b0 }
                   : { x: L.b0, y: L.a0 + i * span, w: L.b1 - L.b0, h: span });
}

function drawLamp(ctx, L, mirror) {
  const lamps = V.lamps, run = V.env.running;
  ctx.save(); if (mirror) ctx.scale(-1, 1);
  ctx.beginPath(); L.path(ctx); ctx.fillStyle = C(18, 8, 8); ctx.fill();
  ctx.lineWidth = 0.022; ctx.strokeStyle = C(12, 12, 14); ctx.stroke(); // housing rim
  ctx.save(); ctx.beginPath(); L.path(ctx); ctx.clip();

  // lens body
  const lg = L.axis === 'x' ? ctx.createLinearGradient(L.a0, 0, L.a1, 0) : ctx.createLinearGradient(0, L.a0, 0, L.a1);
  lg.addColorStop(0, C(120, 14, 20)); lg.addColorStop(1, C(76, 8, 13));
  ctx.fillStyle = lg; ctx.fillRect(L.axis === 'x' ? L.a0 : L.b0, L.axis === 'x' ? L.b0 : L.a0,
    L.axis === 'x' ? L.a1 - L.a0 : L.b1 - L.b0, L.axis === 'x' ? L.b1 - L.b0 : L.a1 - L.a0);

  const cells = lampCells(L), gap = 0.012;
  cells.forEach((c, i) => {
    const lit = lamps.lit && i < lamps.segments;
    const x = c.x + gap / 2, y = c.y + gap / 2, w = c.w - gap, h = c.h - gap;
    if (run > 0) { ctx.fillStyle = C(190, 16, 22, run); ctx.fillRect(x, y, w, h); } // running light
    if (!lit) return;
    const cx = x + w / 2, cy = y + h / 2, r = Math.max(w, h) * 0.75;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255,210,195,${lamps.brightness})`); g.addColorStop(0.35, `rgba(255,60,40,${lamps.brightness})`);
    g.addColorStop(1, `rgba(215,12,18,${lamps.brightness})`);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    // LED dots
    ctx.fillStyle = `rgba(255,236,226,${0.85 * lamps.brightness})`;
    for (let d = -1; d <= 1; d++) {
      const px = L.axis === 'x' ? cx : cx + d * w * 0.28, py = L.axis === 'x' ? cy + d * h * 0.26 : cy;
      ctx.beginPath(); ctx.arc(px, py, 0.011, 0, 7); ctx.fill();
    }
  });
  // lens gloss
  const gl = ctx.createLinearGradient(0, L.axis === 'x' ? L.b1 : L.a1, 0, L.axis === 'x' ? L.b0 : L.a0);
  gl.addColorStop(0, 'rgba(255,255,255,0.22)'); gl.addColorStop(0.45, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.fillRect(-2, -2, 4, 4);
  ctx.restore(); ctx.restore();
}

// Light that escapes the lamps: bloom, a veiling halo, and a red wash on the ground.
function drawBloom(ctx, lampSpecs) {
  const lamps = V.lamps; if (!lamps.lit) return;
  const gain = V.env.glow * lamps.brightness, s = V.s;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const L of lampSpecs) for (const side of [-1, 1]) {
    const span = (L.a1 - L.a0) * lamps.segments / 4, mid = L.a0 + span / 2, cross = (L.b0 + L.b1) / 2;
    const px = (L.axis === 'x' ? mid : cross) * side, py = L.axis === 'x' ? cross : mid;
    const ext = Math.max(span, L.b1 - L.b0) * 0.5;
    const r = Math.max(ext + 0.28, 11 / s) * (0.8 + 0.4 * gain);
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(255,70,45,${Math.min(0.75, 0.5 * gain)})`);
    g.addColorStop(0.4, `rgba(255,25,15,${Math.min(0.35, 0.2 * gain)})`); g.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill();
    const R = r * 3.2, h = ctx.createRadialGradient(px, py, 0, px, py, R);
    h.addColorStop(0, `rgba(255,30,20,${Math.min(0.2, 0.1 * gain)})`); h.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = h; ctx.beginPath(); ctx.arc(px, py, R, 0, 7); ctx.fill();
  }
  // red wash on the tarmac behind the vehicle
  ctx.save(); ctx.scale(1, 0.16);
  const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 2.6);
  const lit = lamps.barStyle ? lamps.barFrac : lamps.segments / 4; // how much of the light output is on
  const a = Math.min(0.5, 0.22 * gain * lit * (V.env.k < 1 ? 1.4 : 0.8));
  grd.addColorStop(0, `rgba(255,30,20,${a})`); grd.addColorStop(1, 'rgba(255,0,0,0)');
  ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, 7); ctx.fill(); ctx.restore();
  ctx.restore();
}

// Full-width light bar. In the 'bar' style it fills outward from the centre as braking gets
// harder; at lock-up the centre flashes a white strobe. B = { y, h, hw } (centre-symmetric).
function drawBar(ctx, B) {
  const { y, h, hw } = B, lamps = V.lamps, f = lamps.barFrac;
  const r = Math.min(0.06, h * 0.4);
  ctx.fillStyle = C(18, 8, 8); ctx.beginPath(); ctx.roundRect(-hw - 0.015, y - 0.015, hw * 2 + 0.03, h + 0.03, r + 0.015); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.roundRect(-hw, y, hw * 2, h, r); ctx.clip();
  ctx.fillStyle = C(88, 10, 15); ctx.fillRect(-hw, y, hw * 2, h); // unlit lens
  if (V.env.running > 0) { ctx.fillStyle = C(190, 16, 22, V.env.running); ctx.fillRect(-hw, y, hw * 2, h); } // running light
  if (lamps.lit && f > 0) {
    const len = f * hw, g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(215,18,24,1)'); g.addColorStop(0.5, 'rgba(255,85,62,1)'); g.addColorStop(1, 'rgba(200,14,20,1)');
    ctx.fillStyle = g; ctx.fillRect(-len, y, len * 2, h);
    ctx.fillStyle = 'rgba(255,236,226,0.85)'; // LED dot grid
    const rows = Math.max(1, Math.round(h / 0.05));
    for (let j = 0; j < rows; j++) for (let x = -len + 0.025; x < len; x += 0.05) {
      ctx.beginPath(); ctx.arc(x, y + h * (j + 0.5) / rows, 0.011, 0, 7); ctx.fill();
    }
    if (lamps.strobeOn) {
      const sg = ctx.createLinearGradient(-0.2, 0, 0.2, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0.7)'); sg.addColorStop(0.3, 'rgba(255,255,255,1)');
      sg.addColorStop(0.7, 'rgba(255,255,255,1)'); sg.addColorStop(1, 'rgba(255,255,255,0.7)');
      ctx.fillStyle = sg; ctx.fillRect(-0.2, y, 0.4, h);
    }
  }
  const gl = ctx.createLinearGradient(0, y + h, 0, y); gl.addColorStop(0, 'rgba(255,255,255,0.2)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.fillRect(-hw, y, hw * 2, h);
  ctx.restore();
}

function drawBarGlow(ctx, B) {
  const lamps = V.lamps; if (!lamps.lit || !lamps.barFrac) return;
  const gain = V.env.glow, s = V.s, len = lamps.barFrac * B.hw, cy = B.y + B.h / 2;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.save(); ctx.translate(0, cy); ctx.scale(1, 0.25 + B.h * 1.2);
  const R = len + Math.max(0.3, 10 / s), g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  g.addColorStop(0, `rgba(255,55,38,${Math.min(0.55, 0.32 * gain)})`); g.addColorStop(1, 'rgba(255,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill(); ctx.restore();
  if (lamps.strobeOn) {
    const r = Math.max(0.55, 20 / s), w = ctx.createRadialGradient(0, cy, 0, 0, cy, r);
    w.addColorStop(0, `rgba(255,255,255,${Math.min(0.95, 0.5 + 0.3 * gain)})`); w.addColorStop(0.35, 'rgba(255,225,215,0.3)'); w.addColorStop(1, 'rgba(255,200,200,0)');
    ctx.fillStyle = w; ctx.beginPath(); ctx.arc(0, cy, r, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function chmsl(ctx, x, y, w, h) {
  return { axis: 'x', a0: x - w / 2, a1: x + w / 2, b0: y, b1: y + h,
    path: c => { c.roundRect(x - w / 2, y, w, h, h * 0.4); } };
}

function drawVehicle(ctx, type, env, lamps, cx, gy, s) {
  V = { K: env.carK, env, lamps, s };
  const paint = VEHICLES[type].paint;
  ctx.save(); ctx.translate(cx, gy); ctx.scale(s, -s);

  // contact shadow
  ctx.save(); ctx.scale(1, 0.12);
  const sh = ctx.createRadialGradient(0, 0, 0.2, 0, 0, 1.45);
  sh.addColorStop(0, 'rgba(0,0,0,0.75)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, 1.45, 0, 7); ctx.fill(); ctx.restore();

  let tail;
  if (type === 'sedan') tail = drawSedan(ctx, paint);
  else if (type === 'suv') tail = drawSuv(ctx, paint);
  else tail = drawPickup(ctx, paint);

  for (const L of tail.sides) { drawLamp(ctx, L, false); drawLamp(ctx, L, true); }
  const hm = tail.high; if (hm) drawLamp(ctx, hm, false);
  if (tail.bar) drawBar(ctx, tail.bar);
  drawBloom(ctx, tail.sides);
  if (tail.bar) drawBarGlow(ctx, tail.bar);
  // third lamp bloom (centre, single)
  if (hm && lamps.lit) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const px = 0, py = hm.b0 + (hm.b1 - hm.b0) / 2, r = Math.max(0.22, 9 / s), g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(255,70,45,${Math.min(0.6, 0.4 * env.glow * lamps.brightness)})`); g.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}

function seam(ctx, y, hw) { ctx.strokeStyle = C(0, 0, 0, 0.5); ctx.lineWidth = 0.011; ctx.beginPath(); ctx.moveTo(-hw, y); ctx.lineTo(hw, y); ctx.stroke(); }

function drawSedan(ctx, paint) {
  drawTyres(ctx, 0.62, 0.88, 0.3);
  // roof and C-pillars
  ctx.fillStyle = paintFill(ctx, paint, 0.98, 1.47); trap(ctx, 0.97, 0.82, 1.47, 0.6); ctx.fill();
  const glass = c => trap(c, 1.02, 0.74, 1.41, 0.55, 0.07);
  drawGlass(ctx, glass, 1.02, 1.41);
  // rear deck and bumper
  shell(ctx, 1.0, 0.84, 0.94, 0.74, 0.8, 0.3);
  ctx.fillStyle = paintFill(ctx, paint, 0.3, 1.0); ctx.fill();
  ctx.fillStyle = sheenFill(ctx, -0.9, 0.9); ctx.fill();
  ctx.fillStyle = C(255, 255, 255, 0.18); ctx.fillRect(-0.8, 0.985, 1.6, 0.012); // lid edge catch-light
  seam(ctx, 0.64, 0.9); seam(ctx, 0.4, 0.83);
  // lower valance, exhaust, reflectors
  ctx.fillStyle = C(16, 16, 18); ctx.beginPath(); ctx.roundRect(-0.66, 0.31, 1.32, 0.12, 0.03); ctx.fill();
  chrome(ctx, -0.45, 0.37, 0.055, 0.032); chrome(ctx, 0.45, 0.37, 0.055, 0.032);
  ctx.fillStyle = C(140, 10, 14); for (const s of [-1, 1]) ctx.fillRect(s * 0.72 - 0.05, 0.42, 0.1, 0.04);
  drawPlate(ctx, 0.55, 0.52, 0.12);
  const bar = V.lamps.barStyle;
  chrome(ctx, 0, bar ? 0.94 : 0.86, 0.07, 0.035);
  const side = { axis: 'x', a0: 0.36, a1: 0.94, b0: 0.73, b1: 0.98, path: c => {
    c.moveTo(0.36, 0.78); c.lineTo(0.36, 0.9); c.quadraticCurveTo(0.7, 0.975, 0.88, 0.965);
    c.quadraticCurveTo(0.945, 0.9, 0.93, 0.77); c.quadraticCurveTo(0.65, 0.735, 0.36, 0.78); c.closePath();
  } };
  // bar style: one full-width bar (about half the trunk height) replaces all regular brake lights
  return bar ? { sides: [], high: null, bar: { y: 0.7, h: 0.18, hw: 0.86 } }
             : { sides: [side], high: chmsl(ctx, 0, 1.025, 0.46, 0.045) };
}

function drawSuv(ctx, paint) {
  drawTyres(ctx, 0.64, 0.9, 0.36);
  // roof, spoiler and tall glass
  ctx.fillStyle = paintFill(ctx, paint, 1.0, 1.76); trap(ctx, 1.0, 0.9, 1.74, 0.78, 0.08); ctx.fill();
  drawGlass(ctx, c => trap(c, 1.06, 0.74, 1.62, 0.64, 0.09), 1.06, 1.62);
  ctx.fillStyle = C(10, 10, 12); ctx.fillRect(-0.5, 1.69, 1, 0.025); // spoiler lip
  shell(ctx, 1.04, 0.9, 0.96, 0.78, 0.86, 0.34);
  ctx.fillStyle = paintFill(ctx, paint, 0.34, 1.04); ctx.fill();
  ctx.fillStyle = sheenFill(ctx, -0.95, 0.95); ctx.fill();
  seam(ctx, 0.62, 0.95);
  ctx.fillStyle = C(18, 18, 20); ctx.beginPath(); ctx.roundRect(-0.74, 0.35, 1.48, 0.17, 0.04); ctx.fill(); // bumper insert
  chrome(ctx, -0.5, 0.4, 0.07, 0.032); chrome(ctx, 0.5, 0.4, 0.07, 0.032);
  const bar = V.lamps.barStyle;
  drawPlate(ctx, bar ? 0.66 : 0.76, 0.52, 0.12); chrome(ctx, 0, 1.2, 0.085, 0.04);
  const side = { axis: 'y', a0: 0.82, a1: 1.5, b0: 0.76, b1: 0.95, path: c => {
    c.moveTo(0.76, 0.84); c.lineTo(0.95, 0.82); c.quadraticCurveTo(0.96, 1.2, 0.9, 1.5);
    c.lineTo(0.8, 1.5); c.quadraticCurveTo(0.76, 1.2, 0.76, 0.84); c.closePath();
  } };
  return bar ? { sides: [], high: null, bar: { y: 0.84, h: 0.19, hw: 0.9 } }
             : { sides: [side], high: chmsl(ctx, 0, 1.655, 0.4, 0.04) };
}

function drawPickup(ctx, paint) {
  drawTyres(ctx, 0.7, 0.98, 0.46);
  // cab behind the bed
  ctx.fillStyle = paintFill(ctx, paint, 1.1, 1.95); trap(ctx, 1.1, 0.9, 1.95, 0.76, 0.1); ctx.fill();
  drawGlass(ctx, c => trap(c, 1.3, 0.62, 1.82, 0.54, 0.07), 1.3, 1.82);
  ctx.fillStyle = C(10, 10, 12); ctx.fillRect(-0.3, 1.88, 0.6, 0.03);
  // bed top rail and tailgate
  shell(ctx, 1.2, 0.98, 1.02, 0.9, 0.96, 0.3);
  ctx.fillStyle = paintFill(ctx, paint, 0.3, 1.2); ctx.fill();
  ctx.fillStyle = sheenFill(ctx, -1.0, 1.0); ctx.fill();
  ctx.fillStyle = C(0, 0, 0, 0.55); ctx.fillRect(-0.94, 1.16, 1.88, 0.035); // tailgate/bed gap
  seam(ctx, 0.56, 1.0);
  // step bumper
  const bg = ctx.createLinearGradient(0, 0.3, 0, 0.58); bg.addColorStop(0, C(70, 72, 76)); bg.addColorStop(0.5, C(215, 218, 222)); bg.addColorStop(1, C(110, 112, 118));
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(-1.0, 0.32, 2.0, 0.24, 0.05); ctx.fill();
  ctx.fillStyle = C(16, 16, 18); ctx.fillRect(-0.12, 0.2, 0.24, 0.13); // hitch receiver
  const bar = V.lamps.barStyle;
  drawPlate(ctx, bar ? 0.4 : 0.66, 0.52, 0.12); // bar style leaves the tailgate to the bar, so the plate sits on the bumper
  ctx.fillStyle = C(20, 20, 22); ctx.beginPath(); ctx.roundRect(-0.14, bar ? 1.07 : 1.02, 0.28, 0.05, 0.02); ctx.fill(); // handle
  const side = { axis: 'y', a0: 0.66, a1: 1.12, b0: 0.8, b1: 0.97, path: c => {
    c.moveTo(0.8, 0.66); c.lineTo(0.97, 0.66); c.lineTo(0.97, 1.12); c.lineTo(0.8, 1.12); c.closePath();
  } };
  return bar ? { sides: [], high: null, bar: { y: 0.72, h: 0.3, hw: 0.9 } }
             : { sides: [side], high: chmsl(ctx, 0, 1.915, 0.36, 0.04) };
}

// ---------------------------------------------------------------- HUD

function drawHud(ctx, sim, pedal, source) {
  const { W, H } = VIEW;
  ctx.save();
  // brake pedal gauge
  const bx = 46, by = H - 215, bw = 22, bh = 150;
  ctx.fillStyle = 'rgba(8,10,14,0.62)'; ctx.beginPath(); ctx.roundRect(bx - 20, by - 36, 150, bh + 74, 12); ctx.fill();
  ctx.fillStyle = '#2b2f37'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5); ctx.fill();
  const hFill = bh * pedal;
  const gg = ctx.createLinearGradient(0, by + bh, 0, by); gg.addColorStop(0, '#f3a21c'); gg.addColorStop(1, '#ee3b2f');
  ctx.fillStyle = gg; ctx.beginPath(); ctx.roundRect(bx, by + bh - hFill, bw, hFill, 5); ctx.fill();
  ctx.fillStyle = '#e8eaee'; ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText('BRAKE', bx - 2, by - 14);
  ctx.font = '600 22px system-ui, sans-serif'; ctx.fillText(Math.round(pedal * 100) + '%', bx + 34, by + 28);
  ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = '#9aa1ad';
  ctx.fillText(source, bx - 2, by + bh + 22);

  // speed and gap
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(8,10,14,0.62)'; ctx.beginPath(); ctx.roundRect(W - 230, H - 125, 200, 95, 12); ctx.fill();
  ctx.fillStyle = '#f2f4f7'; ctx.font = '600 38px system-ui, sans-serif';
  ctx.fillText((sim.playerSpeed * 2.237).toFixed(0), W - 112, H - 72);
  ctx.font = '13px system-ui, sans-serif'; ctx.fillStyle = '#9aa1ad'; ctx.fillText('mph', W - 70, H - 72);
  ctx.font = '600 20px system-ui, sans-serif'; ctx.fillStyle = sim.gap < 8 ? '#ff5a4d' : '#f2f4f7';
  ctx.fillText(sim.gap.toFixed(0) + ' m', W - 112, H - 42);
  ctx.font = '13px system-ui, sans-serif'; ctx.fillStyle = '#9aa1ad'; ctx.fillText('gap', W - 70, H - 42);
  ctx.restore();
}
