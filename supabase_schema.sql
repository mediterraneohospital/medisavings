-- MediSavings - Cost Savings Tracker
-- Run this in Supabase SQL Editor

create table if not exists material_changes (
  id uuid primary key default gen_random_uuid(),

  -- Παλιό υλικό
  old_code text not null,
  old_description text not null,
  old_supplier text,
  old_price numeric(10,4),

  -- Νέο υλικό
  new_code text not null,
  new_description text,
  new_supplier text,
  new_price numeric(10,4),

  -- Σύγκριση τιμών
  price_diff numeric(10,4),
  price_reduction_pct numeric(8,6),

  -- Αγορές
  purchases_2024 numeric(12,2),
  purchases_2025_old numeric(12,2),
  purchases_2025_new numeric(12,2),
  purchases_2026_h1 numeric(12,2),

  -- Κατανάλωση
  consumption_2024 numeric(12,2),
  consumption_2025 numeric(12,2),
  consumption_2026 numeric(12,2),

  -- Κόστη & εξοικονόμηση
  cost_old_price_2025 numeric(12,2),
  cost_new_price_2025 numeric(12,2),
  annual_saving_2025 numeric(12,2),
  saving_from_purchases numeric(12,2),

  -- Metadata
  category text,
  notes text,
  status text default 'active' check (status in ('active','discontinued','pending')),
  change_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table material_changes enable row level security;

-- Allow all for authenticated users (adjust as needed)
create policy "Allow all for authenticated"
  on material_changes
  for all
  to authenticated
  using (true)
  with check (true);

-- Allow anonymous read (for GitHub Pages without login)
create policy "Allow anon read"
  on material_changes
  for select
  to anon
  using (true);

-- Allow anon insert/update/delete (if no auth needed)
create policy "Allow anon write"
  on material_changes
  for all
  to anon
  using (true)
  with check (true);

-- Index for common queries
create index if not exists idx_material_changes_status on material_changes(status);
create index if not exists idx_material_changes_category on material_changes(category);
create index if not exists idx_material_changes_old_supplier on material_changes(old_supplier);
