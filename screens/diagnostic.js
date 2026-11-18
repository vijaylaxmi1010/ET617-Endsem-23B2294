// screens/diagnostic.js — Screen 2
import { DIAGNOSTIC, ADAPTIVITY } from "../config.js";
import { loadState, saveState, flagMisconception } from "../state.js";

let answers = { q1: null, q1Confidence: 3, q2: null, q2Confidence: 3 };

export default function renderDiagnostic(root) {
  answers = { q1: null, q1Confidence: 3, q2: null, q2Confidence: 3 };
  paintQ1(root);
}

function paintQ1(root) {
  root.innerHTML = `
    <div class="screen">
      <h1>Quick diagnostic</h1>
      <p class="lede">Two quick questions so RangeLab can start you at the right level. There's no penalty for guessing — just be honest about your confidence.</p>

      <div class="card">
        <h2>Question 1 of 2</h2>
        <p>${DIAGNOSTIC.Q1.text}</p>
        <div class="field">
          ${DIAGNOSTIC.Q1.options.map((o) => `<label class="mcq-option"><input type="radio" name="q1" value="${o}" /> ${o}</label>`).join("")}
        </div>
        <div class="field">
          <label for="q1Conf">How confident are you? (1 = guessing, 5 = certain)</label>
          <input type="range" id="q1Conf" min="1" max="5" value="3" />
          <output id="q1ConfVal">3</output>
        </div>
        <div class="btn-row">
          <span class="spacer"></span>
          <button class="btn btn--primary" id="q1Next">Next question</button>
        </div>
      </div>
    </div>
  `;
  const conf = document.getElementById("q1Conf");
  conf.addEventListener("input", () => (document.getElementById("q1ConfVal").textContent = conf.value));

  document.getElementById("q1Next").addEventListener("click", () => {
    const sel = root.querySelector("input[name='q1']:checked");
    if (!sel) { alertInline(root, "Please select an answer first."); return; }
    answers.q1 = sel.value;
    answers.q1Confidence = parseInt(conf.value, 10);
    paintQ2(root);
  });
}

function paintQ2(root) {
  root.innerHTML = `
    <div class="screen">
      <h1>Quick diagnostic</h1>
      <div class="card">
        <h2>Question 2 of 2</h2>
        <p>${DIAGNOSTIC.Q2.text}</p>
        <div class="field">
          ${DIAGNOSTIC.Q2.options.map((o) => `<label class="mcq-option"><input type="radio" name="q2" value="${o}" /> ${o}</label>`).join("")}
        </div>
        <div class="field">
          <label for="q2Conf">How confident are you? (1 = guessing, 5 = certain)</label>
          <input type="range" id="q2Conf" min="1" max="5" value="3" />
          <output id="q2ConfVal">3</output>
        </div>
        <div class="btn-row">
          <button class="btn btn--secondary" id="q2Back">Back</button>
          <button class="btn btn--primary" id="q2Finish">See my result</button>
        </div>
      </div>
    </div>
  `;
  const conf = document.getElementById("q2Conf");
  conf.addEventListener("input", () => (document.getElementById("q2ConfVal").textContent = conf.value));
  document.getElementById("q2Back").addEventListener("click", () => paintQ1(root));

  document.getElementById("q2Finish").addEventListener("click", () => {
    const sel = root.querySelector("input[name='q2']:checked");
    if (!sel) { alertInline(root, "Please select an answer first."); return; }
    answers.q2 = sel.value;
    answers.q2Confidence = parseInt(conf.value, 10);
    finishDiagnostic(root);
  });
}

function alertInline(root, msg) {
  let box = root.querySelector(".field-error");
  if (!box) {
    box = document.createElement("p");
    box.className = "field-error";
    root.querySelector(".card").appendChild(box);
  }
  box.textContent = msg;
}

function finishDiagnostic(root) {
  const q1Correct = answers.q1 === DIAGNOSTIC.Q1.correct;
  const q2Correct = answers.q2 === DIAGNOSTIC.Q2.correct;
  const m2Suspected = answers.q2 === DIAGNOSTIC.Q2.zeroOption;

  const s = loadState();
  s.profile.diagnostic = {
    q1: answers.q1, q1Correct, q1Confidence: answers.q1Confidence,
    q2: answers.q2, q2Correct, q2Confidence: answers.q2Confidence,
    m2Suspected,
  };

  const bothCorrectHighConfidence =
    q1Correct && q2Correct &&
    answers.q1Confidence >= ADAPTIVITY.advancedConfidenceThreshold &&
    answers.q2Confidence >= ADAPTIVITY.advancedConfidenceThreshold;

  s.profile.level = bothCorrectHighConfidence ? "Advanced" : "Standard";
  if (bothCorrectHighConfidence) {
    s.unlocks.olympiad = true; // "unlock the Olympiad extension early"
    s.unlocks.height = true; // "the challenge starts with height"
  }
  saveState();

  if (m2Suspected) {
    flagMisconception("M2", `Diagnostic Q2: selected "${answers.q2}".`);
  }

  root.innerHTML = `
    <div class="screen">
      <h1>Your starting level</h1>

      <div class="card">
        <p class="box ${q1Correct ? "box--success" : "box--warning"}" style="margin:0 0 10px;">
          <strong>Q1:</strong> you answered <strong>${answers.q1}</strong> — ${q1Correct ? "✓ Correct" : `✗ Not quite (correct answer: ${DIAGNOSTIC.Q1.correct})`}
        </p>
        <p class="box ${q2Correct ? "box--success" : "box--warning"}" style="margin:0;">
          <strong>Q2:</strong> you answered <strong>${answers.q2}</strong> — ${q2Correct ? "✓ Correct" : `✗ Not quite (correct answer: ${DIAGNOSTIC.Q2.correct})`}
        </p>
      </div>

      <div class="box ${bothCorrectHighConfidence ? "box--success" : "box--info"}">
        <strong>Profile: ${s.profile.level}</strong>
        <p>${
          bothCorrectHighConfidence
            ? "Both answers correct with high confidence — you're starting in Advanced mode. The Olympiad extension (wind, gravity presets, launch height) is unlocked early, and your first challenge will include a launch height."
            : "You're starting in Standard mode. You'll unlock the Olympiad extension after working through the first five tasks — or a teacher can unlock it for you."
        }</p>
      </div>
      <div class="btn-row">
        <span class="spacer"></span>
        <button class="btn btn--primary" id="continueBtn">Continue to Hypothesis</button>
      </div>
    </div>
  `;
  document.getElementById("continueBtn").addEventListener("click", () => {
    location.hash = "#/hypothesis";
  });
}
