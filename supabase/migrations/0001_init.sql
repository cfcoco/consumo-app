-- Esquema inicial de Consumo App
-- Reemplaza las tablas manuales del Excel (por tarjeta + otros gastos + ingresos + historico)
-- por un modelo relacional único filtrable por fecha.

create extension if not exists "pgcrypto";

-- Tarjetas (BNA+, Bancor, BBVA, Naranja X, etc)
create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  bank text,
  closing_day int,
  due_day int,
  color text,
  created_at timestamptz not null default now()
);

-- Familiares / personas a quienes se les presta la tarjeta o se comparte un gasto
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- Una serie de cuotas (ej "Notebook 6/18"). De acá se proyectan
-- automáticamente las transacciones de los meses futuros.
create table if not exists installment_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id uuid references cards(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  person_id uuid references people(id) on delete set null,
  description text not null,
  owner_type text not null default 'mine' check (owner_type in ('mine','shared','person')),
  installment_amount numeric(12,2) not null,
  total_installments int not null check (total_installments > 0),
  start_month date not null,
  created_at timestamptz not null default now()
);

-- Cada gasto individual: tarjeta o "otro gasto" (card_id null),
-- manual o generado por una serie de cuotas / importación de resumen.
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id uuid references cards(id) on delete set null,
  series_id uuid references installment_series(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  person_id uuid references people(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null,
  currency text not null default 'ARS',
  transaction_date date not null,
  statement_month date not null,
  installment_number int,
  installment_total int,
  owner_type text not null default 'mine' check (owner_type in ('mine','shared','person')),
  status text not null default 'confirmed' check (status in ('projected','confirmed')),
  source text not null default 'manual' check (source in ('manual','import')),
  is_settled boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_month_idx on transactions (user_id, statement_month);
create index if not exists transactions_series_idx on transactions (series_id);

create table if not exists incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  description text not null,
  amount numeric(12,2) not null,
  income_date date not null,
  income_type text,
  person_id uuid references people(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(12,2),
  monthly_amount numeric(12,2),
  created_at timestamptz not null default now()
);

create table if not exists alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  rule_type text not null check (rule_type in ('category_limit','card_limit','total_limit','card_closing_reminder','installment_ending')),
  category_id uuid references categories(id) on delete cascade,
  card_id uuid references cards(id) on delete cascade,
  threshold numeric(12,2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Auditoría de cada resumen de tarjeta subido para importar
create table if not exists statement_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id uuid references cards(id) on delete set null,
  statement_month date not null,
  file_path text,
  parsed_result jsonb,
  status text not null default 'pending_review' check (status in ('pending_review','applied','discarded')),
  created_at timestamptz not null default now()
);

-- Row Level Security: cada usuario solo ve sus propios datos.
alter table cards enable row level security;
alter table people enable row level security;
alter table categories enable row level security;
alter table installment_series enable row level security;
alter table transactions enable row level security;
alter table incomes enable row level security;
alter table savings_goals enable row level security;
alter table alert_rules enable row level security;
alter table statement_imports enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'cards','people','categories','installment_series','transactions',
    'incomes','savings_goals','alert_rules','statement_imports'
  ])
  loop
    execute format('drop policy if exists "owner_all" on %I', t);
    execute format(
      'create policy "owner_all" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t
    );
  end loop;
end $$;
