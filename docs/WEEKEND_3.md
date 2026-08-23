# Weekend 3 — Real Data

- [ ] Create and link a hosted Supabase project (developer setup step)
- [ ] Apply the committed migrations and seed to that project (developer setup step)
- [x] Expand schema for ingredients, steps, equipment, favorites, and inventory
- [x] Replace direct mock recipe reads with a repository/service boundary
- [x] Keep a bundled local fallback and persisted guest mode
- [x] Add an auth session boundary for development sessions
- [ ] Add email authentication UI (intentionally deferred)
- [ ] Add Apple/Google sign-in (intentionally deferred)
- [x] Sync favorites and Coffee Bar for signed-in users
- [x] Add indexed multi-field search and existing category filters

## Implemented behavior

The UI always starts with bundled recipes. When client-safe Supabase variables are present,
the repository refreshes from the normalized public catalog and caches successful responses.
Failures retain cached or bundled content. Guest favorites and inventory use AsyncStorage;
an existing authenticated session uses RLS-protected Supabase rows instead. Guest data remains
separate so a later sign-in flow can offer an explicit migration rather than merging silently.
