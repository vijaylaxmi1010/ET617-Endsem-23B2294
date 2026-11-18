// screens/lab.js
// ---------------------------------------------------------------------------
// Screen 4 — the Lab (core). Sliders drive physics.simulate(); canvas draws
// the trajectory with ghost trails, velocity-component arrows, wind
// streamlines and lab tools (tape measure, stopwatch, protractor, peak
// marker). Also hosts the Screen 5 "unsuccessful experiment" support panel
// inline, and is reachable directly at #/support (opened by the fair-test /
// hypothesis-contradiction detectors).
// ---------------------------------------------------------------------------
import { DEFAULTS, RANGES, G_PRESETS, HINT_LADDERS, HINT_LADDER_TITLES } from "../config.js";
import { simulate, optimalAngleNoWind } from "../physics.js";
import {
  loadState, saveState, addRun, clearRuns,
  logHintRequest, hintLevelFor, flagMisconception, recomputeOutcomes,
  isOlympiadUnlocked, consumePendingLabPreset,
} from "../state.js";

// --- Local (non-persisted) UI state for this screen -------------------------
let lab = {
  theta: DEFAULTS.theta, v: DEFAULTS.v, m: DEFAULTS.m, h: DEFAULTS.h,
  gName: "Earth", g: DEFAULTS.g, F: DEFAULTS.F, windMode: DEFAULTS.windMode, k: DEFAULTS.k,
  showComponents: false,
  tapeMode: false, tapePoints: [],
  lastSim: null,
  supportPanel: null, // { type, runA, runB, level }
};

let animHandle = null;
let animState = null; // { sim, startTime, paused }

function heightUnlocked() {
  const s = loadState();
  return s.unlocks.height || s.profile.level === "Advanced";
}
function olympiadUnlocked() {
  return isOlympiadUnlocked();
}
function expertUnlocked() {
  const s = loadState();
  return s.unlocks.expert || (s.tasks.T7 && s.tasks.T7.status === "done");
}

function describeVarsChanged(prev, cur) {
  if (!prev) return [];
  const vars = [];
  if (prev.theta !== cur.theta) vars.push("angle");
  if (prev.v !== cur.v) vars.push("speed");
  if (prev.m !== cur.m) vars.push("mass");
  if (prev.h !== cur.h) vars.push("height");
  if (prev.g !== cur.g) vars.push("gravity");
  if (prev.F !== cur.F) vars.push("wind");
  return vars;
}

// --- Detectors (design challenge: fair test + hypothesis contradiction) ----
function detectUnfairTest(run, prevRun) {
  if (!prevRun) return null;
  if (run.varsChanged.length >= 2) return { type: "unfair", runA: prevRun, runB: run };
  return null;
}

function detectM1(run, allRuns) {
  if (run.h > 0 && run.theta === 45) {
    // Look for another run at the same v,h,g but a different angle that beat it.
    const better = allRuns.find(
      (r) => r.id !== run.id && r.v === run.v && r.h === run.h && r.g === run.g && r.F === run.F && r.R > run.R
    );
    if (better) return { type: "M1", runA: run, runB: better };
  }
  return null;
}

function detectMassRedHerring(run, allRuns) {
  const sameExceptMass = allRuns.find(
    (r) => r.id !== run.id && r.theta === run.theta && r.v === run.v && r.h === run.h && r.g === run.g && r.F === run.F && r.m !== run.m
  );
  if (sameExceptMass && Math.abs(sameExceptMass.R - run.R) < 0.05) {
    const s = loadState();
    const h1 = s.hypotheses[0];
    if (h1 && h1.variable === "mass" && (h1.direction === "increase" || h1.direction === "decrease")) {
      return { type: "MASS", runA: run, runB: sameExceptMass };
    }
  }
  return null;
}

function detectM3(run, allRuns) {
  if (run.F === 0) return null;
  const noWind = allRuns.find(
    (r) => r.id !== run.id && r.theta === run.theta && r.v === run.v && r.h === run.h && r.g === run.g && r.F === 0
  );
  if (noWind && Math.abs(noWind.T - run.T) < 0.02 && Math.abs(noWind.R - run.R) > 0.3) {
    return { type: "M3", runA: noWind, runB: run };
  }
  return null;
}

function detectM4(run, allRuns) {
  if (run.F === 0 || run.windMode !== "force") return null;
  const sameWindDiffMass = allRuns.find(
    (r) => r.id !== run.id && r.theta === run.theta && r.v === run.v && r.h === run.h && r.g === run.g && r.F === run.F && r.windMode === "force" && r.m !== run.m
  );
  if (sameWindDiffMass && Math.abs(sameWindDiffMass.R - run.R) > 0.3) {
    return { type: "M4", runA: run, runB: sameWindDiffMass };
  }
  return null;
}

