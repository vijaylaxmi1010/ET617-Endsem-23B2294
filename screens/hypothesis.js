// screens/hypothesis.js — Screen 3
import { HYPOTHESIS_INTRO, HYPOTHESIS_VARIABLES, HYPOTHESIS_DIRECTIONS } from "../config.js";
import { loadState, addHypothesis } from "../state.js";

export default function renderHypothesis(root) {
  const s = loadState();

  root.innerHTML = `
    <div class="screen">
      <h1>Build your hypothesis</h1>

      <div class="box box--info">
        <p>${HYPOTHESIS_INTRO}</p>
      </div>

      ${s.hypotheses.length ? renderHistory(s.hypotheses) : ""}

      <h2>Hypothesis ${"H" + (s.hypotheses.length + 1)}</h2>
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
