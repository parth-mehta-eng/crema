-- Weekend 6: content-quality tracking fields, collection-aware search, and idempotent seed support.

-- 1. Content-quality fields on recipe_drafts -------------------------------------------------

alter table public.recipe_drafts
  add column image_status text not null default 'missing'
    check (image_status in ('missing', 'placeholder', 'approved')),
  add column attribution_status text not null default 'not_required'
    check (attribution_status in ('not_required', 'required', 'complete', 'incomplete')),
  add column validation_status text not null default 'incomplete'
    check (validation_status in ('incomplete', 'valid', 'invalid')),
  add column content_notes text check (content_notes is null or char_length(content_notes) <= 2000),
  add column last_reviewed_at timestamptz,
  add column last_reviewed_by uuid references auth.users(id) on delete set null,
  add column seed_key text check (seed_key is null or seed_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

create unique index recipe_drafts_seed_key_unique_idx on public.recipe_drafts (seed_key) where seed_key is not null;
create index recipe_drafts_image_status_idx on public.recipe_drafts (image_status);
create index recipe_drafts_attribution_status_idx on public.recipe_drafts (attribution_status);
create index recipe_drafts_validation_status_idx on public.recipe_drafts (validation_status);

alter table public.discovered_drinks
  add column seed_key text check (seed_key is null or seed_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
create unique index discovered_drinks_seed_key_unique_idx on public.discovered_drinks (seed_key) where seed_key is not null;

-- 2. Derived image_status / attribution_status keep themselves current on plain field edits ---

create or replace function private.recompute_draft_content_flags()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_cafe_inspired boolean;
begin
  if new.placeholder_approved then
    new.image_status := 'placeholder';
  elsif coalesce(trim(new.hero_image_url), '') <> '' then
    new.image_status := 'approved';
  else
    new.image_status := 'missing';
  end if;

  v_cafe_inspired := lower(coalesce(new.inspiration_label, '')) like '%inspired%' or new.category = 'café inspired';
  if not v_cafe_inspired then
    new.attribution_status := 'not_required';
  elsif coalesce(trim(new.source_name), '') <> '' and coalesce(new.source_url, '') ~ '^https://' then
    new.attribution_status := 'complete';
  elsif coalesce(trim(new.source_name), '') <> '' or coalesce(trim(new.source_url), '') <> '' then
    new.attribution_status := 'incomplete';
  else
    new.attribution_status := 'required';
  end if;

  return new;
end;
$$;

create trigger recipe_drafts_recompute_content_flags
before insert or update of hero_image_url, placeholder_approved, inspiration_label, category, source_name, source_url
on public.recipe_drafts for each row execute function private.recompute_draft_content_flags();

-- 3. validation_status is recomputed explicitly wherever a draft or its children change --------

create or replace function private.recompute_draft_validation_status(p_draft_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_errors jsonb; v_status text; v_current_status text;
begin
  v_errors := private.recipe_draft_validation_errors(p_draft_id);
  select status into v_current_status from public.recipe_drafts where id = p_draft_id;
  if v_current_status is null then
    return null;
  end if;
  if jsonb_array_length(v_errors) = 0 then
    v_status := 'valid';
  elsif v_current_status in ('ready', 'published') then
    v_status := 'invalid';
  else
    v_status := 'incomplete';
  end if;
  update public.recipe_drafts set validation_status = v_status where id = p_draft_id;
  return v_status;
end;
$$;

revoke all on function private.recompute_draft_validation_status(uuid) from public, anon, authenticated;
grant execute on function private.recompute_draft_validation_status(uuid) to service_role;

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
    content_notes = nullif(trim(p_payload->>'contentNotes'), ''),
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
  perform private.recompute_draft_validation_status(p_draft_id);
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
  perform private.recompute_draft_validation_status(p_draft_id);
  return p_status;
end;
$$;

-- Publishing now also requires the cached validation_status to read 'valid' (belt-and-suspenders
-- alongside the live validation-error recheck already performed below).
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
  if d.image_status = 'missing' then raise exception 'Draft validation failed: recipe requires an approved image or approved placeholder.'; end if;
  if d.attribution_status in ('required', 'incomplete') then raise exception 'Draft validation failed: café-inspired attribution is incomplete.'; end if;
  v_recipe_id := coalesce(d.published_recipe_id, d.id::text);

  insert into public.recipes (
    id, slug, name, subtitle, inspiration, description, image_url, image_alt, minutes,
    prep_minutes, difficulty, temperature, servings, cup_size, tags, category,
    sweetness, strength, caffeine_mg, calories, featured, published, published_at, updated_at
  ) values (
    v_recipe_id, d.slug, d.proposed_title, d.inspiration_label, d.inspiration_label, d.description,
    coalesce(nullif(trim(d.hero_image_url), ''), 'crema://placeholder'),
    coalesce(nullif(trim(d.hero_image_alt), ''), d.proposed_title || ' (placeholder image)'),
    d.total_minutes, d.prep_minutes, d.difficulty,
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

  update public.recipes set
    ingredient_search_text = coalesce((
      select string_agg(coalesce(ri.display_name, i.name), ' ' order by ri.position)
      from public.recipe_ingredients ri join public.ingredients i on i.id = ri.ingredient_id
      where ri.recipe_id = v_recipe_id
    ), ''),
    collection_search_text = coalesce((
      select string_agg(c.title, ' ')
      from public.published_recipe_collections prc join public.recipe_collections c on c.id = prc.collection_id
      where prc.recipe_id = v_recipe_id
    ), '')
  where id = v_recipe_id;

  update public.recipe_drafts set status = 'published', published_recipe_id = v_recipe_id,
    published_at = now(), updated_by = p_admin_user_id where id = d.id;
  insert into public.admin_audit_log(action, entity_type, entity_id, admin_user_id, summary)
  values ('published', 'recipe', v_recipe_id, p_admin_user_id, 'Published from draft ' || d.id::text);
  return v_recipe_id;
end;
$$;

-- 4. Search: recipes gain a collection_search_text column and a wider search vector -----------

alter table public.recipes add column collection_search_text text not null default '';

create or replace function public.set_recipe_search_vector()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('pg_catalog.english', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('pg_catalog.english', coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('pg_catalog.english', coalesce(new.inspiration, '')), 'B') ||
    setweight(to_tsvector('pg_catalog.english', coalesce(array_to_string(new.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('pg_catalog.english', coalesce(new.category, '')), 'C') ||
    setweight(to_tsvector('pg_catalog.english', coalesce(new.collection_search_text, '')), 'B') ||
    setweight(to_tsvector('pg_catalog.english', coalesce(new.ingredient_search_text, '')), 'A');
  return new;
end;
$$;

drop trigger if exists recipes_search_vector_update on public.recipes;
create trigger recipes_search_vector_update
before insert or update of name, description, inspiration, tags, category, collection_search_text, ingredient_search_text
on public.recipes
for each row execute function public.set_recipe_search_vector();

update public.recipes set collection_search_text = coalesce((
  select string_agg(c.title, ' ')
  from public.published_recipe_collections prc join public.recipe_collections c on c.id = prc.collection_id
  where prc.recipe_id = recipes.id
), '');

create or replace function public.search_recipes(
  p_search_text text default '',
  p_filter text default null
)
returns table (recipe_id text, rank real)
language sql
volatile
security invoker
set search_path = ''
as $$
  select
    r.id,
    case
      when trim(coalesce(p_search_text, '')) = '' then 0::real
      else ts_rank(r.search_vector, websearch_to_tsquery('pg_catalog.english', p_search_text))
    end
  from public.recipes r
  where r.published
    and (
      trim(coalesce(p_search_text, '')) = ''
      or r.search_vector @@ websearch_to_tsquery('pg_catalog.english', p_search_text)
    )
    and (
      p_filter is null
      or p_filter = 'Surprise Me'
      or (p_filter in ('Iced', 'Hot') and r.temperature = p_filter)
      or (p_filter = 'Sweet' and exists (
        select 1 from unnest(r.tags) tag where lower(tag) = 'sweet'
      ))
      or (p_filter = 'Espresso' and exists (
        select 1
        from public.recipe_ingredients ri
        join public.ingredients i on i.id = ri.ingredient_id
        where ri.recipe_id = r.id
          and (i.id = 'espresso' or lower(i.name) like '%espresso%')
      ))
      or (p_filter = 'Coffee' and r.category = 'coffee')
      or (p_filter = 'Cold Brew' and r.category = 'cold brew')
      or (p_filter = 'Matcha' and r.category = 'matcha')
      or (p_filter = 'Quick' and r.prep_minutes <= 5)
      or (p_filter = 'Easy' and r.difficulty = 'Easy')
      or (p_filter in ('Coffee Shop Inspired', 'Around the World', 'Crema Originals') and exists (
        select 1
        from public.published_recipe_collections prc
        join public.recipe_collections c on c.id = prc.collection_id
        where prc.recipe_id = r.id
          and c.title = p_filter
      ))
    )
  order by
    case when p_filter = 'Surprise Me' then random() else 0 end desc,
    2 desc,
    r.name
  limit case when p_filter = 'Surprise Me' then 1 else 100 end;
$$;

-- 5. Daily Brew reads `recipes(id, image_url)` directly (already public via the existing
--    "Published recipes are public" policy) and does the eligibility/selection logic client-side
--    in lib/daily-brew.ts + services/dailyBrew.ts — no new RPC needed.

-- 6. Grants -------------------------------------------------------------------------------------

revoke all on function public.save_recipe_draft(uuid, integer, jsonb, uuid), public.transition_recipe_draft(uuid, text, uuid), public.publish_recipe_draft(uuid, uuid) from public, anon, authenticated;
grant execute on function public.save_recipe_draft(uuid, integer, jsonb, uuid), public.transition_recipe_draft(uuid, text, uuid), public.publish_recipe_draft(uuid, uuid) to service_role;
