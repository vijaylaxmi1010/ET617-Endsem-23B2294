// state.js
// ---------------------------------------------------------------------------
// All persistence for RangeLab lives under ONE localStorage key so teacher
// and learner share the same "device" in this pilot (see teacher screen
// note). This module owns the schema, default values, load/save, and the
// small event-logging helpers used across screens.
// ---------------------------------------------------------------------------
import { STORAGE_KEY } from "./config.js";

function defaultState() {
  return {
    version: 1,
    createdAt: Date.now(),
    currentScreen: "#/welcome",
    lastMeaningfulScreen: null,
    profile: {
      level: "Standard", // 'Standard' | 'Advanced'
      diagnostic: null, // { q1, q1Correct, q1Confidence, q2, q2Correct, q2Confidence, m2Suspected }
    },
    unlocks: {
      olympiad: false, // gravity presets, wind, Moon task
      height: false, // launch-height slider
      expert: false, // drag k
    },
    teacherOverrides: {
      olympiadLock: null, // null = follow default rule; true/false = forced by teacher
    },
    hypotheses: [], // { id:'H1', timestamp, variable, direction, reason, predictionAngle, confidence }
    runs: [], // see makeRun() in lab screen
    hints: {
      // per ladder type: current level unlocked (0 = none requested yet) and a full log
      log: [], // { type, level, timestamp }
    },
    tasks: {}, // taskId -> { status: 'locked'|'open'|'done', attempts, correct, confidence, lastAnswer }
    aiLog: [], // { id, taskId, input, rawOutput, validatedOutput, fallbackUsed, fallbackLabel, timeMs, timestamp, teacherDecision }
    misconceptions: {
      M1: { flagged: false, evidence: "" },
      M2: { flagged: false, evidence: "" },
      MASS: { flagged: false, evidence: "" },
      M3: { flagged: false, evidence: "" },
      M4: { flagged: false, evidence: "" },
    },
    outcomes: { O1: false, O2: false, O3: false },
    screenTime: {}, // screenHash -> seconds
    screenEnteredAt: null,
    // Set by a Challenge task's "See it in the Lab" button, consumed once by
    // the Lab screen on its next render: { theta, v, m, h, g, F, windMode,
    // showComponents, unlockHeight, unlockOlympiad, sourceTaskId }.
    pendingLabPreset: null,
    nudges: {}, // taskId -> shown boolean
    demoMode: null,
    graphBViewed: false,
    consecutiveIncorrect: 0,
  };
}

let _state = null;

export function loadState() {
  if (_state) return _state;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge with defaults so new fields added later don't break old saves.
      _state = { ...defaultState(), ...parsed };
      _state.profile = { ...defaultState().profile, ...(parsed.profile || {}) };
      _state.unlocks = { ...defaultState().unlocks, ...(parsed.unlocks || {}) };
      _state.hints = { ...defaultState().hints, ...(parsed.hints || {}) };
      _state.misconceptions = { ...defaultState().misconceptions, ...(parsed.misconceptions || {}) };
      _state.outcomes = { ...defaultState().outcomes, ...(parsed.outcomes || {}) };
      _state.teacherOverrides = { ...defaultState().teacherOverrides, ...(parsed.teacherOverrides || {}) };
      return _state;
    }
  } catch (e) {
    console.warn("RangeLab: could not parse saved state, starting fresh.", e);
  }
  _state = defaultState();
  return _state;
}

export function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
  } catch (e) {
    console.warn("RangeLab: could not save state (localStorage full/blocked).", e);
  }
}

export function getState() {
  return loadState();
}

export function resetState() {
  _state = defaultState();
  saveState();
  return _state;
}

export function hasSavedProgress() {
  const s = loadState();
  // Completing the diagnostic already counts as progress — a learner who's
  // past it but hasn't saved a hypothesis/run/task yet should still resume
  // into the flow, not get bounced back to redo the diagnostic.
  return (
    s.runs.length > 0 ||
    s.hypotheses.length > 0 ||
    Object.keys(s.tasks).length > 0 ||
    !!s.profile.diagnostic
  );
}

// --- Screen-time tracking ----------------------------------------------
// Screens that are actually part of the learner's mission flow — i.e. valid
// places for the Welcome screen's "Continue the mission" button to resume
// into. Teacher and About are real screens but aren't "where the learner
// left off" in any sense that button should ever act on.
const MISSION_SCREENS = ["#/diagnostic", "#/hypothesis", "#/lab", "#/graph", "#/challenge", "#/reflect"];

export function markScreenEnter(hash) {
  const s = loadState();
  s.screenEnteredAt = Date.now();
  s.currentScreen = hash;
  // Tracked separately from currentScreen: the Welcome screen needs to know
  // where the learner was *before* arriving at Welcome in order to offer a
  // resume link, but by the time Welcome's own code runs, currentScreen has
  // already been overwritten to "#/welcome" by this same function. So we
  // keep a second field that only advances on actual mission screens —
  // never Welcome itself, and never Teacher/About, which aren't part of
  // the learner's mission progress.
  if (MISSION_SCREENS.includes(hash)) {
    s.lastMeaningfulScreen = hash;
  }
  saveState();
}

export function markScreenExit(hash) {
  const s = loadState();
  if (s.screenEnteredAt) {
    const secs = (Date.now() - s.screenEnteredAt) / 1000;
    s.screenTime[hash] = (s.screenTime[hash] || 0) + secs;
    s.screenEnteredAt = null;
    saveState();
  }
}

