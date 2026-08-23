# Weekend 5 — Recipe Draft Editor and Publishing

Weekend 5 turns the private Coffee Discovery workspace into a structured authoring and publishing system without changing the consumer app.

## Delivered

- [x] Dedicated admin recipe editor at `/admin/draft/:id`
- [x] Controlled classification and metadata selectors
- [x] Structured, reorderable ingredient, step, equipment, tag, and collection editors
- [x] Canonical ingredient catalog with aliases and deactivation
- [x] Editable recipe collections
- [x] Owned-image upload to the `recipe-images` bucket with type/size checks, 4:5 crop, progress state, preview, replacement, removal, metadata, and alt text
- [x] Shared field-level draft validation and legal transition validation
- [x] Draft → tested → ready → published → archived lifecycle
- [x] Mobile-style recipe preview
- [x] Server-only transactional publish, stable IDs, and idempotent republish
- [x] Edit-as-draft, explicit unpublish, archive, restore, and duplication
- [x] Optimistic draft version checks and unsaved-navigation warning
- [x] Admin audit trail and admin-only RLS
- [x] Initial collections, tags, equipment, reviewed Brown Sugar discovery, and 14 deliberately incomplete/untested starter drafts
- [x] Unit, authorization, migration, rollback, unpublish, and idempotent-republish checks

## Safety boundary

The Expo client never receives the service-role key and cannot call publishing RPCs directly. It invokes the authenticated `coffee-discovery` Edge Function, which verifies the caller’s signed `app_metadata.role`. The database publication function then locks and validates the draft and performs the public recipe and relationship writes in one transaction.

See [RECIPE_AUTHORING.md](./RECIPE_AUTHORING.md) for editor operation and [RECIPE_PUBLISHING.md](./RECIPE_PUBLISHING.md) for lifecycle, transaction, and security details.

