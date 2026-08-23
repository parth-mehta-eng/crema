\set ON_ERROR_STOP on

begin;
select plan(1);

do $$
begin
  if (select count(*) from public.recipe_collections) <> 8 then raise exception 'Expected eight initial collections'; end if;
  if (select count(*) from public.recipe_tags) < 20 then raise exception 'Expected controlled recipe tags'; end if;
  if (select count(*) from public.recipe_drafts where needs_testing) < 14 then raise exception 'Expected initial untested draft batch'; end if;
  if not exists (select 1 from public.discovered_drinks where normalized_name = 'brown sugar shaken espresso' and status = 'reviewed') then raise exception 'Expected reviewed Brown Sugar discovery'; end if;
  if has_function_privilege('authenticated', 'public.publish_recipe_draft(uuid,uuid)', 'execute') then raise exception 'Authenticated clients must not execute publish RPC directly'; end if;
  if exists (select 1 from pg_class where oid in ('public.recipe_draft_ingredients'::regclass, 'public.recipe_draft_steps'::regclass, 'public.admin_audit_log'::regclass) and not relrowsecurity) then raise exception 'Authoring tables require RLS'; end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{}}', true);
do $$ begin
  if (select count(*) from public.recipe_drafts) <> 0 then raise exception 'Non-admin must not view drafts'; end if;
  if (select count(*) from public.admin_audit_log) <> 0 then raise exception 'Non-admin must not view audit entries'; end if;
end $$;

reset role;
insert into public.recipe_drafts (
  id, proposed_title, slug, inspiration_label, source_name, source_url, description, category,
  temperature, needs_testing, status, tested, difficulty, prep_minutes, total_minutes, servings,
  cup_size, hero_image_url, hero_image_alt
) values (
  '11111111-1111-4111-8111-111111111111', 'Weekend Five Transaction Test', 'weekend-five-transaction-test',
  'Crema original', '', null, 'A complete transaction-test recipe.', 'Crema original', 'iced', false,
  'draft', true, 'Easy', 5, 5, 1, '12 oz', 'https://example.test/owned.webp', 'Iced test coffee'
);
insert into public.recipe_draft_ingredients(id,draft_id,ingredient_id,quantity,unit,position)
values ('21111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','espresso',2,'shot',1);
insert into public.recipe_draft_steps(id,draft_id,position,instruction,timer_seconds)
values ('31111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',1,'Pour over ice.',15);
insert into public.recipe_draft_step_ingredients values ('31111111-1111-4111-8111-111111111111','21111111-1111-4111-8111-111111111111');
insert into public.recipe_draft_equipment(draft_id,equipment_id,position) values ('11111111-1111-4111-8111-111111111111','espresso-machine',1);
insert into public.recipe_draft_tags values ('11111111-1111-4111-8111-111111111111','quick');
insert into public.recipe_draft_collections values ('11111111-1111-4111-8111-111111111111','crema-originals');

set local role service_role;
select public.transition_recipe_draft('11111111-1111-4111-8111-111111111111','tested',null);
select public.transition_recipe_draft('11111111-1111-4111-8111-111111111111','ready',null);
select public.publish_recipe_draft('11111111-1111-4111-8111-111111111111',null);

reset role;
do $$ begin
  if (select count(*) from public.recipes where id = '11111111-1111-4111-8111-111111111111' and published) <> 1 then raise exception 'Publish did not create exactly one public recipe'; end if;
  if (select count(*) from public.recipe_ingredients where recipe_id = '11111111-1111-4111-8111-111111111111') <> 1 then raise exception 'Ingredient relationship missing'; end if;
  if (select count(*) from public.recipe_steps where recipe_id = '11111111-1111-4111-8111-111111111111') <> 1 then raise exception 'Step relationship missing'; end if;
end $$;

set local role service_role;
update public.recipe_drafts set status='draft', description='Republished description' where id='11111111-1111-4111-8111-111111111111';
select public.transition_recipe_draft('11111111-1111-4111-8111-111111111111','tested',null);
select public.transition_recipe_draft('11111111-1111-4111-8111-111111111111','ready',null);
select public.publish_recipe_draft('11111111-1111-4111-8111-111111111111',null);
reset role;
do $$ begin
  if (select count(*) from public.recipes where id='11111111-1111-4111-8111-111111111111') <> 1 then raise exception 'Republish duplicated recipe'; end if;
  if (select description from public.recipes where id='11111111-1111-4111-8111-111111111111') <> 'Republished description' then raise exception 'Republish did not update public recipe'; end if;
end $$;

