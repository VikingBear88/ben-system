// module/documents/actor.mjs
import { LEVEL_THRESHOLDS } from "../ben-system.mjs";

/**
 * Extend the base Actor document.
 * @extends {Actor}
 */
export class BenSystemActor extends Actor {
  /** @override */
  prepareData() {
    super.prepareData();
  }

  /** @override */
  prepareBaseData() {
    super.prepareBaseData();

    // --- MISC STATS: always a clean array of { name: string, level: number } ---
    const sys = (this.system ??= {});
    sys.miscStats ??= {};

    let entries = sys.miscStats.entries ?? [];
    if (!Array.isArray(entries)) entries = Object.values(entries ?? {});

    const normalize = (r = {}) => ({
      name:  String(r?.name ?? ""),
      level: Number(r?.level ?? 0)
    });

    sys.miscStats.entries = entries.map(normalize);
    // ---------------------------------------------------------------------------
  }

  /**
   * @override
   * Augment the actor source data with additional dynamic data.
   */
  prepareDerivedData() {
    const actorData = this;
    const systemData = actorData.system;

    this._prepareCharacterData(actorData);
    this._prepareNpcData(actorData);
  }

  /**
   * Prepare Character type specific data
   */
  _prepareCharacterData(actorData) {
    if (actorData.type !== "character") return;

    const systemData = actorData.system;

    // Ensure structures exist
    systemData.attributes ??= {};
    systemData.abilities ??= {};

    // ---- Ability modifiers (guard if abilities is null) ----
    if (systemData.abilities && typeof systemData.abilities === "object") {
      for (let [key, ability] of Object.entries(systemData.abilities)) {
        if (!ability) continue;
        ability.mod = Math.floor(((ability.value ?? 10) - 10) / 2);
      }
    }

    // ---- XP → Level + progress (tolerate either path) ----
    const xp =
      foundry.utils.getProperty(systemData, "attributes.xp.value") ??
      foundry.utils.getProperty(systemData, "xp.value") ??
      0;

    // Determine current level (thresholds are cumulative XP at level start)
    let level = 1;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (xp >= LEVEL_THRESHOLDS[i]) { level = i + 1; break; }
    }

    // Ensure level structure exists and write back the derived level
    if (!systemData.attributes.level) systemData.attributes.level = { value: 1 };
    systemData.attributes.level.value = level;

    // Build progress helpers for the sheet's XP bar
    const currStart = LEVEL_THRESHOLDS[level - 1] ?? 0;
    const nextStart = LEVEL_THRESHOLDS[level] ?? currStart; // same if max level
    const span = Math.max(1, nextStart - currStart);
    const pct = Math.clamp(Math.round(((xp - currStart) / span) * 100), 0, 100);

    systemData.xpProgress = {
      current: Math.max(0, xp - currStart),
      nextAt: nextStart,
      span,
      pct
    };

    // =======================================================================
    // Stats Breakdowns derived data
    // =======================================================================

    // 1) Make sure each ability has editable subfields with numeric defaults
    const STAT_KEYS = ["str", "dex", "con", "int", "cha"];
    for (const k of STAT_KEYS) {
      systemData.abilities[k] ??= {};
      const a = systemData.abilities[k];
      a.level = Number(a.level ?? 0);
      a.gear  = Number(a.gear  ?? 0);
      a.misc  = Number(a.misc  ?? 0);
      a.temp  = Number(a.temp  ?? 0);

      systemData.attributes[k] ??= {}; // ensure attribute container exists
    }

    // 2) Race Base from owned race items (supports .attributes.<stat>.base or .attributes.<stat>)
    const raceBase = { str:0, dex:0, con:0, int:0, cha:0 };
    const raceItems = this.items.filter(i => i.type === "race");
    for (const it of raceItems) {
      const a = it.system?.attributes ?? {};
      raceBase.str += Number(a.str?.base ?? a.str ?? 0);
      raceBase.dex += Number(a.dex?.base ?? a.dex ?? 0);
      raceBase.con += Number(a.con?.base ?? a.con ?? 0);
      raceBase.int += Number(a.int?.base ?? a.int ?? 0);
      raceBase.cha += Number(a.cha?.base ?? a.cha ?? 0);
    }

