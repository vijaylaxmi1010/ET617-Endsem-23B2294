// config.js
// ---------------------------------------------------------------------------
// RangeLab — ALL tunable values, content strings, hint ladders and model
// answers live in this one file so a viva "change request" can be done here
// and nowhere else. Nothing in the rest of the app should hard-code a number
// or a learner-facing sentence that belongs here.
// ---------------------------------------------------------------------------

export const STORAGE_KEY = "rangelab_23B2294";
export const TEACHER_PIN = "617";

// --- Exam card (shown on the About screen) --------------------------------
export const EXAM_CARD = {
  problem: "P5 – Inquiry-based virtual laboratory (learners manipulate variables, form hypotheses, run experiments, interpret results; the app responds to their experimental choices and supports revising hypotheses)",
  topic: "P5-T10 – Projectile motion: angle and speed vs range (Class 11)",
  learner: "L6 – High-achieving learner preparing for an Olympiad, bored by routine practice",
  constraint: "C5 – Teacher-in-the-loop: a teacher view that shows learner progress and lets the teacher approve or override AI feedback",
  id: "23B2294",
};

export const FOOTER_TEXT = "ET 617 End-Sem · Roll No. 23B2294 · RangeLab";

// --- Persona ----------------------------------------------------------------
export const PERSONA = {
  name: "Ishita Deshpande",
  short:
    "Ishita, 16, Class 11 (PCM), is aiming for NSEP/INPhO and finds textbook drills “too easy, too repetitive.” She already knows R = v²sin2θ/g by heart — but has never actually tested it.",
  full:
    "Ishita Deshpande, 16, is a Class 11 (PCM) student in Pune preparing for NSEP/INPhO. She finds textbook drills “too easy, too repetitive.” She is strong in vectors and trig identities (sin2θ = 2sinθcosθ) and kinematic equations, and has memorised R = v²sin2θ/g — but has never tested it experimentally. She uses her own Android phone and the family laptop, for about 40 minutes between 9 and 10 PM after coaching. She studies in English medium and is competitive: she loves challenges and hates being told the answer.",
  misconceptions: [
    "M1: “45° always gives the maximum range” (she wrongly applies it even when launching from a height).",
    "M2: “At the highest point the velocity is zero” (she confuses vertical velocity with total velocity).",
  ],
};

// --- Learning outcomes --------------------------------------------------
export const OUTCOMES = [
  {
    id: "O1",
    text: "Predict how range changes with launch angle at fixed speed and identify complementary-angle pairs (e.g. 30°/60°) that give equal range.",
  },
  {
    id: "O2",
    text: "Explain, using horizontal and vertical components, why 45° maximises range on level ground, and predict that the optimal angle falls below 45° when launching from a height.",
  },
  {
    id: "O3",
    text: "Design a fair test (one variable at a time) and derive R ∝ v² from your own data table and graph.",
  },
];

// --- Physics defaults / presets --------------------------------------------
export const DEFAULTS = {
  theta: 30, // degrees
  v: 20, // m/s
  m: 1, // kg
  h: 0, // m
  g: 9.8,
  F: 0, // N
  windMode: "force", // 'force' | 'acceleration'
  k: 0, // drag coefficient kg/s
};

export const RANGES = {
  theta: { min: 0, max: 90, step: 1 },
  v: { min: 5, max: 30, step: 0.5 },
  m: { min: 0.1, max: 10, step: 0.1 },
  h: { min: 0, max: 50, step: 1 },
  F: { min: -5, max: 5, step: 0.5 },
  k: { min: 0, max: 0.5, step: 0.01 },
};

export const G_PRESETS = {
  Earth: 9.8,
  Moon: 1.62,
  Mars: 3.71,
};

// --- Diagnostic screen -------------------------------------------------
export const DIAGNOSTIC = {
  Q1: {
    text: "A ball is thrown at 20 m/s on flat ground. Which angle sends it farthest?",
    options: ["30°", "45°", "60°", "All equal"],
    correct: "45°",
  },
  Q2: {
    text: "At the very top of its path, the ball's velocity is…",
    options: ["Zero", "Only horizontal", "Only vertical", "Maximum"],
    correct: "Only horizontal",
    zeroOption: "Zero",
  },
};

// --- Hypothesis screen ---------------------------------------------------
export const HYPOTHESIS_INTRO =
  "Let's break the launch velocity into two parts. First, the horizontal part (v·cosθ) never changes, since nothing pushes sideways. Second, the vertical part (v·sinθ) is pulled down by g. Third, range = horizontal speed × time in the air. A steeper launch gives more time but less horizontal speed. Where's the sweet spot?";

