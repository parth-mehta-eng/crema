# Crema ☕

A polished but intentionally casual iOS/Android coffee recipe app starter.

## What already works

- Expo Router tabs
- Premium Crema visual style
- Home recipe discovery
- Search
- Recipe details
- Step-by-step Brewing Mode
- Local favorites
- Coffee Bar ingredient toggles
- Mock matching data
- Supabase client scaffold
- Initial SQL migration
- Private Coffee Discovery admin workflow
- Structured Recipe Authoring and transactional publishing workflow
- EAS build configuration
- GitHub Actions validation

## Start on Windows

Requirements: Node.js 22.13+ for Expo SDK 57.

```powershell
Copy-Item .env.example .env
npm.cmd install
npx.cmd expo install --fix
npm.cmd run android
```

Press `i` for iOS simulator or `a` for Android emulator. You may also scan the QR code with a compatible Expo Go build.

The app works with both values empty and uses its bundled recipe fallback plus local guest persistence.

## Supabase development setup

Only client-safe project values belong in `.env`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Never put the service-role key in the Expo environment. To apply the schema and four-recipe
development seed to a linked non-production project:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref YOUR_PROJECT_REF
npx.cmd supabase db push --dry-run
npx.cmd supabase db push --include-seed
npm.cmd run android
```

For a reproducible local stack, start Docker Desktop and run:

```powershell
npx.cmd supabase start
npx.cmd supabase db reset
npm.cmd run android
```

Crema's local Supabase stack uses API port `55321`, database port `55322`, and Studio port `55323` so it can coexist with other local projects. Android emulators should use `http://10.0.2.2:55321` for `EXPO_PUBLIC_SUPABASE_URL`; Expo web should use `http://127.0.0.1:55321`.

## Private Coffee Discovery admin

Weekend 4 adds a hidden `/admin` route for authorized development admins. It imports only exact, configured server-side menu URLs into private discovery records and test-required recipe drafts. All initial sources are disabled until their parser and access behavior are verified. Nothing is published automatically.

See [docs/COFFEE_DISCOVERY_PIPELINE.md](docs/COFFEE_DISCOVERY_PIPELINE.md) for architecture, admin-role setup, source adapter instructions, security controls, and exact local/hosted commands.

Weekend 5 adds the private structured editor, mobile preview, image handling, testing/readiness lifecycle, transactional publish/republish, unpublish/archive, ingredient catalog, and collections. See [docs/RECIPE_AUTHORING.md](docs/RECIPE_AUTHORING.md) and [docs/RECIPE_PUBLISHING.md](docs/RECIPE_PUBLISHING.md).

## Before store submission

1. Change `com.example.crema` in `app.json` to your final bundle/package ID.
2. Add app icons and splash assets.
3. Run `eas init` and connect the project to your Expo account.
4. Configure signing credentials.
5. Add real Supabase values to `.env`.

## Codex start prompt

```text
Read README.md, docs/DESIGN.md, docs/CONTRIBUTING.md, and docs/WEEKEND_1.md.
Run the app and fix any installation or Expo SDK compatibility issues first.
Complete only Weekend 1. Preserve the established visual style and reuse existing components.
```

## Notes

The starter uses remote Unsplash photos so the repository stays small. Replace these with licensed/local production images before launch.
