\set ON_ERROR_STOP on

select plan(1);

do $$
begin
  if (select count(*) from public.coffee_sources) <> 6 then
    raise exception 'Expected six seeded coffee sources';
  end if;
  if (select count(*) from public.coffee_sources where enabled) <> 0 then
    raise exception 'Unverified sources must be disabled by default';
  end if;
  if exists (
    select 1
    from pg_class
    where oid in (
      'public.coffee_sources'::regclass,
      'public.menu_import_runs'::regclass,
      'public.discovered_drinks'::regclass,
      'public.recipe_drafts'::regclass
    )
      and not relrowsecurity
  ) then
    raise exception 'Every discovery table must have RLS enabled';
  end if;
  if has_table_privilege('anon', 'public.coffee_sources', 'select') then
    raise exception 'Anonymous clients must not have discovery table privileges';
  end if;
end;
$$;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","app_metadata":{}}',
  true
);
do $$
begin
  if (select count(*) from public.coffee_sources) <> 0 then
    raise exception 'Non-admin users must not see coffee sources';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","app_metadata":{"role":"admin"}}',
  true
);
do $$
begin
  if (select count(*) from public.coffee_sources) <> 6 then
    raise exception 'Admins must see all seeded coffee sources';
  end if;
end;
$$;
rollback;

select pass('coffee discovery security checks passed');
select * from finish();
