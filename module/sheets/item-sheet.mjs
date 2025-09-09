import {
  prepareActiveEffectCategories,
} from '../helpers/effects.mjs';

/* ---------------- Register the @btn[...] enricher once ---------------- */
Hooks.once('init', () => {
  const cfg = (CONFIG.TextEditor ??= {});
  if (cfg._benTattooBtnEnricher) return;
  cfg._benTattooBtnEnricher = true;

  (cfg.enrichers ??= []).push({
    // Usage in rich text:
    // @btn[1d20|Shoulder,Bicep,...,Eye]{Roll for tattoo placement}
    pattern: /@btn\[(?<spec>[^\]]+)\]\{(?<label>[^}]+)\}/gi,
    enricher: async (m) => {
      const [formula, csv] = (m.groups.spec ?? '').split('|');
      const a = document.createElement('a');
      a.classList.add('tattoo-roll');
      a.dataset.formula = (formula || '1d20').trim();
      a.dataset.targets = (csv ?? '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .join('|'); // store list safely in a data-* attribute
      a.textContent = (m.groups.label ?? 'Roll').trim();
      a.title = `Roll ${a.dataset.formula}`;
      return a;
    }
  });
});

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class BenSystemItemSheet extends ItemSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['ben-system', 'sheet', 'item'],
      width: 520,
      height: 480,
      tabs: [
        {
          navSelector: '.sheet-tabs',
          contentSelector: '.sheet-body',
          initial: 'description',
        },
      ],
    });
  }

  /** @override */
  get template() {
    const path = 'systems/ben-system/templates/item';
    return `${path}/item-${this.item.type}-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData(options) {
    const context = await super.getData(options);

    const itemData = this.document.toObject(false);

    // Pre-enrich description so our custom enricher definitely runs.
    const TE =
      foundry?.applications?.ux?.TextEditor?.implementation ??
      TextEditor;

    const rollData =
      this.actor?.getRollData?.() ??
      this.item?.getRollData?.() ??
      {};

    context.enrichedDescription = await TE.enrichHTML(
      this.item.system?.description ?? "",
      {
        secrets: this.document.isOwner,
        async: true,
        rollData,
        relativeTo: this.item,
      }
    );

    context.system  = itemData.system;
    context.flags   = itemData.flags;
    context.config  = CONFIG.BOILERPLATE;
    context.effects = prepareActiveEffectCategories(this.item.effects);

    // armour selects
    context.armourTypeOptions = {
      Armour: "Armour",
      Tattoo: "Tattoo",
      Implant: "Implant",
      None: "None"
    };

    // weapon selects
    context.weaponClassOptions = {
      Melee: "Melee",
      Ranged: "Ranged",
      Casting: "Casting",
      Instrument: "Instrument",
      Siege: "Siege",
      None: "None"
    };

    context.bodyRegionOptions = {
      Head: "Head",
      Arms: "Arms",
      Hands: "Hands",
      Torso: "Torso",
      Legs: "Legs",
      Feet: "Feet",
      Face: "Face",
      Neck: "Neck",
      Belt: "Belt",
      None: "None"
    };

    context.weaponTypeOptions = {
      LightPiercing: "Light Piercing",
      LightBludgeoning: "Light Bludgeoning",
      LightSlashing: "Light Slashing",
      MediumPiercing: "Medium Piercing",
      MediumBludgeoning: "Medium Bludgeoning",
      MediumSlashing: "Medium Slashing",
      HeavyPiercing: "Heavy Piercing",
      HeavyBludgeoning: "Heavy Bludgeoning",
      HeavySlashing: "Heavy Slashing",
      ThrownAmmo: "Thrown Ammo",
      ThrownWeapon: "Thrown Weapon",
      Sling: "Sling",
      OneHandCrossbow: "1h Crossbow",
      Bow: "Bow",
      Blowgun: "Blowgun",
      Crossbow: "Crossbow",
      HeavyRanged: "Heavy Ranged",
      Siege: "Siege",
      Spray: "Spray",
      Whip: "Whip",
      Unarmed: "Unarmed",
      None: "None"
    };

    // Simple (ungrouped) list for Sub-Region
    context.subRegionOptions = {
      None: 'None',
      Hat: 'Hat',
      Bandana: 'Bandana',
      Hair: 'Hair',
      Over: 'Over',
      Under: 'Under',
      Necklace: 'Necklace',
      Shoulder: 'Shoulder',
      Bicep: 'Bicep',
      Wrist: 'Wrist',
      Hands: 'Hands',
      Fingers: 'Fingers',
      Palm: 'Palm',
      LegArmour: 'Leg Armour',
      LegFrills: 'Leg Frills',
      LegPadding: 'Leg Padding',
      TorsoArmour: 'Torso Armour',
      Tabard: 'Tabard',
      TorsoPadding: 'Torso Padding',
      Shirt: 'Shirt',
      Vest: 'Vest',
      UpperBack: 'Upper Back',
      LowerBack: 'Lower Back',
      Pectoral: 'Pectoral',
      Stomach: 'Stomach',
      Underwear: 'Underwear',
      Thigh: 'Thigh',
      Shin: 'Shin',
      Butt: 'Butt',
      Boots: 'Boots',
      Toe: 'Toe',
      Socks: 'Socks',
      Forehead: 'Forehead',
      Eyes: 'Eyes',
      Ears: 'Ears',
      Cheek: 'Cheek',
      Nose: 'Nose',
      Eyebrow: 'Eyebrow',
      Mouth: 'Mouth',
      Chin: 'Chin',
      Belt: 'Belt',
      Attatchment: 'Attatchment',
      ImplantHead: 'Implant - Head',
      ImplantFace: 'Implant - Face',
      ImplantNeck: 'Implant - Neck',
      ImplantTorso: 'Implant - Torso',
      ImplantArms: 'Implant - Arms',
      ImplantHands: 'Implant - Hands',
      ImplantLegs: 'Implant - Legs',
      ImplantGroin: 'Implant - Groin',
      ImplantFeet: 'Implant - Feet',
      ImplantNone: 'Implant - None'
    };

    context.weaponDamageOptions = {
      AcidMelee: "AcidMelee",
      AcidRanged: "AcidRanged",
      BludgeoningMelee: "BludgeoningMelee",
      BludgeoningRanged: "BludgeoningRanged",
      ColdMelee: "ColdMelee",
      ColdRanged: "ColdRanged",
      FireMelee: "FireMelee",
      FireRanged: "FireRanged",
      ForceMelee: "ForceMelee",
      ForceRanged: "ForceRanged",
      LightningMelee: "LightningMelee",
      LightningRanged: "LightningRanged",
      NecroticMelee: "NecroticMelee",
      NecroticRanged: "NecroticRanged",
      PiercingMelee: "PiercingMelee",
      PiercingRanged: "PiercingRanged",
      PoisonMelee: "PoisonMelee",
      PoisonRanged: "PoisonRanged",
      PsychicMelee: "PsychicMelee",
      PsychicRanged: "PsychicRanged",
      RadiantMelee: "RadiantMelee",
      RadiantRanged: "RadiantRanged",
      SlashingMelee: "SlashingMelee",
      SlashingRanged: "SlashingRanged",
      SonicMelee: "SonicMelee",
      SonicRanged: "SonicRanged",
      None: "None"
    };

    context.statusEffectKind = {
      Damage: "Damage",
      Buff: "Buff",
      Debuff: "Debuff",
      Control: "Control",
      System: "System"
    };

    context.statusEffectDamage = {
      Bleed: "Bleed",
      Burn: "Burn",
      Poison: "Poison",
    };

    return context;
  }

  /* -------------------------------------------- */

  /** Handle effect-control buttons inside the Effects tab */
  async _onEffectControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const action = a.dataset.action;
    const li = a.closest("[data-effect-id]");
    const effectId = li?.dataset.effectId;

    switch (action) {
      case "create":
        return this.item.createEmbeddedDocuments("ActiveEffect", [{
          name: "New Effect",
          img:  this.item.img,
          origin: this.item.uuid,
          transfer: true,
          disabled: true,
          changes: []
        }]);

      case "edit": {
        const ef = this.item.effects.get(effectId);
        return ef?.sheet.render(true);
      }

      case "toggle": {
        const ef = this.item.effects.get(effectId);
        if (ef) return ef.update({ disabled: !ef.disabled });
        break;
      }

      case "delete":
        if (effectId) return this.item.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
        break;
    }
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // +/- steppers
    html.find(".arm-step").on("click", (ev) => {
      ev.preventDefault();
      const btn  = ev.currentTarget;
      const path = btn.dataset.name;           // e.g. "system.pacBonus"
      if (!path) return;

      const cur  = Number(foundry.utils.getProperty(this.item, path) ?? 0);
      const step = btn.classList.contains("inc") ? 1 : -1;

      const $cell  = $(btn).closest('.num-cell');
      const $input = $cell.find(`input[name="${path}"]`);
      const min    = $input.length && $input.attr('min') !== undefined
        ? Number($input.attr('min'))
        : -Infinity;

      const next = Math.max(min, cur + step);
      this.item.update({ [path]: next });
    });

    // Click-to-roll handler for @btn[...] links
    html.on('click', 'a.tattoo-roll', async (ev) => {
      ev.preventDefault();
      const $a = $(ev.currentTarget);

      const formula = String($a.data('formula') || '1d20');
      const targets = String($a.data('targets') || '').split('|').filter(Boolean);

      const rollData =
        this.actor?.getRollData?.() ??
        this.item?.getRollData?.() ??
        {};

      const roll = await (new Roll(formula, rollData)).roll({ async: true });

      const idx  = Math.min(targets.length, Math.max(1, Number(roll.total))) - 1;
      const spot = targets[idx] || `??? (${roll.total})`;

      const rawItemName = this.item?.name ?? 'tattoo';
      const itemName = foundry.utils.escapeHTML(rawItemName);
      const safeSpot = foundry.utils.escapeHTML(spot);

      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `A <em>${itemName}</em> appears on your <strong>${safeSpot}</strong>.`
      });
    });

    // Active Effect management
    html.on("click", ".effect-control", this._onEffectControl.bind(this));
  }
}

// sheets/item-sheet.mjs (add at bottom or a new file if you prefer)
import { BEN_SYSTEM } from "../helpers/config.mjs";
import { computeLevelFromUses, clampEffectiveLevel } from "../helpers/progression.mjs";

export class BenSystemAbilityItemSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['ben-system','sheet','item','ability'],
      width: 620, height: 560,
      tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'details' }]
    });
  }

  get template() {
    return `systems/ben-system/templates/item/item-ability-sheet.hbs`;
  }

  async getData(options) {
    const ctx = await super.getData(options);
    ctx.cfg = BEN_SYSTEM;
    const s = ctx.item.system || {};

    // Derived: effective level (for display)
    ctx.levels = {
      base: Number(s.level?.base ?? 1),
      bonus: Number(s.level?.bonus ?? 0),
      eff: clampEffectiveLevel(Number(s.level?.base ?? 1) + Number(s.level?.bonus ?? 0), s.level?.unlock20, s.level?.max),
      cap: s.level?.unlock20 ? Math.min(20, s.level?.max ?? 20) : 15
    };

    // Preview what level the current uses imply (capped at 15)
    const totalUses = Number(s.progress?.initialUses ?? 0) + Number(s.progress?.uses ?? 0);
    ctx.previewLevel = computeLevelFromUses(totalUses);

    ctx.isGM = game.user.isGM;
    ctx.isSkillCombat = (ctx.item.type === 'skill-combat');
    ctx.isSpellish = (ctx.item.type === 'spell' || ctx.item.type === 'ritual' || ctx.item.type === 'music');
    return ctx;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Handle unlock drag/drop (drop an Item to a level row)
    html.on('drop', '.unlock-drop', async ev => {
      ev.preventDefault();
      const data = TextEditor.getDragEventData(ev);
      if (data?.type !== "Item") return;
      const lvl = Number(ev.currentTarget.dataset.lvl ?? 0);
      const uuid = data.uuid || (data.pack ? `Compendium.${data.pack}.${data.id}` : this.item?.uuid);
      if (!lvl || !uuid) return;
      const arr = Array.from(this.item.system.unlocks ?? []);
      if (!arr.find(u => u.lvl === lvl && u.uuid === uuid)) {
        arr.push({ lvl, uuid });
        await this.item.update({ "system.unlocks": arr });
      }
    });
  }
}
