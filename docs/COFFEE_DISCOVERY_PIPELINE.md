# Coffee Discovery Pipeline

## Architecture

The private workflow is deliberately small:

```text
hidden Expo admin route
  → authenticated Supabase session
  → coffee-discovery Edge Function
  → exact configured menu URL
  → parser adapter
  → normalization and fingerprinting
  → discovered_drinks
  → manual review
  → recipe_drafts
  → testing and ready state
```

The consumer app reads only published `recipes`. Discovery records and drafts are never included in the consumer repository, search, favorites, or Coffee Bar flows.

Raw Supabase reads used by the admin dashboard live in `services/admin.ts`. Privileged mutations and all third-party fetching live in `supabase/functions/coffee-discovery/index.ts`. Shared parsing and normalization live in `supabase/functions/_shared/coffee-discovery.ts`.

## Tables

- `coffee_sources`: exact source URLs, parser type, enabled state, cooldown, and last successful attempt time.
- `menu_import_runs`: one audit row per attempted import, including skipped and failed attempts and all item counts.
- `discovered_drinks`: short external metadata, normalized fields, source URL, stable fingerprint, and review status.
- `recipe_drafts`: internal editable suggestions tied one-to-one to a discovered drink. Drafts start with `needs_testing = true`.

The migration also creates supporting indexes, update-time triggers, lifecycle transition triggers, explicit Data API grants, RLS policies, and a private `is_admin()` helper.

## Import flow

1. The Edge Function verifies the bearer token with Supabase Auth and requires `app_metadata.role = admin`.
2. It loads the source by UUID; callers cannot supply a URL.
3. Disabled sources create a `skipped` import run.
4. Recent successful attempts inside `cooldown_minutes` create a `skipped` run.
5. The fetcher validates the exact configured public HTTPS URL, reads `robots.txt` where practical, and retrieves only that one page.
6. The selected parser extracts drink names and descriptions from structured or explicitly marked menu entries.
7. Shared utilities normalize controlled metadata and create `source-slug:normalized-name` fingerprints.
8. Existing fingerprints are counted as duplicates or updated in place when useful metadata changes. Their review status is retained.
9. The run records discovered, new, duplicate, updated, and failed counts. Parser or fetch failures are recorded with a short sanitized error.

Imports do not follow redirects, crawl links, fetch assets, or enqueue background jobs.

## Parser adapters

Built-in parser modes are:

- `json_ld`: recursively extracts Schema.org `MenuItem` objects from JSON-LD.
- `generic`: extracts only explicit `data-menu-item` or `.menu-item` cards with a nearby heading and optional paragraph.
- `custom`: dispatches to a registered `MenuParser` that declares whether it supports a source and returns `ParsedDrink[]`.

A custom adapter implements:

```ts
type MenuParser = {
  id: string;
  supports(source: CoffeeSource): boolean;
  parse(html: string, source: CoffeeSource): ParsedDrink[];
};
```

To add or verify a source:

1. Confirm the official menu URL, applicable terms, and practical `robots.txt` behavior manually.
2. Save the exact HTTPS `base_url` and `menu_url`; leave `enabled = false`.
3. Prefer JSON-LD when the page exposes reliable `MenuItem` data.
4. Use the generic parser only when menu cards carry stable menu-item markers.
5. Otherwise add a narrowly scoped custom adapter and a stored HTML fixture. Do not add selectors to UI code.
6. Add tests for successful parsing, malformed or empty input, normalization, and repeated imports.
7. Run the checks below, perform one conservative development import, inspect its output, then enable the source explicitly.

Unsupported custom sources fail with a clear recorded result. They never fall back to broad page scraping.

## Normalization and duplicates

The shared normalizer handles aliases including `oatmilk → oat milk`, `coldfoam → cold foam`, `blonde espresso → espresso`, `sweet cream → cream`, and `caramel drizzle → caramel`. White chocolate mocha is represented by controlled `white chocolate` and `mocha` ingredient terms.

Controlled inference covers category, hot/iced/either temperature, common coffee bases and ingredients, configured flavor notes, and spring/summer/fall/winter when explicit terms make a season inferable. Descriptions are stripped of markup and capped at 280 characters.

Fingerprints combine the source slug and normalized drink name. A unique database constraint provides the final duplicate guard. Re-imports preserve `reviewed`, `ignored`, or `converted` status while updating changed metadata.

