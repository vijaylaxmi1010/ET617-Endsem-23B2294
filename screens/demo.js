// screens/demo.js
// ---------------------------------------------------------------------------
// Demo mode: auto-fills the two required learner scenarios (§9 of the exam
// brief) so a viva walkthrough doesn't need 40 minutes of real interaction.
// Everything it writes goes through the same state.js helpers a real learner
// session would use, so the rest of the app can't tell the difference.
// ---------------------------------------------------------------------------
import { simulate } from "../physics.js";
import {
  resetState,
  loadState,
  saveState,
  addRun,
  addHypothesis,
  setTask,
  flagMisconception,
  logHintRequest,
  addAiLogEntry,
  updateAiLogDecision,
  recomputeOutcomes,
  markGraphBViewed,
} from "../state.js";

function makeRun({ theta, v, m, h, g, F = 0, windMode = "force", k = 0, prevRun, taskId, target }) {
  const sim = simulate({ v, theta, m, h, g, F, windMode, k });
  const varsChanged = [];
  if (prevRun) {
    if (prevRun.theta !== theta) varsChanged.push("angle");
    if (prevRun.v !== v) varsChanged.push("speed");
    if (prevRun.m !== m) varsChanged.push("mass");
    if (prevRun.h !== h) varsChanged.push("height");
    if (prevRun.g !== g) varsChanged.push("gravity");
    if (prevRun.F !== F) varsChanged.push("wind");
  }
  const fair = !prevRun || varsChanged.length <= 1;
  const hit = target ? Math.abs(sim.R - target.flag) <= target.tolerance : undefined;
  return {
    id: "run_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    timestamp: Date.now(),
    theta, v, m, h, g, F, windMode, k,
    R: sim.R, H: sim.H, T: sim.T, tPeak: sim.tPeak,
    varsChanged, fair, starred: false, taskId, hit,
  };
}

function scenarioA() {
  resetState();
  const s = loadState();

  // Diagnostic: both correct, high confidence -> Advanced profile.
  s.profile.diagnostic = {
    q1: "45°", q1Correct: true, q1Confidence: 5,
    q2: "Only horizontal", q2Correct: true, q2Confidence: 5,
    m2Suspected: false,
  };
  s.profile.level = "Advanced";
  s.unlocks.height = true;
  saveState();

  addHypothesis({
    variable: "angle", direction: "increase then decrease",
    reason: "the horizontal part stays the same but the vertical part changes how long the ball stays up, so there should be a sweet spot",
    predictionAngle: 45, confidence: 4,
  });

  // Fair angle sweep (only angle changes) -> satisfies T2's complementary pairs.
  const angles = [15, 30, 45, 60, 75];
  let prev = null;
  angles.forEach((theta) => {
    const run = makeRun({ theta, v: 20, m: 1, h: 0, g: 9.8, prevRun: prev });
    run.starred = theta === 45 || theta === 30 || theta === 60; // evidence for the complementary-pair + peak claim
    addRun(run);
    prev = run;
  });

  setTask("T1", { status: "done", attempts: 1, correct: true, confidence: 5, lastAnswer: "45°" });
  setTask("T2", {
    status: "done", attempts: 1, correct: true,
    lastAnswer: "15° and 75° land at the same spot, 30° and 60° land at the same spot, and 45° goes the farthest of all of them.",
  });
  setTask("T3", { status: "done", attempts: 1, correct: true, lastAnswer: "4" });

  const t4Answer = "At the top the ball still has its horizontal speed v cos(theta), only the vertical part vy becomes zero for an instant, so the velocity isn't zero, it's horizontal.";
  setTask("T4", { status: "done", attempts: 1, correct: true, lastAnswer: t4Answer });
  const t4Log = addAiLogEntry({
    taskId: "T4",
    question: "At the highest point of the path, what is the ball's velocity? Explain why.",
    modelAnswer: "v·cosθ, horizontal only; not zero, because the horizontal component is constant",
    learnerAnswer: t4Answer,
    rawOutput: '{"verdict":"correct","misconception":"NONE","hint":"Nice — you clearly separated the two components. Can you show how vx stays fixed using the trig identity for sin2θ?","confidence":0.88}',
    validatedOutput: { verdict: "correct", misconception: "NONE", hint: "Nice — you clearly separated the two components. Can you show how vx stays fixed using the trig identity for sin2θ?", confidence: 0.88 },
    fallbackUsed: false,
    fallbackLabel: null,
    timeMs: 1120,
  });
  updateAiLogDecision(t4Log.id, { action: "approve", text: t4Log.validatedOutput.hint, tag: "NONE" });

  // T5 cliff target challenge: Advanced learner goes almost straight for the optimum.
  const t5run1 = makeRun({ theta: 28, v: 15, m: 1, h: 30, g: 9.8, prevRun: prev, taskId: "T5", target: { flag: 43, tolerance: 1 } });
  t5run1.starred = true; // evidence that below-45° wins from a height
  addRun(t5run1);
  prev = t5run1;
  setTask("T5", { status: "done", attempts: 1, correct: true, lastAnswer: "No — 45° would land short. I tried lower angles close to 28° instead." });

  // Moon unlocked, T6.
  s.unlocks.olympiad = true;
  saveState();
  const moonFlat = makeRun({ theta: 45, v: 20, m: 1, h: 0, g: 1.62, prevRun: prev });
  addRun(moonFlat);
  setTask("T6", { status: "done", attempts: 1, correct: true, lastAnswer: "About 246.9 m — roughly 6 times farther than on Earth, because g is so much smaller." });

  markGraphBViewed();

  addHypothesis({
    variable: "angle", direction: "increase then decrease",
    reason: "flat-ground data confirms 45° is the peak and complementary angles tie, but off a cliff the best angle drops below 45° because the ball already gets extra time from the height",
    predictionAngle: 45, confidence: 5,
  });
  const revLog = addAiLogEntry({
    taskId: "hypothesisRevision",
    question: "Was your hypothesis supported? Revise it using your evidence.",
    modelAnswer: "Range peaks at 45° on flat ground; optimum drops below 45° when launching from a height.",
    learnerAnswer: "My H1 was right for flat ground — 45° wins and 30/60 tie. But from the 30 m cliff, 28° beat 45°, so height changes the best angle.",
    rawOutput: '{"verdict":"correct","misconception":"NONE","hint":"Great synthesis — can you say, in terms of time in the air, why extra height means you need less upward speed?","confidence":0.82}',
    validatedOutput: { verdict: "correct", misconception: "NONE", hint: "Great synthesis — can you say, in terms of time in the air, why extra height means you need less upward speed?", confidence: 0.82 },
    fallbackUsed: false,
    fallbackLabel: null,
    timeMs: 980,
  });
  updateAiLogDecision(revLog.id, { action: "approve", text: revLog.validatedOutput.hint, tag: "NONE" });

  recomputeOutcomes();
  s.demoMode = "A";
  saveState();
  return "#/reflect";
}

