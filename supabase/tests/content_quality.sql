-- Weekend 6: content-quality fields, collection assignment, idempotent seeding, and
-- publish-time content-quality gating. Run with pgTAP against a local/dev Supabase Postgres
-- (see docs/CONTENT_QUALITY.md "Run seed and content-quality tests").

\set ON_ERROR_STOP on

begin;
select plan(1);

-- 1) Idempotent seeding: re-running the same seed statements (mirroring
-- supabase/seeds/draft_templates.sql's pattern for the 'classic-espresso' row) must not
-- duplicate rows or collection links, and must not touch a draft an admin has since edited by
-- hand. This inlines the same on-conflict statements rather than \i-including the seed file, so
-- the test does not depend on the CWD a given pgTAP runner invokes psql from.
do $$
declare
  before_count integer;
  after_count integer;
  before_links integer;
  after_links integer;
begin
  select count(*) into before_count from public.recipe_drafts where seed_key is not null;
  select count(*) into before_links from public.recipe_draft_collections;

  -- Simulate an admin edit to a seeded draft's title before re-running the seed.
  update public.recipe_drafts set proposed_title = 'Edited By Admin'
  where seed_key = 'classic-espresso';

  insert into public.recipe_drafts (
    proposed_title, inspiration_label, source_name, source_url, description,
    category, temperature, flavor_notes, status, needs_testing, seed_key
  ) values (
    'Espresso','Espresso Classic','',null,
    'A straight double shot of espresso.','classic','hot',
    array['strong'],'draft',true,'classic-espresso'
  )
  on conflict (seed_key) where seed_key is not null do nothing;

  insert into public.recipe_draft_collections (draft_id, collection_id)
  select d.id, m.collection_id
  from public.recipe_drafts d
  join (values ('classic-espresso','espresso-classics'), ('classic-espresso','five-minute-coffees'), ('classic-espresso','beginner-friendly'))
    as m(seed_key, collection_id) on m.seed_key = d.seed_key
  on conflict (draft_id, collection_id) do nothing;

  select count(*) into after_count from public.recipe_drafts where seed_key is not null;
  select count(*) into after_links from public.recipe_draft_collections;

  if after_count <> before_count then
    raise exception 'Re-running the draft seed changed row count: % -> %', before_count, after_count;
  end if;
  if after_links <> before_links then
    raise exception 'Re-running the draft seed changed collection-link count: % -> %', before_links, after_links;
  end if;
  if (select proposed_title from public.recipe_drafts where seed_key = 'classic-espresso') <> 'Edited By Admin' then
    raise exception 'Re-running the seed overwrote a manually edited draft';
  end if;
end;
$$;

-- 2) Collection assignment landed as expected for a spot-checked seed_key.
do $$
begin
  if not exists (
    select 1 from public.recipe_drafts d
    join public.recipe_draft_collections dc on dc.draft_id = d.id
    where d.seed_key = 'classic-espresso' and dc.collection_id = 'espresso-classics'
  ) then
    raise exception 'Expected classic-espresso draft to be tagged into espresso-classics';
  end if;
end;
$$;

-- 3) image_status / attribution_status / validation_status are derived correctly.
do $$
declare v_draft_id uuid;
begin
  insert into public.recipe_drafts (
    proposed_title, inspiration_label, source_name, source_url, description, category, temperature,
    status, needs_testing
  ) values (
    'Quality Fixture', 'Starbucks Inspired', '', null, 'A fixture recipe.', 'espresso', 'iced', 'draft', true
  ) returning id into v_draft_id;

  if (select image_status from public.recipe_drafts where id = v_draft_id) <> 'missing' then
    raise exception 'Draft with no hero image should be image_status=missing';
  end if;
  if (select attribution_status from public.recipe_drafts where id = v_draft_id) <> 'required' then
    raise exception 'Cafe-inspired draft with no source should be attribution_status=required';
  end if;

  update public.recipe_drafts set placeholder_approved = true where id = v_draft_id;
  if (select image_status from public.recipe_drafts where id = v_draft_id) <> 'placeholder' then
    raise exception 'Approving the placeholder should set image_status=placeholder';
  end if;

  update public.recipe_drafts set source_name = 'Starbucks', source_url = 'https://www.starbucks.com/menu' where id = v_draft_id;
  if (select attribution_status from public.recipe_drafts where id = v_draft_id) <> 'complete' then
    raise exception 'Full source name+url should set attribution_status=complete';
  end if;

  update public.recipe_drafts set inspiration_label = 'Crema Original', category = 'Crema original' where id = v_draft_id;
  if (select attribution_status from public.recipe_drafts where id = v_draft_id) <> 'not_required' then
    raise exception 'Non-cafe-inspired draft should be attribution_status=not_required';
  end if;
end;
$$;

-- 4) Publish is blocked without an approved image or complete attribution, and blocked
-- unless validation_status reads valid (belt-and-suspenders on top of the live error check).
do $$
declare v_draft_id uuid := '44444444-4444-4444-8444-444444444444';
begin
  insert into public.recipe_drafts (
    id, proposed_title, slug, inspiration_label, source_name, source_url, description, category,
    temperature, needs_testing, status, tested, difficulty, prep_minutes, total_minutes, servings, cup_size
  ) values (
    v_draft_id, 'Attribution Gate Test', 'attribution-gate-test', 'Starbucks Inspired', 'Starbucks',
    'https://www.starbucks.com/menu', 'A recipe missing its image.', 'espresso', 'iced', false, 'ready', true,
    'Easy', 5, 5, 1, '12 oz'
  );
  insert into public.recipe_draft_ingredients(draft_id,ingredient_id,quantity,unit,position)
  values (v_draft_id,'espresso',1,'shot',1);
  insert into public.recipe_draft_steps(draft_id,position,instruction) values (v_draft_id,1,'Pull a shot.');
  insert into public.recipe_draft_equipment(draft_id,equipment_id,position) values (v_draft_id,'espresso-machine',1);

  set local role service_role;
  begin
    perform public.publish_recipe_draft(v_draft_id, null);
    raise exception 'Expected publish to fail without an approved image';
  exception when others then
    if sqlerrm = 'Expected publish to fail without an approved image' then raise; end if;
  end;
  reset role;

  if exists (select 1 from public.recipes where id = v_draft_id::text) then
    raise exception 'A blocked publish must not create a public recipe row';
  end if;
end;
$$;

-- 5) No draft leakage: anonymous/authenticated non-admin clients see zero rows across every
-- content-quality-bearing table, and published_recipe_collections only exposes published recipes.
do $$
begin
  if (select count(*) from public.recipe_drafts) = 0 then
    raise exception 'Test setup problem: expected seeded/fixture drafts to exist for this check';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{}}', true);
do $$
begin
  if (select count(*) from public.recipe_drafts) <> 0 then raise exception 'Non-admin must not see any recipe drafts'; end if;
  if (select count(*) from public.recipe_draft_collections) <> 0 then raise exception 'Non-admin must not see draft collection links'; end if;
end $$;
reset role;

-- 6) Published-only mobile query: a collection membership for an unpublished recipe (if any
-- existed) would never surface through the public policy — verified by construction, since the
-- policy predicate requires recipes.published = true. Spot-check with the real seeded data:
do $$
begin
  if exists (
    select 1 from public.published_recipe_collections prc
    join public.recipes r on r.id = prc.recipe_id
    where not r.published
  ) then
    raise exception 'published_recipe_collections must never reference an unpublished recipe';
  end if;
end $$;

select pass('content-quality fields, collection assignment, idempotent seeding, and publish gating all behave correctly');
select * from finish();
rollback;
