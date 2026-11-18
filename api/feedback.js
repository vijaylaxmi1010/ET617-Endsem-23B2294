// api/feedback.js
// ---------------------------------------------------------------------------
// Vercel serverless function (Node runtime). Receives the learner's
// explanation, calls the LLM provider's REST endpoint directly with fetch
// (no SDK), and returns its raw JSON verdict to the client. ai.js on the
// client does ALL validation (schema, answer-leak, consistency, tone) and
// falls back to the scripted evaluator if anything here fails — this
// function only needs to try its best and fail loudly/quickly.
//
// Provider: Google Gemini (gemini-1.5-flash) via its REST API.
// The API key is read ONLY from process.env.LLM_API_KEY — never hard-coded,
// never committed (see .gitignore for .env*).
//
// This file intentionally duplicates the system prompt text from config.js
// (kept in sync by hand) rather than importing it, so this function has no
// build step and no ES-module/CommonJS interop to worry about on Vercel.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a physics tutor for a 16-year-old Olympiad (NSEP/INPhO) aspirant learning projectile motion (no air drag). Evaluate the learner's explanation against the model answer.
Known misconceptions:
M1 = "45° always gives maximum range" (false when launch height > 0; optimum is below 45°).
M2 = "velocity is zero at the highest point" (only the vertical component is zero; the horizontal component v·cosθ remains).
MASS = "heavier projectiles go farther/shorter" (mass has no effect without drag or wind force).
M3 = "a horizontal wind changes the time of flight" (it doesn't; the vertical motion is independent).
M4 = "mass never matters, even with a wind force" (with a constant force, a = F/m, so lighter balls are pushed more).
Wind physics: horizontal acceleration a = F/m; optimal angle > 45° in a tailwind, < 45° in a headwind (flat ground).
Rules: Never state the final numerical answer or the correct angle. Respond with ONE Socratic question or hint (max 2 sentences, conversational, uses "you"). Refer to the learner's own data runs when useful.
Return ONLY valid JSON: {"verdict":"correct|partial|incorrect","misconception":"M1|M2|MASS|M3|M4|NONE","hint":"...","confidence":0-1}`;

const SERVER_TIMEOUT_MS = 7000; // a little under the client's 8s budget

function buildUserMessage({ question, modelAnswer, learnerAnswer, learnerData, hypothesis }) {
  const compactRuns = (learnerData || []).map((r) => ({
    theta: r.theta, v: r.v, m: r.m, h: r.h, g: r.g, F: r.F, R: r.R, T: r.T,
  }));
  return [
    `Question: ${question || ""}`,
    `Model answer (for your reference only — never reveal this to the learner): ${modelAnswer || ""}`,
    `Learner's answer: ${learnerAnswer || ""}`,
    `Learner's recent data runs (JSON): ${JSON.stringify(compactRuns)}`,
    `Learner's current hypothesis: ${hypothesis ? JSON.stringify(hypothesis) : "(none provided)"}`,
  ].join("\n");
}

async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed, use POST." });
    return;
  }

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "LLM_API_KEY is not configured on the server." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};
  const { taskId, question, modelAnswer, learnerAnswer, learnerData, hypothesis } = body;

  const userMessage = buildUserMessage({ question, modelAnswer, learnerAnswer, learnerData, hypothesis });

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const payload = {
    systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.4,
      maxOutputTokens: 200,
    },
  };

  try {
    const apiRes = await fetchWithTimeout(
      endpoint,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      SERVER_TIMEOUT_MS
    );

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      res.status(502).json({ error: `LLM API error (${apiRes.status}): ${errText.slice(0, 300)}` });
      return;
    }

    const data = await apiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      res.status(502).json({ error: "LLM response had no text content." });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      res.status(502).json({ error: "LLM response was not valid JSON.", raw: text.slice(0, 300) });
      return;
    }

    res.status(200).json(parsed);
  } catch (err) {
    const message = err && err.name === "AbortError" ? "LLM request timed out." : String(err.message || err);
    res.status(502).json({ error: message, taskId });
  }
};
