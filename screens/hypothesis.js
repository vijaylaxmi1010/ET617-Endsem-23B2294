// screens/hypothesis.js — Screen 3
import { HYPOTHESIS_INTRO, HYPOTHESIS_VARIABLES, HYPOTHESIS_DIRECTIONS } from "../config.js";
import { loadState, addHypothesis } from "../state.js";

export default function renderHypothesis(root) {
  const s = loadState();

  // This screen is for the learner's STARTING hypothesis only (H1). Once it
  // exists, coming back here (e.g. via the top stepper nav) should not offer
  // another identical blank form — that just silently piles up near-duplicate
  // hypotheses with the same fixed prediction question. Revisions belong on
  // the Reflect & Revise screen, which builds them from the learner's actual
  // evidence instead of asking the same thing again from scratch.
  if (s.hypotheses.length > 0) {
    renderAlreadySaved(root, s.hypotheses);
    return;
  }

  root.innerHTML = `
    <div class="screen">
      <h1>Build your hypothesis</h1>

      <div class="box box--info">
        <p>${HYPOTHESIS_INTRO}</p>
      </div>

      <h2>Hypothesis H1</h2>
      <form id="hypForm" class="card">
        <p style="font-size:1.05rem;">
          If I change
          <select id="hypVariable" aria-label="Variable to change">
            ${HYPOTHESIS_VARIABLES.map((v) => `<option value="${v}">${v}</option>`).join("")}
          </select>
          then the range will
          <select id="hypDirection" aria-label="Predicted effect on range">
            ${HYPOTHESIS_DIRECTIONS.map((d) => `<option value="${d}">${d}</option>`).join("")}
          </select>
          because
        </p>
        <div class="field">
          <label for="hypReason" class="sr-only">Reason</label>
          <textarea id="hypReason" placeholder="…because the horizontal and vertical parts of velocity trade off differently as angle changes." required></textarea>
        </div>

        <h3>Prediction</h3>
        <div class="inline-fields">
          <div class="field">
            <label for="predAngle">Which angle will go farthest at 20 m/s on flat ground?</label>
            <input type="number" id="predAngle" min="0" max="90" step="1" placeholder="e.g. 45" required />
          </div>
          <div class="field">
            <label for="predConfidence">How confident are you? (1 = guessing, 5 = certain)</label>
            <input type="range" id="predConfidence" min="1" max="5" step="1" value="3" aria-describedby="predConfidenceVal" />
            <output id="predConfidenceVal">3</output>
          </div>
        </div>

        <p id="hypError" class="field-error" hidden>Please fill in your reason and prediction before saving.</p>

        <div class="btn-row">
          <button type="button" class="btn btn--secondary" id="backBtn">Back</button>
          <button type="submit" class="btn btn--primary" id="saveHypBtn">Save hypothesis &amp; go to the Lab</button>
        </div>
      </form>
    </div>
  `;

  const confSlider = document.getElementById("predConfidence");
  const confOut = document.getElementById("predConfidenceVal");
  confSlider.addEventListener("input", () => (confOut.textContent = confSlider.value));

  document.getElementById("backBtn").addEventListener("click", () => { location.hash = "#/diagnostic"; });

  document.getElementById("hypForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const reason = document.getElementById("hypReason").value.trim();
    const predAngle = document.getElementById("predAngle").value;
    if (!reason || predAngle === "") {
      document.getElementById("hypError").hidden = false;
      return;
    }
    addHypothesis({
      variable: document.getElementById("hypVariable").value,
      direction: document.getElementById("hypDirection").value,
      reason,
      predictionAngle: parseFloat(predAngle),
      confidence: parseInt(confSlider.value, 10),
    });
    location.hash = "#/lab";
  });
}

function renderAlreadySaved(root, hyps) {
  const h1 = hyps[0];
  root.innerHTML = `
    <div class="screen">
      <h1>Your hypothesis</h1>
      <div class="box box--info">
        <p>You've already saved your starting hypothesis. Test it in the Lab, then head to <strong>Reflect &amp; Revise</strong> once you have evidence — that's where you write H2 and beyond, based on your actual data rather than a guess.</p>
      </div>

      <h2>H1</h2>
      <div class="card">
        <p>If I change <strong>${h1.variable}</strong>, the range will <strong>${h1.direction}</strong>, because ${h1.reason}</p>
        <p>Prediction: best angle = <strong>${h1.predictionAngle}°</strong>, confidence ${h1.confidence}/5</p>
      </div>

      ${hyps.length > 1 ? renderHistory(hyps.slice(1)) : ""}

      <div class="btn-row">
        <button class="btn btn--secondary" id="backBtn">Back</button>
        <span style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn btn--secondary" id="toReflectBtn">Reflect &amp; revise</button>
          <button class="btn btn--primary" id="toLabBtn">Go to the Lab</button>
        </span>
      </div>
    </div>
  `;
  document.getElementById("backBtn").addEventListener("click", () => { location.hash = "#/diagnostic"; });
  document.getElementById("toReflectBtn").addEventListener("click", () => { location.hash = "#/reflect"; });
  document.getElementById("toLabBtn").addEventListener("click", () => { location.hash = "#/lab"; });
}

function renderHistory(hyps) {
  return `
    <h2>Your earlier hypotheses</h2>
    ${hyps
      .map(
        (h) => `<div class="card">
          <p><strong>${h.id}</strong> (${new Date(h.timestamp).toLocaleString()})</p>
          <p>If I change <strong>${h.variable}</strong>, the range will <strong>${h.direction}</strong>, because ${h.reason}</p>
          <p>Prediction: best angle = <strong>${h.predictionAngle}°</strong>, confidence ${h.confidence}/5</p>
        </div>`
      )
      .join("")}
  `;
}
