# RangeLab — Design Rationale

Exam card: **P5 · P5-T10 · L6 · C5** — Roll No. **23B2294**.

## 1. Why this shape

P5 asks for an *inquiry* lab: learners manipulate variables, form
hypotheses, run experiments, interpret results, and revise. That maps
directly onto the nine-screen flow — Diagnostic → Hypothesis → Lab →
Graph → Challenge → Reflect — rather than a single "simulator +
worksheet" page. Each screen hands the learner something to *do* with
their own data, not content to read.

L6 (Olympiad-bound, bored by routine drills) drives three decisions:

- **No answer is ever stated outright.** Hints are Socratic questions
  (the hint ladders in `config.js`, and the AI's system prompt, both
  enforce this). A learner who "hates being told the answer" needs to
  *earn* the angle, not be handed it.
- **A red herring (mass) and a twist (wind) are built into the physics**,
  not bolted on as extra content, so a learner who already knows
  `R = v²sin2θ/g` still has something non-routine to discover: mass is
  irrelevant until a force appears, then `a = F/m` makes it matter again.
- **The Olympiad extension unlocks adaptively** (Advanced profile, or
  finishing the core tasks, or a teacher override) so a strong learner
  isn't gated behind busywork, while a Standard learner still gets the
  scaffolding first.

## 2. Misconception-first design

Ishita's two named misconceptions (M1: 45° is always optimal; M2:
velocity is zero at the peak) are not just mentioned in the persona —
they are *detectable, tagged, and remediated* end to end:

1. **Detection** happens in three independent places: the Diagnostic
   (Q2's "zero" option flags M2 immediately), the Lab's run-comparison
   detectors (`screens/lab.js`: `detectM1`, `detectMassRedHerring`,
   `detectM3`, `detectM4`), and the AI/fallback evaluator's
   `misconception` tag (`ai.js`).
2. **Every detection path converges on the same mandated feedback text**
   (`config.js → FEEDBACK`), via `ai.js`'s `displayFeedbackFor()` — so
   whether the AI, the offline scripted evaluator, or a rule-based lab
   detector caught the misconception, the learner sees the exact wording
   specified in the exam brief, word for word.
3. **Two more misconceptions were added** (M3: wind changes flight time;
   M4: mass never matters, overgeneralised into the wind case) because
   the wind/force extension *needs* its own pair of misconceptions to be
   pedagogically honest — M1/M2 alone don't cover the Olympiad twist.

## 3. The two deliberate variables that don't behave as expected

- **Mass** is a pure red herring until a horizontal force exists. This
  is the single clearest "fair test" teaching moment: a learner who
  locks everything except mass and sees identical ranges has *proven*
  something, not been told it.
- **Launch height** breaks the memorised 45° rule smoothly (the optimal
  angle is a continuous function of `h`, derived in `physics.js` as
  `θ* = atan(v / sqrt(v² + 2gh))`), so the cliff task (T5) isn't a trick
  question — it's the same physics, extended.

Both are tunable in one place (`config.js` → `RANGES`, `DEFAULTS`,
`G_PRESETS`) so a viva "what if speed went up to 40?" is a one-line edit.

## 4. AI feature: Socratic, validated, teacher-reviewed

The AI (`ai.js` + `api/feedback.js`) is deliberately **not** a free-form
chat tutor. It's constrained to a fixed JSON contract (verdict /
misconception / hint / confidence) so it can be:

- **Schema-validated** before the learner ever sees it.
- **Leak-checked** against a list of phrases that would give away the
  numeric answer (`ANSWER_LEAK_PHRASES`) — because an LLM asked "never
  reveal the answer" will occasionally reveal it anyway, and this is the
  one failure mode that would break the whole pedagogical design.
- **Consistency-checked** against the learner's own words (e.g. a MASS
  tag is downgraded to NONE if the learner's text never mentions mass),
  because misconception tags matter for the teacher view and shouldn't
  be AI hallucination.
- **Gracefully degraded**: offline scripted keyword rules
  (`SCRIPTED_RULES`) or recorded sample outputs (`USE_RECORDED_AI`) step
  in on any failure, labelled so the learner (and the teacher) always
  know which path produced a given hint.

This is also *why* C5 (teacher-in-the-loop) isn't a bolt-on screen: every
AI output is provisional by construction until a teacher approves, edits,
or overrides it, and that status is visible to the learner immediately
(same `localStorage`, read on every repaint).

## 5. Adaptivity as three small, legible rules

Rather than a black-box "mastery score", §8's rules are intentionally
simple enough to show verbatim on the About screen and to reason about
from the teacher view: a strong, confident, low-hint answer skips ahead;
a tagged misconception gets a targeted visual + hint L1; two wrong
answers (or hint L3, or a weak diagnostic) surfaces a concrete
prerequisite mini-card instead of just "try again". All three write to
the same `state.js` fields the teacher view reads, so there's one source
of truth for "why did the app do that?"

## 6. Accessibility & interface choices

- Large (44px+) touch targets, no hover-only affordances, visible lock
  icons with inline (not hover) explanation text — because a phone
  session after coaching, per the persona, is the primary use case.
- A single CSS Grid overflow bug (wide data tables stretching the grid
  track past the viewport at 360px) was caught and fixed during build by
  actually driving the app in a headless browser rather than only
  reading the CSS — `min-width: 0` on grid children, the classic fix.
- Colour is never the only status signal (badges always carry text:
  "Provisional", "Teacher-approved ✓", etc.).

## 7. What a "production version" would change

The Teacher view says so explicitly: this is pilot mode, teacher and
learner share one device/`localStorage`. A real deployment would move
`state.js`'s schema into a small database keyed by learner ID, and the
teacher queue would be a live multi-learner dashboard rather than a
single shared object — but the data *shape* (runs, hypotheses, tasks,
aiLog, misconceptions, outcomes) was designed to make that move a
backend swap, not a redesign.
