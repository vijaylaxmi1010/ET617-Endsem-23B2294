// screens/about.js
import { EXAM_CARD, PERSONA, OUTCOMES, TECH_STACK, ADAPTIVITY, DEMO_SCENARIOS } from "../config.js";
import { runDemoScenario } from "./demo.js";

export default function renderAbout(root) {
  root.innerHTML = `
    <div class="screen">
      <h1>About RangeLab</h1>

      <h2>Exam card</h2>
      <div class="card">
        <p><strong>Problem:</strong> ${EXAM_CARD.problem}</p>
        <p><strong>Topic:</strong> ${EXAM_CARD.topic}</p>
        <p><strong>Learner:</strong> ${EXAM_CARD.learner}</p>
        <p><strong>Constraint:</strong> ${EXAM_CARD.constraint}</p>
        <p><strong>Identity token:</strong> ${EXAM_CARD.id}</p>
      </div>

      <h2>Learner persona</h2>
      <div class="card">
        <p>${PERSONA.full}</p>
        <ul>
          ${PERSONA.misconceptions.map((m) => `<li>${m}</li>`).join("")}
        </ul>
      </div>

      <h2>Learning outcomes</h2>
      <div class="card">
        <ol>
          ${OUTCOMES.map((o) => `<li><strong>${o.id}:</strong> ${o.text}</li>`).join("")}
        </ol>
      </div>

      <h2>Adaptivity rules</h2>
      <div class="card">
        <ul>
          <li><strong>Correct + confidence ≥ ${ADAPTIVITY.advancedConfidenceThreshold} + ≤ ${ADAPTIVITY.hardTaskMaxHints} hint used</strong> → harder task: skip ahead, unlock height/Moon variants.</li>
          <li><strong>Incorrect with a misconception tag</strong> (M1/M2/MASS) → alternative explanation: a targeted visual + hint ladder L1.</li>
          <li><strong>2 consecutive incorrect answers, or hint L3 reached, or diagnostic Standard + T1 wrong</strong> → prerequisite instruction: the "Resolving a velocity into components" mini-card, then retry.</li>
          <li>Interaction signals used: hint requests, number of unfair tests, time on task (&gt; ${Math.round(ADAPTIVITY.nudgeAfterSeconds / 60)} min → nudge), number of runs.</li>
        </ul>
      </div>

      <h2>AI features &amp; fallback</h2>
      <div class="card">
        <p>An explanation evaluator (Socratic, never reveals the final answer) is used for Task T4's free-text explanation, Task T2's observation text, and the hypothesis revision on the Reflect screen. It calls a Vercel serverless function (<code>/api/feedback.js</code>) which in turn calls an LLM REST API with a key stored only in the <code>LLM_API_KEY</code> environment variable.</p>
        <p>Every AI response is schema-validated, checked for answer-leaks and keyword consistency, and length/tone-checked before the learner ever sees it, then queued for teacher review (shown with a "Provisional" badge until approved/edited/overridden).</p>
        <p><strong>Fallback:</strong> if the API errors, times out (8 s) or fails validation, a keyword-based scripted evaluator from <code>config.js</code> takes over and is clearly labelled "Offline hint (AI unavailable)". A recorded-sample mode is also available for exam-day network failure.</p>
      </div>

      <h2>Tech stack</h2>
      <div class="card">
        <ul>
          ${TECH_STACK.map((t) => `<li>${t}</li>`).join("")}
        </ul>
      </div>

      <div class="box box--warning">
        <strong>Built with AI assistance (disclosed in report)</strong>
      </div>

      <h2>Demo mode</h2>
      <div class="card">
        <p>For the viva walkthrough, auto-fill a complete learner journey:</p>
        <p><em>Scenario A (correct path):</em> ${DEMO_SCENARIOS.A}</p>
        <p><em>Scenario B (M1 misconception path):</em> ${DEMO_SCENARIOS.B}</p>
        <div class="btn-row">
          <button class="btn btn--secondary" id="demoABtn">▶ Run Demo Scenario A</button>
          <button class="btn btn--secondary" id="demoBBtn">▶ Run Demo Scenario B</button>
        </div>
        <p class="lede" style="font-size:0.82rem;">Demo mode clearly labels every auto-filled item — it overwrites current saved progress on this device.</p>
      </div>

      <div class="btn-row">
        <button class="btn btn--secondary" id="backBtn">Back</button>
        <span class="spacer"></span>
      </div>
    </div>
  `;

  document.getElementById("backBtn").addEventListener("click", () => {
    history.back();
  });
  document.getElementById("demoABtn").addEventListener("click", () => {
    if (confirm("Run Demo Scenario A? This overwrites current saved progress on this device.")) {
      const dest = runDemoScenario("A");
      location.hash = dest;
      location.reload();
    }
  });
  document.getElementById("demoBBtn").addEventListener("click", () => {
    if (confirm("Run Demo Scenario B? This overwrites current saved progress on this device.")) {
      const dest = runDemoScenario("B");
      location.hash = dest;
      location.reload();
    }
  });
}