    // 3) Level Points
    const earned =
      Number(systemData.attributes?.level?.value ?? 0) * 3;
    const spent =
      Number(systemData.abilities.str?.level ?? 0) +
      Number(systemData.abilities.dex?.level ?? 0) +
      Number(systemData.abilities.con?.level ?? 0) +
      Number(systemData.abilities.int?.level ?? 0) +
      Number(systemData.abilities.cha?.level ?? 0);
    const remaining = Math.max(0, earned - spent);

    // 4) Expose helper for the sheet
    systemData.statsBreakdown = {
      raceBase,                         // {str,dex,con,int,cha}
      points: { earned, spent, remaining }
    };

    // 5) Compute per-stat TOTALS and a grand total for the "Stats Totals" tab
    let grandTotal = 0;
    for (const k of STAT_KEYS) {
      const base = Number(raceBase[k] ?? 0);
      const a = systemData.abilities[k] ?? {};
      const total =
        base +
        Number(a.level ?? 0) +
        Number(a.gear  ?? 0) +
        Number(a.misc  ?? 0) +
        Number(a.temp  ?? 0);

      systemData.attributes[k].value = total; // what the Totals tab shows
      grandTotal += total;
    }
    systemData.attributes.total = grandTotal;

    // =======================================================================
    // Defences (Physical AC, Magical AC, Health)
    // =======================================================================

    const D = systemData.defences ??= { physical: {}, magical: {}, health: {} };

    // Stored editable fields (so items can later modify them)
    D.physical.dexSkill ??= 0;
    D.physical.conSkill ??= 0;
    D.physical.gear     ??= 0;

    D.magical.intSkill  ??= 0;
    D.magical.chaSkill  ??= 0;
    D.magical.gear      ??= 0;

    D.health.benefit    ??= 0;
    D.health.gear       ??= 0;

    // Bases from Race for AC tables
    D.physical.baseDex = Number(raceBase.dex ?? 0);
    D.physical.baseCon = Number(raceBase.con ?? 0);
    D.magical .baseInt = Number(raceBase.int ?? 0);
    D.magical .baseCha = Number(raceBase.cha ?? 0);

    // Health: use computed total CON
    const totalCon = Number(systemData.attributes?.con?.value ?? 0);

    // Band-based HP modifier
    const hpMod = (() => {
      const c = totalCon;
      if (c <=  19) return 0.0;
      if (c <=  39) return 0.2;
      if (c <=  59) return 0.4;
      if (c <=  79) return 0.6;
      if (c <=  99) return 0.8;
      if (c <= 119) return 1.0;
      if (c <= 139) return 1.2;
      if (c <= 159) return 1.4;
      if (c <= 179) return 1.6;
      if (c <= 199) return 1.8;
      if (c <= 219) return 2.0;
      if (c <= 239) return 2.4;
      /* 240–250 */ return 4.0;
    })();

    const conSkillBonus = totalCon * hpMod;

    D.health.totalCon      = totalCon;
    D.health.hpMod         = hpMod;
    D.health.conSkillBonus = conSkillBonus;

    // =======================================================================
    // Header totals (Health max, Mana max, Physical/Magical AC)
    // =======================================================================

    // Health max = Total CON + CON Skill Bonus
    const totalConHdr = Number(systemData.defences?.health?.totalCon ?? 0);
    const conSkillBonusHdr = Number(systemData.defences?.health?.conSkillBonus ?? 0);
    systemData.health ??= {};
    systemData.health.max = totalConHdr + conSkillBonusHdr;

    // Mana max = Total INT
    const totalIntHdr = Number(systemData.attributes?.int?.value ?? 0);
    systemData.mana ??= {};
    systemData.mana.max = totalIntHdr;

