// screens/graph.js — Screen 6
// Plain <canvas> plots drawn from the learner's own runs only. No charting
// library is used (per config.js comment in index.html/README — Chart.js
// from a CDN was the suggested alternative but hand-rolled canvas drawing
// keeps this file self-contained and easy to tweak live in a viva).
import { loadState, markGraphBViewed } from "../state.js";

export default function renderGraph(root) {
  const s = loadState();
  markGraphBViewed(); // §8: O3 requires "the Graph B line viewed"

  root.innerHTML = `
    <div class="screen">
      <h1>Your graphs</h1>
      <p class="lede">These are built only from <strong>your own</strong> launches. First run a few fair tests in the Lab if a graph looks empty.</p>

      <div class="card graph-card">
        <h2>Graph A — Range vs Angle</h2>
        <div class="field inline-fields">
          <div><label for="gaV">Speed v filter</label><select id="gaV"></select></div>
          <div><label for="gaH">Height h filter</label><select id="gaH"></select></div>
          <div><label for="gaG">Gravity g filter</label><select id="gaG"></select></div>
        </div>
        <canvas id="graphACanvas" width="700" height="260" role="img" aria-label="Graph of range versus launch angle for the selected filter"></canvas>
        <div id="graphAPairs"></div>
        <p id="graphAEmpty" class="box box--warning" hidden>Run at least 3 fair tests with only the angle changing to see this graph.</p>
      </div>

      <div class="card graph-card">
        <h2>Graph B — Range vs v²</h2>
        <div class="field inline-fields">
          <div><label for="gbTheta">Angle θ filter</label><select id="gbTheta"></select></div>
          <div><label for="gbH">Height h filter</label><select id="gbH"></select></div>
          <div><label for="gbG">Gravity g filter</label><select id="gbG"></select></div>
        </div>
        <canvas id="graphBCanvas" width="700" height="260" role="img" aria-label="Graph of range versus speed squared for the selected filter, with a best-fit line"></canvas>
        <p id="graphBSlope" class="box box--info" hidden></p>
        <p id="graphBEmpty" class="box box--warning" hidden>Run at least 3 fair tests with only the speed changing to see this graph.</p>
      </div>

      <div class="card graph-card">
        <h2>Graph C — Range vs Angle for 3 wind values</h2>
        <p class="lede">Compares runs at F = −2, 0, +2 N (same v, h, g) to show how wind shifts the peak.</p>
        <canvas id="graphCCanvas" width="700" height="260" role="img" aria-label="Graph of range versus angle for three wind values, showing the peak shift"></canvas>
        <p id="graphCEmpty" class="box box--warning" hidden>Run fair angle sweeps at F = −2, 0 and +2 N to see this graph.</p>
      </div>

      <div class="btn-row">
        <button class="btn btn--secondary" id="backBtn">Back to Lab</button>
        <button class="btn btn--primary" id="toChallengeBtn">Take the challenge</button>
      </div>
    </div>
  `;

  document.getElementById("backBtn").addEventListener("click", () => { location.hash = "#/lab"; });
  document.getElementById("toChallengeBtn").addEventListener("click", () => { location.hash = "#/challenge"; });

  setupGraphA(s.runs);
  setupGraphB(s.runs);
  drawGraphC(s.runs);
}

function uniqueSorted(arr) {
  return [...new Set(arr)].sort((a, b) => a - b);
}

// --- Graph A: Range vs Angle ------------------------------------------
function setupGraphA(runs) {
  const vSel = document.getElementById("gaV");
  const hSel = document.getElementById("gaH");
  const gSel = document.getElementById("gaG");
  const vs = uniqueSorted(runs.map((r) => r.v));
  const hs = uniqueSorted(runs.map((r) => r.h));
  const gs = uniqueSorted(runs.map((r) => r.g));
  vSel.innerHTML = vs.map((v) => `<option value="${v}">${v} m/s</option>`).join("") || "<option>—</option>";
  hSel.innerHTML = hs.map((h) => `<option value="${h}">${h} m</option>`).join("") || "<option>—</option>";
  gSel.innerHTML = gs.map((g) => `<option value="${g}">${g} m/s²</option>`).join("") || "<option>—</option>";

  function redraw() {
    const vf = parseFloat(vSel.value), hf = parseFloat(hSel.value), gf = parseFloat(gSel.value);
    const matching = runs.filter((r) => r.v === vf && r.h === hf && r.g === gf && r.F === 0);
    drawGraphA(matching);
  }
  [vSel, hSel, gSel].forEach((el) => el.addEventListener("change", redraw));
  if (vs.length && hs.length && gs.length) redraw();
  else document.getElementById("graphAEmpty").hidden = false;
}

