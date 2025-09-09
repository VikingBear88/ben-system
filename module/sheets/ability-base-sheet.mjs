// systems/ben-system/module/sheets/ability-base-sheet.mjs
import { BEN_SYSTEM } from '../helpers/config.mjs';
import { computeLevelFromUses, clampEffectiveLevel } from '../helpers/progression.mjs';

const isNil = (v) => v === undefined || v === null || v === '';

/** Minimal cleaner (since foundry.utils.cleanObject may not exist in your build) */
function cleanObjectLite(obj) {
  if (Array.isArray(obj)) {
    return obj.map(cleanObjectLite).filter((v) => v !== undefined);
  }
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined) continue;
      const c = cleanObjectLite(v);
      if (c !== undefined) out[k] = c;
    }
    // remove empty objects
    return Object.keys(out).length ? out : undefined;
  }
  return obj;
}

/** Base sheet for all ability-like items (skills & spells) */
export class AbilityBaseSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['ben-system','sheet','item'],
      width: 640,
      height: 580,
      submitOnChange: true,
      tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'details' }]
    });
  }

  get template() {
    // This base is abstract; subclasses below define their own template.
    return super.template;
  }

  async getData(options) {
    const ctx = await super.getData(options);
    ctx.cfg = BEN_SYSTEM;

    ctx.isSkillCombat = this.item.type === 'skillCombat';
    ctx.isGenericSkill = ['skillCharisma','skillCrafting','skillMovement','skillPerception','skillStealth'].includes(this.item.type);
    ctx.isSpellish    = ['spell','ritual','music'].includes(this.item.type);

    const s = ctx.item.system ?? {};
    const base  = Number(s.level?.base ?? 1);
    const bonus = Number(s.level?.bonus ?? 0);
    const max   = Number(s.level?.max ?? 20);
    const unlock20 = !!s.level?.unlock20;

    ctx.levels = {
      base, bonus,
      eff: clampEffectiveLevel(base + bonus, unlock20, max),
      cap: unlock20 ? Math.min(20, max) : 15
    };

    // preview uses -> level (uses factor & flat if present)
    const totalUses = Number(s.progress?.initialUses ?? 0) + Number(s.progress?.uses ?? 0);
    const factor    = Number(s.progress?.factor ?? 1);
    const flat      = Number(s.progress?.flat ?? 0);
    ctx.previewLevel = computeLevelFromUses(totalUses, factor, flat, 15);

    return ctx;
  }

  async _updateObject(event, formData) {
    const incoming = foundry.utils.expandObject(formData);
    const current  = foundry.utils.duplicate(this.object.system ?? {});
    const next = foundry.utils.mergeObject(
      current,
      normalizeAbilityDelta(incoming, this.item.type, this.form),
      { inplace: false, overwrite: true, insertKeys: true }
    );

    const patch = { system: next };
    if (this.object.system?.system) patch['system.-=system'] = null; // safety for legacy nested junk
    return this.object.update(patch);
  }
}