function runDetectors(run, allRuns, prevRun) {
  return (
    detectUnfairTest(run, prevRun) ||
    detectM1(run, allRuns) ||
    detectM3(run, allRuns) ||
    detectM4(run, allRuns) ||
    detectMassRedHerring(run, allRuns) ||
    null
  );
}

// --- Canvas drawing ----------------------------------------------------
function autoScale(canvas, points, h) {
  const maxX = Math.max(10, ...points.map((p) => p.x));
  const maxY = Math.max(h + 5, ...points.map((p) => p.y));
  const padding = 40;
  const scaleX = (canvas.width - padding * 2) / (maxX * 1.15);
  const scaleY = (canvas.height - padding - 30) / (maxY * 1.25 + h);
  const scale = Math.min(scaleX, scaleY, 14);
  return { scale, padding, maxX, maxY };
}

function groundY(canvas) {
  return canvas.height - 40;
}

function drawScene(canvas, ctx, { points, h, theta, v, F, ghosts, showComponents, peakInfo, tapePoints }) {
  const w = canvas.width, hgt = canvas.height;
  ctx.clearRect(0, 0, w, hgt);

  const gY = groundY(canvas);
  // Sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, gY);
  skyGrad.addColorStop(0, "#bfe3ff");
  skyGrad.addColorStop(1, "#e8f6ff");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, gY);
  // Ground
  ctx.fillStyle = "#cfe9c4";
  ctx.fillRect(0, gY, w, hgt - gY);

  const { scale, padding } = autoScale(canvas, points, h);
  const originX = padding;
  const toPx = (x, y) => [originX + x * scale, gY - y * scale];

  // Scale markings every 5/10 m along the ground.
  ctx.strokeStyle = "#8aa092";
  ctx.fillStyle = "#4a5a4f";
  ctx.font = "11px sans-serif";
  ctx.lineWidth = 1;
  const step = scale > 7 ? 5 : 10;
  for (let d = 0; d * scale + originX < w - 5; d += step) {
    const [px] = toPx(d, 0);
    ctx.beginPath();
    ctx.moveTo(px, gY);
    ctx.lineTo(px, gY + 6);
    ctx.stroke();
    ctx.fillText(String(d), px - 6, gY + 18);
  }

  // Wind streamlines across the sky.
  if (F !== 0) {
    ctx.save();
    ctx.strokeStyle = "rgba(60, 110, 160, 0.55)";
    ctx.lineWidth = 2;
    const dir = F > 0 ? 1 : -1;
    for (let row = 0; row < 4; row++) {
      const y = 30 + row * 28;
      const len = 26 + Math.min(Math.abs(F), 5) * 8;
      for (let col = 0; col < 5; col++) {
        const x = 20 + col * (w / 5) + ((Date.now() / 18) % (w / 5)) * dir;
        const sx = ((x % w) + w) % w;
        ctx.beginPath();
        ctx.moveTo(sx, y);
        ctx.lineTo(sx + len * dir, y);
        ctx.stroke();
        // arrow head
        ctx.beginPath();
        ctx.moveTo(sx + len * dir, y);
        ctx.lineTo(sx + (len - 6) * dir, y - 4);
        ctx.moveTo(sx + len * dir, y);
        ctx.lineTo(sx + (len - 6) * dir, y + 4);
        ctx.stroke();
      }
    }
    ctx.restore();
    // Wind-sock label
    ctx.fillStyle = "#1f5fae";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(F > 0 ? `🎏 Tailwind +${F} N` : `🎏 Headwind ${F} N`, w - 170, 20);
  }

  // Launch platform / cliff.
  const [cliffX, cliffTopY] = toPx(0, h);
  ctx.fillStyle = "#9c8463";
  ctx.fillRect(cliffX - 14, cliffTopY, 14, gY - cliffTopY);
  ctx.fillStyle = "#6c7a89";
  ctx.fillRect(cliffX - 16, cliffTopY - 4, 18, 5);

  // Protractor overlay at the launch point.
  ctx.save();
  ctx.translate(cliffX, cliffTopY - 4);
  ctx.strokeStyle = "rgba(90, 90, 90, 0.55)";
  ctx.beginPath();
  ctx.arc(0, 0, 34, -Math.PI / 2, -Math.PI / 2 + (theta * Math.PI) / 180, false);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 183, 3, 0.25)";
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Ghost trails (previous runs), faint.
  ghosts.forEach((g, i) => {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(120,120,120,${0.15 + i * 0.05})`;
    ctx.lineWidth = 2;
    g.points.forEach((p, j) => {
      const [px, py] = toPx(p.x, p.y);
      if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.stroke();
  });

  // Current trajectory, dotted.
  ctx.beginPath();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = "#1f5fae";
  ctx.lineWidth = 2.4;
  points.forEach((p, i) => {
    const [px, py] = toPx(p.x, p.y);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  // Landing marker + range label.
  const land = points[points.length - 1];
  const [lx, ly] = toPx(land.x, 0);
  ctx.fillStyle = "#b3461c";
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.lineTo(lx - 7, ly - 14);
  ctx.lineTo(lx + 7, ly - 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#1b2530";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText(`R = ${land.x.toFixed(2)} m`, lx - 28, ly - 20);

  // Peak marker.
  if (peakInfo) {
    const [pxp, pyp] = toPx(peakInfo.x, peakInfo.y);
    ctx.fillStyle = "#7a1fae";
    ctx.beginPath();
    ctx.arc(pxp, pyp, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1b2530";
    ctx.font = "11px sans-serif";
    ctx.fillText(`H = ${peakInfo.y.toFixed(2)} m @ t=${peakInfo.t.toFixed(2)}s`, pxp - 40, pyp - 10);
  }

  // Current ball + component arrows, drawn at the animated position if given.
  const ballPoint = animState && animState.currentPoint ? animState.currentPoint : points[points.length - 1];
  const [bx, by] = toPx(ballPoint.x, ballPoint.y);
  ctx.fillStyle = "#1b2530";
  ctx.beginPath();
  ctx.arc(bx, by, 6, 0, Math.PI * 2);
  ctx.fill();

  if (showComponents) {
    const arrowScale = 3.2;
    // vx (blue, constant)
    ctx.strokeStyle = "#1f5fae";
    ctx.lineWidth = 2.5;
    drawArrow(ctx, bx, by, bx + ballPoint.vx * arrowScale, by, "#1f5fae");
    // vy (red, changing)
    drawArrow(ctx, bx, by, bx, by - ballPoint.vy * arrowScale, "#c0392b");
    // horizontal force arrow (purple) if wind present
    if (F !== 0) {
      const a = F; // direction indicator only
      drawArrow(ctx, bx, by + 14, bx + Math.sign(a) * 30, by + 14, "#7a1fae");
    }
  }

  // Measuring tape points.
  tapePoints.forEach((pt, i) => {
    const [tx, ty] = toPx(pt.x, 0);
    ctx.fillStyle = "#c0392b";
    ctx.beginPath();
    ctx.arc(tx, gY, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  if (tapePoints.length === 2) {
    const [x1] = toPx(tapePoints[0].x, 0);
    const [x2] = toPx(tapePoints[1].x, 0);
    ctx.strokeStyle = "#c0392b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, gY - 24);
    ctx.lineTo(x2, gY - 24);
    ctx.stroke();
    ctx.fillStyle = "#c0392b";
    ctx.font = "bold 12px sans-serif";
    const dist = Math.abs(tapePoints[1].x - tapePoints[0].x);
    ctx.fillText(`${dist.toFixed(2)} m`, (x1 + x2) / 2 - 20, gY - 30);
  }

  return { originX, scale, gY };
}

function drawArrow(ctx, x1, y1, x2, y2, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 8 * Math.cos(angle - 0.4), y2 - 8 * Math.sin(angle - 0.4));
  ctx.lineTo(x2 - 8 * Math.cos(angle + 0.4), y2 - 8 * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();
}

// --- Main render ------------------------------------------------------
export default function renderLab(root, opts) {
  // A Challenge task's "See it in the Lab" button leaves a one-shot preset
  // here — apply it (and any unlock it grants) before the lock checks below,
  // so e.g. a T5 handoff can actually show a launch height even if the
  // learner hasn't hit the target yet.
  const preset = consumePendingLabPreset();
  if (preset) {
    const s0 = loadState();
    if (preset.unlockHeight) s0.unlocks.height = true;
    if (preset.unlockOlympiad) s0.unlocks.olympiad = true;
    saveState();
    ["theta", "v", "m", "h", "g", "F", "windMode"].forEach((key) => {
      if (preset[key] !== undefined) lab[key] = preset[key];
    });
    if (preset.g !== undefined) {
      lab.gName = Object.keys(G_PRESETS).find((name) => G_PRESETS[name] === preset.g) || lab.gName;
    }
    if (preset.showComponents !== undefined) lab.showComponents = preset.showComponents;
  }

  const s = loadState();
  lab.hUnlocked = heightUnlocked();
  lab.olyUnlocked = olympiadUnlocked();
  lab.expUnlocked = expertUnlocked();
  if (!lab.hUnlocked) lab.h = 0;
  if (!lab.olyUnlocked) { lab.g = G_PRESETS.Earth; lab.gName = "Earth"; lab.F = 0; }
  if (!lab.expUnlocked) lab.k = 0;

  // Stored runs only keep summary numbers (R/H/T), not the full trajectory
  // (to keep localStorage small) — re-simulate each one here so ghost trails
  // still draw correctly after navigating away from the Lab and back.
  const ghosts = s.runs.slice(-3).map((r) => ({
    points: simulate({ theta: r.theta, v: r.v, m: r.m, h: r.h, g: r.g, F: r.F, windMode: r.windMode, k: r.k }).points,
  }));

  root.innerHTML = `
    <div class="screen">
      <h1>The Lab</h1>
      <p class="lede">Set your variables, launch, and read the data. <strong>First</strong> try one change at a time — the table will warn you if you don't.</p>

      ${preset ? `<div class="box box--info" role="status">📍 Loaded the setup from <strong>${preset.sourceTaskId}</strong>: θ=${preset.theta}°, v=${preset.v} m/s${preset.h !== undefined ? `, h=${preset.h} m` : ""}${preset.F !== undefined && preset.F !== 0 ? `, F=${preset.F} N` : ""}. Launch it and see for yourself.</div>` : ""}

      <div class="lab-grid">
        <div>
          <div class="card">
            ${sliderHTML("theta", "Launch angle θ", "°", lab.theta, RANGES.theta, true)}
            ${sliderHTML("v", "Launch speed v", "m/s", lab.v, RANGES.v, true)}
            ${sliderHTML("m", "Mass m", "kg", lab.m, RANGES.m, true)}
            ${sliderHTML("h", "Launch height h", "m", lab.h, RANGES.h, lab.hUnlocked, !lab.hUnlocked ? "🔒 Unlocks after Task 5, or for Advanced profile." : null)}

            <div class="field">
              <label for="gSelect">Gravity preset ${!lab.olyUnlocked ? "🔒" : ""}</label>
              <select id="gSelect" ${!lab.olyUnlocked ? "disabled" : ""}>
                ${Object.keys(G_PRESETS).map((name) => `<option value="${name}" ${name === lab.gName ? "selected" : ""}>${name} (g = ${G_PRESETS[name]} m/s²)</option>`).join("")}
              </select>
              ${!lab.olyUnlocked ? `<p class="slider-control__lock">🔒 Unlocks with the Olympiad extension (finish T1–T5, or Advanced profile).</p>` : ""}
            </div>

            ${sliderHTML("F", "Wind / horizontal force F", "N", lab.F, RANGES.F, lab.olyUnlocked, !lab.olyUnlocked ? "🔒 Unlocks with the Olympiad extension." : null)}
            <div class="toggle-row">
              <input type="checkbox" id="windModeToggle" ${lab.windMode === "acceleration" ? "checked" : ""} ${!lab.olyUnlocked ? "disabled" : ""} />
              <label for="windModeToggle" style="margin:0;">Wind as uniform acceleration (fixed, independent of mass)</label>
            </div>

            ${sliderHTML("k", "Air drag k (Expert mode)", "kg/s", lab.k, RANGES.k, lab.expUnlocked, !lab.expUnlocked ? "🔒 Unlocks after Task 7." : null)}

            <div class="toggle-row">
              <input type="checkbox" id="componentsToggle" ${lab.showComponents ? "checked" : ""} />
              <label for="componentsToggle" style="margin:0;">Show velocity-component arrows (vx blue, vy red)</label>
            </div>

            <div class="btn-row">
              <span class="spacer"></span>
              <button class="btn btn--primary" id="launchBtn" style="font-size:1.05rem;">🚀 Launch</button>
            </div>
          </div>

          <div class="card">
            <h3>Lab tools</h3>
            <div class="lab-tools">
              <button class="btn btn--ghost" id="tapeBtn" aria-pressed="${lab.tapeMode}">📏 Measuring tape</button>
              <button class="btn btn--ghost" id="stopwatchBtn">⏱ Stopwatch: <span id="stopwatchVal">0.00s</span></button>
              <button class="btn btn--ghost" id="clearGhostsBtn">Clear tape</button>
            </div>
            <p class="lede" style="font-size:0.82rem;">Tap/click two points on the canvas to measure horizontal distance. Protractor shown automatically at the launch point. Peak marker shows max height H and time to peak.</p>
          </div>
        </div>

        <div>
          <div class="lab-canvas-wrap">
            <canvas id="labCanvas" width="760" height="420" role="img" aria-label="Projectile trajectory animation showing the ball's path from launch to landing, with scale markings on the ground"></canvas>
          </div>
          <div id="peakCallout" class="box box--info" hidden></div>
          <div id="detectorPanel"></div>

          <h2>Data table</h2>
          <div class="lab-tools">
            <button class="btn btn--secondary" id="clearTableBtn">Clear table</button>
            <button class="btn btn--secondary" id="exportCsvBtn">Export CSV</button>
          </div>
          <div class="data-table-wrap">
            <table class="data-table" id="dataTable" aria-label="Launch data table">
              <thead>
                <tr>
                  <th>Run #</th><th>θ</th><th>v</th><th>m</th><th>h</th><th>g</th><th>F</th>
                  <th>Range (m)</th><th>Max H (m)</th><th>Flight T (s)</th><th>Changed</th><th>⭐</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="btn-row">
        <button class="btn btn--secondary" id="backBtn">Back</button>
        <span style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn btn--secondary" id="toGraphBtn">See my graph</button>
          <button class="btn btn--secondary" id="toChallengeBtn">Take the challenge</button>
          <button class="btn btn--primary" id="toHypothesisBtn">Revise hypothesis</button>
        </span>
      </div>
    </div>
  `;

  const canvas = document.getElementById("labCanvas");
  const ctx = canvas.getContext("2d");

  function currentParams() {
    return { theta: lab.theta, v: lab.v, m: lab.m, h: lab.h, g: lab.g, F: lab.F, windMode: lab.windMode, k: lab.k };
  }

  function redraw() {
    const sim = simulate(currentParams());
    lab.lastSim = sim;
    const peak = sim.points.reduce((best, p) => (p.y > best.y ? p : best), sim.points[0]);
    drawScene(canvas, ctx, {
      points: sim.points, h: lab.h, theta: lab.theta, v: lab.v, F: lab.olyUnlocked ? lab.F : 0,
      ghosts, showComponents: lab.showComponents,
      peakInfo: { x: peak.x, y: peak.y, t: peak.t },
      tapePoints: lab.tapePoints,
    });
  }
  redraw();

  // --- Sliders ------------------------------------------------------------
  ["theta", "v", "m", "h", "F", "k"].forEach((key) => {
    const rangeEl = document.getElementById(key + "Range");
    const minusEl = document.getElementById(key + "Minus");
    const plusEl = document.getElementById(key + "Plus");
    if (!rangeEl) return;
    rangeEl.addEventListener("input", () => {
      lab[key] = parseFloat(rangeEl.value);
      syncSliderDisplay(key);
      redraw();
    });
    if (minusEl) minusEl.addEventListener("click", () => stepSlider(key, -1, redraw));
    if (plusEl) plusEl.addEventListener("click", () => stepSlider(key, 1, redraw));
  });

  const gSelect = document.getElementById("gSelect");
  gSelect.addEventListener("change", () => {
    lab.gName = gSelect.value;
    lab.g = G_PRESETS[lab.gName];
    redraw();
  });

  document.getElementById("windModeToggle").addEventListener("change", (e) => {
    lab.windMode = e.target.checked ? "acceleration" : "force";
    redraw();
  });
  document.getElementById("componentsToggle").addEventListener("change", (e) => {
    lab.showComponents = e.target.checked;
    redraw();
  });

  // --- Measuring tape ------------------------------------------------------
  const tapeBtn = document.getElementById("tapeBtn");
  tapeBtn.addEventListener("click", () => {
    lab.tapeMode = !lab.tapeMode;
    tapeBtn.setAttribute("aria-pressed", String(lab.tapeMode));
    tapeBtn.classList.toggle("btn--primary", lab.tapeMode);
  });
  document.getElementById("clearGhostsBtn").addEventListener("click", () => {
    lab.tapePoints = [];
    redraw();
  });
  canvas.addEventListener("click", (e) => {
    if (!lab.tapeMode || !lab.lastSim) return;
    const rect = canvas.getBoundingClientRect();
    const scaleXCanvas = canvas.width / rect.width;
    const px = (e.clientX - rect.left) * scaleXCanvas;
    const { scale } = autoScale(canvas, lab.lastSim.points, lab.h);
    const padding = 40;
    const worldX = (px - padding) / scale;
    if (lab.tapePoints.length >= 2) lab.tapePoints = [];
    lab.tapePoints.push({ x: Math.max(0, worldX) });
    redraw();
  });

  // --- Stopwatch (manual + auto on launch) ---------------------------------
  let stopwatchStart = null;
  let stopwatchInterval = null;
  const stopwatchVal = document.getElementById("stopwatchVal");
  document.getElementById("stopwatchBtn").addEventListener("click", () => {
    if (stopwatchInterval) {
      clearInterval(stopwatchInterval);
      stopwatchInterval = null;
    } else {
      stopwatchStart = Date.now();
      stopwatchInterval = setInterval(() => {
        stopwatchVal.textContent = ((Date.now() - stopwatchStart) / 1000).toFixed(2) + "s";
      }, 50);
    }
  });

  // --- Launch + animation --------------------------------------------------
  document.getElementById("launchBtn").addEventListener("click", () => doLaunch());

  function doLaunch() {
    const sim = simulate(currentParams());
    const state = loadState();
    const prevRun = state.runs[state.runs.length - 1] || null;
    const varsChanged = describeVarsChanged(prevRun, { theta: lab.theta, v: lab.v, m: lab.m, h: lab.h, g: lab.g, F: lab.olyUnlocked ? lab.F : 0 });
    const run = {
      id: "run_" + Date.now(),
      timestamp: Date.now(),
      theta: lab.theta, v: lab.v, m: lab.m, h: lab.h, g: lab.g,
      F: lab.olyUnlocked ? lab.F : 0, windMode: lab.windMode, k: lab.expUnlocked ? lab.k : 0,
      R: sim.R, H: sim.H, T: sim.T, tPeak: sim.tPeak,
      varsChanged, fair: !prevRun || varsChanged.length <= 1, starred: false,
    };
    addRun(run);
    ghosts.push({ points: sim.points });
    if (ghosts.length > 3) ghosts.shift();

    // Auto stopwatch readout.
    if (stopwatchInterval) { clearInterval(stopwatchInterval); stopwatchInterval = null; }
    stopwatchVal.textContent = sim.T.toFixed(2) + "s";

    animateRun(sim, () => {
      renderTable();
      const allRuns = loadState().runs;
      const detection = runDetectors(run, allRuns, prevRun);
      renderDetectorPanel(detection);
      recomputeOutcomes();
    });
  }

  function animateRun(sim, onDone) {
    if (animHandle) cancelAnimationFrame(animHandle);
    const duration = Math.min(Math.max(sim.T * 600, 900), 3200); // ms, scaled for visibility
    const start = performance.now();
    const peak = sim.points.reduce((best, p) => (p.y > best.y ? p : best), sim.points[0]);
    let pausedAtPeak = false;
    let pauseStart = 0;
    const peakCallout = document.getElementById("peakCallout");

    function frame(now) {
      let elapsed = now - start;
      if (pausedAtPeak) {
        if (now - pauseStart < 1000) {
          animHandle = requestAnimationFrame(frame);
          return;
        } else {
          pausedAtPeak = false;
          peakCallout.hidden = true;
        }
      }
      const progress = Math.min(elapsed / duration, 1);
      const simT = progress * sim.T;
      const pt = interpolatePoint(sim.points, simT);
      animState = { currentPoint: pt };
      drawScene(canvas, ctx, {
        points: sim.points, h: lab.h, theta: lab.theta, v: lab.v, F: lab.olyUnlocked ? lab.F : 0,
        ghosts, showComponents: lab.showComponents,
        peakInfo: { x: peak.x, y: peak.y, t: peak.t },
        tapePoints: lab.tapePoints,
      });

      if (lab.showComponents && !pausedAtPeak && Math.abs(simT - peak.t) < 0.03 && peak.t > 0.05) {
        pausedAtPeak = true;
        pauseStart = now;
        peakCallout.hidden = false;
        peakCallout.innerHTML = `<strong>Top of the path:</strong> vy = 0, vx = ${peak.vx.toFixed(2)} m/s`;
      }

      if (progress < 1) {
        animHandle = requestAnimationFrame(frame);
      } else {
        animState = null;
        redraw();
        if (onDone) onDone();
      }
    }
    animHandle = requestAnimationFrame(frame);
  }

  function interpolatePoint(points, t) {
    for (let i = 1; i < points.length; i++) {
      if (points[i].t >= t) {
        const p0 = points[i - 1], p1 = points[i];
        const frac = p1.t === p0.t ? 0 : (t - p0.t) / (p1.t - p0.t);
        return {
          x: p0.x + frac * (p1.x - p0.x),
          y: Math.max(0, p0.y + frac * (p1.y - p0.y)),
          vx: p0.vx + frac * (p1.vx - p0.vx),
          vy: p0.vy + frac * (p1.vy - p0.vy),
          t,
        };
      }
    }
    return points[points.length - 1];
  }

  // --- Data table -----------------------------------------------------
  function renderTable() {
    const allRuns = loadState().runs;
    const tbody = document.querySelector("#dataTable tbody");
    tbody.innerHTML = allRuns
      .map((r, i) => {
        const unfair = r.varsChanged && r.varsChanged.length >= 2;
        return `<tr class="${unfair ? "is-unfair" : ""} ${r.starred ? "is-starred" : ""}">
          <td>${i + 1}</td><td>${r.theta}</td><td>${r.v}</td><td>${r.m}</td><td>${r.h}</td>
          <td>${r.g}</td><td>${r.F}</td>
          <td>${r.R.toFixed(2)}</td><td>${r.H.toFixed(2)}</td><td>${r.T.toFixed(2)}</td>
          <td>${unfair ? "⚠ " : ""}${(r.varsChanged || []).join(", ") || "—"}</td>
          <td><button class="btn btn--ghost star-btn" data-id="${r.id}" aria-label="Mark run ${i + 1} as evidence" style="min-height:32px; padding:4px 8px;">${r.starred ? "⭐" : "☆"}</button></td>
        </tr>`;
      })
      .join("");
    tbody.querySelectorAll(".star-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const st = loadState();
        const run = st.runs.find((r) => r.id === btn.dataset.id);
        if (run) { run.starred = !run.starred; saveState(); renderTable(); }
      });
    });
  }
  renderTable();

  document.getElementById("clearTableBtn").addEventListener("click", () => {
    if (confirm("Clear all runs from the table? Ghost trails will also reset.")) {
      clearRuns();
      ghosts.length = 0;
      renderTable();
      redraw();
    }
  });
  document.getElementById("exportCsvBtn").addEventListener("click", () => {
    exportCsv(loadState().runs);
  });

  // --- Detector panel (Screen 5 inline support) ---------------------------
  function renderDetectorPanel(detection) {
    const panelEl = document.getElementById("detectorPanel");
    if (!detection) { panelEl.innerHTML = ""; return; }
    logHintRequestOnOpen(detection.type);
    panelEl.innerHTML = buildSupportPanelHTML(detection);
    wireSupportPanel(panelEl, detection, redraw);
  }

  function logHintRequestOnOpen() {
    // Opening the panel itself isn't a hint request — only clicking
    // "I need another hint" is logged (see wireSupportPanel).
  }

  // If we arrived directly at #/support (from hypothesis/graph), show the
  // most recent detection again for continuity.
  if (opts && opts.hash === "#/support") {
    const allRuns = loadState().runs;
    const last = allRuns[allRuns.length - 1];
    const prev = allRuns[allRuns.length - 2];
    if (last) {
      const detection = runDetectors(last, allRuns, prev);
      if (detection) renderDetectorPanel(detection);
    }
  }

  // --- Navigation -----------------------------------------------------
  document.getElementById("backBtn").addEventListener("click", () => { location.hash = "#/hypothesis"; });
  document.getElementById("toGraphBtn").addEventListener("click", () => { location.hash = "#/graph"; });
  document.getElementById("toChallengeBtn").addEventListener("click", () => { location.hash = "#/challenge"; });
  document.getElementById("toHypothesisBtn").addEventListener("click", () => { location.hash = "#/reflect"; });

  // Cleanup function returned to the router.
  return function cleanup() {
    if (animHandle) cancelAnimationFrame(animHandle);
    if (stopwatchInterval) clearInterval(stopwatchInterval);
  };
}

function sliderHTML(key, label, unit, value, range, unlocked, lockNote) {
  return `
    <div class="slider-control">
      <div class="slider-control__head">
        <label for="${key}Range">${label}${!unlocked ? " 🔒" : ""}</label>
        <span class="slider-control__value" id="${key}Val">${value}${unit}</span>
      </div>
      <div class="slider-control__row">
        <button class="step-btn" id="${key}Minus" aria-label="Decrease ${label}" ${!unlocked ? "disabled" : ""}>−</button>
        <input type="range" id="${key}Range" min="${range.min}" max="${range.max}" step="${range.step}" value="${value}"
          ${!unlocked ? "disabled" : ""} aria-label="${label}, range ${range.min} to ${range.max} ${unit}" />
        <button class="step-btn" id="${key}Plus" aria-label="Increase ${label}" ${!unlocked ? "disabled" : ""}>+</button>
      </div>
      ${lockNote ? `<p class="slider-control__lock">${lockNote}</p>` : ""}
    </div>
  `;
}

function syncSliderDisplay(key) {
  const unitMap = { theta: "°", v: "m/s", m: "kg", h: "m", F: "N", k: "kg/s" };
  const el = document.getElementById(key + "Val");
  if (el) el.textContent = lab[key] + unitMap[key];
  const rangeEl = document.getElementById(key + "Range");
  if (rangeEl) rangeEl.value = lab[key];
}

function stepSlider(key, dir, redraw) {
  const rangeMap = { theta: RANGES.theta, v: RANGES.v, m: RANGES.m, h: RANGES.h, F: RANGES.F, k: RANGES.k };
  const r = rangeMap[key];
  let next = lab[key] + dir * r.step;
  next = Math.min(r.max, Math.max(r.min, Math.round(next / r.step) * r.step));
  lab[key] = Math.round(next * 100) / 100;
  syncSliderDisplay(key);
  redraw();
}

function exportCsv(runs) {
  const header = "Run,Theta,V,Mass,Height,g,F,Range,MaxHeight,FlightTime,VariablesChanged,Starred\n";
  const rows = runs
    .map((r, i) => [i + 1, r.theta, r.v, r.m, r.h, r.g, r.F, r.R, r.H, r.T, (r.varsChanged || []).join("|"), r.starred].join(","))
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "rangelab_runs.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// --- Support panel HTML / wiring (Screen 5) --------------------------------
function buildSupportPanelHTML(detection) {
  const ladder = HINT_LADDERS[detection.type];
  const title = HINT_LADDER_TITLES[detection.type];
  const level = hintLevelFor(detection.type);
  return `
    <div class="card box--warning" style="background:#fff8ec;">
      <h3>⚠ Let's look at this together: ${title}</h3>
      <div class="inline-fields">
        <div class="box box--info">
          <strong>Run A</strong>
          <p>θ=${detection.runA.theta}°, v=${detection.runA.v} m/s, m=${detection.runA.m} kg, h=${detection.runA.h} m, F=${detection.runA.F} N</p>
          <p>Range = <strong>${detection.runA.R.toFixed(2)} m</strong>, Flight time = ${detection.runA.T.toFixed(2)} s</p>
        </div>
        <div class="box box--info">
          <strong>Run B</strong>
          <p>θ=${detection.runB.theta}°, v=${detection.runB.v} m/s, m=${detection.runB.m} kg, h=${detection.runB.h} m, F=${detection.runB.F} N</p>
          <p>Range = <strong>${detection.runB.R.toFixed(2)} m</strong>, Flight time = ${detection.runB.T.toFixed(2)} s</p>
        </div>
      </div>
      <div id="hintLadderList">
        ${Array.from({ length: level }, (_, i) => `
          <div class="hint-ladder__item">
            <div class="hint-ladder__level">Hint ${i + 1}</div>
            <p>${ladder[i]}</p>
          </div>`).join("")}
      </div>
      <div class="btn-row">
        <button class="btn btn--secondary" id="nextHintBtn" ${level >= ladder.length ? "disabled" : ""}>I need another hint</button>
        <button class="btn btn--primary" id="runFairTestBtn">Run a fair test now</button>
      </div>
    </div>
  `;
}

function wireSupportPanel(panelEl, detection, redraw) {
  const nextBtn = panelEl.querySelector("#nextHintBtn");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const level = hintLevelFor(detection.type) + 1;
      logHintRequest(detection.type, level);
      panelEl.innerHTML = buildSupportPanelHTML(detection);
      wireSupportPanel(panelEl, detection, redraw);
    });
  }
  const fairBtn = panelEl.querySelector("#runFairTestBtn");
  if (fairBtn) {
    fairBtn.addEventListener("click", () => {
      // Suggest locking everything but angle (the most common fair-test fix).
      ["v", "m", "h", "F", "k"].forEach((k) => {
        const el = document.getElementById(k + "Range");
        if (el) el.setAttribute("style", "box-shadow:0 0 0 3px #ffb703;");
      });
      panelEl.innerHTML = `<div class="box box--success">Good plan — lock every slider except <strong>angle</strong> (highlighted) and launch a few runs to compare.</div>`;
    });
  }
}