    // Physical AC = Base DEX + DEX Skill + Base CON + CON Skill + Gear
    const P = systemData.defences?.physical ?? {};
    const physicalACTotal =
      Number(P.baseDex ?? 0) +
      Number(P.dexSkill ?? 0) +
      Number(P.baseCon ?? 0) +
      Number(P.conSkill ?? 0) +
      Number(P.gear ?? 0);

    // Magical AC = Base INT + INT Skill + Base CHA + CHA Skill + Gear
    const M = systemData.defences?.magical ?? {};
    const magicalACTotal =
      Number(M.baseInt ?? 0) +
      Number(M.intSkill ?? 0) +
      Number(M.baseCha ?? 0) +
      Number(M.chaSkill ?? 0) +
      Number(M.gear ?? 0);

    // Write to the fields the header binds to
    systemData.pac ??= { value: 0 };
    systemData.mac ??= { value: 0 };
    systemData.pac.value = physicalACTotal;
    systemData.mac.value = magicalACTotal;

    // =======================================================================
    // Movement (Walking & Swimming)
    // =======================================================================

    systemData.movement ??= { walk: {}, swim: {} };
    const MV = systemData.movement;

    // Editable benefits (so items can modify later)
    MV.walk.benefit ??= 0;
    MV.swim.benefit ??= 0;

    // Collect race movement levels (supports .movement.walking.level / .movement.swimming.level)
    const raceMove = this.items
      .filter(i => i.type === "race")
      .map(i => i.system?.movement ?? {});

    const walkLvl = raceMove.reduce((n, m) => n + Number(m.walking?.level ?? m.walk ?? 0), 0);
    const swimLvl = raceMove.reduce((n, m) => n + Number(m.swimming?.level ?? m.swim ?? 0), 0);

    MV.walk.level = walkLvl;
    MV.swim.level = swimLvl;

    // Base speed = level * 10
    MV.walk.base = walkLvl * 10;
    MV.swim.base = swimLvl * 10;

    // DEX banding from TOTAL DEX
    const totalDex = Number(systemData.attributes?.dex?.value ?? 0);
    const dexBoostFrom = (dex) => {
      if (dex <=   9) return   0;
      if (dex <=  19) return  10;
      if (dex <=  29) return  20;
      if (dex <=  39) return  30;
      if (dex <=  49) return  40;
      if (dex <=  59) return  50;
      if (dex <=  69) return  60;
      if (dex <=  79) return  70;
      if (dex <=  89) return  80;
      if (dex <=  99) return  90;
      if (dex <= 109) return 100;
      return 100; // cap as per spec
    };

    MV.walk.dexBoost = dexBoostFrom(totalDex);
    MV.swim.dexBoost = dexBoostFrom(totalDex);

    // Totals
    MV.walk.total = Number(MV.walk.base ?? 0) + Number(MV.walk.dexBoost ?? 0) + Number(MV.walk.benefit ?? 0);
    MV.swim.total = Number(MV.swim.base ?? 0) + Number(MV.swim.dexBoost ?? 0) + Number(MV.swim.benefit ?? 0);

    // Mirror into header fields
    systemData.walkspeed ??= { value: 0 };
    systemData.swimspeed ??= { value: 0 };
    systemData.walkspeed.value = MV.walk.total;
    systemData.swimspeed.value = MV.swim.total;

    // Back-compat if your header still reads attributes.swimspeed.value
    if (systemData.attributes?.swimspeed) {
      systemData.attributes.swimspeed.value = MV.swim.total;
    }

    // =======================================================================
    // Stats Vault (attributes table)
    // =======================================================================

    // 1) Default names list
    const VAULT_DEFAULT_NAMES = [
      'Determine Value','Regeneration','Calories','Intoxication','Attribute 5',
      'Attribute 6','Attribute 7','Attribute 8','Attribute 9','Attribute 10',
      'Attribute 11','Attribute 12','Attribute 13','Attribute 14','Attribute 15',
      'Attribute 16','Attribute 17','Attribute 18','Attribute 19','Attribute 20'
    ];

