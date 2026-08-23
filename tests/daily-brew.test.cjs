const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScriptModule } = require('./load-typescript.cjs');

const { selectDailyBrewRecipeId, formatDateKey } = loadTypeScriptModule('lib/daily-brew.ts');

test('selectDailyBrewRecipeId is deterministic for a given day', () => {
  const candidates = [
    { id: 'a', hasApprovedImage: true },
    { id: 'b', hasApprovedImage: true },
    { id: 'c', hasApprovedImage: true },
  ];

  const first = selectDailyBrewRecipeId(candidates, '2026-08-22');
  const second = selectDailyBrewRecipeId(candidates, '2026-08-22');
  assert.equal(first, second);
  assert.ok(candidates.some((candidate) => candidate.id === first));
});

test('selectDailyBrewRecipeId prefers recipes with approved imagery', () => {
  const candidates = [
    { id: 'no-image', hasApprovedImage: false },
    { id: 'approved', hasApprovedImage: true },
  ];

  for (const dateKey of ['2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23', '2026-08-24']) {
    assert.equal(selectDailyBrewRecipeId(candidates, dateKey), 'approved');
  }
});

test('selectDailyBrewRecipeId falls back to any eligible recipe when none have approved imagery', () => {
  const candidates = [
    { id: 'a', hasApprovedImage: false },
    { id: 'b', hasApprovedImage: false },
  ];
  const pick = selectDailyBrewRecipeId(candidates, '2026-08-22');
  assert.ok(['a', 'b'].includes(pick));
});

test('selectDailyBrewRecipeId returns null when there are no eligible recipes', () => {
  assert.equal(selectDailyBrewRecipeId([], '2026-08-22'), null);
});

test('selectDailyBrewRecipeId returns the sole candidate even if it repeats day over day', () => {
  const candidates = [{ id: 'only', hasApprovedImage: true }];
  assert.equal(selectDailyBrewRecipeId(candidates, '2026-08-22'), 'only');
  assert.equal(selectDailyBrewRecipeId(candidates, '2026-08-23'), 'only');
});

test('selectDailyBrewRecipeId reduces immediate day-over-day repeats across a varied pool', () => {
  const candidates = Array.from({ length: 6 }, (_, index) => ({ id: `r${index}`, hasApprovedImage: true }));
  let repeats = 0;
  let previous = null;
  for (let day = 1; day <= 30; day += 1) {
    const dateKey = `2026-${String(Math.ceil(day / 28)).padStart(2, '0')}-${String(((day - 1) % 28) + 1).padStart(2, '0')}`;
    const pick = selectDailyBrewRecipeId(candidates, dateKey);
    if (pick === previous) repeats += 1;
    previous = pick;
  }
  // Not an absolute guarantee (the selector only looks one day back), but with six
  // candidates immediate repeats should be rare.
  assert.ok(repeats <= 2, `expected few immediate repeats, saw ${repeats}`);
});

test('formatDateKey renders a stable YYYY-MM-DD key from a UTC date', () => {
  assert.equal(formatDateKey(new Date(Date.UTC(2026, 7, 22))), '2026-08-22');
  assert.equal(formatDateKey(new Date(Date.UTC(2026, 0, 5))), '2026-01-05');
});
