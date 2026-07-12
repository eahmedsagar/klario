-- Klario schema (run in Supabase SQL editor)
-- All PKs are client-generated text ids so offline-first sync is trivial.

create table if not exists members (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  dob timestamptz,
  sex text,
  relation text,
  is_self boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reports (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  member_id text not null references members(id) on delete cascade,
  clinic text, panel text,
  date_iso timestamptz,
  file_name text,
  pdf_path text,               -- storage path; blob never stored in the table
  values_count int default 0,
  updated_at timestamptz not null default now()
);

create table if not exists readings (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  member_id text not null references members(id) on delete cascade,
  report_id text references reports(id) on delete cascade,
  marker text not null,
  value double precision not null,
  ref_lo double precision, ref_hi double precision, ref_text text,
  lab text, clinic text,
  date_iso timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists readings_member_marker on readings(member_id, marker, date_iso);

create table if not exists notes (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  member_id text not null references members(id) on delete cascade,
  text text not null,
  date_iso timestamptz,
  source text, sys_tag text, auto_meta text,
  updated_at timestamptz not null default now()
);

create table if not exists reminders (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  member_id text not null references members(id) on delete cascade,
  title text not null,
  source text, due text,
  updated_at timestamptz not null default now()
);

-- storage bucket for original PDFs
insert into storage.buckets (id, name, public) values ('reports','reports',false)
on conflict (id) do nothing;
