const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTypeScriptModule } = require('./load-typescript.cjs');

const discovery = loadTypeScriptModule('supabase/functions/_shared/coffee-discovery.ts');
const jsonLdHtml = fs.readFileSync(path.join(__dirname, 'fixtures/json-ld-menu.html'), 'utf8');
const genericHtml = fs.readFileSync(path.join(__dirname, 'fixtures/generic-menu.html'), 'utf8');

const source = {
  id: 'source-1',
  name: 'Example Coffee',
  slug: 'example-coffee',
  base_url: 'https://menu.example.com',
  menu_url: 'https://menu.example.com/drinks',
  enabled: true,
  parser_type: 'json_ld',
};

test('normalizes known coffee terms without changing the public source name', () => {
  assert.equal(
    discovery.normalizeDrinkName('Iced Brown Sugar Oatmilk Shaken Espresso with Coldfoam'),
    'iced brown sugar oat milk shaken espresso with cold foam',
  );
  assert.deepEqual(
    discovery.extractMentionedIngredients('Blonde espresso, white chocolate mocha, caramel drizzle and sweet cream.'),
    ['espresso', 'white chocolate', 'mocha', 'caramel', 'cream'],
  );
});

test('extracts controlled flavors and infers category and temperature', () => {
  const text = 'An iced pistachio and brown sugar oatmilk shaken espresso with cinnamon.';
  assert.deepEqual(discovery.extractFlavorNotes(text), ['brown sugar', 'cinnamon', 'pistachio']);
  assert.equal(discovery.inferCategory(text), 'shaken espresso');
  assert.equal(discovery.inferTemperature(text), 'iced');
});

test('builds a stable source-scoped fingerprint', () => {
  assert.equal(
    discovery.createFingerprint('starbucks', 'Brown Sugar Oatmilk Shaken Espresso'),
    'starbucks:brown-sugar-oat-milk-shaken-espresso',
  );
});

test('parses MenuItem JSON-LD from a stored fixture', () => {
  const drinks = discovery.parseJsonLdMenu(jsonLdHtml, source);
  assert.equal(drinks.length, 2);
  assert.deepEqual(drinks[0], {
    externalName: 'Iced Brown Sugar Oatmilk Shaken Espresso',
    externalDescription: 'Blonde espresso, brown sugar, cinnamon and oatmilk served over ice.',
    sourceUrl: source.menu_url,
    categoryHint: 'Espresso drinks',
  });
});

test('parses only marked generic menu cards and truncates descriptions', () => {
  const drinks = discovery.parseGenericHtml(genericHtml, { ...source, parser_type: 'generic' });
  assert.equal(drinks.length, 2);
  assert.equal(drinks[0].externalName, 'Salted Caramel Cold Brew');
  assert.equal(drinks[1].categoryHint, 'Seasonal');
  assert.ok(drinks.every((drink) => drink.externalDescription.length <= 280));
});

test('dispatches custom sources through a registered source adapter', () => {
  const customSource = { ...source, slug: 'custom-chain', parser_type: 'custom' };
  const adapter = {
    id: 'custom-chain-v1',
    supports: (candidate) => candidate.slug === 'custom-chain',
    parse: (_html, candidate) => [{
      externalName: 'Adapter Latte',
      externalDescription: 'Espresso and oat milk.',
      sourceUrl: candidate.menu_url,
    }],
  };

  const drinks = discovery.parseMenu('<html></html>', customSource, [adapter]);
  assert.equal(drinks[0].externalName, 'Adapter Latte');
  assert.throws(
    () => discovery.parseMenu('<html></html>', customSource),
    /No verified custom parser/,
  );
});

test('repeated fixture imports detect duplicates and preserve ignored records', () => {
  const parsed = discovery.parseJsonLdMenu(jsonLdHtml, source);
  const first = discovery.processParsedDrinks(source, parsed, []);
  assert.deepEqual(first.counts, { discovered: 2, new: 2, duplicate: 0, updated: 0, failed: 0 });

  const ignored = first.records.map((record, index) => ({
    ...record,
    id: `drink-${index + 1}`,
    status: index === 0 ? 'ignored' : 'new',
  }));
  const second = discovery.processParsedDrinks(source, parsed, ignored);
  assert.deepEqual(second.counts, { discovered: 2, new: 0, duplicate: 2, updated: 0, failed: 0 });
  assert.equal(second.records[0].status, 'ignored');

  const changed = parsed.map((drink, index) => index === 0
    ? { ...drink, externalDescription: `${drink.externalDescription} Cinnamon.` }
    : drink);
  const third = discovery.processParsedDrinks(source, changed, ignored);
  assert.equal(third.counts.updated, 1);
  assert.equal(third.records[0].status, 'ignored');
});