export const HYPOTHESIS_VARIABLES = ["angle", "speed", "mass", "launch height"];
export const HYPOTHESIS_DIRECTIONS = [
  "increase",
  "decrease",
  "stay the same",
  "increase then decrease",
];

// --- Hint ladders (Screen 5 — unsuccessful-experiment support) -------------
// Never reveal the final numeric answer.
export const HINT_LADDERS = {
  unfair: [
    "You changed two things between Run X and Run Y. Can you tell which one caused the difference?",
    "Scientists hold everything fixed except one variable. Which slider would you lock to test your idea?",
    "Try this: keep v = 20 m/s and h = 0, then change ONLY the angle in steps of 15°. What pattern appears in the table?",
  ],
  M1: [
    "Your 45° shot from the cliff landed at X m, but your Y° shot went farther. What's different about this launch compared with flat ground?",
    "Turn on the component arrows. From a height, the ball already has extra time in the air. Do you still need as much upward speed?",
    "Fix v and h. Try 25°, 30°, 35°, 40°, 45°. Plot them on the graph screen. Where's the peak now?",
  ],
  MASS: [
    "Run A (m = 1 kg) and Run B (m = 8 kg) landed at the same spot. What does your hypothesis say should have happened?",
    "Look at the formulas for vx and vy. Does mass appear anywhere?",
    "Try 3 very different masses at the same angle and speed. Compare the Range column.",
  ],
  M3: [
    "Run A (no wind) and Run B (tailwind) went different distances. Check the Flight-time column. What do you notice?",
    "The wind pushes sideways. Which equation decides how long the ball stays up: the x one or the y one?",
    "Keep everything fixed and try F = −3, 0, +3 N. Compare T and R for each.",
  ],
  M4: [
    "Earlier you proved mass doesn't matter. Now Run A (1 kg) and Run B (5 kg) landed at different spots in the same wind. What's new?",
    "The wind gives a force, not an acceleration. How does a = F/m change with mass?",
    "Switch the toggle to 'uniform acceleration' and repeat. Does mass matter now?",
  ],
};

export const HINT_LADDER_TITLES = {
  unfair: "Unfair test (2+ variables changed)",
  M1: "“45° always wins” — even from a height?",
  MASS: "The mass red herring",
  M3: "Does wind change the time in the air?",
  M4: "Does mass matter once there's wind?",
};

// --- Task feedback text (used verbatim) -------------------------------------
export const FEEDBACK = {
  correctGeneral:
    "Exactly! You spotted that sin2θ peaks when 2θ = 90°. Now here's the twist: launch from a cliff. Does your rule still hold?",
  M1:
    "Your 45° shot from the cliff landed at 40.1 m, short of the flag. Your earlier rule came from flat ground. What changes when the ball starts 30 m up? Look at the time in the air.",
  M2:
    "Tap the velocity arrows at the peak. The vertical arrow has vanished, but is anything still pointing sideways? What does that tell you about the total speed at the top?",
  MASS:
    "Interesting prediction! Your data shows Run A and Run B landed at the same spot even with different masses. What could explain that?",
  M3:
    "Check your table: Run A and Run B have the same flight time even though one had wind. Why might the sideways push not change how long the ball stays up?",
  M4:
    "Your rule worked without wind. But look: in the same wind, the 1 kg ball went X m and the 5 kg ball went Y m. What does a sideways force do to a light ball versus a heavy one?",
  partial:
    "You're on the right track. Can you add why using the horizontal and vertical components?",
};

