import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from '../helpers/effects.mjs'

export class BenSystemActorSheet extends ActorSheet {
  _getHeaderButtons() {
    const buttons = super._getHeaderButtons()
    const mod = game.modules.get('popout')
    if (mod?.active && !this._popout) {
      buttons.unshift({
        class: 'popout',
        icon: 'fas fa-up-right-from-square',
        label: '',
        title: 'Pop out',
        onclick: (ev) => {
          const api = mod.api
          if (api?.popoutApp) return api.popoutApp(this)
          Hooks.callAll('popout:popoutApp', this)
        },
      })
    }
    return buttons
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['ben-system', 'sheet', 'actor'],
      popOut: true,
      resizable: true,
      width: 1000,
      height: 1000,
      tabs: [
        { navSelector: '.sheet-tabs[data-group="primary"]', contentSelector: '.sheet-body', initial: 'features' },
        { navSelector: '.stats-tabs[data-group="stats"]',   contentSelector: '.stats-body',  initial: 'statstotals' },
        { navSelector: '.inventory-tabs[data-group="inventory"]',   contentSelector: '.inventory-body',  initial: 'currency' }
      ]
    })
  }

  get template() {
    return `systems/ben-system/templates/actor/actor-${this.actor.type}-sheet.hbs`
  }

  async _render(force, options = {}) {
    const html = await super._render(force, options)
    if (!this._sizeEnforcedOnce) {
      this._sizeEnforcedOnce = true
      this.setPosition({ width: this.options.width, height: this.options.height })
    }
    return html
  }

  async getData() {
    const context = super.getData()

    // Inside getData(options) of BenSystemActorSheet after super.getData
const owned = this.actor.items.contents ?? [];
const byType = (t)=> owned.filter(i => i.type === t);

context.abilities = {
  skills: {
    charisma: byType("skill-charisma"),
    crafting: byType("skill-crafting"),
    combat: byType("skill-combat"),
    movement: byType("skill-movement"),
    perception: byType("skill-perception"),
    stealth: byType("skill-stealth"),
  },
  spells: {
    spell: byType("spell"),
    ritual: byType("ritual"),
    music: byType("music"),
  }
};


    // IMPORTANT: render prepared data (includes normal AE application)
    const raw = this.document.toObject(false)
    context.system = foundry.utils.deepClone(this.actor.system)
    context.flags  = raw.flags

    context.config = CONFIG.BEN_SYSTEM
    context.isGM = game.user.isGM

    // expose option maps if you have them (not required for logic below)
    context.bodyRegionOptions = context.config?.bodyRegionOptions ?? {}
    context.subRegionOptions  = context.config?.subRegionOptions  ?? {}

    const sys = context.system
    context.currentXP =
      foundry.utils.getProperty(sys, 'attributes.xp.value') ??
      foundry.utils.getProperty(sys, 'xp.value') ?? 0

    if (this.actor.type === 'character') {
      this._prepareItems(context)
      this._prepareCharacterData(context)
    }
    if (this.actor.type === 'npc') {
      this._prepareItems(context)
    }

    const TE = foundry?.applications?.ux?.TextEditor?.implementation ?? TextEditor
    context.enrichedBiography = await TE.enrichHTML(
      this.actor.system.biography ?? "",
      { secrets: this.document.isOwner, async: true, rollData: this.actor.getRollData(), relativeTo: this.actor }
    )

    context.effects = prepareActiveEffectCategories(this.actor.allApplicableEffects())

    // ---- Stats Breakdown container ----
    context.system.statsBreakdown ??= {
      raceBase: { str: 0, dex: 0, con: 0, int: 0, cha: 0 },
      points: { earned: 0, spent: 0, remaining: 0 },
    }



    // food/consumables list for the Inventory tab
    context.food = this.actor.items.filter(i => i.type === "consumable").map(i => i.toObject())

    // potions
    context.potions = this.actor.items.filter(i => i.type === "potion").map(i => i.toObject())

    // garbage
    context.garbage = this.actor.items.filter(i => i.type === "garbage").map(i => i.toObject())

    // gear (split by equipped)
{
    const allGear = this.actor.items.filter(i => i.type === "gear");
    context.gearEquipped   = allGear.filter(i => i.system?.equipped === true).map(i => i.toObject());
    context.gearUnequipped = allGear.filter(i => i.system?.equipped !== true).map(i => i.toObject());
}
// currency: top-level gold + list of currency items
context.gold = Number(foundry.utils.getProperty(this.actor, 'system.currency.gold') ?? 0)
context.currencyItems = this.actor.items
  .filter(i => i.type === 'currency')
  .map(i => i.toObject())


// achievements
  const all = this.actor.items.contents ?? this.actor.items;
context.achievements = all.filter(i => i.type === "achievement");




    // Derive raceBase from race items
    {
      const rows = Array.isArray(context.raceRows) ? context.raceRows : []
      if (rows.length) {
        const agg = rows.reduce((a, r) => {
          a.str += Number(r.str ?? 0)
          a.dex += Number(r.dex ?? 0)
          a.con += Number(r.con ?? 0)
          a.int += Number(r.int ?? 0)
          a.cha += Number(r.cha ?? 0)
          return a
        }, { str:0, dex:0, con:0, int:0, cha:0 })
        context.system.statsBreakdown.raceBase = agg
      } else {
        context.system.statsBreakdown.raceBase ??= { str:0, dex:0, con:0, int:0, cha:0 }
      }
    }

    // ---------------- Health helpers ----------------
    const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
    const hpMax =
      toNum(this.actor.system?.health?.max) ??
      toNum(context.system?.health?.max) ?? 0

    const rawMisc = this.actor.system?.miscStats?.entries ?? []
    const miscEntries = Array.isArray(rawMisc) ? rawMisc
                      : rawMisc && typeof rawMisc === 'object' ? Object.values(rawMisc) : []

    const regenRow = miscEntries.find(
      (e) => String(e?.name ?? '').trim().toLowerCase() === 'regeneration'
    )
    const regenLevel = toNum(regenRow?.level ?? 0)
    const regenPct = toNum(regenLevel * 5)
    const regenAmt = Math.floor(hpMax * (regenPct / 100))
    context.healthHeader = { regenPct, regenAmt }

    const allSE = this.actor.items.filter((i) => i.type === 'statuseffect')
    const byKind = (k) => allSE.filter((it) => (it.system?.effect?.kind ?? 'None') === k)
    context.seByKind = {
      Damage: byKind('Damage'),
      Control: byKind('Control'),
      Buff: byKind('Buff'),
      Debuff: byKind('Debuff'),
      System: byKind('System'),
    }

    // ---------------- STATS HISTORY ----------------
    const DAMAGE_TYPES = [
      'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning',
      'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant',
      'Slashing', 'Sonic', 'Bleed'
    ]
    const SOURCES = ['Melee', 'Ranged', 'Explosive']

    const history = this.actor.system?.history ?? {}
    const aggregated = history.damage ?? this.actor.system?.damageHistory ?? null
    const log = Array.isArray(history.log) ? history.log : null

    const emptyBucket = () =>
      Object.fromEntries(
        DAMAGE_TYPES.map((t) => [
          t,
          { Melee: { done: 0, taken: 0 }, Ranged: { done: 0, taken: 0 }, Explosive: { done: 0, taken: 0 } }
        ])
      )

    const buckets = emptyBucket()

    if (log && log.length) {
      for (const e of log) {
        const type = (e.type ?? '').toString()
        theSource: {
          const src = (e.source ?? 'Melee').toString()
          if (!DAMAGE_TYPES.includes(type)) break theSource
          const key = SOURCES.includes(src) ? src : 'Melee'
          const done = toNum(e.done ?? e.damageDone ?? 0)
          const taken = toNum(e.taken ?? e.damageTaken ?? 0)
          buckets[type][key].done += done
          buckets[type][key].taken += taken
        }
      }
    } else if (aggregated && typeof aggregated === 'object') {
      for (const [type, node] of Object.entries(aggregated)) {
        const t = DAMAGE_TYPES.includes(type) ? type : null
        if (!t) continue
        for (const src of SOURCES) {
          const n = node?.[src.toLowerCase?.() ?? ''] ?? node?.[src] ?? {}
          buckets[t][src].done += toNum(n.done ?? n.value ?? 0)
          buckets[t][src].taken += toNum(n.taken ?? n.damageTaken ?? 0)
        }
      }
    }

    // --- Overlay AEs onto damage history buckets (Melee/Ranged/Explosive; Done/Taken) ---
    {
      const effects = (this.actor.allApplicableEffects?.() ?? []).filter(e => !e.disabled && !e.isSuppressed)
      const MODES   = (foundry?.CONST?.ACTIVE_EFFECT_MODES) ?? CONST.ACTIVE_EFFECT_MODES
      const DAMAGE_TYPES = ['Acid','Bludgeoning','Cold','Fire','Force','Lightning','Necrotic','Piercing','Poison','Psychic','Radiant','Slashing','Sonic','Bleed']
      const SOURCES = ['Melee','Ranged','Explosive']

      const norm = (s, list) => {
        const key = String(s || '').toLowerCase()
        return list.find(v => v.toLowerCase() === key) ?? null
      }
      const apply = (mode, cur, val) => {
        const c = Number(cur ?? 0)
        const v = Number(val ?? 0)
        switch (mode) {
          case MODES.ADD:       return c + v
          case MODES.MULTIPLY:  return c * (v || 1)
          case MODES.OVERRIDE:  return v
          case MODES.UPGRADE:   return Math.max(c, v)
          case MODES.DOWNGRADE: return Math.min(c, v)
          default:              return c
        }
      }

      for (const ef of effects) for (const ch of (ef.changes ?? [])) {
        const key = String(ch.key || '')
        const m = Number(ch.mode ?? MODES.ADD)
        const hit = key.match(/^(?:system\.history\.damage|ben\.hist)\.([^.]+)\.([^.]+)\.(done|taken)$/i)
        if (!hit) continue

        const type = norm(hit[1], DAMAGE_TYPES)
        const src  = norm(hit[2], SOURCES)
        const fld  = hit[3].toLowerCase()
        if (!type || !src || (fld !== 'done' && fld !== 'taken')) continue

        const cur = Number(buckets[type][src][fld] ?? 0)
        const next = apply(m, cur, ch.value)
        buckets[type][src][fld] = next
      }
    }

    const damageTable = DAMAGE_TYPES.map((type) => {
      const rows = SOURCES.map((label) => ({
        label,
        done: buckets[type][label].done,
        taken: buckets[type][label].taken,
      }))
      const totalDone = rows.reduce((s, r) => s + r.done, 0)
      const totalTaken = rows.reduce((s, r) => s + r.taken, 0)
      return { type, total: { done: totalDone, taken: totalTaken }, rows }
    })

    const grandTotals = {
      done: damageTable.reduce((s, g) => s + g.total.done, 0),
      taken: damageTable.reduce((s, g) => s + g.total.taken, 0),
    }

    const DEFAULT_STATUSES = [
      'Bleed', 'Burn', 'Crit', 'Fear', 'Mute', 'Petrified', 'Poison', 'Stun', 'Pierce',
    ]
    const statusCounts = history.statusCounts ?? this.actor.system?.statusHistory ?? {}
    const statusTable = DEFAULT_STATUSES.map((status) => ({ status, count: toNum(statusCounts?.[status] ?? 0) }))

    context.damageTable = damageTable
    context.grandTotals = grandTotals
    context.statusTable = statusTable

    // ---------------- BENEFIT RESIST ITEMS ----------------
    {
      const REQ = {
        flat: [30, 90, 210, 450, 930, 1890, 3810, 7650, 15330, 30690, 61410, 122850, 245730, 491490, 983010],
        perDice: [3810, 7650, 15330, 30690, 61410, 122850, 245730, 491490, 983010, 1966050, 3932130, 7864290, 15728610, 31457250, 62914530],
        perLevel: [491490, 983010, 1966050, 3932130, 7864290, 15728610, 31457250, 62914530, 125829090, 251658210, 503316450, 1006632930, 2013265890, 4026531810, 8053063650]
      }
      const TEN_X = new Set(['Bludgeoning','Slashing','Piercing'])
      const mapTypeForHistory = (t) => (t === 'Bleeding' ? 'Bleed' : t)

      const takenByType = (type) => {
        if (!type || type === 'None') return 0
        const t = mapTypeForHistory(type)
        const node = buckets?.[t]
        if (!node) return 0
        return ['Melee','Ranged','Explosive'].reduce((s, src) => s + Number(node[src]?.taken ?? 0), 0)
      }

      const reqsFor = (type, mode) => {
        const base = mode === 'flat' ? REQ.flat : mode === 'perDice' ? REQ.perDice : REQ.perLevel
        return TEN_X.has(type) ? base.map(v => v * 10) : base
      }

      const levelFrom = (damage, reqs) => {
        let lvl = 0
        for (let i = 0; i < reqs.length; i++) {
          if (damage >= reqs[i]) lvl = i + 1; else break
        }
        return lvl
      }

      const resistanceFor = (mode, level) => {
        if (level <= 0) return { value: 0, text: '0' }
        if (mode === 'flat')  return { value: -2 * level, text: String(-2 * level) }
        if (mode === 'perDice') return { value: -level, text: `${-level} Per Dice` }
        return { value: -level, text: `${-level} Per Status Effect Level` }
      }

      for (const it of this.actor.items) {
        if (it.type !== 'benefitresist') continue
        const type = it.system?.damageType ?? 'None'
        const mode = it.system?.mode ?? 'flat'

        const damage = takenByType(type)
        const lvl    = levelFrom(damage, reqsFor(type, mode))
        const { value, text } = resistanceFor(mode, lvl)

        foundry.utils.setProperty(it, 'system.ui.characterDamage', damage)
        foundry.utils.setProperty(it, 'system.ui.benefitLevel', lvl)
        foundry.utils.setProperty(it, 'system.ui.resistance', value)
        foundry.utils.setProperty(it, 'system.ui.resistanceText', text)
      }

      const TYPES = [
        'Acid','Bludgeoning','Cold','Fire','Force','Lightning',
        'Necrotic','Piercing','Poison','Psychic','Radiant','Slashing','Sonic','Bleeding'
      ]
      const sum = Object.fromEntries(TYPES.map(t => [t, { flat: 0, perDice: 0, perLevel: 0 }]))

      for (const it of this.actor.items) {
        if (it.type !== 'benefitresist') continue
        const lvl  = Number(it.system?.ui?.benefitLevel ?? 0)
        if (lvl < 1) continue
        const type = it.system?.damageType ?? 'None'
        const mode = it.system?.mode ?? 'flat'
        const val  = Number(it.system?.ui?.resistance ?? 0)

        if (!sum[type]) continue
        if (mode === 'flat') sum[type].flat += val
        else if (mode === 'perDice') sum[type].perDice += val
        else sum[type].perLevel += val
      }

      context.benefitResistRows = TYPES.map(type => ({
        type,
        flat: sum[type].flat,
        perDice: sum[type].perDice,
        perLevel: sum[type].perLevel
      }))
    }

    // ---------------- RESISTANCES ----------------
    const RESIST_TYPES = [
      'Acid','Bludgeoning','Cold','Fire','Force','Lightning',
      'Necrotic','Piercing','Poison','Psychic','Radiant',
      'Slashing','Sonic','Bleeding'
    ]
    const rawRes = this.actor.system?.resistances ?? {}
    const resistances = RESIST_TYPES.map((type) => {
      const node = rawRes?.[type] ?? {}
      return { type, flat: Number(node.flat ?? 0), perDice: Number(node.perDice ?? 0), perLevel: Number(node.perLevel ?? 0) }
    })
    context.resistances = resistances

    // ---------------- EQUIPPED-BY-REGION + TATTOOS ----------------
    {
      // helpers used by both armour groups and tattoos
      const canon = (s) => String(s ?? 'None')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .replace(/armour/g, 'armor')

      const prettyFromKey = (s) => {
        const raw = String(s ?? 'None')
        if (/[ -]/.test(raw)) return raw
        return raw.replace(/([a-z])([A-Z])/g, '$1 $2')
      }

      const isTattoo = (it) => {
        const t = String(it.system?.armourType ?? '').toLowerCase()
        if (t === 'tattoo') return true
        if (it.system?.isTattoo === true) return true
        return /tattoo/i.test(it.name ?? '')
      }

      const regionOrder = ['Head','Face','Neck','Torso','Arms','Hands','Fingers','Belt','Legs','Feet','None']

      const SUB_LIMITS = {
        'None': null,
        'Hat': 1,
        'Bandana': 1,
        'Hair': 10,
        'Over': 1,
        'Under': 1,
        'Necklace': 1,
        'Shoulder': 1,
        'Bicep': 1,
        'Wrist': 1,
        'Hands': 1,
        'Fingers': 10,
        'Palm': 1,
        'Leg Armour': 1,
        'Leg Frills': 1,
        'Leg Padding': 1,
        'Torso Armour': 1,
        'Tabard': 1,
        'Torso Padding': 1,
        'Shirt': 1,
        'Vest': 1,
        'Upper Back': 1,
        'Lower Back': 1,
        'Pectoral': 1,
        'Stomach': 1,
        'Underwear': 1,
        'Thigh': 1,
        'Shin': 1,
        'Butt': 1,
        'Boots': 1,
        'Toe': 10,
        'Socks': 1,
        'Forehead': 1,
        'Eyes': 1,
        'Ears': 1,
        'Cheek': 1,
        'Nose': 1,
        'Eyebrow': 1,
        'Mouth': 1,
        'Chin': 1,
        'Belt': 1,
        'Attatchment': 10,
        'Implant - Head': null,
        'Implant - Face': null,
        'Implant - Neck': null,
        'Implant - Torso': null,
        'Implant - Arms': null,
        'Implant - Hands': null,
        'Implant - Legs': null,
        'Implant - Groin': null,
        'Implant - Feet': null,
        'Implant - None': null
      }

      const REGION_SUBS = {
        Head:    ['Implant - Head','Hat','Bandana','Hair'],
        Face:    ['Implant - Face','Forehead','Eyes','Ears','Cheek','Nose','Eyebrow','Mouth','Chin'],
        Neck:    ['Implant - Neck','Necklace','Over','Under'],
        Torso:   ['Implant - Torso','Torso Armour','Shirt','Vest','Upper Back','Lower Back','Pectoral','Stomach','Tabard','Torso Padding'],
        Arms:    ['Implant - Arms','Shoulder','Bicep','Wrist'],
        Hands:   ['Implant - Hands','Hands','Fingers','Palm'],
        Belt:    ['Belt','Attatchment'],
        Legs:    ['Implant - Legs','Implant - Groin','Leg Armour','Thigh','Shin','Butt','Underwear','Leg Frills','Leg Padding'],
        Feet:    ['Implant - Feet','Boots','Toe','Socks'],
        None:    ['None']
      }

      const num = (v) => Number(v ?? 0)
      const sumBy = (arr, path) => arr.reduce((s, it) => s + num(foundry.utils.getProperty(it, path)), 0)

      // --- ARMOUR BY REGION (exclude tattoos) ---
      const allEquippedArmour = this.actor.items.filter(i =>
        i.type === 'armour' &&
        i.system?.equipped === true &&
        !isTattoo(i) &&
        ((i.system?.armourType ?? 'Armour') === 'Armour')
      )

      context.equipGroups = regionOrder.map(key => {
        const items = allEquippedArmour.filter(it => (it.system?.bodyRegion ?? 'None') === key)

        // stamp normalized label on each item for the template
        for (const it of items) {
          const raw = it.system?.subRegion ?? 'None'
          const want = canon(raw)
          const regionLabels = REGION_SUBS[key] ?? []
          const matchLabel = regionLabels.find(lbl => canon(lbl) === want)
          const label = matchLabel ?? prettyFromKey(raw)
          foundry.utils.setProperty(it, 'system.ui.subRegionKey', want)
          foundry.utils.setProperty(it, 'system.ui.subRegionLabel', label)
        }

        // Build ALL sub-slots for the region first...
        const rawSubs = (REGION_SUBS[key] ?? []).map(lbl => {
          const k = canon(lbl)
          const count = items.filter(
            it => (it.system?.ui?.subRegionKey ?? canon(it.system?.subRegion)) === k
          ).length
          const max   = SUB_LIMITS[lbl] ?? null
          return { key: k, label: lbl, count, max }
        })

        // ...use ALL subs to compute the region max...
        const hasUnlimited = rawSubs.some(s => s.max == null)
        const regionMax = hasUnlimited ? null : rawSubs.reduce((t, s) => t + (s.max ?? 0), 0)

        // ...but only DISPLAY subs that actually have at least one item.
        const subs = rawSubs.filter(s => s.count > 0)

        const num = (v) => Number(v ?? 0)
        const sumBy = (arr, path) => arr.reduce((s, it) => s + num(foundry.utils.getProperty(it, path)), 0)

        return {
          key,
          label: context.bodyRegionOptions?.[key] ?? key,
          count: items.length,
          max: regionMax,
          totals: {
            pac: sumBy(items, 'system.pacBonus'),
            mac: sumBy(items, 'system.macBonus'),
            str: sumBy(items, 'system.strBonus'),
            dex: sumBy(items, 'system.dexBonus'),
            con: sumBy(items, 'system.conBonus'),
            int: sumBy(items, 'system.intBonus'),
            cha: sumBy(items, 'system.chaBonus')
          },
          subs,   // <- only non-zero sub-slots shown in the summary line
          items
        }
      }).filter(g => g.items.length > 0)

      // --- TATTOOS (own list; controls disabled in template) ---
      const allTattoos = this.actor.items.filter(i =>
        i.type === 'armour' && isTattoo(i)
      )

      // label normalization for tattoos too
      for (const it of allTattoos) {
        const region = it.system?.bodyRegion ?? 'None'
        const raw = it.system?.subRegion ?? 'None'
        const want = canon(raw)
        const regionLabels = REGION_SUBS[region] ?? []
        const matchLabel = regionLabels.find(lbl => canon(lbl) === want)
        const label = matchLabel ?? prettyFromKey(raw)
        foundry.utils.setProperty(it, 'system.ui.subRegionKey', want)
        foundry.utils.setProperty(it, 'system.ui.subRegionLabel', label)
      }

      const eqTattoos = allTattoos.filter(i => i.system?.equipped === true)

      context.tattoos = {
        items: allTattoos,
        totals: {
          pac: sumBy(eqTattoos, 'system.pacBonus'),
          mac: sumBy(eqTattoos, 'system.macBonus'),
          str: sumBy(eqTattoos, 'system.strBonus'),
          dex: sumBy(eqTattoos, 'system.dexBonus'),
          con: sumBy(eqTattoos, 'system.conBonus'),
          int: sumBy(eqTattoos, 'system.intBonus'),
          cha: sumBy(eqTattoos, 'system.chaBonus')
        }
      }
    }

    // ---------------- EQUIPPED WEAPONS (list + totals) ----------------
    {
      const eqWeapons = this.actor.items.filter(
        (i) => i.type === 'weapon' && i.system?.equipped === true
      )

      const num   = (v) => Number(v ?? 0)
      const sumBy = (arr, path) => arr.reduce((s, it) => s + num(foundry.utils.getProperty(it, path)), 0)

      context.equipWeapons = {
        items: eqWeapons,
        totals: {
          pac: sumBy(eqWeapons, 'system.pacBonus'),
          mac: sumBy(eqWeapons, 'system.macBonus'),
          str: sumBy(eqWeapons, 'system.strBonus'),
          dex: sumBy(eqWeapons, 'system.dexBonus'),
          con: sumBy(eqWeapons, 'system.conBonus'),
          int: sumBy(eqWeapons, 'system.intBonus'),
          cha: sumBy(eqWeapons, 'system.chaBonus')
        }
      }
    }

    // ---------------- EQUIPPED TOTALS ----------------
    {
      // Count BOTH armour (including tattoos) and weapons
      const equipped = this.actor.items.filter(it =>
        (it.type === 'armour' || it.type === 'weapon') &&
        it.system?.equipped === true
      )

      const num = (v) => Number(v ?? 0)
      const sum = (path) => equipped.reduce((s, it) => s + num(foundry.utils.getProperty(it, path)), 0)

      context.equippedTotals = {
        pac: sum('system.pacBonus'),
        mac: sum('system.macBonus'),
        str: sum('system.strBonus'),
        dex: sum('system.dexBonus'),
        con: sum('system.conBonus'),
        int: sum('system.intBonus'),
        cha: sum('system.chaBonus')
      }
    }

    // ---------------- DEFENCES TOTALS ----------------
    {
      const RB = context.system.statsBreakdown?.raceBase ?? { str:0,dex:0,con:0,int:0,cha:0 }
      const num = v => Number(v ?? 0)

      const baseDex = num(RB.dex)
      const baseCon = num(RB.con)
      const baseInt = num(RB.int)
      const baseCha = num(RB.cha)

      const phys = this.actor.system?.defences?.physical ?? {}
      const mag  = this.actor.system?.defences?.magical ?? {}
      const dexSkill = num(phys.dexSkill)
      const conSkill = num(phys.conSkill)
      const intSkill = num(mag.intSkill)
      const chaSkill = num(mag.chaSkill)

      const pacGear = num(context.equippedTotals?.pac)
      const macGear = num(context.equippedTotals?.mac)

      const pacTotal = baseDex + dexSkill + baseCon + conSkill + pacGear
      const macTotal = baseInt + intSkill + baseCha + chaSkill + macGear

      context.defencesTotals = { pac: pacTotal, mac: macTotal }

      context.system.pac ??= {}
      context.system.mac ??= {}
      context.system.pac.value = pacTotal
      context.system.mac.value = macTotal

      context.system.defences ??= { physical: {}, magical: {} }
      context.system.defences.physical.baseDex = baseDex
      context.system.defences.physical.baseCon = baseCon
      context.system.defences.magical.baseInt  = baseInt
      context.system.defences.magical.baseCha  = baseCha
    }

    // ---------------- APPLY AE CHANGES TO OFFENSIVE ARRAY ----------------
    {
      const base = foundry.utils.deepClone(this.actor.system?.offense?.attacks ?? [])
      const effects = (this.actor.allApplicableEffects?.() ?? []).filter(e => !e.disabled && !e.isSuppressed)
      const MODES = (foundry?.CONST?.ACTIVE_EFFECT_MODES) ?? CONST.ACTIVE_EFFECT_MODES

      const apply = (mode, cur, val) => {
        const c = Number(cur ?? 0)
        const v = Number(val ?? 0)
        switch (mode) {
          case MODES.ADD:       return c + v
          case MODES.MULTIPLY:  return c * (v || 1)
          case MODES.OVERRIDE:  return v
          case MODES.UPGRADE:   return Math.max(c, v)
          case MODES.DOWNGRADE: return Math.min(c, v)
          default:              return c
        }
      }

      for (const ef of effects) {
        for (const ch of (ef.changes ?? [])) {
          const key = String(ch.key || '')
          const m   = Number(ch.mode ?? MODES.ADD)
          const val = ch.value

          const match = key.match(/^system\.offense\.attacks\.(\d+)\.(.+)$/)
          if (!match) continue
          const idx = Number(match[1])
          const sub = match[2]

          const atk = base[idx]
          if (!atk) continue

          const cur = foundry.utils.getProperty(atk, sub)
          if (isNaN(Number(cur)) && isNaN(Number(val))) continue

          const next = apply(m, cur, val)
          foundry.utils.setProperty(atk, sub, next)
        }
      }

      context.system.offense ??= {}
      context.system.offense.attacks = base
    }

    // ---------------- APPLY AE CHANGES TO STATS VAULT ARRAY ----------------
    {
      const base = foundry.utils.deepClone(this.actor.system?.statsVault?.attributes ?? [])
      const effects = (this.actor.allApplicableEffects?.() ?? []).filter(e => !e.disabled && !e.isSuppressed)
      const MODES = (foundry?.CONST?.ACTIVE_EFFECT_MODES) ?? CONST.ACTIVE_EFFECT_MODES

      const apply = (mode, cur, val) => {
        const c = Number(cur ?? 0)
        const v = Number(val ?? 0)
        switch (mode) {
          case MODES.ADD:       return c + v
          case MODES.MULTIPLY:  return c * (v || 1)
          case MODES.OVERRIDE:  return v
          case MODES.UPGRADE:   return Math.max(c, v)
          case MODES.DOWNGRADE: return Math.min(c, v)
          default:              return c
        }
      }

      for (const ef of effects) for (const ch of (ef.changes ?? [])) {
        const key = String(ch.key || '')
        const m   = Number(ch.mode ?? MODES.ADD)
        const val = ch.value

        // Accept keys like: system.statsVault.attributes.3.level / .detail1..detail10
        const match = key.match(/^system\.statsVault\.attributes\.(\d+)\.(level|detail[1-9]|detail10)$/i)
        if (!match) continue
        const idx = Number(match[1])
        const fld = match[2]
        const row = base[idx]
        if (!row) continue

        const cur = Number(row[fld] ?? 0)
        row[fld] = apply(m, cur, val)
      }

      context.system.statsVault ??= {}
      context.system.statsVault.attributes = base

      // Mirror canonical calories into the Vault row for display
{
  const canonical = Number(foundry.utils.getProperty(this.actor, 'system.tracking.calories') ?? 0)
  const list = context.system.statsVault?.attributes ?? []
  const j = list.findIndex(r => String(r?.name ?? '').toLowerCase() === 'calories')
  if (j >= 0) list[j].detail1 = canonical
}

    }

    return context
  }

  _prepareCharacterData(context) {}

  _prepareItems(context) {
    const gear = []
    const features = []
    const spells = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [] }

    for (let i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON
      if (i.type === 'item') gear.push(i)
      else if (i.type === 'feature') features.push(i)
      else if (i.type === 'spell' && i.system.spellLevel != undefined) {
        spells[i.system.spellLevel].push(i)
      }
    }

    const raceItems = context.items.filter((i) => i.type === 'race')
    context.raceRows = raceItems.map((i) => {
      const s = i.system ?? {}
      const a = s.attributes ?? {}
      const m = s.movement ?? {}
      return {
        id: i._id,
        name: i.name,
        img: i.img || Item.DEFAULT_ICON,
        str: a.str?.base ?? a.str ?? 0,
        con: a.con?.base ?? a.con ?? 0,
        dex: a.dex?.base ?? a.dex ?? 0,
        int: a.int?.base ?? a.int ?? 0,
        cha: a.cha?.base ?? a.cha ?? 0,
        walk: m.walking?.level ?? m.walk ?? 0,
        swim: m.swimming?.level ?? m.swim ?? 0,
      }
    })
    context.hasRaceItems = context.raceRows.length > 0

    context.gear = gear
    context.features = features
    context.spells = spells
  }

  _statModFromTotal(total) {
    const n = Math.max(0, Number(total || 0))
    if (n <= 1) return -5
    if (n <= 3) return -4
    if (n <= 5) return -3
    if (n <= 7) return -2
    if (n <= 9) return -1
    return Math.floor((n - 10) / 5)
  }

  activateListeners(html) {
    super.activateListeners(html)

      html.on('click', '.ability-use', async ev => {
    const id = ev.currentTarget.closest('[data-item-id]')?.dataset?.itemId;
    const item = this.actor.items.get(id);
    const mod = await import("../scripts/workflows/use-ability.mjs");
    await mod.useAbility(this.actor, item);
  });
  html.on('click', '.ability-edit', ev => {
    const id = ev.currentTarget.closest('[data-item-id]')?.dataset?.itemId;
    const item = this.actor.items.get(id);
    item?.sheet?.render(true);
  });

  // In actor-sheet.mjs -> activateListeners(html)
html.on('input', '.ability-search', ev => {
  const q = String(ev.currentTarget.value || '').trim().toLowerCase();
  const scope = ev.currentTarget.dataset.scope;
  const table = html.find(`table.ability-table[data-scope="${scope}"]`);
  table.find('tbody tr').each((_, tr) => {
    const $tr = $(tr);
    const name = String($tr.data('name') || '').toLowerCase();
    const tags = String($tr.data('tags') || '').toLowerCase();
    const show = !q || name.includes(q) || tags.includes(q);
    $tr.toggle(show);
  });
});


    // Open item sheet from list (safe in read-only)
    html.on('click', '.items-list .item .item-name, .items-list .item .item-image', (ev) => {
      const li = ev.currentTarget.closest('.item')
      this.actor.items.get(li?.dataset.itemId)?.sheet?.render(true)
    })

    // ---- Toggle gear equipped (only one allowed) ----
html.on('change', '.gear-equip', async (ev) => {
  ev.preventDefault();
  if (!this.isEditable) return;

// Persist Gold field
html.on('change', '.gold-input', async (ev) => {
  ev.preventDefault()
  const el   = ev.currentTarget
  const path = el.dataset.path || 'system.currency.gold'
  const val  = Number(el.value ?? 0)
  await this.actor.update({ [path]: Math.max(0, val) })
  // Optional: reflect formatted value
  el.value = String(Math.max(0, val))
});

// ===== ACHIEVEMENTS: cancel default item open & toggle accordion =====
  // 1) Kill any default item-clicks inside the Achievements table (except on .item-edit)
  html.on('click', '.ben-inventory--achievements .item, .ben-inventory--achievements .achv-toggle, .ben-inventory--achievements .item-image img', (ev) => {
    // Let the Edit button behave normally
    if ($(ev.target).closest('.item-controls .item-edit').length) return;




    const $row = $(ev.currentTarget).closest('tr.achv-row');
    if (!$row.length) return;

    const id   = $row.data('itemId');
    const $tab = html.find('.ben-inventory--achievements');
    const $sum = $tab.find(`tr.item-summary[data-for="${id}"]`);

    // Optional: close any other open ones
    $tab.find('tr.item-summary:visible').hide();
    $tab.find('tr.achv-row[aria-expanded="true"]').attr('aria-expanded', 'false');

    const isOpen = $sum.is(':visible');
    $sum.toggle(!isOpen);
    $row.attr('aria-expanded', String(!isOpen));
  });

  // 2) Keyboard support on the name “button”
  html.on('keydown', '.ben-inventory--achievements .achv-toggle', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      $(ev.currentTarget).closest('tr.achv-row').trigger('click');
    }
  });

  // 3) Greyed-out delete does nothing
  //html.on('click', '.ben-inventory--achievements .item-delete.is-disabled', (ev) => {
    //return false;
  //});

  // ===== Search: filter by Name or Tag =====
  const applyAchvFilter = () => {
    const q = String($root.find('.achv-search').val() || '').trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);

    $root.find('tr.achv-row').each((_, tr) => {
      const $tr = $(tr);
      const name = String($tr.find('.achv-toggle').text() || '').toLowerCase();
      const tag  = String($tr.find('td.item-tag').text() || '').toLowerCase();
      const hay  = `${name} ${tag}`;
      const match = tokens.length === 0 || tokens.every(t => hay.includes(t));

      $tr.toggle(match);

      // Hide its summary if the row is hidden
      const id = $tr.data('itemId');
      if (!match) {
        $root.find(`tr.item-summary[data-for="${id}"]`).hide();
        $tr.attr('aria-expanded', 'false');
      }
    });

    const anyVisible = $root.find('tr.achv-row:visible').length > 0;
    $root.find('tr.filter-empty').toggle(!anyVisible);
  };

  // Filter as you type
  $root.on('input', '.achv-search', applyAchvFilter);

  // ESC clears the search
  $root.on('keydown', '.achv-search', (ev) => {
    if (ev.key === 'Escape') {
      $(ev.currentTarget).val('');
      applyAchvFilter();
    }
  });

  const id   = ev.currentTarget.dataset.itemId;
  const gear = this.actor.items.get(id);
  if (!gear) return;

  const wantEquip = !!ev.currentTarget.checked;

  if (wantEquip) {
    // 1) Un-equip all other gear on this actor
    const others = this.actor.items.filter(i => i.type === 'gear' && i.id !== id && i.system?.equipped === true);
    const updates = others.map(i => ({ _id: i.id, 'system.equipped': false }));
    if (updates.length) await this.actor.updateEmbeddedDocuments('Item', updates);
    // remove their effects too
    for (const i of others) await this._removeGearEffects(i);

    // 2) Equip this one
    await gear.update({ 'system.equipped': true });
    await this._applyGearEffects(gear);
  } else {
    // Unequip this one
    await gear.update({ 'system.equipped': false });
    await this._removeGearEffects(gear);
  }

  this.render(false);
});



    html.on('click', '.stat-roll', async (ev) => {
      ev.preventDefault()
      const el    = ev.currentTarget
      const stat  = (el.dataset.stat || 'STAT').toUpperCase()
      const total = Number(el.dataset.value || 0)
      const mod   = this._statModFromTotal(total)

      const roll = new Roll('1d20 + @mod', { mod })
      await roll.evaluate({ async: true })
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: `<b>${stat} Check</b> — Total ${total}, Modifier ${mod >= 0 ? '+' : ''}${mod}`,
        rollMode: game.settings.get('core', 'rollMode'),
      })
    })

    // ---- MISC STATS: Add / Delete rows (mirror Offensive pattern) ----
    html.on('click', '.misc-add-row, .misc-add', async (ev) => {
      ev.preventDefault()

      const current = foundry.utils.duplicate(this.actor.system?.miscStats?.entries ?? [])
      const list    = Array.isArray(current) ? current : Object.values(current ?? {})

      list.push({ name: '', level: 0 })

      await this.actor.update({ 'system.miscStats.entries': list })
      this.render(true)
    })

    html.on('click', '.misc-del-row, .misc-del', async (ev) => {
      ev.preventDefault()

      const idx     = Number(ev.currentTarget.dataset.index)
      const current = foundry.utils.duplicate(this.actor.system?.miscStats?.entries ?? [])
      const list    = Array.isArray(current) ? current : Object.values(current ?? {})

      if (Number.isInteger(idx) && idx >= 0 && idx < list.length) {
        list.splice(idx, 1)
        await this.actor.update({ 'system.miscStats.entries': list })
        this.render(true)
      }
    })
    // ------------------------------------------------------------------

    html.on('click', '.effect-control[data-action="delete"]', async (ev) => {
      const li = ev.currentTarget.closest('.item.effect')
      if (!li) return
      const effectId = li.dataset.effectId
      const parentId = li.dataset.parentId
      const parent = parentId === this.actor.id
        ? this.actor
        : this.actor.items.get(parentId)
      if (parent && effectId) {
        await parent.deleteEmbeddedDocuments('ActiveEffect', [effectId])
        this.render(false)
      }
    })

    html.on('click', '.health-tick', async (ev) => {
      ev.preventDefault()
      await this._applyDamagingStatusTicks()
    })

    html.on('click', '.health-regen', async (ev) => {
      ev.preventDefault()
      await this._applyEndOfTurnRegen()
    })

    html.on('click', '.qty-step', async (ev) => {
      const li   = ev.currentTarget.closest('li.item')
      const item = this.actor.items.get(li.dataset.itemId)
      const path = ev.currentTarget.dataset.path || 'system.quantity'

      const cur  = Number(foundry.utils.getProperty(item, path) ?? 0)
      const next = Math.max(0, cur + (ev.currentTarget.classList.contains('inc') ? 1 : -1))
      await item.update({ [path]: next })

      const input = li.querySelector(`input[data-path="${path}"]`)
      if (input) input.value = String(next)
    })

    html.on('click', '.hist-step', (ev) => this._onHistoryStep(ev))
    html.on('click', '.resist-step', (ev) => this._onResistStep(ev))

    // Stop binding mutating handlers for read-only views
    if (!this.isEditable) return

