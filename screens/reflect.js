// screens/reflect.js — Screen 8: Reflect & Revise
import { HYPOTHESIS_VARIABLES, HYPOTHESIS_DIRECTIONS, OUTCOMES, PREDICTION_PROMPTS } from "../config.js";
import { loadState, addHypothesis, recomputeOutcomes } from "../state.js";
import { evaluateExplanation } from "../ai.js";

export default function renderReflect(root) {
  paint(root);
}

function paint(root) {
  const s = loadState();
  recomputeOutcomes();
  const h1 = s.hypotheses[0];
  const starred = s.runs.filter((r) => r.starred);
  const latestHyp = s.hypotheses[s.hypotheses.length - 1];
  const revisionAlreadyMade = s.hypotheses.length > 1;

  root.innerHTML = `
    <div class="screen">
      <h1>Reflect &amp; Revise</h1>

      ${
        h1
          ? `<div class="card">
              <h2>Your original hypothesis (${h1.id})</h2>
              <p>If I change <strong>${h1.variable}</strong>, the range will <strong>${h1.direction}</strong>, because ${h1.reason}</p>
              <p>Prediction: best angle = <strong>${h1.predictionAngle}°</strong>, confidence ${h1.confidence}/5</p>
            </div>`
          : `<div class="box box--warning">You haven't written a hypothesis yet. <a href="#/hypothesis">Go build one</a>.</div>`
      }

      <h2>Your evidence</h2>
      ${
        starred.length
          ? `<div class="data-table-wrap"><table class="data-table">
              <thead><tr><th>⭐</th><th>θ</th><th>v</th><th>m</th><th>h</th><th>F</th><th>Range (m)</th><th>Flight T (s)</th></tr></thead>
              <tbody>${starred.map((r) => `<tr><td>⭐</td><td>${r.theta}</td><td>${r.v}</td><td>${r.m}</td><td>${r.h}</td><td>${r.F}</td><td>${r.R.toFixed(2)}</td><td>${r.T.toFixed(2)}</td></tr>`).join("")}</tbody>
            </table></div>`
          : `<div class="box box--info">You haven't starred any runs as evidence yet. Go to the Lab's data table and click ☆ on the runs that matter most.</div>`
      }

      <div class="box box--info">
        <p><strong>Was your hypothesis supported? Revise it using your evidence.</strong></p>
      </div>

      ${revisionAlreadyMade ? renderPastRevisions(s.hypotheses.slice(1)) : ""}

      <form id="revForm" class="card">
        <h2>Write ${"H" + (s.hypotheses.length + 1)}</h2>
        <p style="font-size:1.05rem;">
          If I change
          <select id="revVariable">${HYPOTHESIS_VARIABLES.map((v) => `<option value="${v}">${v}</option>`).join("")}</select>
          then the range will
          <select id="revDirection">${HYPOTHESIS_DIRECTIONS.map((d) => `<option value="${d}">${d}</option>`).join("")}</select>
          because
        </p>
        <div class="field">
          <label for="revReason" class="sr-only">Reason</label>
          <textarea id="revReason" placeholder="Explain what your evidence showed, and whether your first hypothesis held up." required></textarea>
        </div>
        <div class="inline-fields">
          <div class="field">
            <label for="revPrediction" id="revPredictionLabel">${PREDICTION_PROMPTS.angle.question}</label>
            <input type="text" id="revPrediction" placeholder="${PREDICTION_PROMPTS.angle.placeholder}" />
          </div>
          <div class="field">
            <label for="revConfidence">Confidence (1–5)</label>
            <input type="range" id="revConfidence" min="1" max="5" value="3" />
            <output id="revConfidenceVal">3</output>
          </div>
        </div>
        <button type="submit" class="btn btn--primary" id="revSubmit">Save revision &amp; get feedback</button>
      </form>

      <div id="revFeedback"></div>

      <h2>Progress summary</h2>
      <p class="lede">These track the three learning outcomes from the Welcome screen. Each card below says exactly what still needs doing.</p>
      ${OUTCOMES.map((o) => `
        <div class="box ${s.outcomes[o.id] ? "box--success" : "box--info"}">
          <p style="margin:0;"><strong>${o.id}: ${s.outcomes[o.id] ? "✓ Achieved" : "… In progress"}</strong></p>
          <p style="margin:6px 0 0;">${o.text}</p>
          ${!s.outcomes[o.id] ? `<p style="margin:6px 0 0;"><strong>To complete this:</strong> ${o.howTo}</p>` : ""}
        </div>
      `).join("")}

      <div class="btn-row">
        <button class="btn btn--secondary" id="backBtn">Back to Challenge</button>
        <button class="btn btn--primary" id="aboutBtn">About / Teacher view</button>
      </div>
    </div>
  `;

  const confSlider = document.getElementById("revConfidence");
  confSlider.addEventListener("input", () => {
    document.getElementById("revConfidenceVal").textContent = confSlider.value;
  });

  // The prediction question follows whichever variable the learner is
  // actually hypothesising about here, instead of always asking about angle.
  const revVariable = document.getElementById("revVariable");
  const revPrediction = document.getElementById("revPrediction");
  revVariable.addEventListener("change", () => {
    const prompt = PREDICTION_PROMPTS[revVariable.value] || PREDICTION_PROMPTS.angle;
    document.getElementById("revPredictionLabel").textContent = prompt.question;
    revPrediction.placeholder = prompt.placeholder;
    revPrediction.value = "";
  });

  document.getElementById("revForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const reason = document.getElementById("revReason").value.trim();
    if (!reason) return;
    const variable = revVariable.value;
    const predictionValue = revPrediction.value.trim();
    const newHyp = addHypothesis({
      variable,
      direction: document.getElementById("revDirection").value,
      reason,
      predictionValue: predictionValue || null,
      // Kept for backward compatibility with code that reads predictionAngle
      // (only meaningful when the prediction is actually about angle).
      predictionAngle: variable === "angle" && predictionValue ? parseFloat(predictionValue) || null : null,
      confidence: parseInt(confSlider.value, 10),
    });

    document.getElementById("revFeedback").innerHTML = `<div class="box box--info">Thinking…</div>`;
    const result = await evaluateExplanation({
      taskId: "hypothesisRevision",
      question: "Was your hypothesis supported? Revise it using your evidence.",
      modelAnswer: "Range peaks at 45° on flat ground; optimum drops below 45° when launching from a height.",
      learnerAnswer: reason,
      hypothesis: newHyp,
    });
    renderRevisionFeedback(result);
    recomputeOutcomes();
    paint(root); // repaint to show the new revision in history + updated outcomes
  });

  function renderRevisionFeedback(result) {
    const badge = result.fallbackUsed
      ? `<span class="badge badge--provisional">${result.fallbackLabel}</span>`
      : `<span class="badge badge--provisional">Provisional – awaiting teacher review</span>`;
    document.getElementById("revFeedback").innerHTML = `<div class="box box--info">${badge}<p style="margin-top:8px;">${result.hint}</p></div>`;
  }

  document.getElementById("backBtn").addEventListener("click", () => { location.hash = "#/challenge"; });
  document.getElementById("aboutBtn").addEventListener("click", () => { location.hash = "#/about"; });
}

function renderPastRevisions(revisions) {
  const s = loadState();
  return `
    <h2>Revision history</h2>
    ${revisions
      .map((h) => {
        const logEntry = findAiLogForHypothesis(s, h);
        const badge = badgeForLog(logEntry);
        const predictionLine = h.predictionValue
          ? `<p>Prediction: <strong>${h.predictionValue}</strong>, confidence ${h.confidence}/5</p>`
          : h.predictionAngle
          ? `<p>Prediction: best angle = <strong>${h.predictionAngle}°</strong>, confidence ${h.confidence}/5</p>`
          : "";
        return `<div class="card">
          <p><strong>${h.id}</strong> (${new Date(h.timestamp).toLocaleString()}) ${badge}</p>
          <p>If I change <strong>${h.variable}</strong>, the range will <strong>${h.direction}</strong>, because ${h.reason}</p>
          ${predictionLine}
          ${logEntry ? `<p><em>Feedback:</em> ${logEntry.teacherDecision && logEntry.teacherDecision.text ? logEntry.teacherDecision.text : (logEntry.validatedOutput ? logEntry.validatedOutput.hint : "")}</p>` : ""}
        </div>`;
      })
      .join("")}
  `;
}

function findAiLogForHypothesis(s, hyp) {
  // Match the closest hypothesisRevision log entry logged around the same time.
  const candidates = s.aiLog.filter((e) => e.taskId === "hypothesisRevision");
  if (!candidates.length) return null;
  return candidates.reduce((closest, e) => {
    if (!closest) return e;
    return Math.abs(e.timestamp - hyp.timestamp) < Math.abs(closest.timestamp - hyp.timestamp) ? e : closest;
  }, null);
}

function badgeForLog(entry) {
  if (!entry) return "";
  const d = entry.teacherDecision;
  if (!d) return `<span class="badge badge--provisional">Provisional – awaiting teacher review</span>`;
  if (d.action === "approve") return `<span class="badge badge--approved">Teacher-approved ✓</span>`;
  if (d.action === "edit" || d.action === "override") return `<span class="badge badge--edited">Teacher edited ✎</span>`;
  return `<span class="badge badge--locked">Rejected → scripted hint</span>`;
}
