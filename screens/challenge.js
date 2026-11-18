// screens/challenge.js — Screen 7: Tasks & Challenge
import { TASKS, FEEDBACK, ADAPTIVITY, HINT_LADDERS, HINT_LADDER_TITLES, PREREQ_CARD } from "../config.js";
import { simulate } from "../physics.js";
import {
  loadState, saveState, getTask, setTask, addRun, flagMisconception,
  logHintRequest, hintLevelFor, recomputeOutcomes, isOlympiadUnlocked,
  recordAnswerCorrectness,
} from "../state.js";
import { evaluateExplanation, displayFeedbackFor } from "../ai.js";

let selectedTaskId = null;
let nudgeTimer = null;
let taskOpenedAt = null;
let currentRoot = null;
let t5Attempts = []; // {theta, R, hit} — grows across launches so the T5 curve chart builds up

// --- Mini simulation-check charts ------------------------------------------
// Shown automatically whenever an answer comes back wrong: instead of just
// stating a hint, re-run the actual physics for the options involved and
// draw the comparison, so the learner sees the discrepancy in her own
// simulated data rather than being told what the "right" value is.
function renderBarChart(container, bars, caption) {
  if (!container) return;
  const maxVal = Math.max(...bars.map((b) => b.value), 0.0001) * 1.15;
  const canvas = document.createElement("canvas");
  canvas.width = 360;
  canvas.height = 190;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", caption || "Bar chart comparing simulated values for each option");
  canvas.style.maxWidth = "100%";
  container.innerHTML = "";
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const pad = 34;
  const gap = 18;
  const barW = (canvas.width - pad * 2 - gap * (bars.length - 1)) / bars.length;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#5b6878";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, 8);
  ctx.lineTo(pad, canvas.height - pad);
  ctx.lineTo(canvas.width - 6, canvas.height - pad);
  ctx.stroke();
  bars.forEach((b, i) => {
    const x = pad + i * (barW + gap);
    const h = Math.max(2, (b.value / maxVal) * (canvas.height - pad - 16));
    const y = canvas.height - pad - h;
    ctx.fillStyle = b.highlight ? "#c0392b" : "#1f5fae";
    ctx.fillRect(x, y, barW, h);
    ctx.fillStyle = "#1b2530";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(b.label, x + barW / 2, canvas.height - pad + 16);
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(b.value.toFixed(2), x + barW / 2, y - 6);
  });
  if (caption) {
    const cap = document.createElement("p");
    cap.className = "lede";
    cap.style.cssText = "font-size:0.85rem; margin-top:8px;";
    cap.textContent = caption;
    container.appendChild(cap);
  }
}

