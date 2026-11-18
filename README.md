# RangeLab

**RangeLab** is an inquiry-based virtual laboratory on projectile motion
(angle and speed vs. range) built for a high-achieving Class 11 learner
preparing for the NSEP/INPhO Physics Olympiad — with a teacher-in-the-loop
review view.

Exam card: **P5 · P5-T10 · L6 · C5** — Roll No. **23B2294**.

## Run it locally

No build step — it's plain HTML/CSS/vanilla JS (ES modules).

**Option A — just open it:**
```
open index.html
```
This runs the full app, except the AI feedback feature (which needs the
serverless function) will fall back to the offline scripted evaluator —
which is expected and clearly labelled "Offline hint (AI unavailable)".

**Option B — with the AI feature working, via Vercel dev:**
```
npm install -g vercel   # once
vercel dev
```
Then open the printed `localhost` URL. `vercel dev` serves the static files
*and* runs `/api/feedback.js` as a real serverless function locally.

## Environment variable

The AI feedback feature calls a Vercel serverless function that in turn
calls an LLM. Set this environment variable (in Vercel's dashboard, or a
local `.env` file read by `vercel dev` — never commit it):

```
LLM_API_KEY=<your Google Gemini API key>
```

Provider: **Google Gemini** (`gemini-1.5-flash`), called directly via its
REST API with `fetch` — no SDK. See `api/feedback.js`.

If the API key is missing, the request fails, or the response fails
validation, the client (`ai.js`) automatically falls back to a
keyword-based scripted evaluator defined in `config.js`, clearly labelled
"Offline hint (AI unavailable)". Setting `USE_RECORDED_AI = true` in
`config.js` switches to pre-recorded sample AI outputs instead (for a
demo where the network itself can't be trusted).

## Deployment

Deploys to Vercel as a static site + one serverless function, no config
needed beyond the `LLM_API_KEY` env var. Project name: `et617-23b2294`
→ `https://et617-23b2294.vercel.app`.

```
vercel --prod
```

## Feature list

- **Physics engine** (`physics.js`): closed-form projectile kinematics
  (with launch height, wind/force, mass) plus a numerical (semi-implicit
  Euler) fallback for the Expert air-drag mode. Self-tests run in the
  console on load.
- **9 connected screens**: Welcome, Diagnostic, Hypothesis, Lab, Graph,
  Challenge, Reflect & Revise, Teacher, About (hash-routed).
- **Lab**: sliders for angle/speed/mass/height/gravity/wind/drag, canvas
  animation (ghost trails, velocity-component arrows, wind streamlines,
  protractor, peak marker), data table with fair-test detection, CSV
  export, measuring tape and stopwatch tools.
- **Unsuccessful-experiment support**: a 3-level Socratic hint ladder for
  unfair tests and each of the 4 tracked misconceptions, shown inline in
  the Lab and reachable at `#/support`.
- **9 tasks in 5 interaction formats** (`#/challenge`): MCQ+confidence,
  lab-experiment + data check, numeric, AI-evaluated free text, and two
  interactive target challenges — plus an Olympiad extension (Moon
  gravity, wind) that unlocks progressively.
- **Graphs** (`#/graph`) built only from the learner's own data: Range vs
  Angle (with auto-detected complementary-angle badges), Range vs v²
  (with a best-fit slope), and Range vs Angle for 3 wind values.
- **AI feedback** (`ai.js` + `api/feedback.js`): schema validation,
  answer-leak filtering, data-consistency rule-checking, tone/length
  checks, and a scripted/recorded fallback — every call logged for the
  teacher.
- **Adaptivity**: diagnostic-driven Standard/Advanced profile,
  skip-ahead on strong performance, a prerequisite "resolving velocity
  into components" mini-card after repeated misses, and idle-task nudges.
- **Teacher view** (`#/teacher`, PIN `617`): full learner progress
  (profile, diagnostic, tasks, hint levels, screen time, misconception
  evidence, outcomes O1–O3), an AI feedback review queue (Approve / Edit
  & approve / Override / Reject), lock/unlock controls, reset, and a JSON
  export.
- **Demo mode** (`#/about`): one-click autofill of the two required
  learner scenarios (correct path / M1-misconception path) for a fast
  viva walkthrough.

## Screen map

| Route | Screen |
|---|---|
| `#/welcome` | Welcome, learning outcomes, resume banner, role switch |
| `#/diagnostic` | 2-question diagnostic → Standard/Advanced profile |
| `#/hypothesis` | Concept box + structured hypothesis builder (H1) |
| `#/lab` | Core simulation, controls, data table, lab tools |
| `#/support` | Unsuccessful-experiment hint ladder (opens inline in Lab too) |
| `#/graph` | Range vs Angle / v² / 3-wind-value graphs |
| `#/challenge` | 9 tasks (T1–T9), locked/open/done |
| `#/reflect` | H1 vs evidence, write H2+, AI feedback, O1–O3 progress |
| `#/teacher` | PIN-gated teacher dashboard + AI review queue |
| `#/about` | Exam card, persona, tech stack, AI/fallback, demo mode |

## Tech / libraries used

- Plain HTML5, CSS3, vanilla JavaScript (ES modules) — **no build step**,
  no framework, no bundler.
- **HTML5 `<canvas>`**, hand-rolled drawing, for the simulation and all
  three graphs — no charting library (Chart.js from a CDN was the
  documented fallback option; it wasn't needed).
- Browser **localStorage** for all state, under a single key
  `rangelab_23B2294` (see `state.js`).
- **Vercel serverless function** (Node runtime, CommonJS) at
  `/api/feedback.js`, calling Google Gemini's REST API directly.
- No external npm packages or CDN scripts are required to run the app.

## Build order (for reference)

The app was built and committed in this order so each stage was live and
testable: (1) router + footer + About + Welcome, (2) physics + Lab canvas
+ data table, (3) hypothesis + fair-test detector + hint ladder, (4)
tasks/challenge + feedback, (5) graph, (6) AI endpoint + validation +
fallback, (7) teacher view (+ reflect screen), (8) diagnostic + adaptivity
+ demo mode.

## Notes on originality & AI assistance

All code in this repository is original to this exam submission. **Built
with AI assistance** (Claude) — disclosed here and on the About screen,
per the exam's requirement.
