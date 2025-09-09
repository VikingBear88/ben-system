// systems/ben-system/module/helpers/hbs-helpers.mjs
Hooks.once('init', () => {
  const H = Handlebars;

  H.registerHelper('eq', (a, b) => String(a) === String(b));
  H.registerHelper('add', (a, b) => Number(a || 0) + Number(b || 0));
  H.registerHelper('array', (...args) => args.slice(0, -1)); // strip HB options object

  // range(1, 21) -> [1..20]
  H.registerHelper('range', (start, end) => {
    const s = Number(start || 0), e = Number(end || 0);
    const out = [];
    for (let i = s; i < e; i++) out.push(i);
    return out;
  });

  H.registerHelper('toLowerCase', (v) => String(v ?? '').toLowerCase());
});
