// (no extra imports required)
// scripts/workflows/use-ability-dialog.mjs
export class UseAbilityDialog extends Application {
  static async prompt({ actor, item, isSpell, isCombatSkill }) {
    const dlg = new this({ actor, item, isSpell, isCombatSkill });
    return new Promise(res => {
      dlg.onSubmit = res;
      dlg.render(true);
    });
  }

  constructor(opts) {
    super({ title: `Use: ${opts.item.name}`, width: 420, height: "auto", resizable: false });
    this.data = opts;
  }

  get template() { return "systems/ben-system/templates/apps/use-ability-dialog.hbs"; }
  activateListeners(html) {
    html.find('button.use').on('click', ev => {
      ev.preventDefault();
      const f = html[0].querySelector('form');
      const v = (name)=> {
        const el = f.elements.namedItem(name);
        if (!el) return undefined;
        if (el.type === 'checkbox') return el.checked;
        return el.value;
      };
      this.close();
      this.onSubmit?.({
        advantage: !!v("advantage"),
        disadvantage: !!v("disadvantage"),
        sitMod: Number(v("sitMod")||0),
        targets: Number(v("targets")||0),
        multiCount: Number(v("multiCount")||1),
        increment: !!v("increment"),
        countAsOne: !!v("countAsOne"),
        ignoreCost: !!v("ignoreCost")
      });
    });
    html.find('button.cancel').on('click', e => { e.preventDefault(); this.close(); this.onSubmit?.(null); });
  }
}
