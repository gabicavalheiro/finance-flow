-- =============================================
-- Execute este SQL no editor do Supabase
-- Database → SQL Editor → New Query → Run
-- =============================================

-- Cards
create table if not exists cards (
  id text primary key,
  user_id uuid references auth.users not null,
  name text not null,
  brand text not null default 'visa',
  last_digits text not null default '••••',
  "limit" numeric not null default 0,
  closing_day integer not null default 10,
  custom_gradient text,
  created_at timestamptz default now()
);

-- Expenses (compras parceladas no cartão)
create table if not exists expenses (
  id text primary key,
  user_id uuid references auth.users not null,
  card_id text references cards(id) on delete cascade,
  name text not null,
  total_amount numeric not null,
  installments integer not null default 1,
  category text not null default 'other',
  date text not null,
  created_at timestamptz default now()
);

-- Fixed expenses (gastos fixos mensais)
create table if not exists fixed_expenses (
  id text primary key,
  user_id uuid references auth.users not null,
  name text not null,
  amount numeric not null,
  category text not null default 'subscription',
  paid_months text[] not null default '{}',
  created_at timestamptz default now()
);

-- Fixed incomes (ganhos fixos mensais)
create table if not exists fixed_incomes (
  id text primary key,
  user_id uuid references auth.users not null,
  name text not null,
  amount numeric not null,
  category text not null default 'salary',
  receive_day integer,
  received_months text[] not null default '{}',
  created_at timestamptz default now()
);

-- Variable transactions (lançamentos variáveis)
create table if not exists variable_transactions (
  id text primary key,
  user_id uuid references auth.users not null,
  name text not null,
  amount numeric not null,
  type text not null,
  payment_method text not null default 'pix',
  category text not null default 'other',
  date text not null,
  created_at timestamptz default now()
);

-- =============================================
-- Row Level Security — cada usuário vê só seus dados
-- =============================================
alter table cards enable row level security;
alter table expenses enable row level security;
alter table fixed_expenses enable row level security;
alter table fixed_incomes enable row level security;
alter table variable_transactions enable row level security;

create policy "users_cards"
  on cards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users_expenses"
  on expenses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users_fixed_expenses"
  on fixed_expenses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users_fixed_incomes"
  on fixed_incomes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users_variable_transactions"
  on variable_transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
