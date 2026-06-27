create extension if not exists pgcrypto;

create table if not exists public.stations (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  city_name text not null,
  province_name text not null,
  province_adcode integer,
  venue text not null default '待定',
  date text not null default '待定',
  x numeric not null default 50,
  y numeric not null default 50,
  status text not null default 'upcoming' check (status in ('upcoming', 'live', 'done')),
  palette text not null default 'hot' check (palette in ('hot', 'cool', 'gold', 'violet', 'green', 'warn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  station_id uuid references public.stations(id) on delete set null,
  author text not null,
  avatar integer not null default 1,
  official boolean not null default false,
  body text not null,
  mood text not null,
  rating integer not null default 3 check (rating between 0 and 5),
  city_tag text not null default '',
  image text,
  status text not null default 'pending' check (status in ('published', 'pending', 'hidden')),
  created_at timestamptz not null default now()
);

alter table public.stations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Public station read" on public.stations;
create policy "Public station read" on public.stations for select using (true);

drop policy if exists "Public published message read" on public.messages;
create policy "Public published message read" on public.messages for select using (status = 'published');

drop policy if exists "Public pending message insert" on public.messages;
create policy "Public pending message insert" on public.messages for insert with check (status = 'pending' and official = false);

