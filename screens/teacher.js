// screens/teacher.js — Screen 9 (C5: teacher-in-the-loop)
import { TASKS, HINT_LADDER_TITLES, MISCONCEPTION_LABELS } from "../config.js";
import {
  loadState, saveState, resetState, updateAiLogDecision, recomputeOutcomes,
} from "../state.js";

export default function renderTeacher(root) {
  paint(root);
}

function paint(root) {
  const s = loadState();
  recomputeOutcomes();

  const taskRows = TASKS.map((t) => {
    const rec = s.tasks[t.id] || { status: "locked", attempts: 0, correct: false };
    return `<tr><td>${t.id}</td><td>${rec.status}</td><td>${rec.attempts || 0}</td><td>${rec.status === "done" ? (rec.correct ? "✓" : "✗") : "—"}</td></tr>`;
  }).join("");

  const hintCounts = {};
  s.hints.log.forEach((h) => { hintCounts[h.type] = Math.max(hintCounts[h.type] || 0, h.level); });

  const screenTimeRows = Object.entries(s.screenTime || {})
    .map(([hash, secs]) => `<tr><td>${hash}</td><td>${Math.round(secs)}s</td></tr>`)
    .join("");

  root.innerHTML = `
    <div class="screen">
      <h1>Teacher view</h1>
      <div class="box box--warning">Pilot mode: teacher and learner share this device. A production version would sync via a database.</div>

      <div class="teacher-grid">
        <div>
          <h2>Learner progress</h2>
          <div class="card">
            <div class="kv-grid">
              <div class="kv-tile"><div class="kv-tile__num">${s.profile.level}</div><div class="kv-tile__label">Profile</div></div>
              <div class="kv-tile"><div class="kv-tile__num">${s.runs.length}</div><div class="kv-tile__label">Runs logged</div></div>
              <div class="kv-tile"><div class="kv-tile__num">${s.runs.filter((r) => r.varsChanged && r.varsChanged.length >= 2).length}</div><div class="kv-tile__label">Unfair tests</div></div>
              <div class="kv-tile"><div class="kv-tile__num">${s.currentScreen}</div><div class="kv-tile__label">Current screen</div></div>
            </div>

            <h3>Diagnostic</h3>
            ${
              s.profile.diagnostic
                ? `<p>Q1: ${s.profile.diagnostic.q1} (${s.profile.diagnostic.q1Correct ? "correct" : "incorrect"}, confidence ${s.profile.diagnostic.q1Confidence})<br>
                   Q2: ${s.profile.diagnostic.q2} (${s.profile.diagnostic.q2Correct ? "correct" : "incorrect"}, confidence ${s.profile.diagnostic.q2Confidence})</p>`
                : "<p>Not yet attempted.</p>"
            }

            <h3>Tasks</h3>
            <div class="data-table-wrap">
              <table class="data-table"><thead><tr><th>Task</th><th>Status</th><th>Attempts</th><th>Correct</th></tr></thead><tbody>${taskRows}</tbody></table>
            </div>

            <h3>Hint levels used</h3>
            <p>${Object.keys(hintCounts).length ? Object.entries(hintCounts).map(([k, v]) => `${HINT_LADDER_TITLES[k] || k}: L${v}`).join(" · ") : "No hints requested yet."}</p>

            <h3>Time on each screen</h3>
            <div class="data-table-wrap">
              <table class="data-table"><thead><tr><th>Screen</th><th>Time</th></tr></thead><tbody>${screenTimeRows || "<tr><td colspan='2'>No data yet.</td></tr>"}</tbody></table>
            </div>

            <h3>Misconception flags</h3>
            ${Object.entries(s.misconceptions)
              .map(([code, m]) => {
                const label = MISCONCEPTION_LABELS[code] || { name: code, description: "" };
                return `<div class="box ${m.flagged ? "box--warning" : "box--info"}" style="margin:8px 0;">
                  <p style="margin:0;"><strong>${label.name}</strong> — ${m.flagged ? "⚠ flagged for this learner" : "not flagged"}</p>
                  <p class="lede" style="margin:4px 0 0; font-size:0.85rem;">${label.description}</p>
                  ${m.evidence ? `<p style="margin:6px 0 0;"><strong>Evidence:</strong> <em>${m.evidence}</em></p>` : ""}
                </div>`;
              })
              .join("")}

            <h3>Outcomes</h3>
            <div class="kv-grid">
              <div class="kv-tile"><div class="kv-tile__num">${s.outcomes.O1 ? "✓" : "…"}</div><div class="kv-tile__label">O1</div></div>
              <div class="kv-tile"><div class="kv-tile__num">${s.outcomes.O2 ? "✓" : "…"}</div><div class="kv-tile__label">O2</div></div>
              <div class="kv-tile"><div class="kv-tile__num">${s.outcomes.O3 ? "✓" : "…"}</div><div class="kv-tile__label">O3</div></div>
            </div>
          </div>

          <h2>Teacher controls</h2>
          <div class="card">
            <div class="toggle-row">
              <input type="checkbox" id="olyLockToggle" ${s.teacherOverrides.olympiadLock === true ? "checked" : ""} />
              <label for="olyLockToggle" style="margin:0;">Force-unlock the Olympiad extension</label>
            </div>
            <div class="toggle-row">
              <input type="checkbox" id="olyRelockToggle" ${s.teacherOverrides.olympiadLock === false ? "checked" : ""} />
              <label for="olyRelockToggle" style="margin:0;">Force-lock the Olympiad extension</label>
            </div>
            <div class="btn-row">
              <button class="btn btn--danger" id="resetBtn">Reset learner progress</button>
              <button class="btn btn--secondary" id="exportBtn">Export learner log (JSON)</button>
            </div>
          </div>
        </div>

        <div>
          <h2>AI feedback review queue</h2>
          <div id="queueList"></div>
        </div>
      </div>

      <div class="btn-row">
        <button class="btn btn--secondary" id="backBtn">Back to Learner view</button>
        <span class="spacer"></span>
      </div>
    </div>
  `;

  renderQueue();

  document.getElementById("olyLockToggle").addEventListener("change", (e) => {
    const st = loadState();
    st.teacherOverrides.olympiadLock = e.target.checked ? true : null;
    saveState();
    paint(root);
  });
  document.getElementById("olyRelockToggle").addEventListener("change", (e) => {
    const st = loadState();
    st.teacherOverrides.olympiadLock = e.target.checked ? false : null;
    saveState();
    paint(root);
  });
  document.getElementById("resetBtn").addEventListener("click", () => {
    if (confirm("Reset ALL learner progress on this device? This cannot be undone.")) {
      resetState();
      paint(root);
    }
  });
  document.getElementById("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(loadState(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rangelab_learner_log.json";
    a.click();
    URL.revokeObjectURL(url);
  });
  document.getElementById("backBtn").addEventListener("click", () => { location.hash = "#/welcome"; });
}

