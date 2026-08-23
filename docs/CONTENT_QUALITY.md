# Content Quality

Content-quality tracking added in Weekend 6, on top of the existing Weekend 5 draft/publish validation.

## Fields

All on `public.recipe_drafts` (migration `20260823000000_content_quality_and_collections.sql`):

| field | type | controlled values | how it's set |
| --- | --- | --- | --- |
| `tested` | boolean | — | existing (Weekend 5); set only by the `Mark tested` admin action |
| `needs_testing` | boolean | — | existing (Weekend 5); defaults `true` |
| `image_status` | text | `missing`, `placeholder`, `approved` | **derived automatically** by a trigger from `hero_image_url` / `placeholder_approved` — never set directly |
| `attribution_status` | text | `not_required`, `required`, `complete`, `incomplete` | **derived automatically** by a trigger from `inspiration_label` / `category` / `source_name` / `source_url` — never set directly (a bulk action can force it to `complete` when an admin has verified attribution some other way) |
| `validation_status` | text | `incomplete`, `valid`, `invalid` | recomputed by `private.recompute_draft_validation_status()` at the end of every save/transition, from the same rule set as `private.recipe_draft_validation_errors()` |
| `content_notes` | text, ≤2000 chars | — | free text, editable in the draft editor's "Content quality" section |
| `last_reviewed_at` / `last_reviewed_by` | timestamptz / uuid | — | set by the "Mark reviewed" admin action (single or bulk) |

No new concepts were added beyond what the brief asked for — `tested`/`needs_testing`/`placeholder_approved`/`status` all already existed from Weekend 5 and are reused as-is.

### `image_status` derivation

- `placeholder_approved = true` → `placeholder`
- else `hero_image_url` set → `approved`
- else → `missing`

### `attribution_status` derivation

A draft is "café-inspired" using the same rule as validation: `inspiration_label` contains "inspired" (case-insensitive) or `category = 'café inspired'`.

- not café-inspired → `not_required`
- café-inspired, no `source_name` and no `source_url` → `required`
- café-inspired, partial (one of the two) → `incomplete`
- café-inspired, both `source_name` and an HTTPS `source_url` → `complete`

### `validation_status` derivation

- zero live validation errors → `valid`
- validation errors exist, but the draft previously reached `ready`/`published` (a regression — e.g. someone deleted an ingredient after marking it ready) → `invalid`
- validation errors exist and the draft never got past `draft`/`tested` → `incomplete`

## Image policy

Every draft needs an approved image or an approved placeholder before it can publish — never both missing.

- **Approved photo**: owned or licensed JPEG/PNG/WebP, ≤5 MB, uploaded through `/admin/draft/:id` to the `recipe-images` bucket (unchanged from Weekend 5). Never import third-party product photography.
- **Placeholder**: an admin can explicitly check "Approve publishing with the Crema placeholder" in the draft editor's Content quality section. This sets `placeholder_approved = true`. At publish time, if there's still no uploaded image, the public recipe's `image_url` is set to the sentinel value `crema://placeholder` (never a broken/empty URL). The mobile app (`RecipeCard`, the recipe detail hero) recognizes this exact string and renders a bundled Crema-styled placeholder (an `Ionicons` cup glyph in a neutral tile) instead of attempting to load it as an image — so a placeholder recipe never shows a broken image to a consumer. No fake/generated brand imagery is ever produced.

Publishing is blocked (`publish_recipe_draft` raises) if `image_status = 'missing'` — i.e. neither an approved photo nor an approved placeholder.

## Attribution policy

Publishing is blocked if `attribution_status` is `required` or `incomplete`. Only `not_required` or `complete` may publish. This is enforced twice: once in the live `private.recipe_draft_validation_errors()` check (source name/URL presence), and again via the cached `attribution_status` column, so a stale/out-of-sync value can never slip through.

## Publish requirements (full list)