## Review and draft lifecycle

Open the hidden route `/admin` in the Expo web app or development build. Sign in with an account whose secure app metadata contains `{"role":"admin"}`.

- Sources: enable or disable a verified source and request an import.
- Imports: inspect status, timestamps, counts, and sanitized errors.
- Discovered: mark a new/ignored drink reviewed, ignore it, open its source URL, or convert a reviewed drink.
- Drafts: edit internal suggestions, mark the draft tested, and then mark it ready.

Conversion is idempotent because `recipe_drafts.discovered_drink_id` is unique. It creates a short internal research description rather than copying external prose, placeholder steps, and `needs_testing = true`.

The intended lifecycle is:

```text
new → reviewed → converted → draft → tested → ready
```

Ignored records can return to reviewed. Drafts can be archived. The database reserves `published`, but the admin UI and Edge Function expose no publish action. A future explicit server publishing workflow must perform the final, human-approved creation/update of a public recipe.

## Security and responsible fetching

- All four tables have RLS enabled and are inaccessible to `anon`.
- Authenticated table policies consult only signed `app_metadata.role`, not user-editable metadata.
- The Edge Function revalidates the bearer token before creating a server client.
- Service-role/secret credentials are read only from the Edge Function environment and never use `EXPO_PUBLIC_*` variables.
- The function accepts source/drink/draft IDs and finite action values, never arbitrary target URLs.
- Requests require HTTPS, the exact configured URL, no URL credentials, port 443, and a public hostname. IP literals, localhost, `.local`, `.internal`, and redirects are rejected.
- Fetches use a descriptive user agent, a 10-second timeout, a 2 MB maximum, expected text/HTML content types, one configured page, and a configurable cooldown of at least 15 minutes.
- No images, binary assets, prices, nutrition data, social media, long marketing prose, or proprietary instructions are collected.

## Local Windows setup

Requirements: Node.js 22.13+, Docker Desktop, and an Android emulator for native testing.

```powershell
Set-Location C:\Users\parth\OneDrive\Developer\crema
npm.cmd install
npx.cmd supabase start
npx.cmd supabase db reset
npx.cmd supabase status
```

The Crema stack uses isolated ports so it can coexist with another local Supabase project:

- API and Functions: `55321`
- Database: `55322`
- Studio: `55323`

Copy only the local publishable/anon value printed by `supabase status` into `.env`. For the Android emulator, use the host alias:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:55321
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=PASTE_LOCAL_PUBLISHABLE_KEY
```

Then run:

```powershell
npm.cmd run android
```

For Expo web on the same Windows host, use `http://127.0.0.1:55321` instead and run `npm.cmd run web`. Open `/admin`, for example `http://localhost:8081/admin` (use the port Expo prints if different).

Create a local admin with Supabase Studio at `http://127.0.0.1:55323` or the Auth admin API, then set the role through Studio's SQL editor:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"role":"admin"}'::jsonb
where email = 'admin@example.com';
```

Sign out and back in after changing app metadata so the JWT is refreshed.

## Hosted Supabase setup

Find the project ref in the Supabase Dashboard URL (`https://supabase.com/dashboard/project/PROJECT_REF`) or Project Settings. Apply only to a development project first:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref YOUR_PROJECT_REF
npx.cmd supabase db push --dry-run
npx.cmd supabase db push
npx.cmd supabase functions deploy coffee-discovery
```

The Expo client requires exactly these client-safe values:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Supabase supplies `SUPABASE_URL`, the publishable/anon key, and the service-role/secret key to hosted Edge Functions. Do not copy a service-role or secret key into `.env`, Expo configuration, source code, or documentation.

Assign an admin role with the same SQL shown above, sign out/in, navigate to `/admin`, and keep every source disabled until its adapter has been verified.

## Verification commands

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npx.cmd expo-doctor
npx.cmd supabase db reset
npx.cmd supabase db lint --local --schema public,private --level warning --fail-on error
docker cp supabase\tests\coffee_discovery_security.sql supabase_db_crema:/tmp/coffee_discovery_security.sql
docker exec supabase_db_crema psql -U postgres -d postgres -f /tmp/coffee_discovery_security.sql
```

Tests use only stored HTML fixtures; they never request a live coffee-shop website.
