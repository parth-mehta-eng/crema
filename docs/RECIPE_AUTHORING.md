# Recipe Authoring

## Create or open a draft

Sign in at `/admin` with an account whose signed app metadata contains `{"role":"admin"}`. In **Discovered**, mark a drink reviewed and choose **Convert to draft**, or open an existing item from **Drafts**. Conversion is idempotent for a discovered drink.

The draft list can be searched by title, source, flavor notes, and ingredient suggestions and filtered by completeness/testing/status, source, and category. It shows testing, validation, collection, update, and public-link state.

## Complete the recipe

1. Add title, unique lowercase slug, description, attribution, collection, and classification.
2. Choose difficulty and enter positive prep/total time, servings, and cup size. Total time cannot be shorter than prep time.
3. Add canonical ingredients. Quantity must be positive and the unit must be one of the controlled units. Repeated canonical ingredients are allowed only when display name or preparation differs.
4. Add non-empty steps. Timers are seconds in storage and human-readable in preview. Steps can reference ingredient rows.
5. Select equipment and mark each required or optional; add an alternative note when useful.
6. Select controlled tags and collections.
7. Upload an owned/licensed JPEG, PNG, or WebP no larger than 5 MB. The picker offers a 4:5 crop. Add useful alt text.
8. Choose **Preview** to inspect the hero, metadata, tags, ingredients, equipment, steps, timers, and nonfunctional Start Making control.
9. Choose **Save draft**. Saves use an expected version; a stale editor is rejected and must reload.

The included acceptance fixture is `assets/admin/brown-sugar-shaken-espresso-test.png`. It was generated for Crema and contains no third-party brand imagery.

## Validation

**Validate** shows both a summary and field-level messages. Ready/publish requires title, unique valid slug, description, controlled category/temperature/difficulty, positive prep time and servings, total time at least prep time, cup size, one valid ingredient, one non-empty step, an equipment classification, an approved hero image and alt text, café attribution when applicable, and resolved physical testing.

A draft can stay incomplete indefinitely. Failed saves and publishes keep the local form visible. Navigating away with unsaved changes asks for confirmation.

## Catalog and collections

The **Ingredients** admin tab manages display name, unique canonical name, category, aliases, default unit, and active state. Referenced ingredients are deactivated rather than deleted. The **Collections** tab manages title, description, order, and active state. Eight starter collections and normalized tags are seeded.

## Duplicate

**Duplicate** copies structured ingredients, steps and references, equipment, tags, collections, attribution, and image metadata into a new draft. It creates a new draft and row IDs, proposes a unique `-copy-xxxx` slug, clears the published link, resets `tested`, and returns to `draft`.