function scenarioB() {
  resetState();
  const s = loadState();

  // Diagnostic: correct but lower confidence -> Standard profile.
  s.profile.diagnostic = {
    q1: "45°", q1Correct: true, q1Confidence: 3,
    q2: "Only horizontal", q2Correct: true, q2Confidence: 3,
    m2Suspected: false,
  };
  s.profile.level = "Standard";
  s.unlocks.height = true; // unlocked manually to attempt T5
  saveState();

  addHypothesis({
    variable: "angle", direction: "stay the same",
    reason: "45 degrees always gives the maximum range no matter what, that's the formula R = v^2 sin(2theta)/g",
    predictionAngle: 45, confidence: 5,
  });

  // First attempt at the cliff target: fires at 45°, as the (flawed) hypothesis predicts.
  const run1 = makeRun({ theta: 45, v: 15, m: 1, h: 30, g: 9.8, prevRun: null, taskId: "T5", target: { flag: 43, tolerance: 1 } });
  run1.starred = true; // evidence that the 45°-always rule failed off the cliff
  addRun(run1);
  setTask("T5", { status: "open", attempts: 1, correct: false, lastAnswer: "Yes, 45° should be the best angle — that's always true." });
  flagMisconception("M1", `Run at θ=45°, h=30 m landed at ${run1.R} m, short of the 43 m flag — the learner's hypothesis assumed 45° is always optimal.`);

  // Hint ladder usage up to level 2 for M1 before the learner adjusts.
  logHintRequest("M1", 1);
  logHintRequest("M1", 2);

  // Second attempt: learner tries a lower angle and hits the flag.
  const run2 = makeRun({ theta: 30, v: 15, m: 1, h: 30, g: 9.8, prevRun: run1, taskId: "T5", target: { flag: 43, tolerance: 1 } });
  run2.starred = true; // evidence that a lower angle beat 45° off the cliff
  addRun(run2);
  setTask("T5", { status: "done", attempts: 2, correct: run2.hit, lastAnswer: "Trying a lower angle because the first one fell short." });

  setTask("T1", { status: "done", attempts: 1, correct: true, confidence: 3, lastAnswer: "45°" });

  // Hypothesis revision after seeing the contradiction.
  addHypothesis({
    variable: "angle", direction: "increase then decrease",
    reason: "my first hypothesis was wrong off the cliff — 30° beat 45°, so height must change the best angle, not just the formula from flat ground",
    predictionAngle: 30, confidence: 4,
  });

  const revLog = addAiLogEntry({
    taskId: "hypothesisRevision",
    question: "Was your hypothesis supported? Revise it using your evidence.",
    modelAnswer: "Range peaks at 45° on flat ground; optimum drops below 45° when launching from a height.",
    learnerAnswer: "I thought 45 degrees always wins but my cliff shot missed. A lower angle worked better, so height changes the best angle.",
    rawOutput: '{"verdict":"partial","misconception":"M1","hint":"You\'re noticing the cliff changes things — can you say what the extra height gives the ball that flat ground doesn\'t?","confidence":0.6}',
    validatedOutput: { verdict: "partial", misconception: "M1", hint: "You're noticing the cliff changes things — can you say what the extra height gives the ball that flat ground doesn't?", confidence: 0.6 },
    fallbackUsed: false,
    fallbackLabel: null,
    timeMs: 1340,
  });
  // Teacher edits the AI's feedback before the learner sees the final version.
  updateAiLogDecision(revLog.id, {
    action: "edit",
    text: "You've already found the key evidence yourself — your 30° shot beat your 45° shot off the cliff. Can you connect that to how much extra time the ball spends in the air when it starts higher up?",
    tag: "M1",
  });

  recomputeOutcomes();
  s.demoMode = "B";
  saveState();
  return "#/reflect";
}

export function runDemoScenario(which) {
  return which === "A" ? scenarioA() : scenarioB();
}