function normalizeAbilityDelta(incoming, type, form) {
  const domVal = (name) => form?.querySelector?.(`[name="${name}"]`)?.value;
  const toNum  = (v) => (isNil(v) || v === '') ? undefined : Number(v);
  const toBool = (v) => !!v;

  const out = { actions:{}, cooldown:{}, level:{}, progress:{} };

  // Actions
  const aType = domVal('system.actions.type') ?? incoming?.system?.actions?.type;
  if (!isNil(aType)) out.actions.type = String(aType);
  const aQty  = toNum(incoming?.system?.actions?.qty);
  if (aQty !== undefined) out.actions.qty = aQty;

  // Cooldown
  const cd = toNum(incoming?.system?.cooldown?.turns);
  if (cd !== undefined) out.cooldown.turns = cd;

  // Level
  const lvBase = toNum(incoming?.system?.level?.base);
  if (lvBase !== undefined) out.level.base = lvBase;
  const lvBonus = toNum(incoming?.system?.level?.bonus);
  if (lvBonus !== undefined) out.level.bonus = lvBonus;
  const lvMax = toNum(incoming?.system?.level?.max);
  if (lvMax !== undefined) out.level.max = lvMax;
  if ('unlock20' in (incoming?.system?.level ?? {}))
    out.level.unlock20 = toBool(incoming.system.level.unlock20);

  // Progress
  const pu = toNum(incoming?.system?.progress?.uses);
  if (pu !== undefined) out.progress.uses = pu;
  const pi = toNum(incoming?.system?.progress?.initialUses);
  if (pi !== undefined) out.progress.initialUses = pi;
  const pf = toNum(incoming?.system?.progress?.factor);
  if (pf !== undefined) out.progress.factor = pf;
  const pflat = toNum(incoming?.system?.progress?.flat);
  if (pflat !== undefined) out.progress.flat = pflat;

  // Description / tags
  if ('description' in (incoming?.system ?? {})) out.description = String(incoming.system.description ?? '');
  if ('tags' in (incoming?.system ?? {}))        out.tags = String(incoming.system.tags ?? '');

  // Combat skills
  if (type === 'skillCombat') {
    out.combat ??= {};
    const wType = domVal('system.combat.weaponType') ?? incoming?.system?.combat?.weaponType;
    if (!isNil(wType)) out.combat.weaponType = String(wType);
    let dType = domVal('system.combat.damageType') ?? incoming?.system?.combat?.damageType;
    if (!isNil(dType)) out.combat.damageType = String(dType).toLowerCase();
    const hmod = toNum(incoming?.system?.combat?.hitMod);
    if (hmod !== undefined) out.combat.hitMod = hmod;
  }

  // Spells / Rituals / Music
  if (['spell','ritual','music'].includes(type)) {
    out.spell ??= {};
    const mana = toNum(incoming?.system?.spell?.manaCost);
    if (mana !== undefined) out.spell.manaCost = mana;
    const src = incoming?.system?.spell?.source;
    if (!isNil(src)) out.spell.source = String(src);
    const vs = incoming?.system?.spell?.vs;
    if (!isNil(vs)) out.spell.vs = String(vs);
  }

  // Return a cleaned structure so we don't write "undefined" leaves.
  return cleanObjectLite(out) ?? {};
}

/* ----- Thin per-type sheets that point to their templates ----- */
export class SkillCombatSheet     extends AbilityBaseSheet { get template(){ return 'systems/ben-system/templates/item/item-skill-combat-sheet.hbs'; } }
export class SkillCharismaSheet   extends AbilityBaseSheet { get template(){ return 'systems/ben-system/templates/item/item-skill-generic-sheet.hbs'; } }
export class SkillCraftingSheet   extends AbilityBaseSheet { get template(){ return 'systems/ben-system/templates/item/item-skill-generic-sheet.hbs'; } }
export class SkillMovementSheet   extends AbilityBaseSheet { get template(){ return 'systems/ben-system/templates/item/item-skill-generic-sheet.hbs'; } }
export class SkillPerceptionSheet extends AbilityBaseSheet { get template(){ return 'systems/ben-system/templates/item/item-skill-generic-sheet.hbs'; } }
export class SkillStealthSheet    extends AbilityBaseSheet { get template(){ return 'systems/ben-system/templates/item/item-skill-generic-sheet.hbs'; } }
export class SpellSheet           extends AbilityBaseSheet { get template(){ return 'systems/ben-system/templates/item/item-spelllike-sheet.hbs'; } }
export class RitualSheet          extends AbilityBaseSheet { get template(){ return 'systems/ben-system/templates/item/item-spelllike-sheet.hbs'; } }
export class MusicSheet           extends AbilityBaseSheet { get template(){ return 'systems/ben-system/templates/item/item-spelllike-sheet.hbs'; } }
