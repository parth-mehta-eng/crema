# Weekend 4 — Coffee Discovery Pipeline

Weekend 4 adds a private, server-side workflow for researching public coffee menus and preparing reviewed Crema recipe drafts. It does not change the consumer recipe experience and it never publishes content automatically.

## Delivered

- [x] Private source registry with six initial coffee chains, all disabled until verified
- [x] Audited import runs with new, duplicate, updated, and failed counts
- [x] JSON-LD, conservative generic HTML, and custom parser-adapter support
- [x] Responsible single-page fetching with URL allowlisting, SSRF protection, timeouts, response limits, content-type checks, robots handling, and cooldowns
- [x] Reusable name, ingredient, flavor, category, temperature, and season normalization
- [x] Stable source-scoped fingerprints and idempotent metadata updates
- [x] Separate discovered-drink and recipe-draft lifecycles
- [x] Manual review, ignore, conversion, edit, tested, and ready actions
- [x] Hidden `/admin` workspace with Supabase email/password sign-in
- [x] Admin-only RLS and server-side action validation
- [x] Static parser fixtures, unit tests, SQL security assertions, and local Edge Function integration checks
- [x] Local Windows and hosted Supabase operating instructions

## Safety boundaries

- Mobile clients never fetch coffee-shop pages.
- Only the exact HTTPS URL stored for an enabled source can be requested.
- Source records are disabled by default; no live source is claimed as verified.
- Imports store only names, short descriptions, normalized public metadata, and the original source URL.
- Drafts remain separate from `recipes`; conversion creates no public content.
- The admin workflow intentionally exposes no publish action because Crema has no existing publishing workflow to reuse.
- No service-role or Supabase secret key is present in Expo configuration or client code.

## Done when

An authorized development admin can sign in at `/admin`, run an enabled and verified source adapter, review discovered drinks, convert a reviewed item once, and move the resulting test-required draft to ready without changing public recipes. Unauthorized users cannot read or mutate the workflow.

See [COFFEE_DISCOVERY_PIPELINE.md](./COFFEE_DISCOVERY_PIPELINE.md) for architecture and operating instructions.
