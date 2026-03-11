-- SQL de Supabase para la aplicación de organización de gastos
-- Ejecuta este script en la sección SQL de tu proyecto en Supabase
-- para crear las tablas necesarias. Utiliza el panel de SQL editor
-- disponible en la interfaz web de Supabase.

-- Tabla de usuarios
create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  username text not null unique,
  password_hash text not null unique,
  created_at timestamp with time zone default now()
);

-- Tabla de categorías asociadas a cada usuario
create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  name text not null,
  created_at timestamp with time zone default now(),
  unique (user_id, name)
);

-- Tabla de amigos asociados a cada usuario
create table if not exists public.friends (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  name text not null,
  created_at timestamp with time zone default now(),
  unique (user_id, name)
);

-- Tabla de gastos
create table if not exists public.expenses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  date_time timestamp with time zone not null,
  total_amount numeric not null check (total_amount >= 0),
  created_at timestamp with time zone default now()
);

-- Tabla de gastos compartidos
create table if not exists public.shared_expenses (
  id uuid primary key default uuid_generate_v4(),
  expense_id uuid references public.expenses(id) on delete cascade,
  friend_id uuid references public.friends(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  paid boolean not null default false,
  created_at timestamp with time zone default now()
);

-- Vistas de ayuda: calcular el total neto por gasto
create or replace view public.expenses_with_real_amount as
select
  e.id,
  e.user_id,
  e.category_id,
  e.date_time,
  e.total_amount,
  coalesce(sum(case when se.paid then se.amount else 0 end), 0) as paid_shared_amount,
  (e.total_amount - coalesce(sum(case when se.paid then se.amount else 0 end), 0))::numeric as real_amount
from public.expenses e
left join public.shared_expenses se on se.expense_id = e.id
group by e.id;

-- Índices para acelerar las consultas
create index if not exists expenses_user_id_idx on public.expenses(user_id);
create index if not exists shared_expenses_paid_idx on public.shared_expenses(paid);