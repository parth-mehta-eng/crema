-- Weekend 5: structured recipe authoring, transactional publishing, images, and audit.

alter table public.recipe_drafts
  alter column discovered_drink_id drop not null,
  alter column created_by drop not null,
  drop constraint if exists recipe_drafts_category_check,
  drop constraint if exists recipe_drafts_source_url_check,
  add column slug text,
  add column published_recipe_id text unique references public.recipes(id) on delete restrict,
  add column featured boolean not null default false,
  add column tested boolean not null default false,
  add column difficulty text,
  add column prep_minutes integer,
  add column total_minutes integer,
  add column servings integer,
  add column cup_size text not null default '12 oz',
  add column sweetness smallint,
  add column strength smallint,
  add column caffeine_mg integer,
  add column calories integer,
  add column hero_image_url text,
  add column hero_image_path text,
  add column hero_image_alt text,
  add column hero_image_mime text,
  add column hero_image_bytes integer,
  add column placeholder_approved boolean not null default false,
  add column version integer not null default 1,
  add column updated_by uuid references auth.users(id) on delete set null,
  add column published_at timestamptz,
  add column archived_at timestamptz,
  add constraint recipe_drafts_difficulty_check check (difficulty is null or difficulty in ('Easy', 'Medium', 'Advanced')),
  add constraint recipe_drafts_prep_minutes_check check (prep_minutes is null or prep_minutes > 0),
  add constraint recipe_drafts_total_minutes_check check (total_minutes is null or total_minutes > 0),
  add constraint recipe_drafts_servings_check check (servings is null or servings > 0),
  add constraint recipe_drafts_sweetness_check check (sweetness is null or sweetness between 1 and 5),
  add constraint recipe_drafts_strength_check check (strength is null or strength between 1 and 5),
  add constraint recipe_drafts_caffeine_check check (caffeine_mg is null or caffeine_mg >= 0),
  add constraint recipe_drafts_calories_check check (calories is null or calories >= 0),
  add constraint recipe_drafts_image_bytes_check check (hero_image_bytes is null or hero_image_bytes between 1 and 5242880),
  add constraint recipe_drafts_slug_check check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  add constraint recipe_drafts_source_url_check check (source_url is null or source_url ~ '^https://');
alter table public.recipe_drafts alter column source_url drop not null;

update public.recipe_drafts
set category = case category
  when 'latte' then 'espresso'
  when 'mocha' then 'espresso'
  when 'macchiato' then 'espresso'
  when 'shaken espresso' then 'espresso'
  when 'other' then 'coffee'
  else category
end;

alter table public.recipe_drafts add constraint recipe_drafts_category_check check (
  category in ('espresso', 'coffee', 'cold brew', 'matcha', 'tea', 'blended',
    'seasonal', 'classic', 'café inspired', 'Crema original', 'around the world')
);

alter table public.ingredients
  add column canonical_name text,
  add column aliases text[] not null default '{}',
  add column default_unit text,
  add column active boolean not null default true;

create or replace function private.normalize_ingredient_catalog_row()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.canonical_name is null or trim(new.canonical_name) = '' then
    new.canonical_name := lower(trim(regexp_replace(new.name, '\s+', ' ', 'g')));
  else
    new.canonical_name := lower(trim(regexp_replace(new.canonical_name, '\s+', ' ', 'g')));
  end if;
  if new.category is null or lower(new.category) not in ('coffee', 'espresso', 'milk', 'syrup', 'sauce', 'sweetener', 'spice', 'topping', 'pantry', 'tea', 'matcha', 'other') then
    new.category := 'other';
  else
    new.category := lower(new.category);
  end if;
  return new;
end;
$$;
create trigger ingredients_normalize_catalog_row before insert or update of name, canonical_name, category
on public.ingredients for each row execute function private.normalize_ingredient_catalog_row();

update public.ingredients
set canonical_name = lower(trim(regexp_replace(name, '\s+', ' ', 'g'))),
    category = case
      when lower(coalesce(category, '')) in ('coffee', 'espresso', 'milk', 'syrup', 'sauce', 'sweetener', 'spice', 'topping', 'pantry', 'tea', 'matcha', 'other')
        then lower(category)
      else 'other'
    end;

alter table public.ingredients
  alter column canonical_name set not null,
  alter column category set default 'other',
  add constraint ingredients_category_check check (category in ('coffee', 'espresso', 'milk', 'syrup', 'sauce', 'sweetener', 'spice', 'topping', 'pantry', 'tea', 'matcha', 'other')),
  add constraint ingredients_default_unit_check check (default_unit is null or default_unit in ('shot', 'oz', 'fl oz', 'cup', 'tbsp', 'tsp', 'mL', 'g', 'pinch', 'pump', 'piece', 'to taste'));
create unique index ingredients_canonical_name_unique_idx on public.ingredients (lower(canonical_name));

alter table public.recipes
  drop constraint if exists recipes_temperature_valid,
  add column category text not null default 'coffee',
  add column prep_minutes integer not null default 5,
  add column sweetness smallint,
  add column strength smallint,
  add column caffeine_mg integer,
  add column calories integer,
  add column featured boolean not null default false,
  add column image_alt text not null default '',
  add column published_at timestamptz,
  add column updated_at timestamptz not null default now(),
  add constraint recipes_temperature_valid check (temperature in ('Iced', 'Hot', 'Either'));

