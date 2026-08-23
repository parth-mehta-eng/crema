export type ParserType = 'json_ld' | 'generic' | 'custom';
export type DrinkStatus = 'new' | 'reviewed' | 'ignored' | 'converted';
export type DraftStatus = 'draft' | 'tested' | 'ready' | 'published' | 'archived';
export type DrinkTemperature = 'hot' | 'iced' | 'either';
export type DrinkCategory =
  | 'latte'
  | 'mocha'
  | 'macchiato'
  | 'cold brew'
  | 'shaken espresso'
  | 'blended'
  | 'tea'
  | 'matcha'
  | 'seasonal'
  | 'other';

export type CoffeeSource = {
  id: string;
  name: string;
  slug: string;
  base_url: string;
  menu_url: string;
  enabled: boolean;
  parser_type: ParserType;
};

export type ParsedDrink = {
  externalName: string;
  externalDescription: string;
  sourceUrl: string;
  categoryHint?: string;
};

export type MenuParser = {
  id: string;
  supports: (source: CoffeeSource) => boolean;
  parse: (html: string, source: CoffeeSource) => ParsedDrink[];
};

export type DiscoveredDrinkRecord = {
  id?: string;
  source_id: string;
  external_name: string;
  normalized_name: string;
  external_description: string;
  source_url: string;
  category: DrinkCategory;
  temperature: DrinkTemperature;
  flavor_notes: string[];
  mentioned_ingredients: string[];
  season: string | null;
  fingerprint: string;
  status: DrinkStatus;
};

