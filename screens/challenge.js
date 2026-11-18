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
  paint(root);
  nudgeTimer = setInterval(() => checkNudge(root), 10000);
  return function cleanup() {
    if (nudgeTimer) clearInterval(nudgeTimer);
  };
}

function checkNudge(root) {
  if (!selectedTaskId || !taskOpenedAt) return;
  const elapsed = (Date.now() - taskOpenedAt) / 1000;
  const box = document.getElementById("nudgeBox");
  if (box && elapsed > ADAPTIVITY.nudgeAfterSeconds) {
    box.hidden = false;
  }
}

function paint(root) {
  root.innerHTML = `
    <div class="screen">
      <h1>Tasks &amp; Challenge</h1>
      <p class="lede">Nine missions, five formats. <strong>Can you beat them all?</strong> Some only unlock once you've proven yourself on the earlier ones.</p>

      <div id="missionList"></div>
      <div id="taskDetail"></div>

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
    btn.addEventListener("click", () => {
      selectedTaskId = btn.dataset.task;
      taskOpenedAt = Date.now();
      renderDetail();
    });
  });
}

function renderDetail() {
  const detailEl = document.getElementById("taskDetail");
  const task = TASKS.find((t) => t.id === selectedTaskId);
  if (!task) { detailEl.innerHTML = ""; return; }

  detailEl.innerHTML = `
    <div class="card" id="taskDetailCard" style="border-color:#1f5fae;">
      <h2>${task.id}: ${task.format}</h2>
      <p>${task.prompt}</p>
      <div id="nudgeBox" class="box box--warning" hidden>
        ⏳ You've been on this one a while. Want a nudge? Try re-reading the component-breakdown box on the Hypothesis screen, or check your data table for a pattern.
      </div>
      <div id="prereqCardSlot"></div>
      <div id="taskBody"></div>
      <div id="taskFeedback"></div>
    </div>
  `;

  renderTaskBody(task);
  maybeShowPrereqCard();
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
    showFeedback(correct ? FEEDBACK.correctGeneral : "Not quite — check 30° and 60° too. Does one of them tie with another?", correct ? "box--success" : "box--warning");
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
  `;
  document.getElementById("t3Submit").addEventListener("click", () => {
    const raw = document.getElementById("t3Answer").value.trim().toLowerCase().replace(/\s+/g, "");
    if (!raw) return;
    const correct = task.acceptable.some((a) => raw === a.toLowerCase().replace(/\s+/g, "")) || raw.includes("4");
    setTask("T3", { status: "done", attempts: getTask("T3").attempts + 1, correct, lastAnswer: raw });
    applyAdaptivity("T3", correct, 3, 0);
    showFeedback(correct ? FEEDBACK.correctGeneral : "Think about R = v²sin2θ/g — if v doubles, what happens to v²?", correct ? "box--success" : "box--warning");
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

    setTask("T5", { status: hit ? "done" : t.status, attempts, correct: hit, lastAnswer: `θ=${theta}°` });
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
  `;
  document.getElementById("t6Test").addEventListener("click", () => {
    const pred = parseFloat(document.getElementById("t6Pred").value);
    const sim = simulate({ v: 20, theta: 45, m: 1, h: 0, g: 1.62, F: 0 });
    const s = loadState();
    addRun({ id: "run_" + Date.now(), timestamp: Date.now(), theta: 45, v: 20, m: 1, h: 0, g: 1.62, F: 0, windMode: "force", k: 0, R: sim.R, H: sim.H, T: sim.T, tPeak: sim.tPeak, varsChanged: ["gravity"], fair: true, starred: false, taskId: "T6" });
    const correct = !isNaN(pred) && Math.abs(pred - sim.R) <= sim.R * 0.1;
    setTask("T6", { status: "done", attempts: getTask("T6").attempts + 1, correct, lastAnswer: String(pred) });
    recomputeOutcomes();
    renderMissionList();
    document.getElementById("t6Result").innerHTML = `<div class="box ${correct ? "box--success" : "box--info"}">Actual Moon range: <strong>${sim.R.toFixed(2)} m</strong> (Earth's was about 40.82 m — that's roughly ×${(sim.R / 40.82).toFixed(2)}). ${correct ? "Great prediction!" : "How does g appear in R = v²sin2θ/g? What happens when g shrinks by ~6×?"}</div>`;
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
      showFeedback("Think about a = F/m — which mass gets pushed harder by the same force?", "box--warning");
    }
    recomputeOutcomes();
    renderMissionList();
  });
}
