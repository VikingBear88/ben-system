// module/workflows/use-ability.mjs
import { BEN_SYSTEM } from '../helpers/config.mjs';
import { getWeaponProfile } from '../helpers/offense.mjs';
import { addDamageDone, addDamageTaken, applyDamage } from '../helpers/history.mjs';
import { addUses, clampEffectiveLevel } from '../helpers/progression.mjs';
import { UseAbilityDialog } from './use-ability-dialog.mjs';

function nat(roll) { return roll?.terms?.[0]?.results?.[0]?.result ?? roll.result; }

export async function useAbility(actor, item) {
  if (!actor || !item) return;

  const isCombatSkill = (item.type === "skill-combat");
  const isSpell = (item.type === "spell" || item.type === "ritual" || item.type === "music");

  const dlg = await UseAbilityDialog.prompt({ item, actor, isSpell, isCombatSkill });
  if (!dlg) return;

  const { advantage, disadvantage, sitMod, targets, multiCount, increment, countAsOne, ignoreCost } = dlg;

  // Effective level
  const s = item.system || {};
  const base = Number(s.level?.base ?? 1);
  const bonus = Number(s.level?.bonus ?? 0);
  const effLevel = clampEffectiveLevel(base + bonus, !!s.level?.unlock20, s.level?.max ?? 20);

  // Build weapon/damage context
  let hitMod = 0;
  let dmgMult = 1.0;

  // Weapon profile name (exact labels for weapon types; spells use Magic{Source})
  let weaponRowName = s.combat?.weaponType || (isSpell ? `Magic${s.spell?.source ?? ''}` : null);

  // Stored damage type uses config’s case; make a lower-case key only for table lookups.
  let storedDmgType = isCombatSkill
    ? (s.combat?.damageType || 'None')
    : (isSpell ? (s.spell?.source || 'Radiant') : 'None');

  const dmgKey = String(storedDmgType).toLowerCase();

  if (weaponRowName) {
    const profile = getWeaponProfile(actor, weaponRowName);
    hitMod += Number(profile.hit || 0);
    const mult = Number(profile.dmg?.[dmgKey] ?? 0); // table keys are lower-case
    dmgMult += mult; // decimal multipliers (e.g., 0.10)
  }

  if (isCombatSkill) hitMod += Number(s.combat?.hitMod ?? 0);

  // d20 (adv/dis)
  const rolls = [];
  const r1 = await (new Roll("1d20")).evaluate({async:true}); rolls.push(r1);
  if (advantage || disadvantage) {
    const r2 = await (new Roll("1d20")).evaluate({async:true}); rolls.push(r2);
  }
  if (game.dice3d) for (const r of rolls) await game.dice3d.showForRoll(r);

  const d20nat = (advantage ? Math.max(...rolls.map(nat)) : (disadvantage ? Math.min(...rolls.map(nat)) : nat(r1)));
  const totalToHit = d20nat + effLevel + hitMod + Number(sitMod || 0);

  // Mana cost
  if (isSpell && !ignoreCost) {
    const cur = Number(actor.system?.mana?.value ?? 0);
    const cost = Number(s.spell?.manaCost ?? 0);
    if (cost > 0 && cur < cost) ui.notifications.warn(`Not enough mana (${cur}/${cost}).`);
    await actor.update({ "system.mana.value": Math.max(0, cur - cost) });
  }

  // Placeholder damage formula (replace with your real formula if you wish)
  const dmgRoll = await (new Roll("1d6")).evaluate({async:true});
  if (game.dice3d) await game.dice3d.showForRoll(dmgRoll);

  // Crit
  const profile = weaponRowName ? getWeaponProfile(actor, weaponRowName) : { status: { crit: 20 } };
  const crit = d20nat >= Number(profile.status?.crit ?? 20);

  let rolledDmg = Number(dmgRoll.total || 0);
  let maxDmg = dmgRoll.terms?.[0]?.faces || 6;
  let finalDmg = (crit ? (rolledDmg + maxDmg) : rolledDmg);
  finalDmg = finalDmg * Math.max(0, dmgMult);

  // Multi-target/multi-use total
  const totalInstances = Math.max(1, Number(multiCount || 1));
  const totalDamage = finalDmg * totalInstances;

  // Chat card
  const chatData = {
    user: game.user.id, speaker: ChatMessage.getSpeaker({ actor }),
    content: await renderTemplate("systems/ben-system/templates/chat/ability-card.hbs", {
      item, actor, d20nat, effLevel, hitMod, sitMod, totalToHit, dmgType: dmgKey, crit, finalDmg, totalInstances, totalDamage
    })
  };
  await ChatMessage.create(chatData);

  // Apply to targets if any
  const tgts = Array.from(game.user?.targets ?? []);
  if (tgts.length) {
    for (const t of tgts) {
      await applyDamage(t.actor, totalDamage);
      await addDamageTaken(t.actor, dmgKey, totalDamage);
    }
    await addDamageDone(actor, dmgKey, totalDamage);
  }

  // Increment uses
  if (increment) {
    const inc = countAsOne ? 1 : Math.max(1, totalInstances);
    const { system, leveledUp } = addUses(item, inc);
    await item.update({ system });
    if (leveledUp) await handleUnlocksOnLevelUp(actor, item);
  }
}

async function handleUnlocksOnLevelUp(actor, item) {
  const s = item.system || {};
  const base = Number(s.level?.base ?? 1);
  const unlocks = Array.from(s.unlocks ?? []);
  for (const u of unlocks) {
    if (!u?.lvl || !u?.uuid) continue;
    if (base >= Number(u.lvl)) {
      try {
        const doc = await fromUuid(u.uuid);
        if (doc) await actor.createEmbeddedDocuments("Item", [doc.toObject()]);
      } catch (err) { console.warn("Unlock grant failed", u, err); }
    }
  }
}
