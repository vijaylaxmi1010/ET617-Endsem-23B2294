// ai.js
// ---------------------------------------------------------------------------
// Client-side AI wrapper. Calls the Vercel serverless function at
// /api/feedback, validates what comes back (schema, answer-leak filter,
// data-consistency rule check, length/tone), and falls back to a
// keyword-based scripted evaluator (or recorded samples) when the API
// errors, times out, or fails validation. Every call — successful or not —
// is logged to localStorage for the teacher review queue (§7, D6).
// ---------------------------------------------------------------------------
import {
  AI_TIMEOUT_MS, USE_RECORDED_AI, ANSWER_LEAK_PHRASES, RECORDED_AI_SAMPLES,
  SCRIPTED_RULES, SCRIPTED_FALLBACK_LABEL, RECORDED_FALLBACK_LABEL, FEEDBACK,
} from "./config.js";
import { addAiLogEntry, loadState } from "./state.js";

const VALID_VERDICTS = ["correct", "partial", "incorrect"];
const VALID_MISCONCEPTIONS = ["M1", "M2", "MASS", "M3", "M4", "NONE"];

/** Keyword sets used by the data-consistency rule check, per taskId. */
const T4_REQUIRED_KEYWORDS = /(horizontal|cos|sideways|v\s*cos)/i;

function scriptedEvaluate(learnerAnswer, taskId) {
  const txt = (learnerAnswer || "").toLowerCase();
  for (const rule of SCRIPTED_RULES) {
    if (rule.test(txt)) {
      const hintMap = {
        M1: FEEDBACK.M1, M2: FEEDBACK.M2, MASS: FEEDBACK.MASS, M3: FEEDBACK.M3, M4: FEEDBACK.M4,
        NONE: rule.verdict === "correct" ? FEEDBACK.correctGeneral : FEEDBACK.partial,
      };
      return {
        verdict: rule.verdict,
        misconception: rule.misconception,
        hint: hintMap[rule.misconception] || FEEDBACK.partial,
        confidence: 0.5,
      };
    }
  }
  // No rule matched — default to a gentle partial-credit nudge.
  return { verdict: "partial", misconception: "NONE", hint: FEEDBACK.partial, confidence: 0.4 };
}

function schemaValid(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (!VALID_VERDICTS.includes(obj.verdict)) return false;
  if (!VALID_MISCONCEPTIONS.includes(obj.misconception)) return false;
  if (typeof obj.hint !== "string" || obj.hint.trim().length === 0) return false;
  if (typeof obj.confidence !== "number" || obj.confidence < 0 || obj.confidence > 1) return false;
  return true;
}

function containsAnswerLeak(hint) {
  const lower = hint.toLowerCase();
  return ANSWER_LEAK_PHRASES.some((p) => lower.includes(p.toLowerCase()));
}

function toneLengthOk(hint) {
  // Rough "max 2 sentences" check: split on sentence terminators.
  const sentences = hint.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length > 3) return false; // a little slack for a trailing clause
  const profanity = /\b(damn|stupid|idiot|dumb)\b/i;
  if (profanity.test(hint)) return false;
  return true;
}

/**
 * Data-consistency rule check (§7): downgrade a mismatched misconception tag,
 * and downgrade an unsupported "correct" verdict to "partial".
 */
function applyConsistencyRules(result, taskId, learnerAnswer) {
  const txt = (learnerAnswer || "").toLowerCase();
  const out = { ...result };

  if (out.misconception === "MASS" && !/\b(mass|weight|heavy|heavier|lighter|kg)\b/.test(txt)) {
    out.misconception = "NONE";
  }
  if (taskId === "T4" && out.verdict === "correct" && !T4_REQUIRED_KEYWORDS.test(txt)) {
    out.verdict = "partial";
  }
  return out;
}

/** Fetch with a hard timeout; rejects on timeout or network error. */
function fetchWithTimeout(url, options, timeoutMs) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error("AI request timed out"));
    }, timeoutMs);
    fetch(url, { ...options, signal: controller.signal })
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

/**
 * Evaluate a learner's free-text explanation / observation / hypothesis
 * revision. Returns { verdict, misconception, hint, confidence, fallbackUsed,
 * fallbackLabel, logId } — logId points at the localStorage aiLog entry so
 * the caller can show the "Provisional" badge and the teacher view can find
 * it later.
 */
export async function evaluateExplanation({ taskId, question, modelAnswer, learnerAnswer, hypothesis }) {
  const started = performance.now();
  const s = loadState();
  const learnerData = s.runs.slice(-10);

  let rawOutput = "";
  let validatedOutput = null;
  let fallbackUsed = false;
  let fallbackLabel = null;

  if (USE_RECORDED_AI) {
    const sample = RECORDED_AI_SAMPLES[taskId] || RECORDED_AI_SAMPLES.T4;
    rawOutput = JSON.stringify(sample);
    validatedOutput = applyConsistencyRules(sample, taskId, learnerAnswer);
    fallbackUsed = "recorded";
    fallbackLabel = RECORDED_FALLBACK_LABEL;
  } else {
    try {
      const res = await fetchWithTimeout(
        "/api/feedback",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, question, modelAnswer, learnerAnswer, learnerData, hypothesis }),
        },
        AI_TIMEOUT_MS
      );
      if (!res.ok) throw new Error("API returned status " + res.status);
      const data = await res.json();
      rawOutput = JSON.stringify(data);

      if (!schemaValid(data)) throw new Error("Schema validation failed");
      if (containsAnswerLeak(data.hint)) throw new Error("Answer-leak filter triggered");
      if (!toneLengthOk(data.hint)) throw new Error("Length/tone check failed");

      validatedOutput = applyConsistencyRules(data, taskId, learnerAnswer);
    } catch (err) {
      rawOutput = rawOutput || String(err.message || err);
      const scripted = scriptedEvaluate(learnerAnswer, taskId);
      validatedOutput = applyConsistencyRules(scripted, taskId, learnerAnswer);
      fallbackUsed = "offline";
      fallbackLabel = SCRIPTED_FALLBACK_LABEL;
    }
  }

  const timeMs = Math.round(performance.now() - started);
  const entry = addAiLogEntry({
    taskId, question, modelAnswer, learnerAnswer,
    rawOutput, validatedOutput, fallbackUsed, fallbackLabel, timeMs,
  });

  return { ...validatedOutput, fallbackUsed, fallbackLabel, logId: entry.id };
}

/**
 * Maps an evaluation result to the exact, mandated feedback string (§6) —
 * used for the scripted Task feedback (T2/T4/T8) so the required wording
 * always appears verbatim, regardless of whether the AI or the offline
 * fallback produced the underlying verdict/misconception tag.
 */
export function displayFeedbackFor(result) {
  if (result.misconception && result.misconception !== "NONE") {
    return FEEDBACK[result.misconception] || FEEDBACK.partial;
  }
  return result.verdict === "correct" ? FEEDBACK.correctGeneral : FEEDBACK.partial;
}