function renderAngleCurveChart(container, { v, h, g, flag, tolerance, attempts, caption }) {
  if (!container) return;
  const pts = [];
  for (let a = 0; a <= 90; a += 3) {
    const sim = simulate({ theta: a, v, m: 1, h, g, F: 0 });
    pts.push({ theta: a, R: sim.R });
  }
  const canvas = document.createElement("canvas");
  canvas.width = 420;
  canvas.height = 220;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Range versus angle from the simulation, with your attempts marked and the flag zone shaded");
  canvas.style.maxWidth = "100%";
  container.innerHTML = "";
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const pad = 36;
  const maxR = Math.max(...pts.map((p) => p.R), flag + tolerance) * 1.1;
  const toXY = (theta, R) => [
    pad + (theta / 90) * (canvas.width - pad - 10),
    canvas.height - pad - (R / maxR) * (canvas.height - pad - 16),
  ];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const [, yTop] = toXY(0, flag + tolerance);
  const [, yBot] = toXY(0, flag - tolerance);
  ctx.fillStyle = "rgba(47,125,82,0.18)";
  ctx.fillRect(pad, yTop, canvas.width - pad - 10, yBot - yTop);
  ctx.fillStyle = "#2f7d52";
  ctx.font = "11px sans-serif";
  ctx.fillText(`flag zone (${flag}±${tolerance} m)`, pad + 6, yTop - 4);
  ctx.strokeStyle = "#5b6878";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, 8);
  ctx.lineTo(pad, canvas.height - pad);
  ctx.lineTo(canvas.width - 6, canvas.height - pad);
  ctx.stroke();
  ctx.beginPath();
  ctx.strokeStyle = "#1f5fae";
  ctx.lineWidth = 2;
  pts.forEach((p, i) => {
    const [x, y] = toXY(p.theta, p.R);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  attempts.forEach((att) => {
    const [x, y] = toXY(att.theta, att.R);
    ctx.fillStyle = att.hit ? "#2f7d52" : "#c0392b";
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
  ctx.fillStyle = "#1b2530";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("Angle (°) →", canvas.width - 8, canvas.height - 8);
  if (caption) {
    const cap = document.createElement("p");
    cap.className = "lede";
    cap.style.cssText = "font-size:0.85rem; margin-top:8px;";
    cap.textContent = caption;
    container.appendChild(cap);
  }
}

function isLocked(task) {
  if (!task.locked) return false;
  if (["T6", "T7"].includes(task.id)) return !isOlympiadUnlocked();
  if (task.unlockAfter) {
    const s = loadState();
    return !task.unlockAfter.every((id) => getTask(id).status === "done");
  }
  return true;
}

function statusOf(task) {
  if (isLocked(task)) return "locked";
  const t = getTask(task.id);
  return t.status === "done" ? "done" : "open";
}

export default function renderChallenge(root) {
  currentRoot = root;
  // Always land on the mission list first — a single task view is a
  // separate "page" within this screen, entered only by explicitly opening
  // a mission (see openTask / paintDetail below).
  selectedTaskId = null;
  paintList(root);
  nudgeTimer = setInterval(() => checkNudge(), 10000);
  return function cleanup() {
    if (nudgeTimer) clearInterval(nudgeTimer);
  };
}

function checkNudge() {
  if (!selectedTaskId || !taskOpenedAt) return;
  const elapsed = (Date.now() - taskOpenedAt) / 1000;
  const box = document.getElementById("nudgeBox");
  if (box && elapsed > ADAPTIVITY.nudgeAfterSeconds) {
    box.hidden = false;
  }
}

// --- "Page" 1: the mission list ---------------------------------------
function paintList(root) {
  root.innerHTML = `
    <div class="screen">
      <h1>Tasks &amp; Challenge</h1>
      <p class="lede">Nine missions, five formats. <strong>Can you beat them all?</strong> Some only unlock once you've proven yourself on the earlier ones.</p>

      <div id="missionList"></div>

      <div class="btn-row">
        <button class="btn btn--secondary" id="backBtn">Back</button>
        <button class="btn btn--primary" id="toReflectBtn">Reflect &amp; revise</button>
      </div>
    </div>
  `;
  renderMissionList();
  document.getElementById("backBtn").addEventListener("click", () => { location.hash = "#/graph"; });
  document.getElementById("toReflectBtn").addEventListener("click", () => { location.hash = "#/reflect"; });
}

function renderMissionList() {
  const listEl = document.getElementById("missionList");
  if (!listEl) return; // not on the list "page" right now — nothing to refresh
  listEl.innerHTML = TASKS.map((task) => {
    const status = statusOf(task);
    const label = status === "done" ? "Done ✓" : status === "locked" ? "Locked 🔒" : "Open";
    return `
      <div class="card task-card">
        <div class="task-card__head">
          <strong>${task.id} · ${task.format}</strong>
          <span class="task-status task-status--${status}">${label}</span>
        </div>
        <p>${task.prompt}</p>
        <button class="btn ${status === "locked" ? "btn--ghost" : "btn--secondary"}" data-task="${task.id}" ${status === "locked" ? "disabled" : ""}>
          ${status === "done" ? "Review" : "Open mission"}
        </button>
      </div>
    `;
  }).join("");
  listEl.querySelectorAll("button[data-task]").forEach((btn) => {
    btn.addEventListener("click", () => openTask(btn.dataset.task));
  });
}

// --- "Page" 2: a single task, full-screen (replaces the list entirely) ---
function openTask(taskId) {
  selectedTaskId = taskId;
  taskOpenedAt = Date.now();
  if (taskId === "T5") t5Attempts = [];
  paintDetail(TASKS.find((t) => t.id === taskId));
  window.scrollTo(0, 0);
}

function paintDetail(task) {
  const root = currentRoot;
  root.innerHTML = `
    <div class="screen">
      <div class="btn-row" style="margin-top:0;">
        <button class="btn btn--secondary" id="backToListBtn">← Back to missions</button>
        <span class="spacer"></span>
      </div>

      <h1>${task.id}: ${task.format}</h1>
      <p>${task.prompt}</p>
      <div id="nudgeBox" class="box box--warning" hidden>
        ⏳ You've been on this one a while. Want a nudge? Try re-reading the component-breakdown box on the Hypothesis screen, or check your data table for a pattern.
      </div>
      <div id="prereqCardSlot"></div>
      <div id="taskBody"></div>
      <div id="taskFeedback"></div>

      <div class="btn-row">
        <button class="btn btn--secondary" id="backToListBtn2">← Back to missions</button>
        <span class="spacer"></span>
      </div>
    </div>
  `;
  document.getElementById("backToListBtn").addEventListener("click", backToList);
  document.getElementById("backToListBtn2").addEventListener("click", backToList);

  renderTaskBody(task);
  maybeShowPrereqCard();
}

function backToList() {
  selectedTaskId = null;
  paintList(currentRoot);
}

function maybeShowPrereqCard() {
  const s = loadState();
  const slot = document.getElementById("prereqCardSlot");
  const l3Reached = s.hints.log.some((h) => h.level >= 3);
  const standardAndT1Wrong = s.profile.level === "Standard" && getTask("T1").attempts > 0 && !getTask("T1").correct;
  const twoWrong = (s.consecutiveIncorrect || 0) >= ADAPTIVITY.consecutiveIncorrectForPrereq;
  if (l3Reached || standardAndT1Wrong || twoWrong) {
    slot.innerHTML = `
      <div class="box box--info">
        <strong>${PREREQ_CARD.title}</strong>
        <p>${PREREQ_CARD.body}</p>
        <div class="kv-grid">
          <div class="kv-tile"><div class="kv-tile__num">v·cosθ</div><div class="kv-tile__label">horizontal, vₓ</div></div>
          <div class="kv-tile"><div class="kv-tile__num">v·sinθ</div><div class="kv-tile__label">vertical, v_y</div></div>
        </div>
      </div>
    `;
  } else {
    slot.innerHTML = "";
  }
}

function showFeedback(html, boxClass = "box--info") {
  document.getElementById("taskFeedback").innerHTML = `<div class="box ${boxClass}">${html}</div>`;
}

function applyAdaptivity(taskId, correct, confidence, hintsUsed) {
  recordAnswerCorrectness(correct);
  if (correct && confidence >= ADAPTIVITY.advancedConfidenceThreshold && hintsUsed <= ADAPTIVITY.hardTaskMaxHints) {
    const s = loadState();
    s.unlocks.olympiad = true; // "harder task: skip ahead, unlock height/Moon variants"
    s.unlocks.height = true;
    saveState();
  }
  recomputeOutcomes();
}

function renderHintLadderInline(type, container) {
  const level = hintLevelFor(type);
  const ladder = HINT_LADDERS[type];
  container.innerHTML = `
    <div class="box box--warning">
      <strong>${HINT_LADDER_TITLES[type]}</strong>
      ${Array.from({ length: level }, (_, i) => `<div class="hint-ladder__item"><div class="hint-ladder__level">Hint ${i + 1}</div><p>${ladder[i]}</p></div>`).join("")}
      <div class="btn-row">
        <button class="btn btn--secondary" id="inlineHintBtn" ${level >= ladder.length ? "disabled" : ""}>I need another hint</button>
      </div>
    </div>
  `;
  const btn = container.querySelector("#inlineHintBtn");
  if (btn) {
    btn.addEventListener("click", () => {
      logHintRequest(type, hintLevelFor(type) + 1);
      renderHintLadderInline(type, container);
    });
  }
}

// ---------------------------------------------------------------------------
function renderTaskBody(task) {
  const body = document.getElementById("taskBody");
  switch (task.id) {
    case "T1": return renderT1(body, task);
    case "T2": return renderT2(body, task);
    case "T3": return renderT3(body, task);
    case "T4": return renderT4(body, task);
    case "T5": return renderT5(body, task);
    case "T6": return renderT6(body, task);
    case "T7": return renderT7(body, task);
    case "T8": return renderT8(body, task);
    case "T9": return renderT9(body, task);
  }
}

// --- T1: Prediction MCQ + confidence ----------------------------------
function renderT1(body, task) {
  body.innerHTML = `
    <div class="field">
      ${task.options.map((o) => `<label class="mcq-option"><input type="radio" name="t1opt" value="${o}" /> ${o}</label>`).join("")}
    </div>
    <div class="field">
      <label for="t1Conf">Confidence (1–5)</label>
      <input type="range" id="t1Conf" min="1" max="5" value="3" />
      <output id="t1ConfVal">3</output>
    </div>
    <button class="btn btn--primary" id="t1Submit">Submit</button>
    <div id="t1Chart" style="margin-top:14px;"></div>
  `;
  document.getElementById("t1Conf").addEventListener("input", (e) => {
    document.getElementById("t1ConfVal").textContent = e.target.value;
  });
  document.getElementById("t1Submit").addEventListener("click", () => {
    const sel = body.querySelector("input[name='t1opt']:checked");
    if (!sel) { showFeedback("Pick an angle first.", "box--warning"); return; }
    const confidence = parseInt(document.getElementById("t1Conf").value, 10);
    const correct = sel.value === task.correct;
    const prevAttempts = getTask("T1").attempts;
    setTask("T1", { status: "done", attempts: prevAttempts + 1, correct, confidence, lastAnswer: sel.value });
    applyAdaptivity("T1", correct, confidence, 0);
    showFeedback(correct ? FEEDBACK.correctGeneral : "Not quite — check 30° and 60° too. Does one of them tie with another? Here's what the simulation actually gives each angle:", correct ? "box--success" : "box--warning");
    if (!correct) {
      const bars = task.options.map((opt) => {
        const theta = parseFloat(opt);
        const sim = simulate({ theta, v: 20, m: 1, h: 0, g: 9.8, F: 0 });
        return { label: opt, value: sim.R, highlight: opt === sel.value };
      });
      renderBarChart(document.getElementById("t1Chart"), bars, "Your pick is in red, straight from the simulation. Compare the three bars — what do you notice?");
    } else {
      document.getElementById("t1Chart").innerHTML = "";
    }
    renderMissionList();
    maybeShowPrereqCard();
  });
}

// --- T2: Lab experiment + data-table check ------------------------------
function renderT2(body, task) {
  const s = loadState();
  const needed = task.requiresAngles;
  const have = needed.every((a) =>
    s.runs.some((r) => r.theta === a && r.fair)
  );
  body.innerHTML = `
    <p>Required angles: ${needed.join("°, ")}° (only angle changing between runs).</p>
    <div class="box ${have ? "box--success" : "box--warning"}">${have ? "✓ Found all 5 fair runs in your data table." : "Not yet — go to the Lab and fire all 5 angles with v, m, h, g held fixed."}</div>
    <div class="field">
      <label for="t2Obs">What do you notice?</label>
      <textarea id="t2Obs" placeholder="e.g. 15° and 75° land at the same spot…"></textarea>
    </div>
    <div class="btn-row">
      <button class="btn btn--secondary" id="t2ToLab">Go to Lab</button>
      <button class="btn btn--primary" id="t2Submit" ${have ? "" : "disabled"}>Submit</button>
    </div>
  `;
  document.getElementById("t2ToLab").addEventListener("click", () => { location.hash = "#/lab"; });
  document.getElementById("t2Submit").addEventListener("click", async () => {
    const text = document.getElementById("t2Obs").value.trim();
    if (!text) { showFeedback("Write what you noticed first.", "box--warning"); return; }
    showFeedback("Thinking…", "box--info");
    const result = await evaluateExplanation({
      taskId: "T2", question: task.prompt, modelAnswer: task.modelAnswer, learnerAnswer: text,
    });
    const correct = result.verdict === "correct";
    setTask("T2", { status: "done", attempts: getTask("T2").attempts + 1, correct, lastAnswer: text });
    applyAdaptivity("T2", correct, 3, 0);
    renderAiFeedback(result, correct);
    renderMissionList();
  });
}

function renderAiFeedback(result, correct) {
  const text = displayFeedbackFor(result);
  const badge = result.fallbackUsed
    ? `<span class="badge badge--provisional">${result.fallbackLabel}</span>`
    : `<span class="badge badge--provisional">Provisional – awaiting teacher review</span>`;
  showFeedback(`${badge}<p style="margin-top:8px;">${text}</p>`, correct ? "box--success" : "box--info");
}

// --- T3: Numeric answer --------------------------------------------------
function renderT3(body, task) {
  body.innerHTML = `
    <div class="field">
      <label for="t3Answer">Your answer (factor)</label>
      <input type="text" id="t3Answer" placeholder="e.g. 4 or ×4" />
    </div>
    <button class="btn btn--primary" id="t3Submit">Submit</button>
    <div id="t3Chart" style="margin-top:14px;"></div>
  `;
  document.getElementById("t3Submit").addEventListener("click", () => {
    const raw = document.getElementById("t3Answer").value.trim().toLowerCase().replace(/\s+/g, "");
    if (!raw) return;
    const correct = task.acceptable.some((a) => raw === a.toLowerCase().replace(/\s+/g, "")) || raw.includes("4");
    setTask("T3", { status: "done", attempts: getTask("T3").attempts + 1, correct, lastAnswer: raw });
    applyAdaptivity("T3", correct, 3, 0);
    showFeedback(correct ? FEEDBACK.correctGeneral : "Think about R = v²sin2θ/g — if v doubles, what happens to v²? Here are the two actual simulated ranges:", correct ? "box--success" : "box--warning");
    if (!correct) {
      const simLow = simulate({ theta: 45, v: 10, m: 1, h: 0, g: 9.8, F: 0 });
      const simHigh = simulate({ theta: 45, v: 20, m: 1, h: 0, g: 9.8, F: 0 });
      renderBarChart(
        document.getElementById("t3Chart"),
        [{ label: "v=10 m/s", value: simLow.R }, { label: "v=20 m/s", value: simHigh.R, highlight: true }],
        "Speed doubled, 10 → 20 m/s. Divide the second bar by the first — what factor do you get?"
      );
    } else {
      document.getElementById("t3Chart").innerHTML = "";
    }
    renderMissionList();
    maybeShowPrereqCard();
  });
}

// --- T4: Free-text explanation (AI-evaluated) ----------------------------
function renderT4(body, task) {
  body.innerHTML = `
    <div class="field">
      <label for="t4Answer">Your explanation</label>
      <textarea id="t4Answer" placeholder="At the top, the ball's velocity is…"></textarea>
    </div>
    <button class="btn btn--primary" id="t4Submit">Submit</button>
  `;
  document.getElementById("t4Submit").addEventListener("click", async () => {
    const text = document.getElementById("t4Answer").value.trim();
    if (!text) { showFeedback("Write an explanation first.", "box--warning"); return; }
    showFeedback("Thinking…", "box--info");
    const result = await evaluateExplanation({
      taskId: "T4", question: task.prompt, modelAnswer: task.modelAnswer, learnerAnswer: text,
    });
    const correct = result.verdict === "correct";
    setTask("T4", { status: "done", attempts: getTask("T4").attempts + 1, correct, lastAnswer: text });
    if (result.misconception === "M2") flagMisconception("M2", `T4 answer: "${text}"`);
    applyAdaptivity("T4", correct, 3, 0);
    renderAiFeedback(result, correct);
    renderMissionList();
    maybeShowPrereqCard();
  });
}

// --- T5: Target challenge (interactive) -----------------------------------
function renderT5(body, task) {
  const { v, h, flag, tolerance } = task.target;
  body.innerHTML = `
    <p>Fixed: v = ${v} m/s, launch height h = ${h} m, flat ground beyond the cliff. Target flag at <strong>${flag} m</strong> (±${tolerance} m).</p>
    <div class="slider-control">
      <div class="slider-control__head"><label for="t5Theta">Launch angle θ</label><span class="slider-control__value" id="t5ThetaVal">30°</span></div>
      <input type="range" id="t5Theta" min="0" max="90" step="1" value="30" />
    </div>
    <button class="btn btn--primary" id="t5Launch">🚀 Launch</button>
    <p id="t5Attempts" class="lede"></p>
    <div id="t5HintSlot"></div>
    <div id="t5Chart" style="margin-top:14px;"></div>
  `;
  const thetaRange = document.getElementById("t5Theta");
  thetaRange.addEventListener("input", () => {
    document.getElementById("t5ThetaVal").textContent = thetaRange.value + "°";
  });
  document.getElementById("t5Launch").addEventListener("click", () => {
    const theta = parseFloat(thetaRange.value);
    const sim = simulate({ v, theta, m: 1, h, g: 9.8, F: 0 });
    const hit = Math.abs(sim.R - flag) <= tolerance;
    const t = getTask("T5");
    const attempts = t.attempts + 1;
    const s = loadState();
    const prevRun = s.runs[s.runs.length - 1] || null;
    const run = { id: "run_" + Date.now(), timestamp: Date.now(), theta, v, m: 1, h, g: 9.8, F: 0, windMode: "force", k: 0, R: sim.R, H: sim.H, T: sim.T, tPeak: sim.tPeak, varsChanged: ["angle"], fair: true, starred: false, taskId: "T5", hit };
    addRun(run);
    document.getElementById("t5Attempts").textContent = `Attempt ${attempts}: landed at ${sim.R.toFixed(2)} m.`;

    t5Attempts.push({ theta, R: sim.R, hit });
    renderAngleCurveChart(document.getElementById("t5Chart"), {
      v, h, g: 9.8, flag, tolerance, attempts: t5Attempts,
      caption: hit ? "Your hits and misses so far, against the simulation's actual Range-vs-angle curve for this cliff." : "Each attempt is plotted against the real curve — where does the green flag zone actually sit?",
    });

    setTask("T5", { status: hit ? "done" : t.status, attempts, correct: hit, lastAnswer: `θ=${theta}°` });
    if (hit) {
      // Completing T5 is the other documented way (besides Advanced profile)
      // to unlock the Lab's launch-height slider — honour that here.
      s.unlocks.height = true;
      saveState();
    }
    recomputeOutcomes();
    renderMissionList();

    const hintSlot = document.getElementById("t5HintSlot");
    if (hit) {
      hintSlot.innerHTML = "";
      showFeedback(`🎯 Hit! ${sim.R.toFixed(2)} m is inside the flag zone. ${theta < 45 ? FEEDBACK.correctGeneral : "Nice work — notice this angle isn't 45°."}`, "box--success");
    } else if (theta === 45) {
      flagMisconception("M1", `θ=45°, h=${h} landed at ${sim.R.toFixed(2)} m, short of the ${flag} m flag.`);
      showFeedback(FEEDBACK.M1, "box--warning");
      logHintRequest("M1", Math.max(1, hintLevelFor("M1")));
      renderHintLadderInline("M1", hintSlot);
    } else {
      showFeedback(`Miss — ${sim.R.toFixed(2)} m isn't in the flag zone yet. Try another angle.`, "box--info");
    }
  });
}

// --- T6: Olympiad extension (Moon) ---------------------------------------
function renderT6(body, task) {
  body.innerHTML = `
    <div class="field">
      <label for="t6Pred">Your predicted range on the Moon (m)</label>
      <input type="number" id="t6Pred" step="0.1" />
    </div>
    <button class="btn btn--secondary" id="t6Test">Test it</button>
    <div id="t6Result"></div>
    <div id="t6Chart" style="margin-top:14px;"></div>
  `;
  document.getElementById("t6Test").addEventListener("click", () => {
    const pred = parseFloat(document.getElementById("t6Pred").value);
    const earth = simulate({ v: 20, theta: 45, m: 1, h: 0, g: 9.8, F: 0 });
    const sim = simulate({ v: 20, theta: 45, m: 1, h: 0, g: 1.62, F: 0 });
    const s = loadState();
    addRun({ id: "run_" + Date.now(), timestamp: Date.now(), theta: 45, v: 20, m: 1, h: 0, g: 1.62, F: 0, windMode: "force", k: 0, R: sim.R, H: sim.H, T: sim.T, tPeak: sim.tPeak, varsChanged: ["gravity"], fair: true, starred: false, taskId: "T6" });
    const correct = !isNaN(pred) && Math.abs(pred - sim.R) <= sim.R * 0.1;
    setTask("T6", { status: "done", attempts: getTask("T6").attempts + 1, correct, lastAnswer: String(pred) });
    recomputeOutcomes();
    renderMissionList();
    document.getElementById("t6Result").innerHTML = `<div class="box ${correct ? "box--success" : "box--info"}">Actual Moon range: <strong>${sim.R.toFixed(2)} m</strong> (Earth's is ${earth.R.toFixed(2)} m). ${correct ? "Great prediction!" : "How does g appear in R = v²sin2θ/g? What happens when g shrinks by ~6×?"}</div>`;
    if (!correct) {
      renderBarChart(
        document.getElementById("t6Chart"),
        [{ label: "Earth", value: earth.R }, { label: "Moon", value: sim.R, highlight: true }],
        "Same launch, same angle, only g changed. How many times taller is the Moon bar?"
      );
    } else {
      document.getElementById("t6Chart").innerHTML = "";
    }
  });
}

// --- T7: Prediction + experiment (wind) -----------------------------------
function renderT7(body, task) {
  body.innerHTML = `
    <div class="field">
      <label>Will the flight time change?</label>
      <label class="mcq-option"><input type="radio" name="t7time" value="no" /> No change</label>
      <label class="mcq-option"><input type="radio" name="t7time" value="yes" /> Yes, it changes</label>
    </div>
    <div class="field">
      <label>Will the range change?</label>
      <label class="mcq-option"><input type="radio" name="t7range" value="yes" /> Yes, it changes</label>
      <label class="mcq-option"><input type="radio" name="t7range" value="no" /> No change</label>
    </div>
    <button class="btn btn--secondary" id="t7Test">Test it</button>
    <div id="t7Result"></div>
    <div id="t7Chart" style="margin-top:14px;"></div>
  `;
  document.getElementById("t7Test").addEventListener("click", () => {
    const timeSel = body.querySelector("input[name='t7time']:checked");
    const rangeSel = body.querySelector("input[name='t7range']:checked");
    if (!timeSel || !rangeSel) { showFeedback("Make both predictions first.", "box--warning"); return; }
    const noWind = simulate({ v: 20, theta: 45, m: 1, h: 0, g: 9.8, F: 0 });
    const withWind = simulate({ v: 20, theta: 45, m: 1, h: 0, g: 9.8, F: 2, windMode: "force" });
    addRun({ id: "run_" + Date.now(), timestamp: Date.now(), theta: 45, v: 20, m: 1, h: 0, g: 9.8, F: 2, windMode: "force", k: 0, R: withWind.R, H: withWind.H, T: withWind.T, tPeak: withWind.tPeak, varsChanged: ["wind"], fair: true, starred: false, taskId: "T7" });
    const timeCorrect = timeSel.value === "no";
    const rangeCorrect = rangeSel.value === "yes";
    const correct = timeCorrect && rangeCorrect;
    setTask("T7", { status: "done", attempts: getTask("T7").attempts + 1, correct, lastAnswer: `time:${timeSel.value}, range:${rangeSel.value}` });
    const s = loadState();
    s.unlocks.expert = true;
    saveState();
    recomputeOutcomes();
    renderMissionList();
    let msg = `No wind: T=${noWind.T.toFixed(2)}s, R=${noWind.R.toFixed(2)}m. With +2N tailwind: T=${withWind.T.toFixed(2)}s, R=${withWind.R.toFixed(2)}m.<br>`;
    msg += timeCorrect ? "✓ You were right that flight time doesn't change — horizontal and vertical motion are independent." : "The flight time barely changed even with wind — why might a sideways push not affect how long gravity takes to pull the ball down?";
    document.getElementById("t7Result").innerHTML = `<div class="box ${correct ? "box--success" : "box--info"}">${msg}</div>`;
    if (!correct) {
      renderBarChart(
        document.getElementById("t7Chart"),
        [{ label: "No wind", value: noWind.R }, { label: "+2N wind", value: withWind.R, highlight: true }],
        "Range clearly moved. Now look back at the Flight-time numbers above — did they move anywhere near as much?"
      );
    } else {
      document.getElementById("t7Chart").innerHTML = "";
    }
  });
}

// --- T8: Target challenge with wind + explanation (AI-evaluated) --------
function renderT8(body, task) {
  const { v, F, m, flag, tolerance } = task.target;
  body.innerHTML = `
    <p>Fixed: v = ${v} m/s, tailwind F = +${F} N, mass = ${m} kg, flat ground. Target flag at <strong>${flag} m</strong> (±${tolerance} m).</p>
    <div class="slider-control">
      <div class="slider-control__head"><label for="t8Theta">Launch angle θ</label><span class="slider-control__value" id="t8ThetaVal">45°</span></div>
      <input type="range" id="t8Theta" min="0" max="90" step="1" value="45" />
    </div>
    <button class="btn btn--primary" id="t8Launch">🚀 Launch</button>
    <p id="t8Attempts" class="lede"></p>
    <div class="field">
      <label for="t8Explain">Should you aim above or below 45° in a tailwind, and why?</label>
      <textarea id="t8Explain"></textarea>
    </div>
    <button class="btn btn--secondary" id="t8Submit">Submit explanation</button>
  `;
  let lastHit = false;
  const thetaRange = document.getElementById("t8Theta");
  thetaRange.addEventListener("input", () => {
    document.getElementById("t8ThetaVal").textContent = thetaRange.value + "°";
  });
  document.getElementById("t8Launch").addEventListener("click", () => {
    const theta = parseFloat(thetaRange.value);
    const sim = simulate({ v, theta, m, h: 0, g: 9.8, F, windMode: "force" });
    const hit = Math.abs(sim.R - flag) <= tolerance;
    lastHit = hit;
    addRun({ id: "run_" + Date.now(), timestamp: Date.now(), theta, v, m, h: 0, g: 9.8, F, windMode: "force", k: 0, R: sim.R, H: sim.H, T: sim.T, tPeak: sim.tPeak, varsChanged: ["angle"], fair: true, starred: false, taskId: "T8", hit });
    document.getElementById("t8Attempts").textContent = `Landed at ${sim.R.toFixed(2)} m. ${hit ? "🎯 Inside the flag zone!" : "Not quite."}`;
  });
  document.getElementById("t8Submit").addEventListener("click", async () => {
    const text = document.getElementById("t8Explain").value.trim();
    if (!text) { showFeedback("Write your explanation first.", "box--warning"); return; }
    showFeedback("Thinking…", "box--info");
    const result = await evaluateExplanation({ taskId: "T8", question: task.prompt, modelAnswer: task.modelAnswer, learnerAnswer: text });
    const correct = lastHit && result.verdict !== "incorrect";
    setTask("T8", { status: "done", attempts: getTask("T8").attempts + 1, correct, lastAnswer: text });
    recomputeOutcomes();
    renderMissionList();
    renderAiFeedback(result, correct);
  });
}

// --- T9: Mass-in-wind check (MCQ) -----------------------------------------
function renderT9(body, task) {
  body.innerHTML = `
    <div class="field">
      ${task.options.map((o) => `<label class="mcq-option"><input type="radio" name="t9opt" value="${o}" /> ${o}</label>`).join("")}
    </div>
    <button class="btn btn--primary" id="t9Submit">Submit</button>
    <div id="t9Chart" style="margin-top:14px;"></div>
  `;
  document.getElementById("t9Submit").addEventListener("click", () => {
    const sel = body.querySelector("input[name='t9opt']:checked");
    if (!sel) return;
    const correct = sel.value === task.correct;
    setTask("T9", { status: "done", attempts: getTask("T9").attempts + 1, correct, lastAnswer: sel.value });
    if (sel.value === "Same") {
      flagMisconception("M4", `T9: picked "Same" for a force-mode wind with two different masses.`);
      showFeedback(FEEDBACK.M4.replace("X m", "farther").replace("Y m", "a shorter distance"), "box--warning");
    } else if (correct) {
      showFeedback(FEEDBACK.correctGeneral, "box--success");
    } else {
      showFeedback("Think about a = F/m — which mass gets pushed harder by the same force? Here's what the simulation actually does:", "box--warning");
    }
    if (!correct) {
      const light = simulate({ theta: 45, v: 20, m: 1, h: 0, g: 9.8, F: 2, windMode: "force" });
      const heavy = simulate({ theta: 45, v: 20, m: 5, h: 0, g: 9.8, F: 2, windMode: "force" });
      renderBarChart(
        document.getElementById("t9Chart"),
        [
          { label: "1 kg", value: light.R, highlight: sel.value === "5 kg" },
          { label: "5 kg", value: heavy.R, highlight: sel.value === "1 kg" },
        ],
        "Same +2N wind, same launch, only the mass differs. Which bar is taller?"
      );
    } else {
      document.getElementById("t9Chart").innerHTML = "";
    }
    recomputeOutcomes();
    renderMissionList();
  });
}