    // 2) Row factory
    const makeVaultRow = (name = '', level = 0) => ({
      name, level,
      detail1:0, detail2:0, detail3:0, detail4:0, detail5:0,
      detail6:0, detail7:0, detail8:0, detail9:0, detail10:0
    });

    // 3) Seed + normalize using the list (your existing code can go here)
    systemData.statsVault ??= {};
    const SV = systemData.statsVault;

    if (!Array.isArray(SV.attributes) || SV.attributes.length === 0) {
      SV.attributes = Array.from({ length: 20 }, (_, i) =>
        makeVaultRow(VAULT_DEFAULT_NAMES[i] ?? '', 0)
      );
    }

    if (Array.isArray(SV.attributes)) {
      for (let i = 0; i < SV.attributes.length; i++) {
        const r = SV.attributes[i] ?? {};
        const baseName = VAULT_DEFAULT_NAMES[i] ?? '';
        SV.attributes[i] = {
          name:   String(r.name ?? baseName),
          level:  Number(r.level ?? 0),
          detail1:  Number(r.detail1  ?? 0),
          detail2:  Number(r.detail2  ?? 0),
          detail3:  Number(r.detail3  ?? 0),
          detail4:  Number(r.detail4  ?? 0),
          detail5:  Number(r.detail5  ?? 0),
          detail6:  Number(r.detail6  ?? 0),
          detail7:  Number(r.detail7  ?? 0),
          detail8:  Number(r.detail8  ?? 0),
          detail9:  Number(r.detail9  ?? 0),
          detail10: Number(r.detail10 ?? 0),
        };
      }
    }

    // =======================================================================
    // Offensive (Attacks table)
    // =======================================================================
    systemData.offense ??= {};
    const O = systemData.offense;

    // Helper to build a clean row
    const makeRow = (name = "", range = 0) => ({
      name,
      range,           // editable number
      hit: 0,          // editable number (hit mod)
      dmg: {           // per-type damage; items can add to any field
        acid: 0, bludgeoning: 0, cold: 0, fire: 0, force: 0,
        lightning: 0, necrotic: 0, piercing: 0, poison: 0,
        psychic: 0, radiant: 0, slashing: 0, sonic: 0
      },
      status: {        // status chances; items can add to any field
        bleed: 21, burn: 21, crit: 20, mute: 21, petrified: 21,
        poison: 21, stun: 21, pierce: 21
      }
    });

    // Seed the full list once (only if empty)
    if (!Array.isArray(O.attacks) || O.attacks.length === 0) {
      const defaults = [
        ["ThrownAmmo",       20],
        ["ThrownWeapon",     20],
        ["Sling",            30],
        ["1hCrossbow",       40],
        ["Bow",              60],
        ["Blowgun",          20],
        ["Crossbow",         80],
        ["HeavyRange",      120],
        ["Siege",           500],
        ["Spray",            10],
        ["Whip",             10],

        ["LightPiercing",     5],
        ["LightBludgeoning",  5],
        ["LightSlashing",     5],

        ["MediumPiercing",    5],
        ["MediumBludgeoning", 5],
        ["MediumSlashing",    5],

        ["HeavyPiercing",    10],
        ["HeavyBludgeoning",  5],
        ["HeavySlashing",     5],

        ["Unarmed",           5],

        ["MagicAcid",         5],
        ["Explosive",         5],
        ["MagicCold",         5],
        ["MagicFire",         5],
        ["MagicForce",        5],
        ["MagicLightning",    5],
        ["MagicNecrotic",     5],
        ["MagicPoison",       5],
        ["MagicPsychic",      5],
        ["MagicRadiant",      5],
        ["MagicSonic",        5],
      ];

      O.attacks = defaults.map(([name, range]) => makeRow(name, range));
    }

