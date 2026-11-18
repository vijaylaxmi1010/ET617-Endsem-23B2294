// physics.js
// ---------------------------------------------------------------------------
// Pure physics functions for RangeLab. No DOM, no state — just maths, so it
// is easy to unit-test and easy to change in a viva.
//
// Closed-form kinematics are used whenever the drag coefficient k = 0.
// When k > 0 ("Expert mode: numerical model") we fall back to a fixed-step
// semi-implicit Euler integrator (dt = 0.002 s) because linear drag has no
// simple closed form once both gravity and a horizontal force act together.
// ---------------------------------------------------------------------------

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/** Round to 2 decimals for display. */
export function round2(x) {
  return Math.round(x * 100) / 100;
}

/**
 * Closed-form flight time on a (possibly elevated) launch, no drag.
 * T = (vy0 + sqrt(vy0^2 + 2 g h)) / g
 */
export function timeOfFlight(vy0, h, g) {
  if (g <= 0) return 0;
  return (vy0 + Math.sqrt(vy0 * vy0 + 2 * g * h)) / g;
}

/**
 * Closed-form range with an optional constant horizontal acceleration a
 * (from wind force or uniform-acceleration mode). On level ground with a = 0
 * this reduces to v^2 sin(2*theta)/g.
 */
export function closedFormRange(vx, a, T) {
  return vx * T + 0.5 * a * T * T;
}

/** Maximum height above the ground (h + rise from vy0). */
export function maxHeight(h, vy0, g) {
  return h + (vy0 * vy0) / (2 * g);
}

/** Time to reach the peak (vy = 0), ignoring any horizontal force (vertical only). */
export function timeToPeak(vy0, g) {
  return vy0 / g;
}

/**
 * Optimal launch angle (degrees) from height h with no horizontal force.
 * theta* = atan( v / sqrt(v^2 + 2 g h) ), R_max = (v/g) * sqrt(v^2 + 2 g h)
 */
export function optimalAngleNoWind(v, h, g) {
  const thetaRad = Math.atan(v / Math.sqrt(v * v + 2 * g * h));
  const thetaDeg = thetaRad * RAD2DEG;
  const rMax = (v / g) * Math.sqrt(v * v + 2 * g * h);
  return { thetaDeg, rMax };
}

/**
 * Optimal launch angle with a constant horizontal acceleration a, on level
 * ground (h = 0), closed form:
 *   tailwind (a > 0): theta* = 90 - 0.5*atan(g/a)   (> 45°)
 *   headwind (a < 0): theta* = 0.5*atan(g/|a|)       (< 45°)
 * For h > 0 (or as a robust general fallback) we scan 0–90° in 0.1° steps.
 * theta* is used only internally (challenge checks, teacher view) — never
 * shown to the learner.
 */
export function optimalAngleWithWind(v, h, g, a) {
  if (h === 0 && a !== 0) {
    let thetaDeg;
    if (a > 0) {
      thetaDeg = 90 - 0.5 * Math.atan(g / a) * RAD2DEG;
    } else {
      thetaDeg = 0.5 * Math.atan(g / Math.abs(a)) * RAD2DEG;
    }
    const sim = simulate({ v, theta: thetaDeg, m: 1, h, g, F: a, windMode: "acceleration", k: 0 });
    return { thetaDeg, rMax: sim.R };
  }
  // Numeric scan fallback (h > 0, or a === 0 degenerate case).
  let best = { thetaDeg: 45, rMax: -Infinity };
  for (let t = 0; t <= 90; t += 0.1) {
    const sim = simulate({ v, theta: t, m: 1, h, g, F: a, windMode: "acceleration", k: 0 });
    if (sim.R > best.rMax) best = { thetaDeg: t, rMax: sim.R };
  }
  return best;
}

/**
 * Fixed-step semi-implicit Euler integrator for linear air drag.
 * F_d = -k * v_rel, where v_rel is velocity relative to a uniform wind field
 * (wind speed along x only, so relative velocity = (vx - windSpeedX, vy)).
 * We model the wind as an equivalent constant wind speed derived from F:
 * for drag mode we simply treat F (if windMode === 'force') as an extra
 * constant force on the body (F/m) in addition to drag, which still lets a
 * learner explore "drag + wind" together; dt = 0.002 s, stop when y <= 0.
 */
