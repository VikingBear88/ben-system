export const BEN = {};

function buildLevelThresholds(maxLevel = 250) {
  const base = [
    0, 100, 300, 700, 1599, 3100, 6300, 12700,
    24500, 51100, 81100, 116100, 156100, 176100,
    196100, 216100, 246100, 276100, 316100, 356100,
    406100, 456100, 516100, 576100
  ];

  const thresholds = [...base];

  for (let L = thresholds.length; L < maxLevel; L++) {
    const prevXP = thresholds[L - 1];
    const delta = 20000 + 10000 * Math.floor((L - 14) / 2);
    thresholds.push(prevXP + delta);
  }
  return thresholds;
}

BEN.levelThresholds = buildLevelThresholds(250);

CONFIG.BEN = BEN;
