// router.js
// ---------------------------------------------------------------------------
// Minimal hash router. Each screen module exports a default `render(root)`
// function that paints itself into the given container element, and may
// optionally export `cleanup()` for teardown (timers, canvas loops, etc.).
// ---------------------------------------------------------------------------
import { TEACHER_PIN } from "./config.js";
import { markScreenEnter, markScreenExit, loadState } from "./state.js";

const routes = {
  "#/welcome": { title: "Welcome", module: "./screens/welcome.js", step: null },
  "#/diagnostic": { title: "Diagnostic", module: "./screens/diagnostic.js", step: "Diagnostic" },
  "#/hypothesis": { title: "Hypothesis", module: "./screens/hypothesis.js", step: "Hypothesis" },
  "#/lab": { title: "Lab", module: "./screens/lab.js", step: "Lab" },
  "#/support": { title: "Support", module: "./screens/lab.js", step: "Lab" },
  "#/graph": { title: "Graph", module: "./screens/graph.js", step: "Graph" },
  "#/challenge": { title: "Challenge", module: "./screens/challenge.js", step: "Challenge" },
  "#/reflect": { title: "Reflect", module: "./screens/reflect.js", step: "Reflect" },
  "#/teacher": { title: "Teacher", module: "./screens/teacher.js", step: null },
  "#/about": { title: "About", module: "./screens/about.js", step: null },
};

const STEPS = ["Diagnostic", "Hypothesis", "Lab", "Graph", "Challenge", "Reflect"];

let currentCleanup = null;
let currentHash = null;

function renderStepper(activeStep) {
  const stepper = document.getElementById("stepper");
  if (!activeStep) {
    stepper.innerHTML = "";
    stepper.setAttribute("aria-hidden", "true");
    return;
  }
  stepper.removeAttribute("aria-hidden");
  const activeIdx = STEPS.indexOf(activeStep);
  stepper.innerHTML = STEPS.map((step, i) => {
    const cls = i === activeIdx ? "is-current" : i < activeIdx ? "is-done" : "";
    const hash = "#/" + step.toLowerCase();
    return `<a class="stepper__step ${cls}" href="${hash}" aria-current="${i === activeIdx ? "step" : "false"}">
      <span class="stepper__dot" aria-hidden="true"></span>${step}
    </a>`;
  }).join("");
}

function updateRoleButtons() {
  const s = loadState();
  const learnerBtn = document.getElementById("roleLearnerBtn");
  const teacherBtn = document.getElementById("roleTeacherBtn");
  const onTeacher = location.hash === "#/teacher";
  learnerBtn.classList.toggle("is-active", !onTeacher);
  teacherBtn.classList.toggle("is-active", onTeacher);
  learnerBtn.setAttribute("aria-pressed", String(!onTeacher));
  teacherBtn.setAttribute("aria-pressed", String(onTeacher));
}

async function renderRoute() {
  const hash = location.hash || "#/welcome";
  const route = routes[hash] || routes["#/welcome"];

  if (currentHash) markScreenExit(currentHash);
  if (typeof currentCleanup === "function") {
    try { currentCleanup(); } catch (e) { /* ignore */ }
  }
  currentCleanup = null;
  currentHash = hash;
  markScreenEnter(hash);

  document.title = `RangeLab — ${route.title}`;
  renderStepper(route.step);
  updateRoleButtons();

  const app = document.getElementById("app");
  app.setAttribute("aria-busy", "true");
  try {
    const mod = await import(route.module);
    app.innerHTML = "";
    const result = mod.default(app, { hash });
    if (typeof result === "function") currentCleanup = result;
  } catch (err) {
    console.error("RangeLab router error:", err);
    app.innerHTML = `<div class="screen"><div class="box box--danger"><strong>Something went wrong loading this screen.</strong><p>${err.message}</p></div></div>`;
  }
  app.removeAttribute("aria-busy");
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", renderRoute);
window.addEventListener("DOMContentLoaded", () => {
  if (!location.hash) location.hash = "#/welcome";
  renderRoute();
});

// --- Role switch (inline PIN modal, never window.prompt) -------------------
const pinModal = () => document.getElementById("pinModal");
const pinInput = () => document.getElementById("pinInput");
const pinError = () => document.getElementById("pinError");

function openPinModal() {
  pinModal().hidden = false;
  pinError().hidden = true;
  pinInput().value = "";
  pinInput().focus();
}
function closePinModal() {
  pinModal().hidden = true;
}

document.getElementById("roleTeacherBtn").addEventListener("click", () => {
  if (location.hash === "#/teacher") return;
  openPinModal();
});
document.getElementById("roleLearnerBtn").addEventListener("click", () => {
  if (location.hash === "#/teacher") location.hash = "#/welcome";
});
document.getElementById("pinCancelBtn").addEventListener("click", closePinModal);
document.getElementById("pinSubmitBtn").addEventListener("click", submitPin);
pinInput().addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitPin();
});

function submitPin() {
  if (pinInput().value === TEACHER_PIN) {
    closePinModal();
    location.hash = "#/teacher";
  } else {
    pinError().hidden = false;
  }
}

// Re-sync role buttons whenever the hash changes (handled in renderRoute too,
// but keep this listener for clarity / in case of direct hash edits).
window.addEventListener("hashchange", updateRoleButtons);
