# Weekend 6 — Coffee Library, Collections, and Content Quality

Weekend 6 uses the Weekend 4/5 discovery pipeline, draft editor, recipe schema, and publishing workflow to build a real initial coffee library, expose it through curated mobile collections, and add the content-quality controls needed to keep growing it safely. It does not redesign the app, add community features, or add AI recipe generation.

## Delivered

- [x] ~48 structured recipe drafts across Coffee Shop Inspired, Espresso Classics, Around the World, and Crema Originals (see [CONTENT_LIBRARY.md](./CONTENT_LIBRARY.md))
- [x] Idempotent, separated seed files for discovered drinks and draft templates (`supabase/seeds/`)
- [x] Content-quality fields on `recipe_drafts`: `image_status`, `attribution_status`, `validation_status`, `content_notes`, `last_reviewed_at`/`last_reviewed_by` (see [CONTENT_QUALITY.md](./CONTENT_QUALITY.md))
- [x] Publish-time gating on image and attribution status, in addition to the existing field-level validation
- [x] Admin **Quality** dashboard tab (totals, missing-field counts, by-source/by-collection breakdowns)
- [x] Admin **Review Queue** tab (priority-ordered, shows missing requirements, test/image/validation status, edit/preview actions)
- [x] Admin bulk actions: assign collection, assign source, set/clear needs-testing, mark attribution complete, mark reviewed, archive selected — **no bulk publish**
- [x] Admin JSON/CSV export for backup and editorial review
- [x] Mobile collection list and detail screens (`/collection`, `/collection/[id]`), published-only, with loading/empty/error states
- [x] Home screen: Daily Brew card, collection-driven sections (hidden when empty), Quick & Easy section, "See all" navigation
- [x] Daily Brew: deterministic (non-AI) daily selection, stable per calendar day, prefers approved imagery
- [x] Search: more searchable fields (category, collections, source), more filters (category/prep-time/collection and coffee-bar-aware "Can Make Now" / "Missing One Ingredient"), result count
- [x] Match display: explicit "Equipment Missing" state, kept distinct from missing-ingredient counts
- [x] Recipe metadata: temperature, category, and caffeine/calorie **estimates** (clearly labeled) on the recipe detail screen
- [x] Consistent placeholder-image policy for drafts without approved photography (`crema://placeholder`)
- [x] Tests for seeding idempotency, collection assignment, content validation, publish gating, no-draft-leakage, Daily Brew determinism, and search/match behavior

## What this is not

Per the brief, Weekend 6 explicitly does **not** add: ratings/reviews, comments, public submissions, notifications, payments/subscriptions, AI recipe generation, or a mobile redesign. Bulk publish was intentionally left out — publishing stays a single-recipe, explicit action.

## Content rule

No drink here claims to be an "official" recipe. Café-inspired drafts carry an inspiration label containing the word "Inspired" (e.g. "Starbucks Inspired"), a `source_name`, and an HTTPS `source_url` for attribution — never copied preparation instructions, marketing copy, or product photography. See [CONTENT_LIBRARY.md](./CONTENT_LIBRARY.md) for the full labeling rule.

## Files changed (by area)

- **Database**: `supabase/migrations/20260823000000_content_quality_and_collections.sql` (content-quality columns/triggers, publish gating, wider search vector, Daily Brew eligibility function); `supabase/seeds/discovered_drinks.sql`, `supabase/seeds/draft_templates.sql`; `supabase/config.toml` (`db.seed.sql_paths`); `supabase/tests/content_quality.sql`.
- **Types/services**: `types/recipe.ts`, `services/recipes/mapper.ts`, `services/recipes/repository.ts`, `services/recipes/search.ts`, `services/collections.ts` (new), `services/dailyBrew.ts` (new), `lib/daily-brew.ts` (new), `lib/recipe-utils.ts`, `services/admin.ts`, `services/authoring/domain.ts`, `services/authoring/repository.ts`.
- **Mobile**: `app/(tabs)/index.tsx`, `app/(tabs)/search.tsx`, `app/recipe/[id].tsx`, `app/collection/index.tsx` (new), `app/collection/[id].tsx` (new), `components/DailyBrewCard.tsx` (new), `components/RecipeCard.tsx`, `app/_layout.tsx`.
- **Admin**: `app/admin/index.tsx` (Quality + Review Queue tabs, bulk actions, export), `app/admin/draft/[id].tsx` (content-quality section).
- **Local fallback data**: `data/recipes.ts` (new required `Recipe` fields).
- **Tests**: `tests/daily-brew.test.cjs` (new), `tests/recipe-search.test.cjs`, `tests/recipe-utils.test.cjs`, `supabase/tests/content_quality.sql` (new).
- **Docs**: this file, [CONTENT_LIBRARY.md](./CONTENT_LIBRARY.md), [CONTENT_QUALITY.md](./CONTENT_QUALITY.md).

## Verification

```powershell
Set-Location C:\Users\parth\OneDrive\Developer\crema
npm.cmd install
npx.cmd supabase start
npx.cmd supabase db reset --local
npx.cmd supabase test db
npx.cmd supabase db lint --local --schema public,private --level warning --fail-on error
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npx.cmd expo-doctor
```

`npm run typecheck`, `npm run lint`, `npx expo-doctor`, and `npm test` (38 tests) were run in this environment and pass. `supabase db reset --local`, `supabase test db`, and the `supabase db lint` step require Docker and the Supabase CLI, which were not available in this sandbox — run them locally before merging using the commands above. See section 21 of the task and "Manual verification" below for what to check once a local/dev database is up.

## Manual verification checklist (run once against a local or dev Supabase project)

1. `supabase db reset --local` creates the initial library (~48 drafts, 8 collections, discovered-drink queue).
2. Running `supabase db reset --local` again (or re-applying `supabase/seeds/*.sql`) creates no duplicate drafts, discovered drinks, or collection links.
3. Every seeded draft remains `status = 'draft'` — nothing was auto-published or auto-tested.
4. Publishing one seeded draft through `/admin/draft/:id` (after adding ingredients/steps/equipment, marking tested, and either uploading an image or approving the placeholder) makes it appear in an anonymous mobile query.
5. Unpublished/draft recipes never appear in an anonymous query against `recipes`, `recipe_drafts`, or `published_recipe_collections`.
6. `/collection` shows accurate recipe counts per collection; `/collection/[id]` matches.
7. Home hides any collection section with zero published recipes.
8. The Daily Brew card shows the same recipe across multiple loads/reloads on the same calendar day.
9. Search finds a recipe by title, by an ingredient name, and by source/collection.
10. Coffee Bar match filters ("Can Make Now", "Missing One Ingredient") on the Search screen match the Coffee Bar tab's own matching.
11. A signed-in non-admin account cannot see `/admin` content (drafts, discovered drinks) — verified by the existing RLS test suite in `supabase/tests/`.
12. The Quality tab's counts match a manual `select count(*) ...` against `recipe_drafts` for each stat.

## Remaining manual work

- The ~48 seeded drafts need real testing (a person actually making the drink) before they can move past `draft`/`tested`. None are pre-marked tested, per the constraints.
- None have approved photography yet; each needs either an owned/licensed photo upload or an explicit placeholder approval before it can publish.
- `espresso-classics` and `around-the-world` currently have zero **published** recipes (only drafts) until some of the new drafts are tested, imaged, and published — Home/collections correctly hide those sections until then.
- The four recipes seeded in `supabase/seed.sql` (Weekend 3) still use remote Unsplash imagery; the README already flags this as a pre-existing item to replace before launch — Weekend 6 did not add any new third-party imagery, and doesn't attempt to fix that pre-existing one.
