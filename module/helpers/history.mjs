// helpers/history.mjs
import { BEN_SYSTEM } from "./config.mjs";

/** Very small adapter: set your exact paths here if autodetect fails. */
function getHPRef(actor) {
  for (const p of BEN_SYSTEM.HP_PATHS_TRY) {
    const v = foundry.utils.getProperty(actor, p);
    if (typeof v === "number") return { path: p, value: v };
  }
  // Fallback: do nothing (no crash)
  return null;
}

export async function applyDamage(actor, amount) {
  const hp = getHPRef(actor);
  if (!hp) return;
  const cur = foundry.utils.getProperty(actor, hp.path) ?? 0;
  await actor.update({ [hp.path]: Math.max(0, cur - Math.max(0, amount)) });
}

/** You already have a History table. Wire these to your real keys later if different. */
export async function addDamageDone(actor, dmgType, amount) {
  const key = `system.history.damageDone.${dmgType}`;
  const cur = Number(foundry.utils.getProperty(actor, key) ?? 0);
  await actor.update({ [key]: cur + Number(amount || 0) });
}

export async function addDamageTaken(actor, dmgType, amount) {
  const key = `system.history.damageTaken.${dmgType}`;
  const cur = Number(foundry.utils.getProperty(actor, key) ?? 0);
  await actor.update({ [key]: cur + Number(amount || 0) });
}
