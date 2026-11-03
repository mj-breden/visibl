// VISIBL simulation core: no DOM, so it can be tested headless in node.
// Units: metres, seconds, m/s, m/s^2.

const CONFIG = {
  cruise: 25,          // m/s (~56 mph) both cars hold this speed
  startGap: 32,        // m bumper-to-bumper at the start of each trial
  leadLowSpeed: 8,     // m/s the lead car brakes down to
  leadHold: 1.5,       // s the lead stays slow before recovering
  leadRecover: 2.5,    // m/s^2 lead acceleration back to cruise
  playerAccel: 2.5,    // m/s^2 when the brake is released
  playerMaxDecel: 9,   // m/s^2 at 100% pedal
  reactionThreshold: 0.05, // pedal fraction counted as "reacted"
  waitMin: 3, waitMax: 7,  // s of steady cruising before the lead brakes
  decelChoices: [2, 4, 6, 8], // m/s^2 lead braking severity, picked at random
  lockupDecel: 8,      // m/s^2 at or above this the lead is treated as "locked up" (full emergency stop)
  resetDelay: 1.0,     // s after the lead is back at cruise before the trial ends
};

const STYLES = {
  control:   'Control (on/off)',
  intensity: 'Variable brightness',
  size:      'Variable lit area',
  flash:     'Variable flash rate',
  bar:       'Centre-out light bar + lock-up strobe',
};

// What the lead car's lamps look like for a given style and braking severity.
// Returns { lit, brightness 0..1, segments 0..4, flashHz, barFrac 0..1, strobeHz }.
// barFrac is how far the light bar has grown from the centre (0 = no bar); strobeHz > 0
// means the white centre strobe is active. Only the 'bar' style uses those two.
function lampState(style, decel, braking) {
  const off = { lit: false, brightness: 0, segments: 0, flashHz: 0, barFrac: 0, strobeHz: 0 };
  if (!braking) return off;
  const sev = Math.min(1, decel / 8); // 0..1
  const on = { ...off, lit: true, brightness: 1, segments: 4 };
  switch (style) {
    case 'intensity': return { ...on, brightness: 0.3 + 0.7 * sev };
    case 'size':      return { ...on, segments: Math.max(1, Math.ceil(sev * 4)) };
    case 'flash':     return { ...on, flashHz: 1 + 7 * sev };
    case 'bar':       return { ...on, barFrac: Math.max(0.12, sev), strobeHz: decel >= CONFIG.lockupDecel ? 10 : 0 };
    default:          return on;
  }
}

class Sim {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.style = 'control';
    this.trials = [];
    this.collisions = 0;
    this.resetTrial();
  }

  resetTrial() {
    this.t = 0;
    this.phase = 'cruise';        // cruise -> braking -> hold -> recover -> done
    this.phaseT = 0;
    this.waitFor = CONFIG.waitMin + this.rng() * (CONFIG.waitMax - CONFIG.waitMin);
    this.leadSpeed = CONFIG.cruise;
    this.playerSpeed = CONFIG.cruise;
    this.gap = CONFIG.startGap;
    this.leadDecel = CONFIG.decelChoices[Math.floor(this.rng() * CONFIG.decelChoices.length)];
    this.onsetT = null;           // time lead brake lights came on
    this.reactionT = null;        // time pedal crossed threshold
    this.peakPedal = 0;
    this.minGap = this.gap;
    this.collided = false;
  }

  get leadBraking() { return this.phase === 'braking'; }

  lamps(timeNow) {
    const l = lampState(this.style, this.leadDecel, this.leadBraking);
    if (l.flashHz > 0) l.lit = Math.floor(timeNow * l.flashHz * 2) % 2 === 0;
    l.barStyle = this.style === 'bar'; // the bar housing is fitted (and visible when dark) only in this style
    l.strobeOn = l.strobeHz > 0 && Math.floor(timeNow * l.strobeHz * 2) % 2 === 0;
    return l;
  }

  // Advance by dt seconds with pedal in 0..1. Returns a finished-trial record or null.
  step(dt, pedal) {
    this.t += dt;
    this.phaseT += dt;

    // lead car state machine
    switch (this.phase) {
      case 'cruise':
        if (this.phaseT >= this.waitFor) { this.phase = 'braking'; this.phaseT = 0; this.onsetT = this.t; }
        break;
      case 'braking':
        this.leadSpeed = Math.max(CONFIG.leadLowSpeed, this.leadSpeed - this.leadDecel * dt);
        if (this.leadSpeed <= CONFIG.leadLowSpeed) { this.phase = 'hold'; this.phaseT = 0; }
        break;
      case 'hold':
        if (this.phaseT >= CONFIG.leadHold) { this.phase = 'recover'; this.phaseT = 0; }
        break;
      case 'recover':
        this.leadSpeed = Math.min(CONFIG.cruise, this.leadSpeed + CONFIG.leadRecover * dt);
        if (this.leadSpeed >= CONFIG.cruise) { this.phase = 'done'; this.phaseT = 0; }
        break;
      case 'done':
        if (this.phaseT >= CONFIG.resetDelay) return this.finish();
        break;
    }

    // player car
    if (this.onsetT !== null) this.peakPedal = Math.max(this.peakPedal, pedal);
    if (this.onsetT !== null && this.reactionT === null && pedal >= CONFIG.reactionThreshold) {
      this.reactionT = this.t - this.onsetT;
    }
    if (pedal > 0) this.playerSpeed = Math.max(0, this.playerSpeed - pedal * CONFIG.playerMaxDecel * dt);
    else this.playerSpeed = Math.min(CONFIG.cruise, this.playerSpeed + CONFIG.playerAccel * dt);

    this.gap += (this.leadSpeed - this.playerSpeed) * dt;
    this.minGap = Math.min(this.minGap, this.gap);
    if (this.gap <= 0) { this.collided = true; this.gap = 0; return this.finish(); }
    return null;
  }

  finish() {
    const rec = {
      trial: this.trials.length + 1,
      style: this.style,
      leadDecel: this.leadDecel,
      reactionS: this.reactionT,
      peakPedal: +this.peakPedal.toFixed(3),
      minGapM: +this.minGap.toFixed(2),
      collision: this.collided,
    };
    this.trials.push(rec);
    if (this.collided) this.collisions++;
    this.resetTrial();
    return rec;
  }
}

if (typeof module !== 'undefined') module.exports = { Sim, CONFIG, STYLES, lampState };