// ---- Consume button (works for list OR table layouts) ----
// ---- Consume button (works for list OR table layouts) ----
html.on('click', '.food-consume', async (ev) => {
  ev.preventDefault()
  if (!this.isEditable) return

  // support <li class="item" data-item-id="..."> or data on the button
  const row    = ev.currentTarget.closest('.item') || ev.currentTarget.closest('tr')
  const itemId = row?.dataset.itemId || ev.currentTarget.dataset.itemId
  const item   = this.actor.items.get(itemId)
  if (!item) return console.warn('Consume: no item for', itemId)

  // ---- 1) calories (per portion) ----
  const unitCalories = Number(item.system?.calories ?? 0)
  const calPath = 'system.tracking.calories'
  const current = Number(foundry.utils.getProperty(this.actor, calPath) ?? 0)
  const next    = current + unitCalories
  await this.actor.update({ [calPath]: next })
  await this._syncCaloriesToVault(next)

  // ---- 2) apply item's effects to actor ----
  await this._applyConsumableEffects(item)

  // ---- 3) portions & quantity logic ----
  const portions = Math.max(1, Number(item.system?.portions ?? 1))
  let   remain   = Number(item.system?.portionsRemaining)
  if (!Number.isFinite(remain) || remain <= 0) remain = portions // auto-init

  let qty = Math.max(0, Number(item.system?.quantity ?? 1))

  // consume one portion
  remain -= 1

  if (remain > 0) {
    // still portions left on this stack item
    await item.update({ 'system.portionsRemaining': remain })
  } else {
    // no portions left; reduce quantity and reset portionsRemaining
    qty = Math.max(0, qty - 1)
    if (qty > 0) {
      await item.update({
        'system.quantity': qty,
        'system.portionsRemaining': portions
      })
    } else {
      await item.delete()
    }
  }

  const msgRemain = qty > 0 ? `Portions left: ${remain > 0 ? remain : portions} (Qty: ${qty})` : 'Item finished.'
  ui.notifications.info(`Consumed 1 (${unitCalories} cal). ${msgRemain}`)
})

