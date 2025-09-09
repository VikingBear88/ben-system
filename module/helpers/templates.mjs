// systems/ben-system/module/helpers/templates.mjs
export const preloadHandlebarsTemplates = async function () {
  return loadTemplates([
    // Actor partials.
    'systems/ben-system/templates/actor/parts/actor-stats.hbs',
    'systems/ben-system/templates/actor/parts/actor-stats-statstotals.hbs',
    'systems/ben-system/templates/actor/parts/actor-stats-statsbreakdowns.hbs',
    'systems/ben-system/templates/actor/parts/actor-stats-offensive.hbs',
    'systems/ben-system/templates/actor/parts/actor-stats-defensive.hbs',
    'systems/ben-system/templates/actor/parts/actor-stats-race.hbs',
    'systems/ben-system/templates/actor/parts/actor-stats-miscstats.hbs',
    'systems/ben-system/templates/actor/parts/actor-stats-movement.hbs',
    'systems/ben-system/templates/actor/parts/actor-stats-resistances.hbs',
    'systems/ben-system/templates/actor/parts/actor-stats-history.hbs',
    'systems/ben-system/templates/actor/parts/actor-inventory.hbs',
    'systems/ben-system/templates/actor/parts/actor-spells.hbs',
    'systems/ben-system/templates/actor/parts/actor-skills.hbs',
    'systems/ben-system/templates/actor/parts/actor-equipped.hbs',
    'systems/ben-system/templates/actor/parts/actor-health.hbs',
    'systems/ben-system/templates/actor/parts/actor-ratings.hbs',
    'systems/ben-system/templates/actor/parts/actor-inventory-achievements.hbs',
    'systems/ben-system/templates/actor/parts/actor-inventory-consumables.hbs',
    'systems/ben-system/templates/actor/parts/actor-inventory-potions.hbs',
    'systems/ben-system/templates/actor/parts/actor-inventory-equippables.hbs',
    'systems/ben-system/templates/actor/parts/actor-inventory-gear.hbs',
    'systems/ben-system/templates/actor/parts/actor-inventory-crafting.hbs',
    'systems/ben-system/templates/actor/parts/actor-inventory-garbage.hbs',
    'systems/ben-system/templates/actor/parts/actor-inventory-currency.hbs',
    'systems/ben-system/templates/actor/parts/actor-inventory-lootboxes.hbs',

    // Item partials
    'systems/ben-system/templates/item/parts/item-effects.hbs',

    // NEW ability item sheets
    'systems/ben-system/templates/item/item-skill-combat-sheet.hbs',
    'systems/ben-system/templates/item/item-skill-generic-sheet.hbs',
    'systems/ben-system/templates/item/item-spelllike-sheet.hbs'
  ]);
};