// --- Tasks & Challenge (Screen 7) -------------------------------------------
export const TASKS = [
  {
    id: "T1",
    format: "Prediction MCQ + confidence",
    prompt: "At v = 20 m/s on flat ground, which lands farthest: 30°, 45° or 60°?",
    options: ["30°", "45°", "60°"],
    correct: "45°",
    modelAnswer: "45° (≈ 40.8 m); 30° and 60° tie (≈ 35.3 m)",
    locked: false,
  },
  {
    id: "T2",
    format: "Lab experiment + data-table check",
    prompt:
      "Fire at 15°, 30°, 45°, 60°, 75° at the same speed. What do you notice?",
    modelAnswer: "15° ≈ 75°, 30° ≈ 60°, peak at 45° (complementary angles)",
    requiresAngles: [15, 30, 45, 60, 75],
    locked: false,
  },
  {
    id: "T3",
    format: "Numeric answer",
    prompt: "If you double the launch speed, by what factor does the range change?",
    correct: "4",
    acceptable: ["4", "×4", "4x", "x4", "4 times"],
    modelAnswer: "4 (R ∝ v²); accept 4 or ×4",
    locked: false,
  },
  {
    id: "T4",
    format: "Free-text explanation (AI-evaluated)",
    prompt: "At the highest point of the path, what is the ball's velocity? Explain why.",
    modelAnswer: "v·cosθ, horizontal only; not zero, because the horizontal component is constant",
    locked: false,
  },
  {
    id: "T5",
    format: "Target challenge (interactive)",
    prompt:
      "Launch from a 30 m cliff at v = 15 m/s. Hit the flag at 43 m (±1 m). Is 45° your best bet?",
    modelAnswer:
      "No. 45° lands ≈ 40.1 m (miss). Hits are roughly 22°–35°; the optimum is ≈ 28° (≈ 43.6 m)",
    target: { v: 15, h: 30, flag: 43, tolerance: 1 },
    locked: false,
  },
  {
    id: "T6",
    format: "Olympiad extension",
    prompt:
      "Same flat-ground launch (v = 20, θ = 45°) on the Moon (g = 1.62). Predict the range, then test it.",
    modelAnswer: "≈ 246.9 m (×6.05 Earth's range)",
    locked: true,
    unlockAfter: ["T1", "T2", "T3", "T4", "T5"],
  },
  {
    id: "T7",
    format: "Prediction + experiment (wind)",
    prompt:
      "A +2 N tailwind blows on a 1 kg ball (v = 20, θ = 45°, flat ground). Predict: (a) does the flight time change? (b) does the range change? Then test it.",
    modelAnswer:
      "(a) No, T stays ≈ 2.89 s, because horizontal and vertical motions are independent. (b) Yes, R ≈ 49.2 m instead of 40.8 m",
    locked: true,
    unlockAfter: ["T1", "T2", "T3", "T4", "T5"],
  },
  {
    id: "T8",
    format: "Target challenge with wind + explanation (AI-evaluated)",
    prompt:
      "Tailwind +2 N, 1 kg ball, v = 20 m/s, flat ground. Hit the flag at 49.8 m (±0.5 m). Then explain: should you aim above or below 45° in a tailwind, and why?",
    modelAnswer:
      "Above 45° (θ* ≈ 50.8°, R_max ≈ 50.0 m). A steeper launch gives more time for the wind to keep accelerating the ball. In a headwind, aim below 45°",
    target: { v: 20, F: 2, m: 1, flag: 49.8, tolerance: 0.5 },
    locked: true,
    unlockAfter: ["T7"],
  },
  {
    id: "T9",
    format: "Mass-in-wind check (MCQ)",
    prompt:
      "In the same wind (force mode), a 1 kg and a 5 kg ball are launched identically. Which lands farther?",
    options: ["1 kg", "5 kg", "Same"],
    correct: "1 kg",
    modelAnswer: "1 kg (a = F/m is larger). In uniform-acceleration mode: same",
    locked: true,
    unlockAfter: ["T7"],
  },
];

// --- AI feature ---------------------------------------------------------
export const AI_SYSTEM_PROMPT = `You are a physics tutor for a 16-year-old Olympiad (NSEP/INPhO) aspirant learning projectile motion (no air drag). Evaluate the learner's explanation against the model answer.
Known misconceptions:
M1 = "45° always gives maximum range" (false when launch height > 0; optimum is below 45°).
M2 = "velocity is zero at the highest point" (only the vertical component is zero; the horizontal component v·cosθ remains).
MASS = "heavier projectiles go farther/shorter" (mass has no effect without drag or wind force).
M3 = "a horizontal wind changes the time of flight" (it doesn't; the vertical motion is independent).
M4 = "mass never matters, even with a wind force" (with a constant force, a = F/m, so lighter balls are pushed more).
Wind physics: horizontal acceleration a = F/m; optimal angle > 45° in a tailwind, < 45° in a headwind (flat ground).
Rules: Never state the final numerical answer or the correct angle. Respond with ONE Socratic question or hint (max 2 sentences, conversational, uses "you"). Refer to the learner's own data runs when useful.
Return ONLY valid JSON: {"verdict":"correct|partial|incorrect","misconception":"M1|M2|MASS|M3|M4|NONE","hint":"...","confidence":0-1}`;