export type ImportCounts = {
  discovered: number;
  new: number;
  duplicate: number;
  updated: number;
  failed: number;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type FetchOptions = {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  maxBytes?: number;
  userAgent?: string;
};

const DESCRIPTION_LIMIT = 280;
export const DISCOVERY_USER_AGENT =
  'CremaCoffeeDiscovery/1.0 (+private menu research; contact: admin@crema.local)';

const flavorNotes = [
  'caramel',
  'vanilla',
  'brown sugar',
  'cinnamon',
  'white chocolate',
  'chocolate',
  'pistachio',
  'hazelnut',
  'honey',
  'lavender',
  'peppermint',
  'pumpkin',
  'maple',
  'coconut',
] as const;

const ingredientTerms = [
  'espresso',
  'coffee',
  'cold brew',
  'matcha',
  'tea',
  'oat milk',
  'milk',
  'cold foam',
  'white chocolate',
  'mocha',
  'caramel',
  'cream',
  'brown sugar',
  'cinnamon',
  'vanilla',
  'pistachio',
  'hazelnut',
  'honey',
  'lavender',
  'peppermint',
  'pumpkin',
  'maple',
  'coconut',
] as const;

function decodeHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAliases(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/\boat\s*milk\b/g, 'oat milk')
    .replace(/\bcold\s*foam\b/g, 'cold foam')
    .replace(/\bblonde espresso\b/g, 'espresso')
    .replace(/\bsweet cream\b/g, 'cream')
    .replace(/\bcaramel drizzle\b/g, 'caramel')
    .replace(/\bwhite chocolate mocha\b/g, 'white chocolate mocha')
    .replace(/[^a-z0-9'&+ -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeDrinkName(name: string) {
  return normalizeAliases(decodeHtml(name));
}

function slugify(value: string) {
  return normalizeAliases(value)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function createFingerprint(sourceSlug: string, drinkName: string) {
  return `${slugify(sourceSlug)}:${slugify(normalizeDrinkName(drinkName))}`;
}

export function extractFlavorNotes(value: string) {
  const normalized = normalizeAliases(value);
  return flavorNotes.filter((flavor) => {
    if (flavor === 'chocolate' && normalized.includes('white chocolate')) return false;
    return normalized.includes(flavor);
  });
}

export function extractMentionedIngredients(value: string) {
  const normalized = normalizeAliases(value);
  return ingredientTerms.filter((ingredient) => {
    if (ingredient === 'coffee' && normalized.includes('cold brew')) return false;
    if (ingredient === 'milk' && normalized.includes('oat milk')) return false;
    return normalized.includes(ingredient);
  });
}

export function inferCategory(value: string): DrinkCategory {
  const normalized = normalizeAliases(value);
  if (normalized.includes('shaken espresso')) return 'shaken espresso';
  if (normalized.includes('cold brew')) return 'cold brew';
  if (normalized.includes('macchiato')) return 'macchiato';
  if (normalized.includes('mocha')) return 'mocha';
  if (normalized.includes('latte')) return 'latte';
  if (normalized.includes('matcha')) return 'matcha';
  if (normalized.includes('tea')) return 'tea';
  if (/\b(blended|frappe|frappuccino|frozen)\b/.test(normalized)) return 'blended';
  if (/\b(seasonal|holiday|limited time)\b/.test(normalized)) return 'seasonal';
  return 'other';
}

export function inferTemperature(value: string): DrinkTemperature {
  const normalized = normalizeAliases(value);
  if (/\b(iced|ice|cold|frozen|chilled)\b/.test(normalized)) return 'iced';
  if (/\b(hot|warm|steamed)\b/.test(normalized)) return 'hot';
  return 'either';
}

function inferSeason(value: string) {
  const normalized = normalizeAliases(value);
  if (/\b(pumpkin|autumn|fall)\b/.test(normalized)) return 'fall';
  if (/\b(peppermint|holiday|winter)\b/.test(normalized)) return 'winter';
  if (/\b(lavender|spring)\b/.test(normalized)) return 'spring';
  if (/\b(coconut|summer)\b/.test(normalized)) return 'summer';
  return null;
}

function shortDescription(value: string) {
  const clean = decodeHtml(value);
  return clean.length <= DESCRIPTION_LIMIT ? clean : `${clean.slice(0, DESCRIPTION_LIMIT - 1).trimEnd()}…`;
}

function jsonLdType(value: unknown) {
  return Array.isArray(value) ? value : [value];
}

function collectJsonLdItems(
  value: unknown,
  sourceUrl: string,
  categoryHint: string | undefined,
  drinks: ParsedDrink[],
) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonLdItems(item, sourceUrl, categoryHint, drinks));
    return;
  }
  if (!value || typeof value !== 'object') return;

  const item = value as Record<string, unknown>;
  const types = jsonLdType(item['@type']).map(String);
  const nextCategory = types.includes('MenuSection') && typeof item.name === 'string'
    ? shortDescription(item.name)
    : categoryHint;

  if (types.includes('MenuItem') && typeof item.name === 'string') {
    drinks.push({
      externalName: shortDescription(item.name),
      externalDescription: typeof item.description === 'string' ? shortDescription(item.description) : '',
      sourceUrl,
      ...(nextCategory ? { categoryHint: nextCategory } : {}),
    });
  }

  Object.entries(item).forEach(([key, child]) => {
    if (key !== '@context' && key !== '@type' && key !== 'name' && key !== 'description') {
      collectJsonLdItems(child, sourceUrl, nextCategory, drinks);
    }
  });
}

export function parseJsonLdMenu(html: string, source: CoffeeSource): ParsedDrink[] {
  const drinks: ParsedDrink[] = [];
  const scripts = html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );

  for (const match of scripts) {
    try {
      collectJsonLdItems(JSON.parse(match[1] ?? ''), source.menu_url, undefined, drinks);
    } catch {
      // One malformed JSON-LD block should not discard other valid blocks.
    }
  }

  return drinks.filter((drink) => drink.externalName.length > 0);
}

function readAttribute(attributes: string, name: string) {
  const match = attributes.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'));
  return match?.[1] ? decodeHtml(match[1]) : undefined;
}

