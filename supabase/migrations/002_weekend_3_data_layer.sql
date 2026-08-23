-- Weekend 3: normalized, read-only recipe catalog plus user-owned favorites and inventory.

alter table public.recipes alter column id drop default;
alter table public.recipes alter column id type text using id::text;

alter table public.recipes
  add column if not exists inspiration text not null default '',
  add column if not exists servings integer not null default 1,
  add column if not exists cup_size text not null default '12 oz',
  add column if not exists ingredient_search_text text not null default '',
  add column if not exists search_vector tsvector;

update public.recipes
set subtitle = coalesce(subtitle, ''),
    description = coalesce(description, ''),
    image_url = coalesce(image_url, '');

alter table public.recipes
  alter column subtitle set not null,
  alter column description set not null,
  alter column image_url set not null,
  add constraint recipes_minutes_positive check (minutes > 0),
  add constraint recipes_servings_positive check (servings > 0),
  add constraint recipes_difficulty_valid check (difficulty in ('Easy', 'Medium', 'Advanced')),
  add constraint recipes_temperature_valid check (temperature in ('Iced', 'Hot'));

create table public.ingredients (
  id text primary key,
  name text not null,
  category text,
  created_at timestamptz not null default now()
);

create table public.recipe_ingredients (
  recipe_id text not null references public.recipes(id) on delete cascade,
  ingredient_id text not null references public.ingredients(id) on delete restrict,
  position integer not null check (position > 0),
  quantity numeric not null check (quantity > 0),
  unit text not null,
  display_name text,
  note text,
  optional boolean not null default false,
  primary key (recipe_id, ingredient_id),
  unique (recipe_id, position)
);

create table public.recipe_steps (
  id bigint generated always as identity primary key,
  recipe_id text not null references public.recipes(id) on delete cascade,
  position integer not null check (position > 0),
  instruction text not null,
  timer_seconds integer check (timer_seconds is null or timer_seconds > 0),
  unique (recipe_id, position)
);

create table public.equipment (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.recipe_equipment (
  recipe_id text not null references public.recipes(id) on delete cascade,
  equipment_id text not null references public.equipment(id) on delete restrict,
  position integer not null check (position > 0),
  primary key (recipe_id, equipment_id),
  unique (recipe_id, position)
);

create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id text not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create table public.user_ingredient_inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  ingredient_id text not null references public.ingredients(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, ingredient_id)
);

create table public.user_equipment_inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  equipment_id text not null references public.equipment(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, equipment_id)
);

create index recipe_ingredients_ingredient_id_idx
  on public.recipe_ingredients (ingredient_id);
create index recipe_steps_recipe_id_idx on public.recipe_steps (recipe_id);
create index recipe_equipment_equipment_id_idx on public.recipe_equipment (equipment_id);
create index favorites_recipe_id_idx on public.favorites (recipe_id);
create index user_ingredient_inventory_ingredient_id_idx
  on public.user_ingredient_inventory (ingredient_id);
create index user_equipment_inventory_equipment_id_idx
  on public.user_equipment_inventory (equipment_id);
create index recipes_temperature_idx on public.recipes (temperature) where published;
create index recipes_tags_idx on public.recipes using gin (tags);
create index recipes_search_vector_idx on public.recipes using gin (search_vector);

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
    setweight(to_tsvector('pg_catalog.english', coalesce(new.ingredient_search_text, '')), 'A');
  return new;
end;
$$;

create trigger recipes_search_vector_update
before insert or update of name, description, inspiration, tags, ingredient_search_text
on public.recipes
for each row execute function public.set_recipe_search_vector();

update public.recipes set ingredient_search_text = ingredient_search_text;

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
    )
  order by
    case when p_filter = 'Surprise Me' then random() else 0 end desc,
    2 desc,
    r.name
  limit case when p_filter = 'Surprise Me' then 1 else 100 end;
$$;

alter table public.recipes enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;
alter table public.equipment enable row level security;
alter table public.recipe_equipment enable row level security;
alter table public.favorites enable row level security;
alter table public.user_ingredient_inventory enable row level security;
alter table public.user_equipment_inventory enable row level security;

drop policy if exists "Published recipes are public" on public.recipes;
create policy "Published recipes are public"
on public.recipes for select to anon, authenticated using (published);

create policy "Ingredients are public read only"
on public.ingredients for select to anon, authenticated using (true);
create policy "Equipment is public read only"
on public.equipment for select to anon, authenticated using (true);
create policy "Published recipe ingredients are public"
on public.recipe_ingredients for select to anon, authenticated
using (exists (select 1 from public.recipes r where r.id = recipe_id and r.published));
create policy "Published recipe steps are public"
on public.recipe_steps for select to anon, authenticated
using (exists (select 1 from public.recipes r where r.id = recipe_id and r.published));
create policy "Published recipe equipment is public"
on public.recipe_equipment for select to anon, authenticated
using (exists (select 1 from public.recipes r where r.id = recipe_id and r.published));

create policy "Users read their favorites"
on public.favorites for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Users add their favorites"
on public.favorites for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Users remove their favorites"
on public.favorites for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Users read their ingredient inventory"
on public.user_ingredient_inventory for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Users add their ingredient inventory"
on public.user_ingredient_inventory for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Users remove their ingredient inventory"
on public.user_ingredient_inventory for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Users read their equipment inventory"
on public.user_equipment_inventory for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Users add their equipment inventory"
on public.user_equipment_inventory for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Users remove their equipment inventory"
on public.user_equipment_inventory for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.recipes, public.ingredients, public.recipe_ingredients,
  public.recipe_steps, public.equipment, public.recipe_equipment,
  public.favorites, public.user_ingredient_inventory, public.user_equipment_inventory
from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on table public.recipes, public.ingredients, public.recipe_ingredients,
  public.recipe_steps, public.equipment, public.recipe_equipment to anon, authenticated;
grant select, insert, delete on table public.favorites,
  public.user_ingredient_inventory, public.user_equipment_inventory to authenticated;
revoke all on function public.search_recipes(text, text) from public;
grant execute on function public.search_recipes(text, text) to anon, authenticated;