function renderQueue() {
  const s = loadState();
  const queueEl = document.getElementById("queueList");
  if (!s.aiLog.length) {
    queueEl.innerHTML = `<div class="box box--info">No AI feedback has been generated yet.</div>`;
    return;
  }
  queueEl.innerHTML = s.aiLog
    .slice()
    .reverse()
    .map((entry) => queueItemHTML(entry))
    .join("");

  s.aiLog.forEach((entry) => {
    const approveBtn = document.getElementById(`approve_${entry.id}`);
    const editBtn = document.getElementById(`editSave_${entry.id}`);
    const overrideBtn = document.getElementById(`overrideSave_${entry.id}`);
    const rejectBtn = document.getElementById(`reject_${entry.id}`);
    if (approveBtn) approveBtn.addEventListener("click", () => {
      updateAiLogDecision(entry.id, { action: "approve", text: entry.validatedOutput?.hint || "", tag: entry.validatedOutput?.misconception || "NONE" });
      renderQueue();
    });
    if (editBtn) editBtn.addEventListener("click", () => {
      const textarea = document.getElementById(`editText_${entry.id}`);
      updateAiLogDecision(entry.id, { action: "edit", text: textarea.value, tag: entry.validatedOutput?.misconception || "NONE" });
      renderQueue();
    });
    if (overrideBtn) overrideBtn.addEventListener("click", () => {
      const tagSel = document.getElementById(`overrideTag_${entry.id}`);
      const textarea = document.getElementById(`overrideText_${entry.id}`);
      updateAiLogDecision(entry.id, { action: "override", text: textarea.value, tag: tagSel.value });
      renderQueue();
    });
    if (rejectBtn) rejectBtn.addEventListener("click", () => {
      updateAiLogDecision(entry.id, { action: "reject", text: null, tag: entry.validatedOutput?.misconception || "NONE" });
      renderQueue();
    });
  });
}

