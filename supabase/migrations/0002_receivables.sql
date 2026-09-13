-- Desacopla lo que se paga en la tarjeta de lo que se le cobra a una persona.
-- Antes una compra en cuotas generaba el mismo cronograma para ambos lados;
-- ahora son series independientes (caso "pago 1 cuota, cobro 3", o "me
-- cancelan antes pero yo sigo pagando mi plan").

create table if not exists receivables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  card_id uuid references cards(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  source_transaction_id uuid references transactions(id) on delete set null,
  description text not null,
  installment_amount numeric(12,2) not null,
  total_installments int not null check (total_installments > 0),
  start_month date not null,
  status text not null default 'active' check (status in ('active','settled')),
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists receivable_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  receivable_id uuid not null references receivables(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  description text not null,
  amount numeric(12,2) not null,
  due_month date not null,
  installment_number int not null,
  installment_total int not null,
  status text not null default 'pending' check (status in ('pending','collected')),
  collected_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists receivable_charges_receivable_idx on receivable_charges (receivable_id);
create index if not exists receivable_charges_person_idx on receivable_charges (person_id, status);

alter table transactions drop column if exists is_settled;

alter table cards add column if not exists statement_format text
  check (statement_format in ('bna_bancor','bbva','naranja'));

alter table receivables enable row level security;
alter table receivable_charges enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array['receivables','receivable_charges'])
  loop
    execute format('drop policy if exists "owner_all" on %I', t);
    execute format(
      'create policy "owner_all" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t
    );
  end loop;
end $$;
