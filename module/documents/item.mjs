// systems/ben-system/module/documents/item.mjs
export class BenSystemItem extends Item {
  /** Only fill defaults; never overwrite user data on prepare */
  prepareBaseData() {
    super.prepareBaseData?.();

    const s = this.system ??= {};

    // Common ability-ish fields
    s.actions  ??= { type: 'standard', qty: 1 };
    s.cooldown ??= { turns: 0 };
    s.level    ??= { base: 1, bonus: 0, unlock20: false, max: 20 };
    s.progress ??= { uses: 0, initialUses: 0, factor: 1, flat: 0 };
    s.prereqs  ??= Array.isArray(s.prereqs) ? s.prereqs : [];
    s.unlocks  ??= Array.isArray(s.unlocks) ? s.unlocks : [];
    s.tags     ??= (typeof s.tags === 'string' ? s.tags : '');

    switch (this.type) {
      case 'skillcombat': {
        s.skill  ??= { category: 'Combat', combat: true };
        s.combat ??= {};
        s.combat.weaponType ??= 'ThrownAmmo';
        s.combat.damageType ??= 'none';
        s.combat.hitMod     ??= 0;
        break;
      }

      case 'skillcharisma':
      case 'skillcrafting':
      case 'skillmovement':
      case 'skillperception':
      case 'skillstealth': {
        s.skill ??= { category: 'General', combat: false };
        break;
      }

      case 'spell':
      case 'ritual':
      case 'music': {
        s.spell ??= { manaCost: 0, source: 'Radiant', vs: 'MAC' };
        break;
      }

      default:
        // leave other item types alone
        break;
    }
  }

  /** Derived values only — do not write to system.* here. */
  prepareDerivedData() {
    super.prepareDerivedData?.();
    // If you compute preview-only values, stash them under a private key
    // like this.system._computed = {...} to avoid clobbering form fields.
  }
}
