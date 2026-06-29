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
  parent_id uuid references public.messages(id) on delete cascade,
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
create table if not exists public.message_images (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  url text not null,
  sort_order integer not null default 0 check (sort_order between 0 and 5),
  created_at timestamptz not null default now()
);

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  visitor_id text not null,
  type text not null check (type in ('like', 'heart')),
  created_at timestamptz not null default now(),
  unique (message_id, visitor_id, type)
);

alter table public.messages
  add column if not exists parent_id uuid references public.messages(id) on delete cascade;

create index if not exists message_images_message_id_sort_idx
  on public.message_images (message_id, sort_order);

create index if not exists messages_parent_id_idx
  on public.messages (parent_id);

create index if not exists message_reactions_message_id_type_idx
  on public.message_reactions (message_id, type);

create index if not exists message_reactions_visitor_id_idx
  on public.message_reactions (visitor_id);

alter table public.stations enable row level security;
alter table public.messages enable row level security;
alter table public.message_images enable row level security;
alter table public.message_reactions enable row level security;

drop policy if exists "Public station read" on public.stations;
create policy "Public station read" on public.stations for select using (true);

drop policy if exists "Public published message read" on public.messages;
create policy "Public published message read" on public.messages for select using (status = 'published');

drop policy if exists "Public pending message insert" on public.messages;
create policy "Public pending message insert" on public.messages for insert with check (status = 'pending' and official = false);


drop policy if exists "Public published message image read" on public.message_images;
create policy "Public published message image read" on public.message_images for select using (
  exists (
    select 1 from public.messages
    where messages.id = message_images.message_id
      and messages.status = 'published'
  )
);

drop policy if exists "Public published message reaction read" on public.message_reactions;
create policy "Public published message reaction read" on public.message_reactions for select using (
  exists (
    select 1 from public.messages
    where messages.id = message_reactions.message_id
      and messages.status = 'published'
  )
);