test('failed parsed records retain per-item action alignment', () => {
  const parsed = discovery.parseJsonLdMenu(jsonLdHtml, source);
  const result = discovery.processParsedDrinks(source, [
    parsed[0],
    { externalName: '', externalDescription: 'Missing name', sourceUrl: source.menu_url },
    parsed[1],
  ], []);
  assert.equal(result.counts.failed, 1);
  assert.deepEqual(result.items.map((item) => item.action), ['new', 'failed', 'new']);
  assert.equal(result.items[1].record, undefined);
});

test('draft conversion creates one test-required internal draft without copying source prose', () => {
  const parsed = discovery.parseJsonLdMenu(jsonLdHtml, source);
  const drink = discovery.processParsedDrinks(source, parsed, []).records[0];
  const draft = discovery.createRecipeDraft(drink, source, 'admin-user');
  assert.equal(draft.proposed_title, 'Iced Brown Sugar Oatmilk Shaken Espresso');
  assert.equal(draft.inspiration_label, 'Example Coffee Inspired');
  assert.equal(draft.needs_testing, true);
  assert.equal(draft.status, 'draft');
  assert.equal(draft.category, 'espresso');
  assert.notEqual(draft.description, drink.external_description);
  assert.deepEqual(draft.suggested_steps, ['Test and document the Crema recipe before publishing.']);
});

test('admin authorization trusts app metadata only', () => {
  assert.equal(discovery.isAdminUser({ app_metadata: { role: 'admin' }, user_metadata: {} }), true);
  assert.equal(discovery.isAdminUser({ app_metadata: {}, user_metadata: { role: 'admin' } }), false);
  assert.equal(discovery.isAdminUser(null), false);
});

test('SSRF validation accepts only the exact configured public HTTPS menu URL', () => {
  assert.equal(discovery.validateSourceUrl(source.menu_url, source).ok, true);
  assert.equal(discovery.validateSourceUrl('https://menu.example.com/private', source).ok, false);
  assert.equal(discovery.validateSourceUrl('http://menu.example.com/drinks', source).ok, false);
  assert.equal(
    discovery.validateSourceUrl('https://127.0.0.1/drinks', { ...source, menu_url: 'https://127.0.0.1/drinks' }).ok,
    false,
  );
  assert.equal(
    discovery.validateSourceUrl('https://metadata.google.internal/drinks', {
      ...source,
      menu_url: 'https://metadata.google.internal/drinks',
    }).ok,
    false,
  );
});

test('responsible fetch rejects robots exclusions, binary content, and oversized pages', async () => {
  const robotsBlocked = async (url) => new Response(
    url.endsWith('/robots.txt') ? 'User-agent: *\nDisallow: /drinks' : '<html></html>',
    { headers: { 'content-type': 'text/plain' } },
  );
  await assert.rejects(
    () => discovery.fetchMenuPage(source, { fetchImpl: robotsBlocked, timeoutMs: 1000, maxBytes: 1024 }),
    /robots\.txt/,
  );

  const binary = async (url) => new Response(
    url.endsWith('/robots.txt') ? '' : new Uint8Array([1, 2, 3]),
    { headers: { 'content-type': url.endsWith('/robots.txt') ? 'text/plain' : 'image/png' } },
  );
  await assert.rejects(
    () => discovery.fetchMenuPage(source, { fetchImpl: binary, timeoutMs: 1000, maxBytes: 1024 }),
    /content type/,
  );

  const oversized = async (url) => new Response(
    url.endsWith('/robots.txt') ? '' : '<html></html>',
    { headers: {
      'content-type': url.endsWith('/robots.txt') ? 'text/plain' : 'text/html',
      ...(url.endsWith('/robots.txt') ? {} : { 'content-length': '2048' }),
    } },
  );
  await assert.rejects(
    () => discovery.fetchMenuPage(source, { fetchImpl: oversized, timeoutMs: 1000, maxBytes: 1024 }),
    /maximum size/,
  );
});