export function parseGenericHtml(html: string, source: CoffeeSource): ParsedDrink[] {
  const drinks: ParsedDrink[] = [];
  const cardPattern = /<(article|div|li)\b([^>]*(?:data-menu-item|class=["'][^"']*menu-item[^"']*["'])[^>]*)>([\s\S]*?)<\/\1>/gi;

  for (const match of html.matchAll(cardPattern)) {
    const attributes = match[2] ?? '';
    const body = match[3] ?? '';
    const heading = body.match(/<h[2-4]\b[^>]*>([\s\S]*?)<\/h[2-4]>/i);
    const paragraph = body.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    const externalName = shortDescription(readAttribute(attributes, 'data-name') ?? heading?.[1] ?? '');
    if (!externalName) continue;

    const categoryHint = readAttribute(attributes, 'data-category');
    drinks.push({
      externalName,
      externalDescription: shortDescription(paragraph?.[1] ?? ''),
      sourceUrl: source.menu_url,
      ...(categoryHint ? { categoryHint } : {}),
    });
  }

  return drinks;
}

export function parseMenu(html: string, source: CoffeeSource, customParsers: MenuParser[] = []) {
  if (source.parser_type === 'json_ld') return parseJsonLdMenu(html, source);
  if (source.parser_type === 'generic') return parseGenericHtml(html, source);
  const customParser = customParsers.find((parser) => parser.supports(source));
  if (customParser) return customParser.parse(html, source);
  throw new Error(`No verified custom parser is registered for ${source.slug}.`);
}

export function normalizeParsedDrink(source: CoffeeSource, parsed: ParsedDrink): DiscoveredDrinkRecord {
  const externalName = shortDescription(parsed.externalName);
  if (!externalName) throw new Error('Drink name is required.');
  const externalDescription = shortDescription(parsed.externalDescription);
  const combined = `${externalName} ${externalDescription} ${parsed.categoryHint ?? ''}`;

  return {
    source_id: source.id,
    external_name: externalName,
    normalized_name: normalizeDrinkName(externalName),
    external_description: externalDescription,
    source_url: parsed.sourceUrl,
    category: inferCategory(combined),
    temperature: inferTemperature(combined),
    flavor_notes: extractFlavorNotes(combined),
    mentioned_ingredients: extractMentionedIngredients(combined),
    season: inferSeason(combined),
    fingerprint: createFingerprint(source.slug, externalName),
    status: 'new',
  };
}

function comparableDrink(record: DiscoveredDrinkRecord) {
  const { id: _id, status: _status, ...comparable } = record;
  return JSON.stringify(comparable);
}

export function processParsedDrinks(
  source: CoffeeSource,
  parsedDrinks: ParsedDrink[],
  existingRecords: DiscoveredDrinkRecord[],
) {
  const existingByFingerprint = new Map(
    existingRecords.map((record) => [record.fingerprint, record]),
  );
  const counts: ImportCounts = {
    discovered: parsedDrinks.length,
    new: 0,
    duplicate: 0,
    updated: 0,
    failed: 0,
  };
  const records: DiscoveredDrinkRecord[] = [];
  const actions: Array<'new' | 'duplicate' | 'updated' | 'failed'> = [];
  const items: Array<{
    action: 'new' | 'duplicate' | 'updated' | 'failed';
    record?: DiscoveredDrinkRecord;
  }> = [];

  parsedDrinks.forEach((parsed) => {
    try {
      const normalized = normalizeParsedDrink(source, parsed);
      const existing = existingByFingerprint.get(normalized.fingerprint);
      if (!existing) {
        counts.new += 1;
        records.push(normalized);
        actions.push('new');
        items.push({ action: 'new', record: normalized });
        return;
      }

      const merged = { ...normalized, id: existing.id, status: existing.status };
      if (comparableDrink(merged) === comparableDrink(existing)) {
        counts.duplicate += 1;
        records.push(existing);
        actions.push('duplicate');
        items.push({ action: 'duplicate', record: existing });
      } else {
        counts.updated += 1;
        records.push(merged);
        actions.push('updated');
        items.push({ action: 'updated', record: merged });
      }
    } catch {
      counts.failed += 1;
      actions.push('failed');
      items.push({ action: 'failed' });
    }
  });

  return { counts, records, actions, items };
}

export function createRecipeDraft(
  drink: DiscoveredDrinkRecord,
  source: CoffeeSource,
  adminUserId: string,
) {
  const equipment = drink.mentioned_ingredients.includes('espresso')
    ? ['espresso-machine']
    : [];

  return {
    discovered_drink_id: drink.id,
    proposed_title: drink.external_name,
    inspiration_label: `${source.name} Inspired`,
    source_name: source.name,
    source_url: drink.source_url,
    description: `Internal Crema draft inspired by a public ${source.name} menu listing. Rewrite and test before publishing.`,
    category: ['latte', 'mocha', 'macchiato', 'shaken espresso'].includes(drink.category)
      ? 'espresso'
      : drink.category === 'other' ? 'coffee' : drink.category,
    temperature: drink.temperature,
    flavor_notes: drink.flavor_notes,
    suggested_ingredients: drink.mentioned_ingredients,
    suggested_equipment: equipment,
    suggested_steps: ['Test and document the Crema recipe before publishing.'],
    needs_testing: true,
    status: 'draft' as DraftStatus,
    created_by: adminUserId,
  };
}

export function isAdminUser(user: { app_metadata?: Record<string, unknown> } | null | undefined) {
  return user?.app_metadata?.role === 'admin';
}

function isUnsafeHostname(hostname: string) {
  const normalized = hostname.toLocaleLowerCase().replace(/^\[|\]$/g, '');
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal')
  ) return true;
  if (normalized.includes(':')) return true;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalized)) return true;
  return false;
}