A draft cannot publish unless **all** of the following hold — this is the union of the pre-existing Weekend 5 rules and the two content-quality additions:

title · unique slug · description · collection (optional but recommended) · category · temperature · ≥1 ingredient · ≥1 step · preparation time · difficulty · `tested = true` · valid equipment classification · attribution complete when required · approved image or approved placeholder · `validation_status = 'valid'`

Seed data existing for a draft never counts as validity — every seeded draft starts `validation_status = 'incomplete'` (missing slug, testing, and usually image/ingredients) until an admin fills it in through the normal editor workflow.

## Content-quality dashboard (`/admin` → **Quality** tab)

Shows: total discovered drinks, total drafts, drafts missing images, drafts needing testing, drafts missing ingredients, drafts missing steps, drafts ready for review, published recipes, drafts by source, drafts by collection.

Filters live on the **Drafts** tab (shared with the dashboard's underlying data) rather than duplicated on Quality: source, collection, status, needs-testing, missing-image, invalid, and ready-for-review are all filter chips there — pick one to drill into a Quality stat.

## Review workflow (`/admin` → **Review Queue** tab)

Every non-archived, non-published draft, ordered by priority:

1. café-inspired drafts (`inspiration_label` contains "inspired") — highest recognition value
2. espresso classics (`category = 'classic'`)
3. drafts with complete ingredients+steps but still `needs_testing`/untested
4. drafts missing exactly one requirement
5. seasonal drafts (`category = 'seasonal'`)
6. everything else (lower-priority/experimental)

Each row shows: title, source, collection(s), the list of missing requirements (in plain English — "Missing: image, testing"), test status, image status, validation status, and Edit/Preview actions (both route to the existing `/admin/draft/:id` editor, in edit or preview mode).

## Bulk actions (`/admin` → Drafts tab, appears once ≥1 draft is selected via its checkbox)

- Assign collection
- Assign source (name + URL)
- Set / clear needs-testing
- Mark attribution complete
- Mark reviewed (`last_reviewed_at`/`last_reviewed_by`)
- Archive selected (routes through the existing single-draft `transition_recipe_draft` RPC once per draft, so audit logging and the "unpublish if published" safety check still run)

**There is no bulk publish.** Publishing always stays a single-recipe, explicit action from `/admin/draft/:id`, per the brief.

Everything except Archive operates as a direct, RLS-scoped table write (`recipe_drafts` / `recipe_draft_collections`) — the existing "Admins manage recipe drafts" / "Admins manage draft collections" policies already grant `authenticated` admins this access, so no new Edge Function code was needed for bulk actions.

## Export

From the same bulk-action toolbar: **Export selected** as JSON (full structure: metadata, ingredients, steps, equipment, tags, collections, source attribution, status) or CSV (flat summary: status/category/temperature/source/quality flags/counts). Rendered into a read-only, selectable text box in the admin UI for manual copy — this is for backup and editorial review, not an automated pipeline.

## Daily Brew selection

Deterministic, no AI (`lib/daily-brew.ts`):

1. Eligible pool = all published recipes.
2. Prefer the subset with **approved** (non-placeholder) imagery; fall back to the full eligible pool only if none have approved imagery yet.
3. Hash today's date (`YYYY-MM-DD`, UTC) to an index into that pool — same day always yields the same recipe, on any device, with no server-side state.
4. If that index would repeat yesterday's raw hash bucket, shift by one — reduces (does not strictly guarantee) immediate day-over-day repeats.
5. `services/dailyBrew.ts` wraps the pure selector with the actual Supabase query; if there are zero published recipes, Daily Brew simply doesn't render (no card) rather than showing anything fabricated.

## Windows setup commands

```powershell
Set-Location C:\Users\parth\OneDrive\Developer\crema
npm.cmd install
npx.cmd supabase start
npx.cmd supabase db reset --local
npx.cmd supabase test db
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npx.cmd expo-doctor
```