alter table public.recipe_ingredients
  drop constraint if exists recipe_ingredients_pkey,
  add column id uuid not null default gen_random_uuid(),
  add column preparation_note text,
  add column substitution_notes text,
  add primary key (id);
create index recipe_ingredients_recipe_ingredient_idx on public.recipe_ingredients (recipe_id, ingredient_id);
create unique index recipe_ingredients_meaningful_unique_idx
  on public.recipe_ingredients (recipe_id, ingredient_id, lower(coalesce(display_name, '')), lower(coalesce(preparation_note, '')));

alter table public.recipe_steps add column tip text;
alter table public.recipe_equipment
  add column optional boolean not null default false,
  add column alternative_note text;

create table public.recipe_draft_ingredients (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.recipe_drafts(id) on delete cascade,
  ingredient_id text not null references public.ingredients(id) on delete restrict,
  display_name text,
  quantity numeric not null check (quantity > 0),
  unit text not null check (unit in ('shot', 'oz', 'fl oz', 'cup', 'tbsp', 'tsp', 'mL', 'g', 'pinch', 'pump', 'piece', 'to taste')),
  preparation_note text,
  optional boolean not null default false,
  substitution_notes text,
  position integer not null check (position > 0),
  unique (draft_id, position)
);
create unique index recipe_draft_ingredients_meaningful_unique_idx
  on public.recipe_draft_ingredients (draft_id, ingredient_id, lower(coalesce(display_name, '')), lower(coalesce(preparation_note, '')));
create index recipe_draft_ingredients_ingredient_idx on public.recipe_draft_ingredients (ingredient_id);

create table public.recipe_draft_steps (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.recipe_drafts(id) on delete cascade,
  position integer not null check (position > 0),
  instruction text not null,
  timer_seconds integer check (timer_seconds is null or timer_seconds > 0),
  tip text,
  unique (draft_id, position)
);

create table public.recipe_draft_step_ingredients (
  step_id uuid not null references public.recipe_draft_steps(id) on delete cascade,
  draft_ingredient_id uuid not null references public.recipe_draft_ingredients(id) on delete cascade,
  primary key (step_id, draft_ingredient_id)
);
create index recipe_draft_step_ingredients_ingredient_idx on public.recipe_draft_step_ingredients (draft_ingredient_id);

create table public.recipe_draft_equipment (
  draft_id uuid not null references public.recipe_drafts(id) on delete cascade,
  equipment_id text not null references public.equipment(id) on delete restrict,
  optional boolean not null default false,
  alternative_note text,
  position integer not null check (position > 0),
  primary key (draft_id, equipment_id),
  unique (draft_id, position)
);