export function validateSourceUrl(requestedUrl: string, source: CoffeeSource) {
  try {
    const requested = new URL(requestedUrl);
    const configured = new URL(source.menu_url);
    const valid =
      requested.protocol === 'https:' &&
      requested.username === '' &&
      requested.password === '' &&
      (requested.port === '' || requested.port === '443') &&
      !isUnsafeHostname(requested.hostname) &&
      requested.href === configured.href;
    return valid
      ? { ok: true as const, url: requested.href }
      : { ok: false as const, error: 'Only the exact configured public HTTPS menu URL may be fetched.' };
  } catch {
    return { ok: false as const, error: 'The configured menu URL is invalid.' };
  }
}

function robotsDisallows(robots: string, pathname: string) {
  let applies = false;
  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const directive = line.slice(0, separator).trim().toLocaleLowerCase();
    const value = line.slice(separator + 1).trim();
    if (directive === 'user-agent') {
      applies = value === '*' || value.toLocaleLowerCase().includes('cremacoffeediscovery');
    } else if (directive === 'disallow' && applies && value && pathname.startsWith(value)) {
      return true;
    }
  }
  return false;
}

async function fetchWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  timeoutMs: number,
  userAgent: string,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/ld+json;q=0.9,text/plain;q=0.1',
        'User-Agent': userAgent,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchMenuPage(source: CoffeeSource, options: FetchOptions = {}) {
  const validation = validateSourceUrl(source.menu_url, source);
  if (!validation.ok) throw new Error(validation.error);
  if (!source.enabled) throw new Error('This coffee source is disabled.');

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxBytes = options.maxBytes ?? 2_000_000;
  const userAgent = options.userAgent ?? DISCOVERY_USER_AGENT;
  const configuredUrl = new URL(validation.url);

  try {
    const robotsResponse = await fetchWithTimeout(
      fetchImpl,
      `${configuredUrl.origin}/robots.txt`,
      timeoutMs,
      userAgent,
    );
    if (robotsResponse.ok) {
      const robots = await robotsResponse.text();
      if (robotsDisallows(robots, configuredUrl.pathname)) {
        throw new Error('The configured menu path is disallowed by robots.txt.');
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('robots.txt')) throw error;
    // A missing or unreachable robots file is non-fatal; the single configured page remains conservative.
  }

  const response = await fetchWithTimeout(fetchImpl, validation.url, timeoutMs, userAgent);
  if (!response.ok) throw new Error(`Menu request failed with HTTP ${response.status}.`);
  if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
    throw new Error('Menu redirects are not followed. Update the configured menu URL instead.');
  }

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLocaleLowerCase();
  const expectedTypes = new Set(['text/html', 'application/xhtml+xml', 'application/ld+json']);
  if (!contentType || !expectedTypes.has(contentType)) {
    throw new Error(`Unexpected menu content type: ${contentType ?? 'missing'}.`);
  }

  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > maxBytes) throw new Error('Menu response exceeds the maximum size.');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > maxBytes) throw new Error('Menu response exceeds the maximum size.');
  return new TextDecoder().decode(bytes);
}