// ---- Drink a potion ----
html.on('click', '.potion-consume', async (ev) => {
  ev.preventDefault()
  if (!this.isEditable) return

  const row    = ev.currentTarget.closest('.item') || ev.currentTarget.closest('tr')
  const itemId = row?.dataset.itemId || ev.currentTarget.dataset.itemId
  const item   = this.actor.items.get(itemId)
  if (!item) return

  // apply the potion's item effects to the actor
  if (typeof this._applyConsumableEffects === 'function') {
    await this._applyConsumableEffects(item)    // reuse the helper you already have
  } else if (typeof this._applyItemEffects === 'function') {
    await this._applyItemEffects(item)
  }

  // reduce quantity; delete if it hits 0
  const qty = Math.max(0, Number(item.system?.quantity ?? 1)) - 1
  if (qty > 0) {
    await item.update({ 'system.quantity': qty })
  } else {
    await item.delete()
  }

  ui.notifications.info(`You consume ${item.name}.`)
})





    // ---- Stats Vault inline editing: persist text/number changes immediately ----
    html.on('change', 'input[name^="system.statsVault.attributes"]', async (ev) => {
      ev.preventDefault()
      const el = ev.currentTarget
      const path = el.name   // e.g. "system.statsVault.attributes.3.name"
      const value = (el.type === 'number') ? Number(el.value) : el.value
      await this.actor.update({ [path]: value })
    })

    html.on('click', '.item-create', (ev) => this._onItemCreate(ev))

    html.on('change', '.item-field', async (ev) => {
      const el   = ev.currentTarget
      const li   = el.closest('[data-item-id]')
      const id   = li?.dataset.itemId
      if (!id) return

      const item = this.actor.items.get(id)
      if (!item) return

      const path = el.dataset.path
      let value  = el.type === 'checkbox' ? el.checked : el.value
      if (el.type === 'number') value = Number(value)

      await item.update({ [path]: value })
      this.render(true)
    })

    html.on('click', '.item-edit', (ev) => {
      const li = ev.currentTarget.closest('[data-item-id]')
      this.actor.items.get(li.dataset.itemId)?.sheet.render(true)
    })

    html.on('click', '.item-delete', async (ev) => {
      const li = ev.currentTarget.closest('[data-item-id]')
      await this.actor.deleteEmbeddedDocuments('Item', [li.dataset.itemId])
      this.render(true)
    })

    html.on('click', '.rollable', (ev) => this._onRoll(ev))

    if (this.actor.isOwner) {
      const handler = (ev) => this._onDragStart(ev)
      html.find('li.item').each((i, li) => {
        if (li.classList.contains('inventory-header')) return
        li.setAttribute('draggable', true)
        li.addEventListener('dragstart', handler, false)
      })
    }

    // ---------- Offensive: Add/Delete ----------
    html.on('click', '.off-add-row', async (ev) => {
      ev.preventDefault()
      const current = foundry.utils.duplicate(this.actor.system.offense?.attacks ?? [])
      current.push({
        name: '', range: 0, hit: 0,
        dmg: { acid:0, bludgeoning:0, cold:0, fire:0, force:0, lightning:0, necrotic:0,
               piercing:0, poison:0, psychic:0, radiant:0, slashing:0, sonic:0 },
        status: { bleed:0, burn:0, crit:0, mute:0, petrified:0, poison:0, stun:0, pierce:0 }
      })
      await this.actor.update({ 'system.offense.attacks': current })
      this.render(true)
    })

    html.on('click', '.off-del-row', async (ev) => {
      ev.preventDefault()
      const i = Number(ev.currentTarget.dataset.index)
      const current = foundry.utils.duplicate(this.actor.system.offense?.attacks ?? [])
      if (Number.isInteger(i) && i >= 0 && i < current.length) {
        current.splice(i, 1)
        await this.actor.update({ 'system.offense.attacks': current })
        this.render(true)
      }
    })
    // -------------------------------------------

    // ---------- Stats Vault: Add/Delete ----------
    html.on('click', '.vault-add-row', async (ev) => {
      ev.preventDefault()
      const current = foundry.utils.duplicate(this.actor.system?.statsVault?.attributes ?? [])
      current.push({
        name: '',
        level: 0,
        detail1:0, detail2:0, detail3:0, detail4:0, detail5:0,
        detail6:0, detail7:0, detail8:0, detail9:0, detail10:0
      })
      await this.actor.update({ 'system.statsVault.attributes': current })
      this.render(true)
    })

    html.on('click', '.vault-del-row', async (ev) => {
      ev.preventDefault()
      const i = Number(ev.currentTarget.dataset.index)
      const current = foundry.utils.duplicate(this.actor.system?.statsVault?.attributes ?? [])
      if (Number.isInteger(i) && i >= 0 && i < current.length) {
        current.splice(i, 1)
        await this.actor.update({ 'system.statsVault.attributes': current })
        this.render(true)
      }
    })
    // ---------------------------------------------
    
    html.on('click', '.roll-damage', async (ev) => {
      ev.preventDefault()
      const formula = ev.currentTarget.dataset.formula
      const label   = ev.currentTarget.dataset.label ?? 'Damage'
      if (!formula) return

      const roll = new Roll(formula, this.actor.getRollData())
      await roll.evaluate({ async: true })
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: `<b>${label}</b> (${formula})`,
        rollMode: game.settings.get('core', 'rollMode'),
      })
    })

    html.on('click', '.se-stepper', async (ev) => {
      ev.preventDefault()
      const btn = ev.currentTarget
      const itemId = btn.dataset.itemId
      const path   = btn.dataset.path
      if (!itemId || !path) return

      const item = this.actor.items.get(itemId)
      if (!item) return

      const sysPath = path.replace(/^system\./, '')
      const cur = Number(foundry.utils.getProperty(item.system, sysPath) ?? 0)
      const inc = btn.classList.contains('inc') ? 1 : -1
      const next = Math.max(0, cur + inc)

      await item.update({ [path]: next })

      const input = btn.parentElement?.querySelector('input[type="number"]')
      if (input) input.value = next
      this.render(true)
    })

    html.on('change', '.se-toggle', async (ev) => {
      const el = ev.currentTarget
      const itemId = el.dataset.itemId
      const path   = el.dataset.path
      if (!itemId || !path) return

      await this._updateStatusEffectItem(itemId, { [path]: !!el.checked })
      this.render(true)
    })

    html.on('click', '.xp-give', (ev) => this._onGiveXP(ev))
    html.on('click', '.xp-set',  (ev) => this._onSetXP(ev))

    html.on('click', '.stepper', async (ev) => {
      ev.preventDefault()
      const btn  = ev.currentTarget
      const path = btn.dataset.path
      if (!path) return

      const inc = btn.classList.contains('inc') ? 1 : -1
      const sysPath = path.replace(/^system\./, '')
      const cur = Number(foundry.utils.getProperty(this.actor.system, sysPath) ?? 0)

      let next = cur + inc
      if (/\.level$/.test(path)) next = Math.max(0, next)

      await this.actor.update({ [path]: next })

      const input = btn.parentElement.querySelector('input[type="number"]')
      if (input) input.value = next
      this.render(true)
    })

    if (!this._hooksBound) {
      this._hooksBound = true

      this._boundItemRefresh = (doc) => {
        if (doc?.parent?.id !== this.actor.id) return
        if (doc.sheet?.rendered) return
        clearTimeout(this._refreshTimer)
        this._refreshTimer = setTimeout(() => this.render(false), 50)
      }
      Hooks.on('createItem', this._boundItemRefresh)
      Hooks.on('updateItem', this._boundItemRefresh)
      Hooks.on('deleteItem', this._boundItemRefresh)

      this._boundEffectRefresh = (doc) => {
        const p = doc?.parent
        const belongs =
          p?.id === this.actor.id ||
          p?.parent?.id === this.actor.id
        if (!belongs) return
        clearTimeout(this._refreshTimer)
        this._refreshTimer = setTimeout(() => this.render(false), 50)
      }
      Hooks.on('createActiveEffect', this._boundEffectRefresh)
      Hooks.on('updateActiveEffect', this._boundEffectRefresh)
      Hooks.on('deleteActiveEffect', this._boundEffectRefresh)

      this._boundDropActorSheetData = (actor, sheet, data) => {
        if (actor?.id === this.actor.id) setTimeout(() => this.render(true), 0)
      }
      Hooks.on('dropActorSheetData', this._boundDropActorSheetData)
    }

    // In your BenSystemActorSheet.activateListeners after your other Hooks binding:
