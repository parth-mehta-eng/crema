-- Weekend 4: private coffee discovery and recipe draft workflow.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;

create table public.coffee_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  base_url text not null check (base_url ~ '^https://'),
  menu_url text not null check (menu_url ~ '^https://'),
  enabled boolean not null default false,
  parser_type text not null check (parser_type in ('json_ld', 'generic', 'custom')),
  cooldown_minutes integer not null default 360 check (cooldown_minutes >= 15),
  last_imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menu_import_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.coffee_sources(id) on delete restrict,
  status text not null check (status in ('running', 'succeeded', 'partial', 'failed', 'skipped')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  discovered_count integer not null default 0 check (discovered_count >= 0),
  new_count integer not null default 0 check (new_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  error_message text check (char_length(error_message) <= 500)
);

create table public.discovered_drinks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.coffee_sources(id) on delete restrict,
  external_name text not null check (char_length(external_name) between 1 and 180),
  normalized_name text not null check (char_length(normalized_name) between 1 and 180),
  external_description text not null default '' check (char_length(external_description) <= 280),
  source_url text not null check (source_url ~ '^https://'),
  category text not null check (
    category in ('latte', 'mocha', 'macchiato', 'cold brew', 'shaken espresso',
      'blended', 'tea', 'matcha', 'seasonal', 'other')
  ),
  temperature text not null check (temperature in ('hot', 'iced', 'either')),
  flavor_notes text[] not null default '{}',
  mentioned_ingredients text[] not null default '{}',
  season text check (season is null or season in ('spring', 'summer', 'fall', 'winter')),
  fingerprint text not null unique,
  status text not null default 'new' check (status in ('new', 'reviewed', 'ignored', 'converted')),
  discovered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipe_drafts (
  id uuid primary key default gen_random_uuid(),
  discovered_drink_id uuid not null unique references public.discovered_drinks(id) on delete restrict,
  proposed_title text not null check (char_length(proposed_title) between 1 and 180),
  inspiration_label text not null,
  source_name text not null,
  source_url text not null check (source_url ~ '^https://'),
  description text not null default '',
  category text not null check (
    category in ('latte', 'mocha', 'macchiato', 'cold brew', 'shaken espresso',
      'blended', 'tea', 'matcha', 'seasonal', 'other')
  ),
  temperature text not null check (temperature in ('hot', 'iced', 'either')),
  flavor_notes text[] not null default '{}',
  suggested_ingredients text[] not null default '{}',
  suggested_equipment text[] not null default '{}',
  suggested_steps text[] not null default '{}',
  needs_testing boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'tested', 'ready', 'published', 'archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index menu_import_runs_source_started_idx
  on public.menu_import_runs (source_id, started_at desc);
create index discovered_drinks_source_status_idx
  on public.discovered_drinks (source_id, status);
create index discovered_drinks_normalized_name_idx
  on public.discovered_drinks (normalized_name);
create index recipe_drafts_status_created_idx
  on public.recipe_drafts (status, created_at desc);
create index recipe_drafts_created_by_idx
  on public.recipe_drafts (created_by);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger coffee_sources_set_updated_at
before update on public.coffee_sources
for each row execute function private.set_updated_at();
create trigger discovered_drinks_set_updated_at
before update on public.discovered_drinks
for each row execute function private.set_updated_at();
create trigger recipe_drafts_set_updated_at
before update on public.recipe_drafts
for each row execute function private.set_updated_at();

create or replace function private.enforce_discovered_drink_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if old.status = 'new' and new.status in ('reviewed', 'ignored') then
    return new;
  end if;
  if old.status = 'reviewed' and new.status in ('ignored', 'converted') then
    return new;
  end if;
  if old.status = 'ignored' and new.status = 'reviewed' then
    return new;
  end if;
  raise exception 'Invalid discovered drink status transition: % to %', old.status, new.status;
end;
$$;

revoke all on function private.enforce_discovered_drink_status() from public, anon, authenticated;

create trigger discovered_drinks_enforce_status
before update of status on public.discovered_drinks
for each row execute function private.enforce_discovered_drink_status();

create or replace function private.enforce_recipe_draft_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if old.status = 'draft' and new.status in ('tested', 'archived') then
    null;
  elsif old.status = 'tested' and new.status in ('draft', 'ready', 'archived') then
    null;
  elsif old.status = 'ready' and new.status in ('tested', 'archived', 'published') then
    null;
  elsif old.status = 'published' and new.status = 'archived' then
    null;
  else
    raise exception 'Invalid recipe draft status transition: % to %', old.status, new.status;
  end if;

  if new.status in ('tested', 'ready', 'published') and new.needs_testing then
    raise exception 'A tested or ready draft cannot still need testing';
  end if;
  if new.status = 'published' and current_user <> 'service_role' then
    raise exception 'Drafts may only be published by the server-side publishing workflow';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_recipe_draft_status() from public, anon, authenticated;

create trigger recipe_drafts_enforce_status
before update of status, needs_testing on public.recipe_drafts
for each row execute function private.enforce_recipe_draft_status();

alter table public.coffee_sources enable row level security;
alter table public.menu_import_runs enable row level security;
alter table public.discovered_drinks enable row level security;
alter table public.recipe_drafts enable row level security;

create policy "Admins manage coffee sources"
on public.coffee_sources for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
create policy "Admins manage import runs"
on public.menu_import_runs for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
create policy "Admins manage discovered drinks"
on public.discovered_drinks for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
create policy "Admins manage recipe drafts"
on public.recipe_drafts for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

revoke all on table public.coffee_sources, public.menu_import_runs,
  public.discovered_drinks, public.recipe_drafts from public, anon, authenticated;
grant select, insert, update, delete on table public.coffee_sources,
  public.menu_import_runs, public.discovered_drinks, public.recipe_drafts to authenticated;
grant select, insert, update, delete on table public.coffee_sources,
  public.menu_import_runs, public.discovered_drinks, public.recipe_drafts to service_role;

insert into public.coffee_sources
  (name, slug, base_url, menu_url, enabled, parser_type)
values
  ('Starbucks', 'starbucks', 'https://www.starbucks.com', 'https://www.starbucks.com/menu', false, 'custom'),
  ('Dutch Bros', 'dutch-bros', 'https://www.dutchbros.com', 'https://www.dutchbros.com/menu', false, 'json_ld'),
  ('Dunkin''', 'dunkin', 'https://www.dunkindonuts.com', 'https://www.dunkindonuts.com/en/menu', false, 'custom'),
  ('Scooter''s Coffee', 'scooters-coffee', 'https://www.scooterscoffee.com', 'https://www.scooterscoffee.com/menu', false, 'generic'),
  ('Peet''s', 'peets', 'https://www.peets.com', 'https://www.peets.com/pages/menu', false, 'generic'),
  ('Caribou Coffee', 'caribou-coffee', 'https://www.cariboucoffee.com', 'https://www.cariboucoffee.com/menu', false, 'generic')
on conflict (slug) do nothing;