create table public.recipe_tags (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index recipe_tags_normalized_name_idx on public.recipe_tags (lower(name));

create table public.recipe_draft_tags (
  draft_id uuid not null references public.recipe_drafts(id) on delete cascade,
  tag_id text not null references public.recipe_tags(id) on delete restrict,
  primary key (draft_id, tag_id)
);

create table public.published_recipe_tags (
  recipe_id text not null references public.recipes(id) on delete cascade,
  tag_id text not null references public.recipe_tags(id) on delete restrict,
  primary key (recipe_id, tag_id)
);

create table public.recipe_collections (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  description text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipe_draft_collections (
  draft_id uuid not null references public.recipe_drafts(id) on delete cascade,
  collection_id text not null references public.recipe_collections(id) on delete restrict,
  primary key (draft_id, collection_id)
);

create table public.published_recipe_collections (
  recipe_id text not null references public.recipes(id) on delete cascade,
  collection_id text not null references public.recipe_collections(id) on delete restrict,
  primary key (recipe_id, collection_id)
);

create table public.recipe_step_ingredients (
  step_id bigint not null references public.recipe_steps(id) on delete cascade,
  recipe_ingredient_id uuid not null references public.recipe_ingredients(id) on delete cascade,
  primary key (step_id, recipe_ingredient_id)
);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  action text not null check (action in ('draft_created', 'draft_updated', 'marked_tested', 'marked_ready', 'published', 'unpublished', 'archived', 'restored', 'duplicated')),
  entity_type text not null check (entity_type in ('recipe_draft', 'recipe', 'ingredient', 'collection')),
  entity_id text not null,
  admin_user_id uuid references auth.users(id) on delete set null,
  summary text check (char_length(summary) <= 500),
  created_at timestamptz not null default now()
);
create index admin_audit_log_entity_idx on public.admin_audit_log (entity_type, entity_id, created_at desc);

create or replace function private.enforce_recipe_draft_status()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.status = old.status then return new; end if;
  if old.status = 'draft' and new.status in ('tested', 'archived') then null;
  elsif old.status = 'tested' and new.status in ('draft', 'ready', 'archived') then null;
  elsif old.status = 'ready' and new.status in ('tested', 'published', 'archived') then null;
  elsif old.status = 'published' and new.status in ('draft', 'archived') then null;
  elsif old.status = 'archived' and new.status = 'draft' then null;
  else raise exception 'Invalid recipe draft status transition: % to %', old.status, new.status;
  end if;
  if new.status in ('tested', 'ready', 'published') and (new.needs_testing or not new.tested) then
    raise exception 'A tested, ready, or published draft must be marked tested';
  end if;
  return new;
end;
$$;

create or replace function private.recipe_draft_validation_errors(p_draft_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(errors.error), '[]'::jsonb)
  from public.recipe_drafts d
  cross join lateral (
    select jsonb_build_object('field', validation.field, 'code', validation.code, 'message', validation.message) error
    from (
      select 'proposedTitle' field, 'required' code, 'Recipe title is required.' message where coalesce(trim(d.proposed_title), '') = ''
      union all select 'slug', 'required', 'Slug is required.' where coalesce(trim(d.slug), '') = ''
      union all select 'slug', 'format', 'Slug must use lowercase letters, numbers, and hyphens.' where d.slug is not null and d.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      union all select 'slug', 'duplicate_slug', 'This slug is already used by another recipe.' where exists (select 1 from public.recipes r where r.slug = d.slug and r.id is distinct from d.published_recipe_id)
      union all select 'description', 'required', 'Short description is required.' where coalesce(trim(d.description), '') = ''
      union all select 'difficulty', 'required', 'Choose a difficulty.' where d.difficulty is null
      union all select 'prepMinutes', 'required', 'Preparation time is required.' where d.prep_minutes is null
      union all select 'totalMinutes', 'range', 'Total time cannot be shorter than preparation time.' where d.total_minutes is null or d.total_minutes < d.prep_minutes
      union all select 'servings', 'required', 'Serving count is required.' where d.servings is null
      union all select 'ingredients', 'required', 'Add at least one ingredient.' where not exists (select 1 from public.recipe_draft_ingredients i where i.draft_id = d.id)
      union all select 'steps', 'required', 'Add at least one preparation step.' where not exists (select 1 from public.recipe_draft_steps s where s.draft_id = d.id and trim(s.instruction) <> '')
      union all select 'equipment', 'required', 'Classify at least one equipment item.' where not exists (select 1 from public.recipe_draft_equipment e where e.draft_id = d.id)
      union all select 'heroImageUrl', 'required', 'Upload an approved hero image.' where coalesce(trim(d.hero_image_url), '') = '' and not d.placeholder_approved
      union all select 'heroImageAlt', 'required', 'Image alt text is required.' where coalesce(trim(d.hero_image_url), '') <> '' and coalesce(trim(d.hero_image_alt), '') = ''
      union all select 'sourceName', 'required', 'Café-inspired recipes require a source name.' where (lower(d.inspiration_label) like '%inspired%' or d.category = 'café inspired') and coalesce(trim(d.source_name), '') = ''
      union all select 'sourceUrl', 'required', 'Café-inspired recipes require an HTTPS source URL.' where (lower(d.inspiration_label) like '%inspired%' or d.category = 'café inspired') and coalesce(d.source_url, '') !~ '^https://'
      union all select 'tested', 'required', 'Resolve testing and mark the recipe tested.' where d.needs_testing or not d.tested
    ) validation
  ) errors
  where d.id = p_draft_id;
$$;

revoke all on function private.recipe_draft_validation_errors(uuid) from public, anon, authenticated;
grant execute on function private.recipe_draft_validation_errors(uuid) to service_role;

create or replace function public.save_recipe_draft(
  p_draft_id uuid,
  p_expected_version integer,
  p_payload jsonb,
  p_admin_user_id uuid
)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_version integer;
  ingredient jsonb;
  step jsonb;
  equipment_item jsonb;
  tag_item jsonb;
  collection_item jsonb;
  referenced_id jsonb;
begin
  update public.recipe_drafts set
    proposed_title = trim(p_payload->>'proposedTitle'), slug = nullif(trim(p_payload->>'slug'), ''),
    description = trim(p_payload->>'description'), inspiration_label = trim(p_payload->>'inspirationLabel'),
    source_name = trim(p_payload->>'sourceName'), source_url = nullif(trim(p_payload->>'sourceUrl'), ''),
    category = p_payload->>'category', temperature = p_payload->>'temperature',
    difficulty = nullif(p_payload->>'difficulty', ''), prep_minutes = nullif(p_payload->>'prepMinutes', '')::integer,
    total_minutes = nullif(p_payload->>'totalMinutes', '')::integer, servings = nullif(p_payload->>'servings', '')::integer,
    cup_size = trim(p_payload->>'cupSize'), sweetness = nullif(p_payload->>'sweetness', '')::smallint,
    strength = nullif(p_payload->>'strength', '')::smallint, caffeine_mg = nullif(p_payload->>'caffeineMg', '')::integer,
    calories = nullif(p_payload->>'calories', '')::integer, featured = coalesce((p_payload->>'featured')::boolean, false),
    hero_image_url = nullif(trim(p_payload->>'heroImageUrl'), ''), hero_image_path = nullif(trim(p_payload->>'heroImagePath'), ''),
    hero_image_alt = nullif(trim(p_payload->>'heroImageAlt'), ''), hero_image_mime = nullif(trim(p_payload->>'heroImageMime'), ''),
    hero_image_bytes = nullif(p_payload->>'heroImageBytes', '')::integer,
    placeholder_approved = coalesce((p_payload->>'placeholderApproved')::boolean, false),
    flavor_notes = coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'flavorNotes', '[]'::jsonb))), '{}'),
    updated_by = p_admin_user_id, version = version + 1
  where id = p_draft_id and version = p_expected_version
  returning version into v_version;
  if v_version is null then raise exception 'Draft changed in another session. Reload before saving.'; end if;

  delete from public.recipe_draft_step_ingredients where step_id in (select id from public.recipe_draft_steps where draft_id = p_draft_id);
  delete from public.recipe_draft_steps where draft_id = p_draft_id;
  delete from public.recipe_draft_ingredients where draft_id = p_draft_id;
  delete from public.recipe_draft_equipment where draft_id = p_draft_id;
  delete from public.recipe_draft_tags where draft_id = p_draft_id;
  delete from public.recipe_draft_collections where draft_id = p_draft_id;

  for ingredient in select value from jsonb_array_elements(coalesce(p_payload->'ingredients', '[]'::jsonb)) loop
    insert into public.recipe_draft_ingredients(id, draft_id, ingredient_id, display_name, quantity, unit, preparation_note, optional, substitution_notes, position)
    values ((ingredient->>'id')::uuid, p_draft_id, ingredient->>'ingredientId', nullif(trim(ingredient->>'displayName'), ''),
      (ingredient->>'quantity')::numeric, ingredient->>'unit', nullif(trim(ingredient->>'preparationNote'), ''),
      coalesce((ingredient->>'optional')::boolean, false), nullif(trim(ingredient->>'substitutionNotes'), ''), (ingredient->>'position')::integer);
  end loop;
  for step in select value from jsonb_array_elements(coalesce(p_payload->'steps', '[]'::jsonb)) loop
    insert into public.recipe_draft_steps(id, draft_id, position, instruction, timer_seconds, tip)
    values ((step->>'id')::uuid, p_draft_id, (step->>'position')::integer, trim(step->>'instruction'),
      nullif(step->>'timerSeconds', '')::integer, nullif(trim(step->>'tip'), ''));
    for referenced_id in select value from jsonb_array_elements(coalesce(step->'ingredientRowIds', '[]'::jsonb)) loop
      insert into public.recipe_draft_step_ingredients(step_id, draft_ingredient_id)
      values ((step->>'id')::uuid, trim(both '"' from referenced_id::text)::uuid);
    end loop;
  end loop;
  for equipment_item in select value from jsonb_array_elements(coalesce(p_payload->'equipment', '[]'::jsonb)) loop
    insert into public.recipe_draft_equipment(draft_id, equipment_id, optional, alternative_note, position)
    values (p_draft_id, equipment_item->>'equipmentId', coalesce((equipment_item->>'optional')::boolean, false),
      nullif(trim(equipment_item->>'alternativeNote'), ''), (equipment_item->>'position')::integer);
  end loop;
  for tag_item in select value from jsonb_array_elements(coalesce(p_payload->'tagIds', '[]'::jsonb)) loop
    insert into public.recipe_draft_tags(draft_id, tag_id) values (p_draft_id, trim(both '"' from tag_item::text));
  end loop;
  for collection_item in select value from jsonb_array_elements(coalesce(p_payload->'collectionIds', '[]'::jsonb)) loop
    insert into public.recipe_draft_collections(draft_id, collection_id) values (p_draft_id, trim(both '"' from collection_item::text));
  end loop;
  insert into public.admin_audit_log(action, entity_type, entity_id, admin_user_id, summary)
  values ('draft_updated', 'recipe_draft', p_draft_id::text, p_admin_user_id, 'Saved structured recipe draft version ' || v_version::text);
  return v_version;