    // Normalize any existing rows to ensure shape (safe for item updates)
    if (Array.isArray(O.attacks)) {
      for (let i = 0; i < O.attacks.length; i++) {
        const r = O.attacks[i] ?? {};
        // merge defaults with current row (current values win)
        const base = makeRow(r.name ?? "", Number(r.range ?? 0));
        r.name  = String(r.name ?? base.name);
        r.range = Number(r.range ?? base.range);
        r.hit   = Number(r.hit ?? 0);

        // ensure nested objects exist with all keys
        r.dmg    = Object.assign({}, base.dmg,    r.dmg);
        r.status = Object.assign({}, base.status, r.status);

        // coerce all nested numbers
        for (const k of Object.keys(r.dmg))    r.dmg[k]    = Number(r.dmg[k]    ?? 0);
        for (const k of Object.keys(r.status)) r.status[k] = Number(r.status[k] ?? 0);

        O.attacks[i] = r;
      }



      // =====================================================================
      // Offensive: Physical & Magic damage previews
      // =====================================================================
      const S = systemData.attributes ?? {};
      const total = (k) => Number(S?.[k]?.value ?? 0);

      // Pickers (tie -> first arg)
      const pickStat = (aKey, bKey, aLabel, bLabel) => {
        const av = total(aKey);
        const bv = total(bKey);
        return (av >= bv) ? { key: aKey, label: aLabel, value: av }
                          : { key: bKey, label: bLabel, value: bv };
      };

      // Tables
      const diceCountFrom = (v) => {
        if (v <= 19) return 1;
        if (v <= 29) return 2;
        if (v <= 39) return 3;
        if (v <= 49) return 4;
        if (v <= 59) return 5;
        if (v <= 69) return 6;
        if (v <= 79) return 7;
        if (v <= 89) return 8;
        if (v <= 99) return 9;
        return 10;
      };

      const dieSizeFrom = (v) => {
        if (v <=  9) return 4;
        if (v <= 29) return 6;
        if (v <= 59) return 8;
        if (v <= 79) return 10;
        return 12;
      };

      // Physical (STR vs DEX; ties -> STR)
      const physPick = pickStat("str", "dex", "STR", "DEX");
      const physDice = diceCountFrom(physPick.value);
      const physDie  = dieSizeFrom(physPick.value);

      // Magic (INT vs CHA; ties -> INT)
      const magPick  = pickStat("int", "cha", "INT", "CHA");
      const magDice  = diceCountFrom(magPick.value);
      const magDie   = dieSizeFrom(magPick.value);

      // Expose for the sheet
      systemData.offense ??= {};
      systemData.offense.damage = {
        physical: { stat: physPick.label, level: physPick.value, ndice: physDice, die: physDie },
        magical:  { stat: magPick.label,  level: magPick.value,  ndice: magDice,  die: magDie  }
      };
    }
  }

  /**
   * Prepare NPC type specific data.
   */
  _prepareNpcData(actorData) {
    if (actorData.type !== "npc") return;

    const systemData = actorData.system;
    systemData.xp = systemData.cr * systemData.cr * 100;
  }

  /**
   * Override getRollData() that's supplied to rolls.
   */
  getRollData() {
    const data = { ...this.system };
    this._getCharacterRollData(data);
    this._getNpcRollData(data);
    return data;
  }

  /**
   * Prepare character roll data.
   */
  _getCharacterRollData(data) {
    if (this.type !== "character") return;

    if (data.abilities && typeof data.abilities === "object") {
      for (let [k, v] of Object.entries(data.abilities)) {
        if (!v) continue;
        data[k] = foundry.utils.deepClone(v);
      }
    }

    if (data.attributes?.level) data.lvl = data.attributes.level.value ?? 0;
    else data.lvl = 0;
  }

  /**
   * Prepare NPC roll data.
   */
  _getNpcRollData(data) {
    if (this.type !== "npc") return;
  }
}
