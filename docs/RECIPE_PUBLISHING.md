# Recipe Publishing

## Lifecycle

The enforced sequence is:

`discovered → draft → tested → ready → published → archived`

- **draft** may be incomplete.
- **tested** records that a person physically tested it and clears `needs_testing`.
- **ready** requires centralized validation to pass.
- **published** is visible to consumer recipe queries.
- **archived** remains recoverable and hides a linked public recipe.

Published recipes can be reopened with **Edit as draft**. The existing public version remains unchanged while edits are saved privately. Test and mark ready again, then publish to update the same public ID. **Unpublish** explicitly hides the public row and restores an editable draft. **Archive** also hides a linked public recipe; **Restore draft** makes the archived draft editable again.

## Transaction behavior

`public.publish_recipe_draft` is `SECURITY DEFINER`, uses an empty `search_path`, is revoked from `public`, `anon`, and `authenticated`, and is executable only by `service_role`. The Edge Function verifies the JWT and admin app metadata before calling it.

The function:

1. locks the draft;
2. requires `ready` and runs server validation;
3. reuses `published_recipe_id` or assigns the draft UUID text as the stable public ID;
4. upserts the public recipe;
5. replaces ingredients, steps, step references, equipment, tags, and collections;
6. refreshes ingredient search text;
7. records the public ID and timestamp and marks the draft published;
8. inserts the audit entry.

PostgreSQL commits the function as one transaction. Any relationship failure rolls back the recipe upsert, relationship changes, draft status, and audit entry. Repeating the process updates one public recipe rather than inserting another.

## Image storage

The public `recipe-images` bucket permits JPEG, PNG, and WebP files up to 5 MB. Anonymous/authenticated users may read published image URLs. Only authenticated callers passing `private.is_admin()` may insert, update, or delete objects. Image path, URL, MIME type, byte count, and accessible alt text are stored on the draft; approved metadata is copied to the public recipe.

## Local Windows verification

Start Docker Desktop, then:

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

For Expo web, set `.env` to the local API URL printed by `npx.cmd supabase status` (`http://127.0.0.1:55321` in this repository) and its publishable key, then run `npm.cmd run web -- --clear` and open `/admin`. For Android use `http://10.0.2.2:55321` and run `npm.cmd run android -- --clear`.

Create a user in local Studio (`http://127.0.0.1:55323`) and run in its SQL editor:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'admin@example.com';
```

Sign out/in after the update so the JWT contains the role.

For a hosted development project:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref YOUR_PROJECT_REF
npx.cmd supabase db push --dry-run
npx.cmd supabase db push
npx.cmd supabase functions deploy coffee-discovery
```

The Expo client requires only:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Never put a service-role or secret key in `.env`, Expo config, client source, or browser storage.