// --- Hint logging ---------------------------------------------------------
export function logHintRequest(type, level) {
  const s = loadState();
  s.hints.log.push({ type, level, timestamp: Date.now() });
  saveState();
}

export function hintLevelFor(type) {
  const s = loadState();
  const entries = s.hints.log.filter((h) => h.type === type);
  return entries.length ? Math.max(...entries.map((e) => e.level)) : 0;
}

// --- Misconception flagging -------------------------------------------------
export function flagMisconception(code, evidence) {
  const s = loadState();
  if (!s.misconceptions[code]) s.misconceptions[code] = { flagged: false, evidence: "" };
  s.misconceptions[code].flagged = true;
  s.misconceptions[code].evidence = evidence;
  saveState();
}

// --- Task tracking --------------------------------------------------------
export function getTask(taskId) {
  const s = loadState();
  return s.tasks[taskId] || { status: "locked", attempts: 0, correct: false, confidence: null, lastAnswer: "" };
}

export function setTask(taskId, patch) {
  const s = loadState();
  s.tasks[taskId] = { ...getTask(taskId), ...patch };
  saveState();
  return s.tasks[taskId];
}

// --- Run / hypothesis helpers ------------------------------------------
export function addRun(run) {
  const s = loadState();
  s.runs.push(run);
  saveState();
  return run;
}

export function clearRuns() {
  const s = loadState();
  s.runs = [];
  saveState();
}

export function addHypothesis(hyp) {
  const s = loadState();
  hyp.id = "H" + (s.hypotheses.length + 1);
  hyp.timestamp = Date.now();
  s.hypotheses.push(hyp);
  saveState();
  return hyp;
}

// --- AI log -----------------------------------------------------------
export function addAiLogEntry(entry) {
  const s = loadState();
  entry.id = "ai_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  entry.timestamp = Date.now();
  entry.teacherDecision = null; // { action: 'approve'|'edit'|'override'|'reject', text, tag, decidedAt }
  s.aiLog.push(entry);
  saveState();
  return entry;
}

export function updateAiLogDecision(id, decision) {
  const s = loadState();
  const entry = s.aiLog.find((e) => e.id === id);
  if (entry) {
    entry.teacherDecision = { ...decision, decidedAt: Date.now() };
    saveState();
  }
  return entry;
}

// --- Consecutive-incorrect tracking (adaptivity §8 prerequisite trigger) --
export function recordAnswerCorrectness(correct) {
  const s = loadState();
  s.consecutiveIncorrect = correct ? 0 : (s.consecutiveIncorrect || 0) + 1;
  saveState();
  return s.consecutiveIncorrect;
}

// --- "See it in the Lab" handoff (Challenge -> Lab) ------------------------
// A wrong-answer chart in the Challenge screen can offer to open the exact
// same setup in the full interactive Lab. Since both screens are plain ES
// modules with no direct import relationship, the handoff goes through
// state rather than router query params, so the Lab's existing route stays
// a clean "#/lab" with no parsing of its own.
export function setPendingLabPreset(preset) {
  const s = loadState();
  s.pendingLabPreset = preset;
  saveState();
}

export function consumePendingLabPreset() {
  const s = loadState();
  const preset = s.pendingLabPreset || null;
  if (preset) {
    s.pendingLabPreset = null;
    saveState();
  }
  return preset;
}

// --- Outcome evaluation (adaptivity §8) -----------------------------------
// Re-checked after every task attempt / run / graph view so the teacher view
// and reflect screen always show current status.
export function recomputeOutcomes() {
  const s = loadState();
  const t = (id) => s.tasks[id] || {};

  // O1: T1 correct + T2 complementary-pair observation made (T2 marked done).
  s.outcomes.O1 = !!(t("T1").correct && t("T2").status === "done");

  // O2: T4 correct (AI or teacher-approved) + T5 hit with an angle < 45°.
  const t5HitBelow45 = s.runs.some(
    (r) => r.taskId === "T5" && r.hit && r.theta < 45
  );
  s.outcomes.O2 = !!(t("T4").correct && t5HitBelow45);

  // O3: >=3 fair-test runs with one variable changed + T3 correct + Graph B viewed.
  const fairRuns = s.runs.filter((r) => r.fair).length;
  s.outcomes.O3 = !!(fairRuns >= 3 && t("T3").correct && s.graphBViewed);

  saveState();
  return s.outcomes;
}

export function markGraphBViewed() {
  const s = loadState();
  s.graphBViewed = true;
  saveState();
  recomputeOutcomes();
}

// --- Olympiad unlock logic --------------------------------------------
// Honours a teacher override first; otherwise Advanced profile or finishing
// the core tasks (T1-T5) unlocks the extension.
export function isOlympiadUnlocked() {
  const s = loadState();
  if (s.teacherOverrides.olympiadLock !== null) return s.teacherOverrides.olympiadLock;
  if (s.unlocks.olympiad) return true;
  if (s.profile.level === "Advanced") return true;
  const core = ["T1", "T2", "T3", "T4", "T5"];
  return core.every((id) => (s.tasks[id] || {}).status === "done");
}

export function setOlympiadUnlockedByProgress() {
  const s = loadState();
  if (isOlympiadUnlocked()) {
    s.unlocks.olympiad = true;
    saveState();
  }
}