if (!this._gearEquipHooked) {
  this._gearEquipHooked = true;
  Hooks.on('updateItem', async (item, changes) => {
    // Only care about gear items owned by THIS actor
    if (item?.parent?.id !== this.actor.id) return;
    if (item.type !== 'gear') return;
    if (!('system' in changes) || !('equipped' in (changes.system ?? {}))) return;

    const nowEquipped = !!foundry.utils.getProperty(item, 'system.equipped');
    if (nowEquipped) {
      // un-equip all other gear
      const others = this.actor.items.filter(i => i.type === 'gear' && i.id !== item.id && i.system?.equipped === true);
      const updates = others.map(i => ({ _id: i.id, 'system.equipped': false }));
      if (updates.length) await this.actor.updateEmbeddedDocuments('Item', updates);
      for (const i of others) await this._removeGearEffects(i);
      await this._applyGearEffects(item);
    } else {
      await this._removeGearEffects(item);
    }
    // light refresh
    this.render(false);
  });
}

  } // <-- end activateListeners

  // Mirror canonical calories into the "Calories" row in the Stats Vault
  async _syncCaloriesToVault(value) {
    const path = 'system.statsVault.attributes'
    const rows = foundry.utils.duplicate(foundry.utils.getProperty(this.actor, path) ?? [])
    const i = rows.findIndex(r => String(r?.name ?? '').toLowerCase() === 'calories')
    if (i < 0) return
    rows[i].detail1 = Number(value || 0)
    await this.actor.update({ [path]: rows })
  }
