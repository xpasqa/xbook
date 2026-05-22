-- Copy-paste this into Supabase SQL Editor.
-- This is a one-time setup, not a migration folder.

create extension if not exists pgcrypto;

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  author text not null,
  category text not null default 'Umum',
  price integer not null default 0 check (price >= 0),
  isbn text not null default 'Dalam Proses Pengajuan',
  short_description text not null default '',
  synopsis text not null,
  keywords text[] not null default '{}',
  cover_url text not null,
  cover_alt text not null default '',
  gallery_urls text[] not null default '{}',
  buy_url text not null default '',
  google_books_url text not null default '',
  published boolean not null default false,
  sort_order integer not null default 999,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint books_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

alter table public.books
  add column if not exists google_books_url text not null default '';

create index if not exists books_published_sort_idx
  on public.books (sort_order, created_at desc)
  where published = true;

create index if not exists books_created_by_idx
  on public.books (created_by);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists books_set_updated_at on public.books;
create trigger books_set_updated_at
before update on public.books
for each row
execute function public.set_updated_at();

alter table public.books enable row level security;

drop policy if exists "Published books are readable" on public.books;
create policy "Published books are readable"
on public.books
for select
using (published = true or created_by = auth.uid());

drop policy if exists "Authenticated users can add books" on public.books;
create policy "Authenticated users can add books"
on public.books
for insert
with check (auth.uid() is not null and created_by = auth.uid());

drop policy if exists "Users can update their books" on public.books;
create policy "Users can update their books"
on public.books
for update
using (created_by = auth.uid())
with check (created_by = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'book-covers',
  'book-covers',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read book covers" on storage.objects;
create policy "Public can read book covers"
on storage.objects
for select
using (bucket_id = 'book-covers');

drop policy if exists "Authenticated users can upload book covers" on storage.objects;
create policy "Authenticated users can upload book covers"
on storage.objects
for insert
with check (bucket_id = 'book-covers' and auth.role() = 'authenticated');
