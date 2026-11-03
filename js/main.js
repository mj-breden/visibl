// Wires input, sim and rendering together and handles the stats panel.

const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const input = new BrakeInput();
const sim = new Sim();
let running = false, last = performance.now();

// style picker
const styleSel = document.getElementById('style');
for (const [k, label] of Object.entries(STYLES)) styleSel.add(new Option(label, k));
styleSel.addEventListener('change', () => { sim.style = styleSel.value; sim.resetTrial(); styleSel.blur(); });

document.getElementById('start').addEventListener('click', e => {
  running = true; document.getElementById('overlay').hidden = true; e.stopPropagation();
});
document.getElementById('csv').addEventListener('click', downloadCsv);

function mean(a) { return a.reduce((s, v) => s + v, 0) / a.length; }

function updateStats() {
  const byStyle = {};
  for (const r of sim.trials) (byStyle[r.style] ||= []).push(r);
  const tb = document.querySelector('#stats tbody');
  tb.innerHTML = '';
  for (const k of Object.keys(STYLES)) {
    const rs = byStyle[k] || [];
    const rts = rs.filter(r => r.reactionS !== null).map(r => r.reactionS);
    const tr = tb.insertRow();
    [STYLES[k], rs.length, rts.length ? mean(rts).toFixed(3) + ' s' : '-', rs.filter(r => r.collision).length]
      .forEach(v => tr.insertCell().textContent = v);
  }
}

function downloadCsv() {
  const head = ['trial', 'style', 'leadDecel', 'reactionS', 'peakPedal', 'minGapM', 'collision'];
  const lines = [head.join(',')].concat(sim.trials.map(r => head.map(k => r[k] ?? '').join(',')));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  a.download = 'visibl_trials.csv'; a.click();
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.style.opacity = 1;
  clearTimeout(toast.t); toast.t = setTimeout(() => el.style.opacity = 0, 2500);
}

function frame(nowMs) {
  const dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs;
  const pedal = input.read(dt);
  if (running) {
    sim.odo = (sim.odo || 0) + sim.playerSpeed * dt;
    const rec = sim.step(dt, pedal);
    if (rec) {
      toast(rec.collision ? 'COLLISION' :
        rec.reactionS === null ? 'No reaction' : `Reaction ${rec.reactionS.toFixed(3)} s, peak brake ${Math.round(rec.peakPedal * 100)}%`);
      updateStats();
    }
  }
  drawScene(ctx, canvas.width, canvas.height, sim, nowMs / 1000);
  drawHud(ctx, canvas.width, canvas.height, sim, pedal, input.source);
  requestAnimationFrame(frame);
}
updateStats();
requestAnimationFrame(frame);
