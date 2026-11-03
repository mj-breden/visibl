// Brake input: everything is reduced to one number, pedal pressure 0..1.
// Swap this file's sources for a load-cell pedal later without touching the sim.

class BrakeInput {
  constructor() {
    this.held = false;       // keyboard Space/Down or mouse button
    this.level = 0;          // ramped value for held input
    this.source = 'keyboard / mouse';
    this.rampUp = 1.0;       // seconds to go 0 -> 1 while held
    this.rampDown = 0.25;    // seconds to go 1 -> 0 on release
    window.addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'ArrowDown') { this.held = true; e.preventDefault(); } });
    window.addEventListener('keyup',   e => { if (e.code === 'Space' || e.code === 'ArrowDown') this.held = false; });
    window.addEventListener('mousedown', () => { this.held = true; });
    window.addEventListener('mouseup',   () => { this.held = false; });
  }

  gamepadValue() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (p && p.buttons[7]) return p.buttons[7].value; // right trigger (standard mapping)
    }
    return 0;
  }

  read(dt) {
    const gp = this.gamepadValue();
    if (gp > 0.01) { this.source = 'gamepad trigger'; this.level = 0; return gp; }
    this.level = this.held
      ? Math.min(1, this.level + dt / this.rampUp)
      : Math.max(0, this.level - dt / this.rampDown);
    if (this.level > 0) this.source = 'keyboard / mouse (ramped)';
    return this.level;
  }
}
