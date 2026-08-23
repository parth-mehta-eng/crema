# Content Library

This describes the initial coffee library seeded in Weekend 6: its collection taxonomy, labeling rules, and how it's organized in the database.

## Collection taxonomy

Eight collections exist in `public.recipe_collections` (seeded in `20260822010000_recipe_authoring.sql`, Weekend 5):

| id | title | typical contents |
| --- | --- | --- |
| `coffee-shop-inspired` | Coffee Shop Inspired | Starbucks/Dutch Bros/Dunkin'/Scooter's-inspired originals |
| `espresso-classics` | Espresso Classics | Espresso, Americano, Latte, Cappuccino, Flat White, Cortado, Macchiato, Mocha, Affogato |
| `around-the-world` | Around the World | Spanish Latte, Vietnamese Iced Coffee, Café Bombón, Greek Frappé, Dalgona Coffee, Café au Lait, Espresso Tonic |
| `crema-originals` | Crema Originals | Original Crema concepts (no external inspiration) |
| `iced-favorites` | Iced Favorites | Cross-cutting: any iced drink worth surfacing together |
| `five-minute-coffees` | Five-Minute Coffees | Cross-cutting: `prep_minutes <= 5` |
| `beginner-friendly` | Beginner Friendly | Cross-cutting: `difficulty = 'Easy'` and simple steps |
| `seasonal-favorites` | Seasonal Favorites | Cross-cutting: seasonal drinks (pumpkin, peppermint, etc.) |

A draft or recipe can belong to more than one collection — e.g. "Brown Sugar Shaken Espresso" is tagged both `coffee-shop-inspired` and `iced-favorites` and `five-minute-coffees`. Assignment happens via `recipe_draft_collections` (draft stage) and is copied to `published_recipe_collections` on publish (see `publish_recipe_draft` in `docs/RECIPE_PUBLISHING.md`).

## Café-inspired labeling rule

**Nothing in this library claims to be an official recipe.** Every café-inspired draft:

- carries an `inspiration_label` containing the word "Inspired" (`Starbucks Inspired`, `Dutch Bros Inspired`, `Dunkin' Inspired`, `Scooter's Inspired`) — this substring is what the database and client validation both use to detect "this needs attribution" (see `private.recipe_draft_validation_errors` and `validateDraft` in `services/authoring/domain.ts`);
- carries a `source_name` (the café chain) and an HTTPS `source_url` (a link to the chain's public menu page — never a scraped/cached copy);
- has an **original, short Crema description** and **original preparation steps** — never copied marketing copy or copied instructions.

Non-café-inspired drafts use `Espresso Classic`, `Around the World`, or `Crema Original` as their inspiration label, none of which contain "inspired", so attribution is `not_required` for them (see [CONTENT_QUALITY.md](./CONTENT_QUALITY.md)).

## Draft vs. tested vs. published

This reuses the Weekend 5 lifecycle unchanged: `draft → tested → ready → published → archived`. Weekend 6 adds ~48 drafts, all seeded as `status = 'draft'`, `needs_testing = true`, `tested = false` — none are pre-marked tested or published. A draft only becomes `tested` when a person records that they made it (`Mark tested` in `/admin/draft/:id`), only becomes `ready` when it passes full validation, and only becomes `published` via the explicit single-recipe Publish action.

## Seed workflow

Two seed files, run in order after the Weekend 3 `seed.sql` (see `supabase/config.toml`'s `db.seed.sql_paths`):

1. **`supabase/seeds/discovered_drinks.sql`** — simulates discovery-pipeline output (rows in `discovered_drinks`, `status = 'new'`) for a handful of drinks, so the admin "Discovered" review queue has content even before any source is enabled for live scraping. Idempotent via a unique `seed_key` on `discovered_drinks`.
2. **`supabase/seeds/draft_templates.sql`** — the ~34 new hand-authored draft templates (plus a one-time backfill of `seed_key` on the 14 drafts already seeded in Weekend 5), each collection-tagged. Idempotent via a unique partial index on `recipe_drafts.seed_key`; every insert uses `on conflict (seed_key) where seed_key is not null do nothing`, so re-running the file never duplicates a row and never overwrites a draft an admin has since edited by hand. Collection-tag inserts use `on conflict (draft_id, collection_id) do nothing` for the same reason.

Running seeds locally:

```powershell
npx.cmd supabase db reset --local
```

This runs every migration then every file in `db.seed.sql_paths` in order. Re-running it (or re-applying just the seed files against a database that already has this content) is safe — see the idempotency test in `supabase/tests/content_quality.sql`.

Running seeds against a hosted/dev Supabase project (there is no separate "seed" command in hosted Supabase — apply the SQL directly):

```powershell
npx.cmd supabase link --project-ref YOUR_PROJECT_REF
npx.cmd supabase db push
$env:PGPASSWORD = "YOUR_DB_PASSWORD"
psql "postgresql://postgres:$env:PGPASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres" -f supabase/seeds/discovered_drinks.sql
psql "postgresql://postgres:$env:PGPASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres" -f supabase/seeds/draft_templates.sql
```

To **update controlled metadata safely** after seeding (e.g. re-labeling a collection, fixing a source URL) without risking a duplicate: edit the row directly in `/admin` (preferred — goes through the audit-logged admin actions), or re-run the relevant seed file, which only ever fills in rows that don't already exist by `seed_key` — it will never overwrite a field on an existing row. Bulk field updates (source, collection, needs-testing, attribution) are available from the admin Drafts tab's bulk-action toolbar; see [CONTENT_QUALITY.md](./CONTENT_QUALITY.md).

To **skip existing content**: this is the default and only behavior — there is no "force overwrite" seed mode, by design, so a seed run can never clobber edited content.

## Review workflow

See the "Review workflow" section of [CONTENT_QUALITY.md](./CONTENT_QUALITY.md) for the Review Queue's priority order and what each queue item shows.
