// systems/ben-system/module/helpers/config.mjs
export const BEN_SYSTEM = {
  ACTION_TYPES: ['standard', 'bonus', 'free'],

  WEAPON_TYPES: [
    'ThrownAmmo','ThrownWeapon','Sling','1hCrossbow','Bow','Blowgun','Crossbow','HeavyRange','Siege','Spray','Whip',
    'LightPiercing','LightBludgeoning','LightSlashing','MediumPiercing','MediumBludgeoning','MediumSlashing',
    'HeavyPiercing','HeavyBludgeoning','HeavySlashing','Unarmed',
    'MagicAcid','Explosive','MagicCold','MagicFire','MagicForce','MagicLightning','MagicNecrotic','MagicPoison','MagicPsychic','MagicRadiant','MagicSonic'
  ],

  DAMAGE_TYPES: [
    'none','Acid','Bludgeoning','Cold','Fire','Force','Lightning','Necrotic','Piercing','Poison','Psychic','Radiant','Slashing','Sonic'
  ],

  SPELL_SOURCES: ['Acid','Cold','Fire','Force','Lightning','Necrotic','Poison','Psychic','Radiant','Sonic']
};



/**
 * The set of Ability Scores used within the system.
 * @type {Object}
 */
BEN_SYSTEM.abilities = {
  str: 'BEN_SYSTEM.Ability.Str.long',
  dex: 'BEN_SYSTEM.Ability.Dex.long',
  con: 'BEN_SYSTEM.Ability.Con.long',
  int: 'BEN_SYSTEM.Ability.Int.long',
  wis: 'BEN_SYSTEM.Ability.Wis.long',
  cha: 'BEN_SYSTEM.Ability.Cha.long',
};

BEN_SYSTEM.abilityAbbreviations = {
  str: 'BEN_SYSTEM.Ability.Str.abbr',
  dex: 'BEN_SYSTEM.Ability.Dex.abbr',
  con: 'BEN_SYSTEM.Ability.Con.abbr',
  int: 'BEN_SYSTEM.Ability.Int.abbr',
  wis: 'BEN_SYSTEM.Ability.Wis.abbr',
  cha: 'BEN_SYSTEM.Ability.Cha.abbr',
};
