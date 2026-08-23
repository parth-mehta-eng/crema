create extension if not exists "pgcrypto";

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  subtitle text,
  description text,
  image_url text,
  minutes integer not null default 5,
  difficulty text not null default 'Easy',
  temperature text not null default 'Iced',
  tags text[] not null default '{}',
  published boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.recipes enable row level security;
create policy "Published recipes are public" on public.recipes for select using (published = true);