// Clone all effects from a consumable item onto the actor (non-transfer, timed)
// inside BenSystemActorSheet
async _applyConsumableEffects(item) {
  const srcEffects = item.effects?.contents ?? []
  if (!srcEffects.length) return

  const now = game.time?.worldTime ?? 0

  const create = srcEffects.map(ef => {
    const data = ef.toObject()
    data.transfer = false
    data.disabled = false
    data.origin   = item.uuid
    data.name   = data.name || `${item.name} (Consumed)`

    // merge flags without nuking others
    data.flags = foundry.utils.mergeObject(data.flags ?? {}, {
      'ben-system': { fromConsumable: true, deleteOnExpire: true }
    }, { inplace: false, overwrite: true })

    // start timing now if a seconds duration exists
    if (data?.duration?.seconds && !data.duration.startTime) {
      data.duration.startTime = now
    }
    return data
  })

  await this.actor.createEmbeddedDocuments('ActiveEffect', create)
}


/** Remove any actor effects that originated from this gear item */
async _removeGearEffects(item) {
  const toDelete = (this.actor.effects?.contents ?? [])
    .filter(e => e.getFlag?.('ben-system','fromGear') === true && e.origin === item.uuid)
    .map(e => e.id);
  if (toDelete.length) await this.actor.deleteEmbeddedDocuments('ActiveEffect', toDelete);
}

