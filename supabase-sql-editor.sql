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

create table if not exists public.book_orders (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique,
  order_token uuid not null default gen_random_uuid(),
  book_slug text not null,
  book_title text not null,
  book_author text not null,
  book_price integer not null default 0 check (book_price >= 0),
  price_label text not null default '',
  customer_name text not null,
  shipping_address text not null,
  city text not null default '',
  postal_code text not null default '',
  province text not null default '',
  shipping_destination_city text not null default '',
  shipping_cost integer not null default 0 check (shipping_cost >= 0),
  total_amount integer not null default 0 check (total_amount >= 0),
  phone text not null,
  email text not null,
  transfer_proof_url text not null default '',
  status text not null default 'unpaid' check (
    status in ('unpaid', 'packed', 'shipped', 'completed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.book_orders
  add column if not exists city text not null default '',
  add column if not exists postal_code text not null default '',
  add column if not exists province text not null default '',
  add column if not exists shipping_destination_city text not null default '',
  add column if not exists shipping_cost integer not null default 0,
  add column if not exists total_amount integer not null default 0;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'book_orders_status_check'
      and conrelid = 'public.book_orders'::regclass
  ) then
    alter table public.book_orders drop constraint book_orders_status_check;
  end if;
end;
$$;

update public.book_orders
set status = case
  when status in ('waiting_payment', 'proof_uploaded') then 'unpaid'
  when status in ('paid', 'processing') then 'packed'
  when status = 'shipped' then 'shipped'
  when status = 'completed' then 'completed'
  else 'unpaid'
end
where status not in ('unpaid', 'packed', 'shipped', 'completed');

alter table public.book_orders
  alter column status set default 'unpaid',
  add constraint book_orders_status_check check (status in ('unpaid', 'packed', 'shipped', 'completed'));

create index if not exists book_orders_created_at_idx
  on public.book_orders (created_at desc);

create index if not exists book_orders_invoice_no_idx
  on public.book_orders (invoice_no);

drop trigger if exists book_orders_set_updated_at on public.book_orders;
create trigger book_orders_set_updated_at
before update on public.book_orders
for each row
execute function public.set_updated_at();

alter table public.book_orders enable row level security;

drop policy if exists "Anyone can create book orders" on public.book_orders;
create policy "Anyone can create book orders"
on public.book_orders
for insert
with check (true);

drop policy if exists "Authenticated users can read book orders" on public.book_orders;
create policy "Authenticated users can read book orders"
on public.book_orders
for select
using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update book orders" on public.book_orders;
create policy "Authenticated users can update book orders"
on public.book_orders
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create or replace function public.attach_order_transfer_proof(
  p_invoice_no text,
  p_order_token uuid,
  p_transfer_proof_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(p_transfer_proof_url), '') is null then
    raise exception 'Transfer proof URL is required';
  end if;

  update public.book_orders
  set
    transfer_proof_url = p_transfer_proof_url,
    updated_at = now()
  where invoice_no = p_invoice_no
    and order_token = p_order_token;

  if not found then
    raise exception 'Order not found';
  end if;
end;
$$;

grant execute on function public.attach_order_transfer_proof(text, uuid, text) to anon, authenticated;

create or replace function public.check_book_order_invoice(p_invoice_no text)
returns table (
  invoice_no text,
  book_title text,
  book_author text,
  book_price integer,
  price_label text,
  shipping_cost integer,
  total_amount integer,
  city text,
  province text,
  status text,
  transfer_proof_uploaded boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    o.invoice_no,
    o.book_title,
    o.book_author,
    o.book_price,
    o.price_label,
    o.shipping_cost,
    o.total_amount,
    o.city,
    o.province,
    o.status,
    o.transfer_proof_url <> '' as transfer_proof_uploaded,
    o.created_at,
    o.updated_at
  from public.book_orders o
  where o.invoice_no = trim(p_invoice_no)
  limit 1;
$$;

grant execute on function public.check_book_order_invoice(text) to anon, authenticated;

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'transfer-proofs',
  'transfer-proofs',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read transfer proofs" on storage.objects;
create policy "Public can read transfer proofs"
on storage.objects
for select
using (bucket_id = 'transfer-proofs');

drop policy if exists "Anyone can upload transfer proofs" on storage.objects;
create policy "Anyone can upload transfer proofs"
on storage.objects
for insert
with check (bucket_id = 'transfer-proofs');
