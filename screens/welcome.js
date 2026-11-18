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
  const resume = hasSavedProgress() && s.currentScreen && s.currentScreen !== "#/welcome";
  const resumeName = SCREEN_NAMES[s.currentScreen] || "where you left off";

  root.innerHTML = `
    <div class="screen">
      ${
        resume
          ? `<div class="box box--info resume-banner" role="status">
              <span>👋 <strong>Welcome back!</strong> Continue from ${resumeName}.</span>
              <span style="display:flex; gap:8px; flex-wrap:wrap;">
                <button class="btn btn--primary" id="resumeBtn">Continue</button>
                <button class="btn btn--ghost" id="startOverBtn">Start over</button>
              </span>
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
        <span class="spacer"></span>
        <button class="btn btn--primary" id="startBtn" style="font-size:1.05rem; padding:14px 26px;">Start the mission</button>
      </div>
    </div>
  `;

  document.getElementById("startBtn").addEventListener("click", () => {
    location.hash = "#/diagnostic";
  });

  const resumeBtn = document.getElementById("resumeBtn");
  if (resumeBtn) {
    resumeBtn.addEventListener("click", () => {
      location.hash = s.currentScreen;
    });
  }
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
