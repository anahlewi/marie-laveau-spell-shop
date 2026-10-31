-- Run once in the Supabase SQL Editor.
create table if not exists public.spells (
  id          bigint generated always as identity primary key,
  order_no    text        not null,
  type        text        not null,
  custom_name text,
  target      text        not null,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists spells_created_at_idx on public.spells (created_at desc);

-- Row Level Security on with no policies: the public API can't read or write this table.
-- The app uses the secret key on the server, which bypasses RLS.
alter table public.spells enable row level security;
