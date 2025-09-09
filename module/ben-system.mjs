// systems/ben-system/module/ben-system.mjs

// Import document classes.
import { BenSystemActor } from './documents/actor.mjs';
import { BenSystemItem } from './documents/item.mjs';

// Import sheet classes.
import { BenSystemActorSheet } from './sheets/actor-sheet.mjs';
import { BenSystemItemSheet } from './sheets/item-sheet.mjs';

// NEW: per-type ability sheets
import {
  SkillCombatSheet, SkillCharismaSheet, SkillCraftingSheet, SkillMovementSheet,
  SkillPerceptionSheet, SkillStealthSheet, SpellSheet, RitualSheet, MusicSheet
} from './sheets/ability-base-sheet.mjs';

// Helpers & config
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
import { BEN_SYSTEM } from './helpers/config.mjs';
import './helpers/hbs-helpers.mjs';

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

// XP thresholds (unchanged example)
export const LEVEL_THRESHOLDS = (() => {
  const base = [
    0, 100, 300, 700, 1599, 3100, 6300, 12700,
    24500, 51100, 81100, 116100, 156100, 176100,
    196100, 216100, 246100, 276100, 316100, 356100,
    406100, 456100, 516100, 576100
  ];
  const thresholds = [...base];
  for (let L = thresholds.length; L < 250; L++) {
    const prevXP = thresholds[L - 1];
    const delta = 20000 + 10000 * Math.floor((L - 14) / 2);
    thresholds.push(prevXP + delta);
  }
  return thresholds;
})();

