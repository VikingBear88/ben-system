// systems/ben-system/module/helpers/progression.mjs

/**
 * Compute a preview/derived level from total uses.
 * Simple, safe curve:
 *  - Each level n (starting at 1) roughly requires (n-1)^2 * factor uses.
 *  - flat is an additive shift to the level after the sqrt curve.
 *  - Result is clamped to [1, cap] (default cap=15).
 */
export function computeLevelFromUses(uses = 0, factor = 1, flat = 0, cap = 15) {
  const U  = Math.max(0, Number(uses)   || 0);
  const F  = Math.max(0.0001, Number(factor) || 1);
  const FL = Number(flat) || 0;

  // invert the quadratic: level ≈ floor(sqrt(U/F)) + 1 (+ flat)
  const lvl = Math.floor(Math.sqrt(U / F)) + 1 + FL;
  return Math.max(1, Math.min(cap ?? 15, lvl));
}

/**
 * Clamp the *effective* level after adding bonuses.
 * If unlock20=false, the cap is 15 regardless of max.
 * If unlock20=true, cap is min(20, max).
 */
export function clampEffectiveLevel(total, unlock20 = false, max = 20) {
  const cap = unlock20 ? Math.min(20, Number(max) || 20) : Math.min(15, Number(max) || 15);
  const t   = Number(total) || 1;
  return Math.max(1, Math.min(cap, t));
}

/**
 * Utility to add uses to a progress block.
 * Returns a new progress object (does not mutate input).
 */
export function addUsesToProgress(progress = {}, inc = 1) {
  const p = {
    uses:        Number(progress?.uses ?? 0),
    initialUses: Number(progress?.initialUses ?? 0),
    factor:      Number(progress?.factor ?? 1),
    flat:        Number(progress?.flat ?? 0)
  };
  p.uses = Math.max(0, p.uses + (Number(inc) || 0));
  return p;
}