insert into public.recipe_drafts (
  id, proposed_title, slug, inspiration_label, source_name, description, category, temperature,
  needs_testing, status, tested, difficulty, prep_minutes, total_minutes, servings, cup_size,
  hero_image_url, hero_image_alt
) values (
  '12222222-2222-4222-8222-222222222222', 'Rollback Test', 'weekend-five-rollback-test', 'Crema original', '',
  'A complete recipe that will hit an injected relation failure.', 'Crema original', 'iced', false, 'ready', true,
  'Easy', 5, 5, 1, '12 oz', 'https://example.test/owned.webp', 'Rollback test coffee'
);
insert into public.recipe_draft_ingredients(id,draft_id,ingredient_id,quantity,unit,position)
values ('22222222-2222-4222-8222-222222222222','12222222-2222-4222-8222-222222222222','espresso',1,'shot',1);
insert into public.recipe_draft_steps(id,draft_id,position,instruction) values ('32222222-2222-4222-8222-222222222222','12222222-2222-4222-8222-222222222222',1,'Try to publish.');
insert into public.recipe_draft_equipment(draft_id,equipment_id,position) values ('12222222-2222-4222-8222-222222222222','espresso-machine',1);

create function public.test_reject_recipe_ingredient() returns trigger language plpgsql as $$
begin
  if new.recipe_id = '12222222-2222-4222-8222-222222222222' then raise exception 'Injected relation failure'; end if;
  return new;
end $$;
create trigger test_reject_recipe_ingredient before insert on public.recipe_ingredients for each row execute function public.test_reject_recipe_ingredient();

set local role service_role;
do $$ begin
  begin
    perform public.publish_recipe_draft('12222222-2222-4222-8222-222222222222',null);
    raise exception 'Expected injected publish failure';
  exception when others then
    if sqlerrm = 'Expected injected publish failure' then raise; end if;
  end;
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.recipes where id='12222222-2222-4222-8222-222222222222') then raise exception 'Failed publish left a partial public recipe'; end if;
  if (select status from public.recipe_drafts where id='12222222-2222-4222-8222-222222222222') <> 'ready' then raise exception 'Failed publish changed draft status'; end if;
end $$;

set local role service_role;
select public.unpublish_recipe_draft('11111111-1111-4111-8111-111111111111',null);
select public.save_recipe_draft(
  '11111111-1111-4111-8111-111111111111', 1,
  jsonb_build_object(
    'proposedTitle','Weekend Five Transaction Test','slug','weekend-five-transaction-test','description','Saved through the structured transaction.',
    'inspirationLabel','Crema original','sourceName','','sourceUrl','','category','Crema original','temperature','iced','difficulty','Easy',
    'prepMinutes',5,'totalMinutes',5,'servings',1,'cupSize','12 oz','featured',false,'placeholderApproved',false,
    'heroImageUrl','https://example.test/owned.webp','heroImagePath','test/owned.webp','heroImageAlt','Iced test coffee','heroImageMime','image/webp','heroImageBytes',1024,
    'flavorNotes',jsonb_build_array('strong'),'tagIds',jsonb_build_array('quick'),'collectionIds',jsonb_build_array('crema-originals'),
    'ingredients',jsonb_build_array(jsonb_build_object('id','21111111-1111-4111-8111-111111111111','ingredientId','espresso','displayName','','quantity',2,'unit','shot','preparationNote','','optional',false,'substitutionNotes','','position',1)),
    'steps',jsonb_build_array(jsonb_build_object('id','31111111-1111-4111-8111-111111111111','instruction','Pour over ice.','timerSeconds',15,'tip','','ingredientRowIds',jsonb_build_array('21111111-1111-4111-8111-111111111111'),'position',1)),
    'equipment',jsonb_build_array(jsonb_build_object('equipmentId','espresso-machine','optional',false,'alternativeNote','','position',1))
  ), null
);
select public.duplicate_recipe_draft('11111111-1111-4111-8111-111111111111',null);
reset role;
do $$ begin
  if (select published from public.recipes where id='11111111-1111-4111-8111-111111111111') then raise exception 'Unpublish did not hide recipe'; end if;
  if (select version from public.recipe_drafts where id='11111111-1111-4111-8111-111111111111') <> 2 then raise exception 'Structured save did not advance optimistic version'; end if;
  if (select count(*) from public.recipe_drafts where proposed_title='Weekend Five Transaction Test Copy' and status='draft' and not tested and published_recipe_id is null) <> 1 then raise exception 'Duplicate did not reset draft identity and lifecycle'; end if;
end $$;

select pass('recipe authoring transaction and authorization checks passed');
select * from finish();
rollback;