Hooks.once('init', function () {
  // Convenience
  game.bensystem = {
    BenSystemActor,
    BenSystemItem,
    rollItemMacro,
  };

  CONFIG.BEN_SYSTEM = BEN_SYSTEM;

  // Initiative
  CONFIG.Combat.initiative = {
    formula: '1d20 + @abilities.dex.mod',
    decimals: 2,
  };

  // Documents
  CONFIG.Actor.documentClass = BenSystemActor;
  CONFIG.Item.documentClass  = BenSystemItem;

  // AE legacy (keep off)
  CONFIG.ActiveEffect.legacyTransferral = false;

  // Sheets
  Actors.unregisterSheet('core', ActorSheet);
  Actors.registerSheet('ben-system', BenSystemActorSheet, {
    makeDefault: true,
    label: 'BEN_SYSTEM.SheetLabels.Actor',
  });

  Items.unregisterSheet('core', ItemSheet);

  // Ability item sheets (NEW)
  Items.registerSheet('ben-system', SkillCombatSheet,     { types: ['skillCombat'],     makeDefault: true });
  Items.registerSheet('ben-system', SkillCharismaSheet,   { types: ['skillCharisma'],   makeDefault: true });
  Items.registerSheet('ben-system', SkillCraftingSheet,   { types: ['skillCrafting'],   makeDefault: true });
  Items.registerSheet('ben-system', SkillMovementSheet,   { types: ['skillMovement'],   makeDefault: true });
  Items.registerSheet('ben-system', SkillPerceptionSheet, { types: ['skillPerception'], makeDefault: true });
  Items.registerSheet('ben-system', SkillStealthSheet,    { types: ['skillStealth'],    makeDefault: true });

  Items.registerSheet('ben-system', SpellSheet,  { types: ['spell'],  makeDefault: true });
  Items.registerSheet('ben-system', RitualSheet, { types: ['ritual'], makeDefault: true });
  Items.registerSheet('ben-system', MusicSheet,  { types: ['music'],  makeDefault: true });

  // Everything else uses the general item sheet
  Items.registerSheet('ben-system', BenSystemItemSheet, {
    types: [
      'item','achievement','armour','statuseffect','book','race','class','benefit','benefitresist','curse','lootbox',
      'weapon','ammo','consumable','potion','gear','medical','transport','spellbook','drugs','currency','garbage',
      'componant','explosive','magicitem','scroll','trap'
    ],
    makeDefault: true,
    label: 'BEN_SYSTEM.SheetLabels.Item',
  });

  // Preload templates
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  AE: Toggle / grant helpers (kept from your setup) */
/* -------------------------------------------- */
Hooks.on("updateItem", async (item, changes) => {
  if (!item.parent) return;
  const flat = foundry.utils.flattenObject(changes);
  if (!("system.equipped" in flat)) return;

  const equipped = !!foundry.utils.getProperty(item, "system.equipped");

  const effs = Array.from(item.effects.values());
  if (!effs.length) return;

  const updates = effs
    .filter(e => e)
    .map(e => {
      const shouldBeDisabled = !equipped;
      const patch = { _id: e.id };
      if (e.transfer !== true) patch.transfer = true;
      if (e.disabled !== shouldBeDisabled) patch.disabled = shouldBeDisabled;
      return patch;
    })
    .filter(p => Object.keys(p).length > 1);

  if (updates.length) {
    await item.updateEmbeddedDocuments("ActiveEffect", updates);
  }

  item.sheet?.render(false);
  item.parent?.sheet?.render(false);
});

Hooks.on("updateItem", async (item, changes) => {
  console.log("updateItem fired", item.name, changes, item.system?.equipped);
});

/* ---------------- Grant Items via AE (unchanged helpers) ---------------- */

const GRANT_KEY = "flags.ben-system.grantItems";
function _owningActorOf(doc) {
  if (!doc) return null;
  if (doc instanceof Actor) return doc;
  if (doc.parent instanceof Actor) return doc.parent;
  if (doc.parent?.parent instanceof Actor) return doc.parent.parent;
  return null;
}
function _isEffectActiveForActor(effect) {
  const actor = _owningActorOf(effect);
  if (!actor) return false;
  if (effect.parent instanceof Item && effect.transfer !== true) return false;
  return !effect.disabled;
}
function _parseGrantList(value) {
  if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof value === "string") {
    try {
      const asJSON = JSON.parse(value);
      if (Array.isArray(asJSON)) return asJSON.map(String).map(s => s.trim()).filter(Boolean);
    } catch {}
    return value.split(",").map(s => s.trim()).filter(Boolean);
  }
  return [];
}
function _grantListFromEffect(effect) {
  const change = (effect.changes ?? []).find(c => String(c?.key) === GRANT_KEY);
  if (!change) return [];
  return _parseGrantList(change.value);
}
async function _ensureGrantedItems(effect) {
  if (!_isEffectActiveForActor(effect)) return;
  const actor = _owningActorOf(effect);
  const uuids = _grantListFromEffect(effect);
  if (!uuids.length) return;

  const already = new Set(
    actor.items
      .filter(i => foundry.utils.getProperty(i, "flags.ben-system.grantedBy") === effect.uuid)
      .map(i => i.flags?.["ben-system"]?.grantedSrc ?? i.name)
  );

  const toCreate = [];
  for (const uuid of uuids) {
    try {
      const src = await fromUuid(uuid);
      if (!src || src.documentName !== "Item") continue;

      const signature = uuid;
      if (already.has(signature)) continue;

      const data = src.toObject();
      delete data._id;
      data.flags ??= {};
      data.flags["ben-system"] ??= {};
      data.flags["ben-system"].grantedBy = effect.uuid;
      data.flags["ben-system"].grantedSrc = uuid;

      toCreate.push(data);
    } catch (err) {
      console.warn(`[ben-system] Could not resolve grant UUID: ${uuid}`, err);
    }
  }

  if (toCreate.length) {
    await actor.createEmbeddedDocuments("Item", toCreate);
  }
}
async function _revokeGrantedItems(effect) {
  const actor = _owningActorOf(effect);
  if (!actor) return;
  const ids = actor.items
    .filter(i => foundry.utils.getProperty(i, "flags.ben-system.grantedBy") === effect.uuid)
    .map(i => i.id);
  if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
}
Hooks.on("createActiveEffect", async (effect) => {
  if (!_grantListFromEffect(effect).length) return;
  await _ensureGrantedItems(effect);
});
Hooks.on("updateActiveEffect", async (effect, changes) => {
  if (!_grantListFromEffect(effect).length) return;
  const flat = foundry.utils.flattenObject(changes);
  if (Object.keys(flat).some(k => k.startsWith("changes"))) {
    await _revokeGrantedItems(effect);
    await _ensureGrantedItems(effect);
    return;
  }
  if ("disabled" in flat) {
    if (flat.disabled === true) await _revokeGrantedItems(effect);
    else await _ensureGrantedItems(effect);
  }
  if ("transfer" in flat) {
    if (effect.transfer !== true) await _revokeGrantedItems(effect);
    else await _ensureGrantedItems(effect);
  }
});
Hooks.on("deleteActiveEffect", async (effect) => {
  await _revokeGrantedItems(effect);
});

/* -------------------------------------------- */
/*  Handlebars helper (kept)                    */
/* -------------------------------------------- */
Handlebars.registerHelper('toLowerCase', function (str) {
  return String(str ?? '').toLowerCase();
});

/* -------------------------------------------- */
/*  Ready hooks / macros (kept from your file)  */
/* -------------------------------------------- */
Hooks.once('ready', function () {
  Hooks.on('hotbarDrop', (bar, data, slot) => createItemMacro(data, slot));

  (async () => {
    for (const actor of game.actors) {
      for (const ef of actor.effects) {
        if (_grantListFromEffect(ef).length) await _ensureGrantedItems(ef);
      }
      for (const it of actor.items) {
        for (const ef of it.effects) {
          if (_grantListFromEffect(ef).length) await _ensureGrantedItems(ef);
        }
      }
    }
  })();
});

async function createItemMacro(data, slot) {
  if (data.type !== 'Item') return;
  if (!data.uuid.includes('Actor.') && !data.uuid.includes('Token.')) {
    return ui.notifications.warn('You can only create macro buttons for owned Items');
  }
  const item = await Item.fromDropData(data);
  const command = `game.bensystem.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find((m) => m.name === item.name && m.command === command);
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: 'script',
      img: item.img,
      command: command,
      flags: { 'ben-system.itemMacro': true },
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}
function rollItemMacro(itemUuid) {
  const dropData = { type: 'Item', uuid: itemUuid };
  Item.fromDropData(dropData).then((item) => {
    if (!item || !item.parent) {
      const itemName = item?.name ?? itemUuid;
      return ui.notifications.warn(`Could not find item ${itemName}. You may need to delete and recreate this macro.`);
    }
    item.roll();
  });
}
