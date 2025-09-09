import { AbilityBaseSheet } from "./ability-base-sheet.mjs";

export class SpellSheet extends AbilityBaseSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ben-system", "sheet", "item"],
      width: 640,
      height: 580,
      tabs: [
        { navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "details" }
      ]
    });
  }

  get template() {
    return "systems/ben-system/templates/item/item-spelllike-sheet.hbs";
  }

  async getData(options) {
    const ctx = await super.getData(options);
    ctx.item = this.item;
    ctx.system = this.item.system ?? {};
    ctx.editable = this.isEditable;
    return ctx;
  }
}