function queueItemHTML(entry) {
  const decided = entry.teacherDecision;
  const statusBadge = !decided
    ? `<span class="badge badge--provisional">Provisional</span>`
    : decided.action === "approve" ? `<span class="badge badge--approved">Teacher-approved ✓</span>`
    : decided.action === "edit" ? `<span class="badge badge--edited">Teacher edited ✎</span>`
    : decided.action === "override" ? `<span class="badge badge--edited">Teacher override ✎</span>`
    : `<span class="badge badge--locked">Rejected → scripted hint</span>`;

  const vo = entry.validatedOutput || {};
  return `
    <div class="queue-item">
      <div class="task-card__head">
        <strong>${entry.taskId}</strong>
        ${statusBadge}
      </div>
      <p><strong>Learner's answer:</strong> ${escapeHtml(entry.learnerAnswer || "")}</p>
      <p><strong>AI verdict:</strong> ${vo.verdict || "—"} &nbsp; <strong>Rule-check:</strong> ${entry.fallbackUsed ? entry.fallbackLabel : "passed validation"}</p>
      <p><strong>Misconception:</strong> ${(MISCONCEPTION_LABELS[vo.misconception] || { name: vo.misconception || "—" }).name}</p>
      ${vo.misconception && vo.misconception !== "NONE" ? `<p class="lede" style="font-size:0.85rem; margin-top:-6px;">${MISCONCEPTION_LABELS[vo.misconception].description}</p>` : ""}
      <p><strong>Hint shown:</strong> ${escapeHtml(vo.hint || "")}</p>

      <fieldset>
        <legend>Edit &amp; approve</legend>
        <textarea id="editText_${entry.id}" rows="2">${escapeHtml(vo.hint || "")}</textarea>
        <button class="btn btn--secondary" id="editSave_${entry.id}">Save edit &amp; approve</button>
      </fieldset>

      <fieldset>
        <legend>Override</legend>
        <label for="overrideTag_${entry.id}">Misconception</label>
        <select id="overrideTag_${entry.id}">
          ${["M1", "M2", "MASS", "M3", "M4", "NONE"].map((tag) => `<option value="${tag}" ${tag === vo.misconception ? "selected" : ""}>${MISCONCEPTION_LABELS[tag].name}</option>`).join("")}
        </select>
        <textarea id="overrideText_${entry.id}" rows="2" placeholder="Write your own feedback…"></textarea>
        <button class="btn btn--secondary" id="overrideSave_${entry.id}">Save override</button>
      </fieldset>

      <div class="queue-item__actions">
        <button class="btn btn--primary" id="approve_${entry.id}">Approve</button>
        <button class="btn btn--danger" id="reject_${entry.id}">Reject (use scripted hint)</button>
      </div>

      ${decided ? `<p class="lede" style="margin-top:8px;">Decision: <strong>${decided.action}</strong>${decided.text ? ` — "${escapeHtml(decided.text)}"` : ""}</p>` : ""}
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