end;
$$;

create or replace function public.transition_recipe_draft(p_draft_id uuid, p_status text, p_admin_user_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare d public.recipe_drafts%rowtype; validation jsonb; action_name text;
begin
  select * into d from public.recipe_drafts where id = p_draft_id for update;
  if not found then raise exception 'Recipe draft was not found.'; end if;
  if p_status = 'tested' then
    update public.recipe_drafts set status = 'tested', tested = true, needs_testing = false, updated_by = p_admin_user_id where id = p_draft_id;
    action_name := 'marked_tested';
  elsif p_status = 'ready' then
    validation := private.recipe_draft_validation_errors(p_draft_id);
    if jsonb_array_length(validation) > 0 then raise exception 'Draft validation failed: %', validation::text; end if;
    update public.recipe_drafts set status = 'ready', updated_by = p_admin_user_id where id = p_draft_id;
    action_name := 'marked_ready';
  elsif p_status = 'archived' then
    if d.published_recipe_id is not null then update public.recipes set published = false, updated_at = now() where id = d.published_recipe_id; end if;
    update public.recipe_drafts set status = 'archived', archived_at = now(), updated_by = p_admin_user_id where id = p_draft_id;
    action_name := 'archived';
  elsif p_status = 'draft' and d.status in ('archived', 'published') then
    update public.recipe_drafts set status = 'draft', archived_at = null, updated_by = p_admin_user_id where id = p_draft_id;
    action_name := case when d.status = 'archived' then 'restored' else 'draft_updated' end;
  else raise exception 'Unsupported draft transition.';
  end if;
  insert into public.admin_audit_log(action, entity_type, entity_id, admin_user_id)
  values (action_name, 'recipe_draft', p_draft_id::text, p_admin_user_id);
  return p_status;
end;
$$;

create or replace function public.duplicate_recipe_draft(p_draft_id uuid, p_admin_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  d public.recipe_drafts%rowtype;
  v_new_id uuid := gen_random_uuid();
  v_new_ingredient_id uuid;
  v_new_step_id uuid;
  ingredient_row record;
  step_row record;
  reference_row record;
  ingredient_id_map jsonb := '{}'::jsonb;
begin
  select * into d from public.recipe_drafts where id = p_draft_id;
  if not found then raise exception 'Recipe draft was not found.'; end if;
  insert into public.recipe_drafts (
    id, proposed_title, slug, inspiration_label, source_name, source_url, description, category, temperature,
    flavor_notes, featured, tested, difficulty, prep_minutes, total_minutes, servings, cup_size,
    sweetness, strength, caffeine_mg, calories, hero_image_url, hero_image_path, hero_image_alt,
    hero_image_mime, hero_image_bytes, placeholder_approved, needs_testing, status, created_by, updated_by
  ) values (
    v_new_id, d.proposed_title || ' Copy', coalesce(d.slug, 'recipe') || '-copy-' || left(v_new_id::text, 4),
    d.inspiration_label, d.source_name, d.source_url, d.description, d.category, d.temperature,
    d.flavor_notes, false, false, d.difficulty, d.prep_minutes, d.total_minutes, d.servings, d.cup_size,
    d.sweetness, d.strength, d.caffeine_mg, d.calories, d.hero_image_url, d.hero_image_path, d.hero_image_alt,
    d.hero_image_mime, d.hero_image_bytes, d.placeholder_approved, true, 'draft', p_admin_user_id, p_admin_user_id
  );
  for ingredient_row in select * from public.recipe_draft_ingredients where draft_id = p_draft_id order by position loop
    v_new_ingredient_id := gen_random_uuid();
    ingredient_id_map := ingredient_id_map || jsonb_build_object(ingredient_row.id::text, v_new_ingredient_id::text);
    insert into public.recipe_draft_ingredients(id, draft_id, ingredient_id, display_name, quantity, unit, preparation_note, optional, substitution_notes, position)
    values (v_new_ingredient_id, v_new_id, ingredient_row.ingredient_id, ingredient_row.display_name, ingredient_row.quantity,
      ingredient_row.unit, ingredient_row.preparation_note, ingredient_row.optional, ingredient_row.substitution_notes, ingredient_row.position);
  end loop;
  for step_row in select * from public.recipe_draft_steps where draft_id = p_draft_id order by position loop
    v_new_step_id := gen_random_uuid();
    insert into public.recipe_draft_steps(id, draft_id, position, instruction, timer_seconds, tip)
    values (v_new_step_id, v_new_id, step_row.position, step_row.instruction, step_row.timer_seconds, step_row.tip);
    for reference_row in select draft_ingredient_id from public.recipe_draft_step_ingredients where step_id = step_row.id loop
      insert into public.recipe_draft_step_ingredients(step_id, draft_ingredient_id)
      values (v_new_step_id, (ingredient_id_map->>reference_row.draft_ingredient_id::text)::uuid);
    end loop;
  end loop;
  insert into public.recipe_draft_equipment select v_new_id, equipment_id, optional, alternative_note, position from public.recipe_draft_equipment where draft_id = p_draft_id;
  insert into public.recipe_draft_tags select v_new_id, tag_id from public.recipe_draft_tags where draft_id = p_draft_id;
  insert into public.recipe_draft_collections select v_new_id, collection_id from public.recipe_draft_collections where draft_id = p_draft_id;
  insert into public.admin_audit_log(action, entity_type, entity_id, admin_user_id, summary)
  values ('duplicated', 'recipe_draft', v_new_id::text, p_admin_user_id, 'Duplicated from draft ' || p_draft_id::text);
  return v_new_id;
end;
$$;

revoke all on function public.save_recipe_draft(uuid, integer, jsonb, uuid), public.transition_recipe_draft(uuid, text, uuid), public.duplicate_recipe_draft(uuid, uuid) from public, anon, authenticated;
grant execute on function public.save_recipe_draft(uuid, integer, jsonb, uuid), public.transition_recipe_draft(uuid, text, uuid), public.duplicate_recipe_draft(uuid, uuid) to service_role;

create or replace function public.publish_recipe_draft(p_draft_id uuid, p_admin_user_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  d public.recipe_drafts%rowtype;
  v_recipe_id text;
  validation jsonb;
  draft_step record;
  public_step_id bigint;
begin
  select * into d from public.recipe_drafts where id = p_draft_id for update;
  if not found then raise exception 'Recipe draft was not found.'; end if;
  if d.status <> 'ready' then raise exception 'Recipe draft must be ready before publishing.'; end if;
  validation := private.recipe_draft_validation_errors(p_draft_id);
  if jsonb_array_length(validation) > 0 then raise exception 'Draft validation failed: %', validation::text; end if;
  v_recipe_id := coalesce(d.published_recipe_id, d.id::text);

  insert into public.recipes (
    id, slug, name, subtitle, inspiration, description, image_url, image_alt, minutes,
    prep_minutes, difficulty, temperature, servings, cup_size, tags, category,
    sweetness, strength, caffeine_mg, calories, featured, published, published_at, updated_at
  ) values (
    v_recipe_id, d.slug, d.proposed_title, d.inspiration_label, d.inspiration_label, d.description,
    d.hero_image_url, coalesce(d.hero_image_alt, ''), d.total_minutes, d.prep_minutes, d.difficulty,
    initcap(d.temperature), d.servings, d.cup_size,
    coalesce((select array_agg(t.name order by t.name) from public.recipe_draft_tags dt join public.recipe_tags t on t.id = dt.tag_id where dt.draft_id = d.id), '{}'),
    d.category, d.sweetness, d.strength, d.caffeine_mg, d.calories, d.featured, true, now(), now()
  ) on conflict (id) do update set
    slug = excluded.slug, name = excluded.name, subtitle = excluded.subtitle,
    inspiration = excluded.inspiration, description = excluded.description,
    image_url = excluded.image_url, image_alt = excluded.image_alt, minutes = excluded.minutes,
    prep_minutes = excluded.prep_minutes, difficulty = excluded.difficulty,
    temperature = excluded.temperature, servings = excluded.servings, cup_size = excluded.cup_size,
    tags = excluded.tags, category = excluded.category, sweetness = excluded.sweetness,
    strength = excluded.strength, caffeine_mg = excluded.caffeine_mg, calories = excluded.calories,
    featured = excluded.featured, published = true, published_at = coalesce(public.recipes.published_at, now()), updated_at = now();

  delete from public.recipe_step_ingredients where step_id in (select id from public.recipe_steps where recipe_steps.recipe_id = v_recipe_id);
  delete from public.recipe_steps where recipe_steps.recipe_id = v_recipe_id;
  delete from public.recipe_ingredients where recipe_ingredients.recipe_id = v_recipe_id;
  delete from public.recipe_equipment where recipe_equipment.recipe_id = v_recipe_id;
  delete from public.published_recipe_tags where published_recipe_tags.recipe_id = v_recipe_id;
  delete from public.published_recipe_collections where published_recipe_collections.recipe_id = v_recipe_id;

  insert into public.recipe_ingredients (id, recipe_id, ingredient_id, position, quantity, unit, display_name, note, preparation_note, optional, substitution_notes)
  select id, v_recipe_id, ingredient_id, position, quantity, unit, nullif(display_name, ''), nullif(preparation_note, ''), nullif(preparation_note, ''), optional, nullif(substitution_notes, '')
  from public.recipe_draft_ingredients where draft_id = d.id order by position;

  insert into public.recipe_equipment (recipe_id, equipment_id, position, optional, alternative_note)
  select v_recipe_id, equipment_id, position, optional, nullif(alternative_note, '')
  from public.recipe_draft_equipment where draft_id = d.id order by position;

  for draft_step in select * from public.recipe_draft_steps where draft_id = d.id order by position loop
    insert into public.recipe_steps (recipe_id, position, instruction, timer_seconds, tip)
    values (v_recipe_id, draft_step.position, draft_step.instruction, draft_step.timer_seconds, nullif(draft_step.tip, ''))
    returning id into public_step_id;
    insert into public.recipe_step_ingredients (step_id, recipe_ingredient_id)
    select public_step_id, dsi.draft_ingredient_id
    from public.recipe_draft_step_ingredients dsi where dsi.step_id = draft_step.id;
  end loop;

  insert into public.published_recipe_tags (recipe_id, tag_id)
  select v_recipe_id, tag_id from public.recipe_draft_tags where draft_id = d.id;
  insert into public.published_recipe_collections (recipe_id, collection_id)
  select v_recipe_id, collection_id from public.recipe_draft_collections where draft_id = d.id;

  update public.recipes set ingredient_search_text = coalesce((
    select string_agg(coalesce(ri.display_name, i.name), ' ' order by ri.position)
    from public.recipe_ingredients ri join public.ingredients i on i.id = ri.ingredient_id
    where ri.recipe_id = v_recipe_id
  ), '') where id = v_recipe_id;

  update public.recipe_drafts set status = 'published', published_recipe_id = v_recipe_id,
    published_at = now(), updated_by = p_admin_user_id where id = d.id;
  insert into public.admin_audit_log(action, entity_type, entity_id, admin_user_id, summary)
  values ('published', 'recipe', v_recipe_id, p_admin_user_id, 'Published from draft ' || d.id::text);
  return v_recipe_id;
end;
$$;

create or replace function public.unpublish_recipe_draft(p_draft_id uuid, p_admin_user_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare d public.recipe_drafts%rowtype;
begin
  select * into d from public.recipe_drafts where id = p_draft_id for update;
  if not found or d.published_recipe_id is null then raise exception 'Published recipe was not found.'; end if;
  update public.recipes set published = false, updated_at = now() where id = d.published_recipe_id;
  update public.recipe_drafts set status = 'draft', updated_by = p_admin_user_id where id = d.id;
  insert into public.admin_audit_log(action, entity_type, entity_id, admin_user_id, summary)
  values ('unpublished', 'recipe', d.published_recipe_id, p_admin_user_id, 'Public recipe hidden; editable draft restored.');
  return d.published_recipe_id;
end;
$$;

revoke all on function public.publish_recipe_draft(uuid, uuid), public.unpublish_recipe_draft(uuid, uuid) from public, anon, authenticated;
grant execute on function public.publish_recipe_draft(uuid, uuid), public.unpublish_recipe_draft(uuid, uuid) to service_role;

alter table public.recipe_draft_ingredients enable row level security;
alter table public.recipe_draft_steps enable row level security;
alter table public.recipe_draft_step_ingredients enable row level security;
alter table public.recipe_draft_equipment enable row level security;
alter table public.recipe_tags enable row level security;
alter table public.recipe_draft_tags enable row level security;
alter table public.published_recipe_tags enable row level security;
alter table public.recipe_collections enable row level security;
alter table public.recipe_draft_collections enable row level security;
alter table public.published_recipe_collections enable row level security;
alter table public.recipe_step_ingredients enable row level security;
alter table public.admin_audit_log enable row level security;

create policy "Admins manage draft ingredients" on public.recipe_draft_ingredients for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage draft steps" on public.recipe_draft_steps for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage draft step ingredients" on public.recipe_draft_step_ingredients for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage draft equipment" on public.recipe_draft_equipment for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage tags" on public.recipe_tags for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage draft tags" on public.recipe_draft_tags for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Public reads published recipe tags" on public.published_recipe_tags for select to anon, authenticated using (exists (select 1 from public.recipes r where r.id = recipe_id and r.published));
create policy "Public reads active collections" on public.recipe_collections for select to anon, authenticated using (active);
create policy "Admins manage collections" on public.recipe_collections for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage draft collections" on public.recipe_draft_collections for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Public reads published recipe collections" on public.published_recipe_collections for select to anon, authenticated using (exists (select 1 from public.recipes r where r.id = recipe_id and r.published));
create policy "Public reads published step ingredients" on public.recipe_step_ingredients for select to anon, authenticated using (exists (select 1 from public.recipe_steps s join public.recipes r on r.id = s.recipe_id where s.id = step_id and r.published));
create policy "Admins read audit log" on public.admin_audit_log for select to authenticated using ((select private.is_admin()));

create policy "Admins manage ingredient catalog" on public.ingredients for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage equipment catalog" on public.equipment for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

revoke all on table public.recipe_draft_ingredients, public.recipe_draft_steps,
  public.recipe_draft_step_ingredients, public.recipe_draft_equipment, public.recipe_tags,
  public.recipe_draft_tags, public.published_recipe_tags, public.recipe_collections,
  public.recipe_draft_collections, public.published_recipe_collections,
  public.recipe_step_ingredients, public.admin_audit_log from public, anon, authenticated;
grant select, insert, update, delete on table public.recipe_draft_ingredients, public.recipe_draft_steps,
  public.recipe_draft_step_ingredients, public.recipe_draft_equipment, public.recipe_tags,
  public.recipe_draft_tags, public.recipe_collections, public.recipe_draft_collections to authenticated;
grant select on table public.published_recipe_tags, public.recipe_collections,
  public.published_recipe_collections, public.recipe_step_ingredients to anon, authenticated;
grant select on table public.admin_audit_log to authenticated;
grant select, insert, update, delete on table public.recipe_draft_ingredients, public.recipe_draft_steps,
  public.recipe_draft_step_ingredients, public.recipe_draft_equipment, public.recipe_tags,
  public.recipe_draft_tags, public.published_recipe_tags, public.recipe_collections,
  public.recipe_draft_collections, public.published_recipe_collections,
  public.recipe_step_ingredients, public.admin_audit_log to service_role;
grant select, insert, update on table public.ingredients, public.equipment to authenticated;

insert into public.recipe_tags (id, name) values
  ('vanilla','vanilla'),('caramel','caramel'),('brown-sugar','brown sugar'),('cinnamon','cinnamon'),
  ('chocolate','chocolate'),('white-chocolate','white chocolate'),('pistachio','pistachio'),('hazelnut','hazelnut'),
  ('honey','honey'),('lavender','lavender'),('peppermint','peppermint'),('pumpkin','pumpkin'),('maple','maple'),
  ('coconut','coconut'),('fruity','fruity'),('floral','floral'),('nutty','nutty'),('creamy','creamy'),
  ('strong','strong'),('lightly-sweet','lightly sweet'),('quick','quick'),('dairy-free','dairy free'),('seasonal','seasonal')
on conflict (id) do nothing;

insert into public.recipe_collections (id, title, description, sort_order) values
  ('coffee-shop-inspired','Coffee Shop Inspired','Home recipes inspired by café favorites.',10),
  ('around-the-world','Around the World','Coffee traditions from around the world.',20),
  ('crema-originals','Crema Originals','Original recipes developed by Crema.',30),
  ('seasonal-favorites','Seasonal Favorites','Recipes for the current season.',40),
  ('espresso-classics','Espresso Classics','Foundational espresso drinks.',50),
  ('iced-favorites','Iced Favorites','Cold coffee favorites.',60),
  ('beginner-friendly','Beginner Friendly','Approachable recipes for new home baristas.',70),
  ('five-minute-coffees','Five-Minute Coffees','Recipes ready in five minutes.',80)
on conflict (id) do nothing;

insert into public.equipment (id, name) values
  ('nespresso','Nespresso'),('keurig','Keurig'),('milk-frother','Milk frother'),('cocktail-shaker','Cocktail shaker'),
  ('blender','Blender'),('french-press','French press'),('moka-pot','Moka pot'),('pour-over','Pour-over'),
  ('saucepan','Saucepan'),('measuring-spoon','Measuring spoon'),('scale','Scale')
on conflict (id) do nothing;

insert into public.discovered_drinks (source_id, external_name, normalized_name, external_description, source_url, category, temperature, flavor_notes, mentioned_ingredients, fingerprint, status)
select id, 'Brown Sugar Shaken Espresso', 'brown sugar shaken espresso', 'A menu discovery awaiting an original, tested Crema home recipe.', menu_url,
  'shaken espresso', 'iced', array['brown sugar','strong'], array['espresso','brown sugar','milk'], encode(extensions.digest(id::text || ':brown sugar shaken espresso', 'sha256'), 'hex'), 'reviewed'
from public.coffee_sources where slug = 'starbucks'
on conflict (fingerprint) do nothing;

insert into public.recipe_drafts (proposed_title, inspiration_label, source_name, source_url, description, category, temperature, flavor_notes, status, needs_testing)
values
  ('Caramel Macchiato','Coffee shop inspired','Starbucks','https://www.starbucks.com/menu','','espresso','either',array['caramel'],'draft',true),
  ('Vanilla Sweet Cream Cold Brew','Coffee shop inspired','Starbucks','https://www.starbucks.com/menu','','cold brew','iced',array['vanilla','creamy'],'draft',true),
  ('Iced White Mocha','Coffee shop inspired','Starbucks','https://www.starbucks.com/menu','','espresso','iced',array['white chocolate'],'draft',true),
  ('Pistachio Latte','Coffee shop inspired','Starbucks','https://www.starbucks.com/menu','','espresso','either',array['pistachio','nutty'],'draft',true),
  ('Golden Eagle','Coffee shop inspired','Dutch Bros','https://www.dutchbros.com/menu','','espresso','either',array['caramel','vanilla'],'draft',true),
  ('Caramelizer','Coffee shop inspired','Dutch Bros','https://www.dutchbros.com/menu','','espresso','either',array['caramel','chocolate'],'draft',true),
  ('Annihilator','Coffee shop inspired','Dutch Bros','https://www.dutchbros.com/menu','','espresso','either',array['chocolate','nutty'],'draft',true),
  ('Butter Pecan Latte','Coffee shop inspired','Dunkin''','https://www.dunkindonuts.com/en/menu','','espresso','either',array['nutty'],'draft',true),
  ('Caramelicious','Coffee shop inspired','Scooter''s Coffee','https://www.scooterscoffee.com/menu','','espresso','either',array['caramel'],'draft',true),
  ('Spanish Latte','Around the world','','https://en.wikipedia.org/wiki/Caf%C3%A9_con_leche','','around the world','hot',array['creamy'],'draft',true),
  ('Vietnamese Iced Coffee','Around the world','','https://en.wikipedia.org/wiki/Vietnamese_iced_coffee','','around the world','iced',array['strong','creamy'],'draft',true),
  ('Café Bombón','Around the world','','https://en.wikipedia.org/wiki/Caf%C3%A9_bomb%C3%B3n','','around the world','hot',array['creamy'],'draft',true),
  ('Affogato','Espresso classic','','https://en.wikipedia.org/wiki/Affogato','','classic','hot',array['creamy','strong'],'draft',true),
  ('Espresso Tonic','Crema original','','https://crema.local/recipes','','Crema original','iced',array['fruity','strong'],'draft',true)
on conflict do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-images', 'recipe-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Public reads recipe images" on storage.objects for select to anon, authenticated using (bucket_id = 'recipe-images');
create policy "Admins upload recipe images" on storage.objects for insert to authenticated with check (bucket_id = 'recipe-images' and (select private.is_admin()));
create policy "Admins replace recipe images" on storage.objects for update to authenticated using (bucket_id = 'recipe-images' and (select private.is_admin())) with check (bucket_id = 'recipe-images' and (select private.is_admin()));
create policy "Admins remove recipe images" on storage.objects for delete to authenticated using (bucket_id = 'recipe-images' and (select private.is_admin()));
