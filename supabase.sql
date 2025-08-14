-- Run in Supabase SQL editor

create table if not exists public.landlords (
  id uuid primary key,
  name text not null,
  address text,
  signature_url text,
  created_at timestamp with time zone default now()
);

create table if not exists public.bills (
  id uuid primary key,
  bill_number text not null,
  bill_mode text not null check (bill_mode in ('auto','manual','random')),
  date date not null,
  period text not null,
  landlord_id uuid not null references public.landlords(id) on delete cascade,
  agreement_date date not null,
  amount numeric not null,
  signature_url text,
  created_at timestamp with time zone default now()
);

-- Storage bucket named `public` with public access is expected for signature uploads.