function drawGraphA(runs) {
  const canvas = document.getElementById("graphACanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const emptyEl = document.getElementById("graphAEmpty");
  const pairsEl = document.getElementById("graphAPairs");
  const distinctAngles = new Set(runs.map((r) => r.theta));
  if (distinctAngles.size < 3) {
    emptyEl.hidden = false;
    pairsEl.innerHTML = "";
    return;
  }
  emptyEl.hidden = true;

  const points = [...runs].sort((a, b) => a.theta - b.theta);
  const pad = 40;
  const maxR = Math.max(...points.map((p) => p.R), 10);
  const toXY = (theta, R) => [pad + (theta / 90) * (canvas.width - pad * 2), canvas.height - pad - (R / maxR) * (canvas.height - pad * 2)];

  drawAxes(ctx, canvas, pad, "Angle (°)", "Range (m)", 0, 90, 0, maxR);

  ctx.beginPath();
  ctx.strokeStyle = "#1f5fae";
  ctx.lineWidth = 2;
  points.forEach((p, i) => {
    const [x, y] = toXY(p.theta, p.R);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  points.forEach((p) => {
    const [x, y] = toXY(p.theta, p.R);
    ctx.fillStyle = "#1f5fae";
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // Complementary-pair badges: thetaA + thetaB = 90, similar range.
  const pairs = [];
  points.forEach((a) => {
    points.forEach((b) => {
      if (a.theta < b.theta && Math.abs(a.theta + b.theta - 90) < 0.5 && Math.abs(a.R - b.R) < Math.max(0.5, maxR * 0.03)) {
        pairs.push(`${a.theta}° ≈ ${b.theta}°`);
      }
    });
  });
  pairsEl.innerHTML = [...new Set(pairs)].map((p) => `<span class="badge badge--star">${p}</span>`).join(" ");
}

// --- Graph B: Range vs v^2, with best-fit line -----------------------------
function setupGraphB(runs) {
  const thetaSel = document.getElementById("gbTheta");
  const hSel = document.getElementById("gbH");
  const gSel = document.getElementById("gbG");
  const thetas = uniqueSorted(runs.map((r) => r.theta));
  const hs = uniqueSorted(runs.map((r) => r.h));
  const gs = uniqueSorted(runs.map((r) => r.g));
  thetaSel.innerHTML = thetas.map((t) => `<option value="${t}">${t}°</option>`).join("") || "<option>—</option>";
  hSel.innerHTML = hs.map((h) => `<option value="${h}">${h} m</option>`).join("") || "<option>—</option>";
  gSel.innerHTML = gs.map((g) => `<option value="${g}">${g} m/s²</option>`).join("") || "<option>—</option>";

  function redraw() {
    const tf = parseFloat(thetaSel.value), hf = parseFloat(hSel.value), gf = parseFloat(gSel.value);
    const matching = runs.filter((r) => r.theta === tf && r.h === hf && r.g === gf && r.F === 0);
    drawGraphB(matching, gf);
  }
  [thetaSel, hSel, gSel].forEach((el) => el.addEventListener("change", redraw));
  if (thetas.length && hs.length && gs.length) redraw();
  else document.getElementById("graphBEmpty").hidden = false;
}

function drawGraphB(runs, g) {
  const canvas = document.getElementById("graphBCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const emptyEl = document.getElementById("graphBEmpty");
  const slopeEl = document.getElementById("graphBSlope");
  const distinctV = new Set(runs.map((r) => r.v));
  if (distinctV.size < 3) {
    emptyEl.hidden = false;
    slopeEl.hidden = true;
    return;
  }
  emptyEl.hidden = true;

  const pts = runs.map((r) => ({ x: r.v * r.v, y: r.R })).sort((a, b) => a.x - b.x);
  const pad = 40;
  const maxX = Math.max(...pts.map((p) => p.x)) * 1.1;
  const maxY = Math.max(...pts.map((p) => p.y)) * 1.15;
  const toXY = (x, y) => [pad + (x / maxX) * (canvas.width - pad * 2), canvas.height - pad - (y / maxY) * (canvas.height - pad * 2)];

  drawAxes(ctx, canvas, pad, "v² (m²/s²)", "Range (m)", 0, maxX, 0, maxY);

  // Best-fit line through the origin: slope = sum(xy)/sum(x^2) (R = slope * v^2).
  const sumXY = pts.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = pts.reduce((s, p) => s + p.x * p.x, 0);
  const slope = sumXX > 0 ? sumXY / sumXX : 0;

  ctx.beginPath();
  ctx.strokeStyle = "#b3461c";
  ctx.lineWidth = 2;
  const [x0, y0] = toXY(0, 0);
  const [x1, y1] = toXY(maxX, slope * maxX);
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();

  pts.forEach((p) => {
    const [x, y] = toXY(p.x, p.y);
    ctx.fillStyle = "#1f5fae";
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  const expectedSlope = g ? (Math.sin((2 * runs[0].theta * Math.PI) / 180) / g) : 0;
  slopeEl.hidden = false;
  slopeEl.innerHTML = `Best-fit slope ≈ <strong>${slope.toFixed(4)}</strong> m per (m/s)² (theory: sin2θ/g ≈ ${expectedSlope.toFixed(4)}). <strong>What does the slope tell you?</strong> It's a straight line through the origin — that's the signature of R ∝ v².`;
}

// --- Graph C: Range vs Angle for 3 wind values -----------------------------
function drawGraphC(runs) {
  const canvas = document.getElementById("graphCCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const emptyEl = document.getElementById("graphCEmpty");

  const windValues = [-2, 0, 2];
  const colors = { "-2": "#a21f2e", "0": "#1f5fae", "2": "#1d7a46" };
  const series = {};
  windValues.forEach((F) => {
    const pts = runs.filter((r) => r.F === F).sort((a, b) => a.theta - b.theta);
    if (pts.length >= 2) series[F] = pts;
  });
  if (Object.keys(series).length === 0) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  const allPts = Object.values(series).flat();
  const pad = 40;
  const maxR = Math.max(...allPts.map((p) => p.R), 10);
  const toXY = (theta, R) => [pad + (theta / 90) * (canvas.width - pad * 2), canvas.height - pad - (R / maxR) * (canvas.height - pad * 2)];

  drawAxes(ctx, canvas, pad, "Angle (°)", "Range (m)", 0, 90, 0, maxR);

  Object.entries(series).forEach(([F, pts]) => {
    ctx.beginPath();
    ctx.strokeStyle = colors[F];
    ctx.lineWidth = 2;
    pts.forEach((p, i) => {
      const [x, y] = toXY(p.theta, p.R);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    const last = pts[pts.length - 1];
    const [lx, ly] = toXY(last.theta, last.R);
    ctx.fillStyle = colors[F];
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(`F=${F}N`, lx + 6, ly);
  });
}

function drawAxes(ctx, canvas, pad, xLabel, yLabel, xMin, xMax, yMin, yMax) {
  ctx.strokeStyle = "#5b6878";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, pad / 2);
  ctx.lineTo(pad, canvas.height - pad);
  ctx.lineTo(canvas.width - pad / 2, canvas.height - pad);
  ctx.stroke();
  ctx.fillStyle = "#1b2530";
  ctx.font = "12px sans-serif";
  ctx.fillText(xLabel, canvas.width - pad - 60, canvas.height - 10);
  ctx.save();
  ctx.translate(12, canvas.height / 2 + 30);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
}
