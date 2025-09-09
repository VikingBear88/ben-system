// helpers/offense.mjs
import { BEN_SYSTEM } from "./config.mjs";

export function findOffenseRow(actor, weaponTypeName) {
  const rows = actor.system?.offense?.attacks ?? [];
  const idx = rows.findIndex(r => (r?.name || "").toLowerCase() === (weaponTypeName || "").toLowerCase());
  return rows[Math.max(0, idx)];
}

export function getWeaponProfile(actor, weaponTypeName) {
  const r = findOffenseRow(actor, weaponTypeName) ?? {};
  const safe = (x)=>Number(x ?? 0);
  return {
    hit: safe(r.hit),
    dmg: {
      acid: safe(r.dmg_acid), bludgeoning: safe(r.dmg_bludgeoning), cold: safe(r.dmg_cold),
      fire: safe(r.dmg_fire), force: safe(r.dmg_force), lightning: safe(r.dmg_lightning),
      necrotic: safe(r.dmg_necrotic), piercing: safe(r.dmg_piercing), poison: safe(r.dmg_poison),
      psychic: safe(r.dmg_psychic), radiant: safe(r.dmg_radiant), slashing: safe(r.dmg_slashing),
      sonic: safe(r.dmg_sonic)
    },
    status: {
      crit: safe(r.status?.crit ?? 20),
      stun: safe(r.status?.stun ?? 99),
      bleed: safe(r.status?.bleed ?? 99),
      burn: safe(r.status?.burn ?? 99),
      mute: safe(r.status?.mute ?? 99),
      poison: safe(r.status?.poison ?? 99),
      petrified: safe(r.status?.petrified ?? 99),
      sleep: safe(r.status?.sleep ?? 99),
      slow: safe(r.status?.slow ?? 99),
      parry: safe(r.status?.parry ?? 99),
      stunBy: safe(r.status?.stunBy ?? 99),
      pierce: safe(r.status?.pierce ?? 99)
    }
  };
}