function simulateWithDrag({ v, theta, m, h, g, F, windMode, k }) {
  const dt = 0.002;
  const thetaRad = theta * DEG2RAD;
  let x = 0;
  let y = h;
  let vx = v * Math.cos(thetaRad);
  let vy = v * Math.sin(thetaRad);
  const a_wind = windMode === "acceleration" ? F : F / m;
  const points = [{ t: 0, x, y, vx, vy }];
  let t = 0;
  let tPeak = 0;
  let peakY = y;
  const maxSteps = 200000; // safety cap (~400s of simulated time)
  for (let i = 0; i < maxSteps; i++) {
    const speed = Math.sqrt(vx * vx + vy * vy);
    const dragAx = speed > 0 ? (-k * vx) / m : 0;
    const dragAy = speed > 0 ? (-k * vy) / m : 0;
    const ax = a_wind + dragAx;
    const ay = -g + dragAy;
    vx += ax * dt;
    vy += ay * dt;
    x += vx * dt;
    y += vy * dt;
    t += dt;
    if (y > peakY) {
      peakY = y;
      tPeak = t;
    }
    points.push({ t, x, y, vx, vy });
    if (y <= 0) break;
  }
  // Linear interpolation to the exact y = 0 crossing for a clean landing point.
  const n = points.length;
  if (n >= 2 && points[n - 1].y <= 0) {
    const p0 = points[n - 2];
    const p1 = points[n - 1];
    const frac = p0.y / (p0.y - p1.y);
    const landX = p0.x + frac * (p1.x - p0.x);
    const landT = p0.t + frac * (p1.t - p0.t);
    points[n - 1] = { t: landT, x: landX, y: 0, vx: p1.vx, vy: p1.vy };
  }
  const last = points[points.length - 1];
  return {
    points,
    T: round2(last.t),
    R: round2(last.x),
    H: round2(peakY),
    tPeak: round2(tPeak),
  };
}

/**
 * Generic simulator. Returns { points[], T, R, H, tPeak } with 2-decimal
 * rounded headline numbers but full-precision points for smooth drawing.
 * Uses closed-form kinematics when k === 0 (fast, exact); otherwise
 * numerically integrates (drag mode).
 *
 * Inputs: v (m/s), theta (deg), m (kg), h (m), g (m/s^2), F (N),
 * windMode ('force'|'acceleration'), k (drag coefficient, kg/s).
 */
export function simulate({ v, theta, m, h, g, F = 0, windMode = "force", k = 0 }) {
  if (k > 0) return simulateWithDrag({ v, theta, m, h, g, F, windMode, k });

  const thetaRad = theta * DEG2RAD;
  const vx0 = v * Math.cos(thetaRad);
  const vy0 = v * Math.sin(thetaRad);
  const a = windMode === "acceleration" ? F : F / m; // horizontal acceleration

  const T = timeOfFlight(vy0, h, g);
  const H = maxHeight(h, vy0, g);
  const tPeak = timeToPeak(vy0, g);
  const R = closedFormRange(vx0, a, T);

  // Sample points along the (possibly backward-landing) trajectory for the
  // canvas to draw. If a headwind sends the ball behind the launcher, x(t)
  // can go negative — we still sample and let the renderer handle it.
  const steps = 60;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = (T * i) / steps;
    const x = vx0 * t + 0.5 * a * t * t;
    const y = h + vy0 * t - 0.5 * g * t * t;
    const vxT = vx0 + a * t;
    const vyT = vy0 - g * t;
    points.push({ t, x, y: Math.max(y, 0), vx: vxT, vy: vyT });
  }

  return {
    points,
    T: round2(T),
    R: round2(R),
    H: round2(H),
    tPeak: round2(tPeak),
  };
}

/** Convenience: horizontal acceleration given F, m and wind mode. */
export function horizontalAcceleration(F, m, windMode) {
  return windMode === "acceleration" ? F : F / m;
}