export const AI_TIMEOUT_MS = 8000;
export const USE_RECORDED_AI = false; // flip to true on exam day if the live API is unreliable

// Phrases that would leak the final answer — if the AI's hint contains any of
// these (case-insensitive), the hint is rejected and the scripted fallback is
// used instead.
export const ANSWER_LEAK_PHRASES = [
  "27.8",
  "28°",
  "28 degrees",
  "v cos", // "v cos θ remains" style leak of the T4 model answer
  "4 times",
  "×4",
  "x4",
  "40.8",
  "49.2",
  "49.15",
  "50.8",
  "50.0 m",
  "246.9",
  "43.6",
];

// Recorded sample AI outputs, used only when USE_RECORDED_AI = true (exam-day
// fallback so a demo never depends on network/API availability).
export const RECORDED_AI_SAMPLES = {
  T4: {
    verdict: "partial",
    misconception: "NONE",
    hint: "You're close — think about which component of velocity actually drops to zero at the peak, and which one never does.",
    confidence: 0.6,
  },
  T2: {
    verdict: "correct",
    misconception: "NONE",
    hint: "Nice pattern-spotting! Can you say why pairs like 30° and 60° might share the same horizontal-×-vertical product?",
    confidence: 0.8,
  },
  hypothesisRevision: {
    verdict: "partial",
    misconception: "M1",
    hint: "Your revised hypothesis mentions angle — does it still assume 45° is best in every situation, even off a cliff?",
    confidence: 0.55,
  },
};

// Keyword-based scripted evaluator (offline fallback, config-driven). Each
// rule is checked in order against the lower-cased learner answer.
export const SCRIPTED_RULES = [
  { test: (txt) => /\bzero\b/.test(txt) && !/\bhorizontal\b/.test(txt), misconception: "M2", verdict: "incorrect" },
  { test: (txt) => /45/.test(txt) && /always/.test(txt), misconception: "M1", verdict: "incorrect" },
  { test: (txt) => /\b(mass|heavy|heavier|weight)\b/.test(txt) && /(doesn'?t matter|no effect|never matters)/.test(txt) === false && /wind/.test(txt) === false, misconception: "MASS", verdict: "partial" },
  { test: (txt) => /wind/.test(txt) && /(time|longer|shorter|duration)/.test(txt) && /(doesn'?t|same|no change|unchanged)/.test(txt) === false, misconception: "M3", verdict: "incorrect" },
  { test: (txt) => /mass.*(doesn'?t|never) matter/.test(txt) && /wind/.test(txt), misconception: "M4", verdict: "incorrect" },
  { test: (txt) => /(horizontal|cos|sideways)/.test(txt), misconception: "NONE", verdict: "correct" },
];

export const SCRIPTED_FALLBACK_LABEL = "Offline hint (AI unavailable)";
export const RECORDED_FALLBACK_LABEL = "Recorded sample (exam-day mode)";

// --- Adaptivity thresholds --------------------------------------------------
export const ADAPTIVITY = {
  advancedConfidenceThreshold: 4,
  hardTaskMaxHints: 1,
  nudgeAfterSeconds: 240, // > 4 min on one task
  consecutiveIncorrectForPrereq: 2,
};

// --- Prerequisite mini-card (vector components) -----------------------------
export const PREREQ_CARD = {
  title: "Resolving a velocity into components",
  body:
    "Any launch velocity v at angle θ can be split into two independent parts: the horizontal part vx = v·cosθ and the vertical part vy = v·sinθ. Drag the vector below and watch the two components change.",
};

// --- Demo mode (scenarios for the viva) -------------------------------------
export const DEMO_SCENARIOS = {
  A: "Correct path: both diagnostics right, fair-angle testing, T1–T5 correct, Moon unlocked, teacher approves AI feedback.",
  B: "M1 misconception path: hypothesis says 45° is always best, misses the cliff flag at 45°, works through the hint ladder, revises the hypothesis, teacher edits the AI feedback.",
};

export const TECH_STACK = [
  "Plain HTML5 + CSS3 + vanilla JavaScript (ES modules) — no build step",
  "HTML5 <canvas> for the simulation and all graphs (no charting library)",
  "Hash-based client-side router (router.js)",
  "Browser localStorage for all learner/teacher state",
  "Vercel serverless function (Node runtime) at /api/feedback.js calling an LLM REST API",
  "Provider: Google Gemini (gemini-1.5-flash) via REST fetch, no SDK — key read from process.env.LLM_API_KEY",
];