/** Apply all item effects to actor, tagged as fromGear */
async _applyGearEffects(item) {
  const src = item.effects?.contents ?? [];
  if (!src.length) return;

  // avoid duplicates: clear any existing from this item first
  await this._removeGearEffects(item);

  const now = game.time?.worldTime ?? 0;
  const docs = src.map(ef => {
    const data = ef.toObject();
    data.transfer = false;
    data.disabled = false;
    data.origin   = item.uuid;
    data.name     = data.name || `${item.name} (Equipped)`;
    data.flags ??= {};
    data.flags['ben-system'] = { fromGear: true };
    // start timed durations now if set in seconds
    if (data?.duration?.seconds && !data.duration.startTime) data.duration.startTime = now;
    return data;
  });
  await this.actor.createEmbeddedDocuments('ActiveEffect', docs);
}




  async close(options) {
    try {
      if (this._hooksBound) {
        if (this._boundItemRefresh) {
          Hooks.off('createItem', this._boundItemRefresh)
          Hooks.off('updateItem', this._boundItemRefresh)
          Hooks.off('deleteItem', this._boundItemRefresh)
          this._boundItemRefresh = null
        }
        if (this._boundEffectRefresh) {
          Hooks.off('createActiveEffect', this._boundEffectRefresh)
          Hooks.off('updateActiveEffect', this._boundEffectRefresh)
          Hooks.off('deleteActiveEffect', this._boundEffectRefresh)
          this._boundEffectRefresh = null
        }
        if (this._boundDropActorSheetData) {
          Hooks.off('dropActorSheetData', this._boundDropActorSheetData)
          this._boundDropActorSheetData = null
        }
        this._hooksBound = false
      }
    } finally {
      return super.close(options)
    }
  }

  async _onDrop(event) {
    const result = await super._onDrop(event)
    setTimeout(() => this.render(true), 0)
    return result
  }

  async _onDropItemCreate(itemData) {
    const created = await super._onDropItemCreate(itemData)
    setTimeout(() => this.render(true), 0)
    return created
  }

  async _onItemCreate(event) {
    event.preventDefault()
    const header = event.currentTarget
    theType: {
      const type = header.dataset.type ?? 'loot'
      const data = foundry.utils.duplicate(header.dataset ?? {})
      const cap = (s) => (s?.length ? s[0].toUpperCase() + s.slice(1) : '')
      const name = `New ${cap(type)}`
      const itemData = { name, type, system: data }
      delete itemData.system.type
      const created = await Item.create(itemData, { parent: this.actor })
      if (created) setTimeout(() => this.render(true), 0)
      return created
    }
  }

  _onRoll(event) {
    event.preventDefault()
    const element = event.currentTarget
    const dataset = element.dataset

    if (dataset.rollType === 'item') {
      const itemId = element.closest('.item').dataset.itemId
      const item = this.actor.items.get(itemId)
      if (item) return item.roll()
    }

    if (dataset.roll) {
      const label = dataset.label ? `[ability] ${dataset.label}` : ''
      const roll = new Roll(dataset.roll, this.actor.getRollData())
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      })
      return roll
    }
  }

  async _updateStatusEffectItem(itemId, patch) {
    const it = this.actor.items.get(itemId)
    if (!it) return
    await it.update(patch)
  }

  async _applyDamagingStatusTicks() {
    const actor = this.actor
    const maxHP = Number(foundry.utils.getProperty(actor, 'system.health.max') ?? 0)
    let curHP   = Number(foundry.utils.getProperty(actor, 'system.health.value') ?? 0)

    const dmgItems = actor.items.filter(it =>
      it.type === 'statuseffect' &&
      foundry.utils.getProperty(it, 'system.effect.kind') === 'Damage' &&
      !!foundry.utils.getProperty(it, 'system.effect.damage.active') &&
      Number(foundry.utils.getProperty(it, 'system.effect.damage.level') ?? 0) > 0
    )

    if (!dmgItems.length) {
      ui.notifications?.info('No active damaging status effects to apply.')
      return
    }

    let totalDamage = 0
    const updates = []
    const lines = []

    for (const it of dmgItems) {
      const d = it.system?.effect?.damage ?? {}
      let level = Math.max(0, Number(d.level ?? 0))
      const basePct = Number(d.hpPercentPerRound ?? 0)
      const pct = Math.max(basePct, level * 5)
      const dmg = Math.ceil(maxHP * (pct / 100))

      totalDamage += dmg
      lines.push(`${it.name || 'Effect'}: ${pct}% → ${dmg}`)

      const roundsPerLevel = Number(d.roundsPerLevel ?? 3)
      let roundsRemaining  = Number(d.roundsRemaining ?? roundsPerLevel) - 1

      if (roundsRemaining <= 0) {
        level = Math.max(0, level - 1)
        roundsRemaining = level > 0 ? roundsPerLevel : 0
      }

      updates.push({
        _id: it.id,
        'system.effect.damage.level': level,
        'system.effect.damage.roundsRemaining': roundsRemaining,
        'system.effect.damage.active': level > 0
      })
    }

    if (totalDamage > 0) {
      curHP = Math.max(0, curHP - totalDamage)
      await actor.update({ 'system.health.value': curHP })
    }

    if (updates.length) {
      await actor.updateEmbeddedDocuments('Item', updates)
    }

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p><b>${actor.name} – Start of Turn</b></p>
                <p>Total Damage: <b>${totalDamage}</b></p>
                <ul><li>${lines.join('</li><li>')}</li></ul>
                <p><b>HP:</b> ${curHP} / ${maxHP}</p>`
    })
  }

  async _applyEndOfTurnRegen() {
    const actor = this.actor
    const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

    const maxHP = toNum(foundry.utils.getProperty(actor, 'system.health.max') ?? 0)
    let curHP   = toNum(foundry.utils.getProperty(actor, 'system.health.value') ?? 0)

    const rawMisc = actor.system?.miscStats?.entries ?? []
    const miscEntries = Array.isArray(rawMisc)
      ? rawMisc
      : rawMisc && typeof rawMisc === 'object'
      ? Object.values(rawMisc)
      : []

    const regenRow = miscEntries.find(
      (e) => String(e?.name ?? '').trim().toLowerCase() === 'regeneration'
    )

    const regenLevel = toNum(regenRow?.level ?? 0)
    const regenPct   = toNum(regenLevel * 5)
    const regenAmt   = Math.floor(maxHP * (regenPct / 100))

    if (regenAmt <= 0 || maxHP <= 0) {
      ui.notifications?.info('No regeneration to apply.')
      return
    }

    const newHP = Math.min(maxHP, curHP + regenAmt)
    await actor.update({ 'system.health.value': newHP })

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p><b>End of Turn – Regeneration</b></p>
                <p>Restored <b>${regenAmt}</b> HP (${regenPct}%).</p>
                <p><b>HP:</b> ${newHP} / ${maxHP}</p>`
    })
  }

  // Always return a mutable array (kept, still useful)
  _getMiscEntriesArray() {
    const raw = foundry.utils.duplicate(this.actor.system?.miscStats?.entries ?? [])
    return Array.isArray(raw) ? raw : Object.values(raw ?? {})
  }

  async _onHistoryStep(event) {
    event.preventDefault()
    const btn = event.currentTarget

    const step = event.shiftKey ? 10 : 1
    const inc = btn.classList.contains('inc') ? step : -step

    const history = foundry.utils.duplicate(this.actor.system.history ?? {})
    history.damage ??= {}
    history.statusCounts ??= {}

    const toInt  = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
    const clamp0 = (n) => Math.max(0, n)

    if (btn.dataset.status) {
      const key = btn.dataset.status
      const cur = toInt(history.statusCounts[key] ?? 0)
      history.statusCounts[key] = clamp0(cur + inc)
      await this.actor.update({ 'system.history.statusCounts': history.statusCounts })
      return
    }

    let type   = btn.dataset.type || ''
    let source = btn.dataset.source || ''
    const field  = btn.dataset.field
    if (!type || !source || !field) return

    const normalizeSource = (s) => {
      const map = { melee: 'Melee', ranged: 'Ranged', explosive: 'Explosive' }
      const k = s.trim().toLowerCase()
      return map[k] ?? 'Melee'
    }
    source = normalizeSource(source)
    type   = String(type).trim()

    history.damage[type] ??= {}
    history.damage[type][source] ??= { done: 0, taken: 0 }

    const cur = toInt(history.damage[type][source][field] ?? 0)
    history.damage[type][source][field] = clamp0(cur + inc)

    await this.actor.update({ 'system.history.damage': history.damage })
  }

  async _onResistStep(event) {
    event.preventDefault()
    const btn = event.currentTarget

    const step = event.shiftKey ? 10 : 1
    const inc = btn.classList.contains('inc') ? step : -step

    const type  = btn.dataset.type
    const field = btn.dataset.field
    if (!type || !field) return

    const resistances = foundry.utils.duplicate(this.actor.system.resistances ?? {})
    resistances[type] ??= { flat: 0, perDice: 0, perLevel: 0 }

    const cur = Number(resistances[type][field] ?? 0)
    resistances[type][field] = Math.max(0, cur + inc)

    await this.actor.update({ 'system.resistances': resistances })
  }
}