// ---------------------------------------------------------------------------
// Self-tests — run automatically when this module loads, logged to console.
// These mirror the worked examples in the exam brief so a wrong refactor is
// caught immediately during a live viva edit.
// ---------------------------------------------------------------------------
function approxEqual(a, b, tol) {
  return Math.abs(a - b) <= tol;
}

function runSelfTests() {
  const results = [];

  // Level ground, v=20, theta=45 -> R ~= 40.82 m
  {
    const r = simulate({ v: 20, theta: 45, m: 1, h: 0, g: 9.8, F: 0 });
    results.push(["Level ground v=20 θ=45 → R≈40.82", approxEqual(r.R, 40.82, 0.05), r.R]);
  }

  // v=15, h=30, theta=45 -> R ~= 40.1 m
  {
    const r = simulate({ v: 15, theta: 45, m: 1, h: 30, g: 9.8, F: 0 });
    results.push(["v=15 h=30 θ=45 → R≈40.1", approxEqual(r.R, 40.1, 0.1), r.R]);
  }

  // theta* ~= 27.8°, R_max ~= 43.6 m  (v=15, h=30, g=9.8)
  {
    const opt = optimalAngleNoWind(15, 30, 9.8);
    results.push(["θ* for v=15,h=30 → ≈27.8°", approxEqual(opt.thetaDeg, 27.8, 0.3), opt.thetaDeg]);
    results.push(["R_max for v=15,h=30 → ≈43.6 m", approxEqual(opt.rMax, 43.6, 0.3), opt.rMax]);
  }

  // Wind self-tests: v=20, theta=45, h=0, F=+2N, m=1kg -> T≈2.886, R≈49.15
  {
    const r = simulate({ v: 20, theta: 45, m: 1, h: 0, g: 9.8, F: 2, windMode: "force" });
    results.push(["F=+2N m=1 → T≈2.886", approxEqual(r.T, 2.886, 0.01), r.T]);
    results.push(["F=+2N m=1 → R≈49.15", approxEqual(r.R, 49.15, 0.1), r.R]);
  }
  // same with m=5kg -> R≈42.49
  {
    const r = simulate({ v: 20, theta: 45, m: 5, h: 0, g: 9.8, F: 2, windMode: "force" });
    results.push(["F=+2N m=5 → R≈42.49", approxEqual(r.R, 42.49, 0.1), r.R]);
  }
  // F=-2N, m=1 -> R≈32.49
  {
    const r = simulate({ v: 20, theta: 45, m: 1, h: 0, g: 9.8, F: -2, windMode: "force" });
    results.push(["F=-2N m=1 → R≈32.49", approxEqual(r.R, 32.49, 0.1), r.R]);
  }
  // tailwind a=2 -> theta*≈50.8°, R_max≈50.0
  {
    const opt = optimalAngleWithWind(20, 0, 9.8, 2);
    results.push(["tailwind a=2 → θ*≈50.8°", approxEqual(opt.thetaDeg, 50.8, 0.3), opt.thetaDeg]);
    results.push(["tailwind a=2 → R_max≈50.0", approxEqual(opt.rMax, 50.0, 0.3), opt.rMax]);
  }
  // headwind a=-2 -> theta*≈39.2°
  {
    const opt = optimalAngleWithWind(20, 0, 9.8, -2);
    results.push(["headwind a=-2 → θ*≈39.2°", approxEqual(opt.thetaDeg, 39.2, 0.3), opt.thetaDeg]);
  }

  const allPass = results.every((r) => r[1]);
  // eslint-disable-next-line no-console
  console.groupCollapsed(
    `%cphysics.js self-tests: ${allPass ? "ALL PASS" : "SOME FAILED"}`,
    `color: ${allPass ? "green" : "red"}; font-weight: bold;`
  );
  results.forEach(([label, pass, value]) => {
    // eslint-disable-next-line no-console
    console.log(`${pass ? "✓" : "✗"} ${label} (got ${value})`);
  });
  console.groupEnd();
}

runSelfTests();
