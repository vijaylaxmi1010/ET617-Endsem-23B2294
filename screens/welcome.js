// screens/welcome.js
import { PERSONA, OUTCOMES } from "../config.js";
import { loadState, hasSavedProgress, resetState } from "../state.js";

const SCREEN_NAMES = {
  "#/diagnostic": "the Diagnostic",
  "#/hypothesis": "the Hypothesis Builder",
  "#/lab": "the Lab",
  "#/graph": "the Graph screen",
  "#/challenge": "the Challenge",
  "#/reflect": "Reflect & Revise",
};

export default function renderWelcome(root) {
  const s = loadState();
  // "Resume" means there's real progress to go back to — not just having
  // visited the diagnostic result page once. The main CTA below adapts to
  // this so it never silently re-does a step the learner already finished.
  // Uses lastMeaningfulScreen, not currentScreen — by the time this screen's
  // code runs, the router has already set currentScreen to "#/welcome".
  const lastScreen = s.lastMeaningfulScreen;
  const resume = hasSavedProgress() && lastScreen && lastScreen !== "#/diagnostic";
  const resumeName = SCREEN_NAMES[lastScreen] || "where you left off";

  root.innerHTML = `
    <div class="screen">
      ${
        resume
          ? `<div class="box box--info resume-banner" role="status">
              👋 <strong>Welcome back!</strong> You last left off at ${resumeName}. Use the button below to pick up right there.
            </div>`
          : ""
      }

      <h1>RangeLab: How far will it fly?</h1>
      <p class="lede">${PERSONA.short}</p>

      <div class="box box--info">
        <strong>By the end you will be able to…</strong>
        <ol>
          ${OUTCOMES.map((o) => `<li>${o.text}</li>`).join("")}
        </ol>
      </div>

      <p>You'll set up your own experiments, build a hypothesis, test it against real trajectory data, and defend your reasoning against an Olympiad-style challenge — no one is going to hand you the formula and walk away. <strong>Can you beat the flag? Prove it with data.</strong></p>

      <div class="btn-row">
        ${resume ? `<button class="btn btn--ghost" id="startOverBtn">Start over</button>` : `<span class="spacer"></span>`}
        <button class="btn btn--primary" id="startBtn" style="font-size:1.05rem; padding:14px 26px;">${resume ? "Continue the mission" : "Start the mission"}</button>
      </div>
    </div>
  `;

  document.getElementById("startBtn").addEventListener("click", () => {
    // Pick up exactly where this learner left off; only a brand-new learner
    // (no progress at all) goes to the diagnostic.
    location.hash = resume ? lastScreen : "#/diagnostic";
  });

  const startOverBtn = document.getElementById("startOverBtn");
  if (startOverBtn) {
    startOverBtn.addEventListener("click", () => {
      if (confirm("Start over? This clears all your saved runs, hypotheses and progress on this device.")) {
        resetState();
        location.hash = "#/diagnostic";
        location.reload();
      }
    });
  }
}
