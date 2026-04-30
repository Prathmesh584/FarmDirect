-- ============================================================
-- FarmDirect — PostgreSQL Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================
create type user_role as enum ('farmer', 'consumer');
create type order_status as enum (
  'pending_payment',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'confirmed_delivery',
  'completed',
  'cancelled',
  'refunded'
);
create type product_category as enum (
  'vegetables',
  'fruits',
  'grains',
  'dairy',
  'spices',
  'pulses',
  'other'
);

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          user_role    not null default 'consumer',
  full_name     text         not null,
  phone         text,
  avatar_url    text,
  address       text,
  city          text         default 'Bhopal',
  state         text         default 'Madhya Pradesh',
  pincode       text,
  bio           text,                          -- For farmers: farm description
  farm_name     text,                          -- For farmers only
  is_verified   boolean      not null default false,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);

-- ============================================================
-- PRODUCTS
-- ============================================================
create table public.products (
  id              uuid         primary key default uuid_generate_v4(),
  farmer_id       uuid         not null references public.profiles(id) on delete cascade,
  name            text         not null,
  description     text,
  category        product_category not null,
  price_per_unit  numeric(10,2) not null check (price_per_unit > 0),
  unit            text         not null default 'kg',   -- kg, dozen, litre, piece
  stock_quantity  integer      not null default 0 check (stock_quantity >= 0),
  min_order_qty   integer      not null default 1,
  images          text[]       not null default '{}',   -- Array of Storage URLs
  is_organic      boolean      not null default false,
  is_available    boolean      not null default true,
  harvest_date    date,
  tags            text[]       default '{}',
  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now()
);

-- Full-text search index
create index products_search_idx on public.products
  using gin(to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,'')));
create index products_farmer_idx on public.products(farmer_id);
create index products_category_idx on public.products(category);

-- ============================================================
-- ORDERS
-- ============================================================
create table public.orders (
  id                  uuid         primary key default uuid_generate_v4(),
  consumer_id         uuid         not null references public.profiles(id) on delete restrict,
  status              order_status not null default 'pending_payment',
  total_amount        numeric(12,2) not null check (total_amount >= 0),
  delivery_address    text         not null,
  delivery_city       text         not null default 'Bhopal',
  delivery_pincode    text,
  notes               text,
  -- Escrow fields
  payment_reference   text,                    -- e.g. Razorpay / UPI ref
  escrow_released_at  timestamptz,             -- When funds released to farmer
  delivered_at        timestamptz,             -- Consumer confirmation timestamp
  created_at          timestamptz  not null default now(),
  updated_at          timestamptz  not null default now()
);

create index orders_consumer_idx on public.orders(consumer_id);
create index orders_status_idx on public.orders(status);

-- ============================================================
-- ORDER ITEMS (join table: orders ↔ products)
-- ============================================================
create table public.order_items (
  id              uuid         primary key default uuid_generate_v4(),
  order_id        uuid         not null references public.orders(id) on delete cascade,
  product_id      uuid         not null references public.products(id) on delete restrict,
  farmer_id       uuid         not null references public.profiles(id),
  quantity        integer      not null check (quantity > 0),
  unit_price      numeric(10,2) not null,      -- Locked at time of purchase
  subtotal        numeric(12,2) generated always as (quantity * unit_price) stored,
  created_at      timestamptz  not null default now()
);

create index order_items_order_idx on public.order_items(order_id);
create index order_items_farmer_idx on public.order_items(farmer_id);

-- ============================================================
-- REVIEWS
-- ============================================================
create table public.reviews (
  id              uuid         primary key default uuid_generate_v4(),
  product_id      uuid         not null references public.products(id) on delete cascade,
  consumer_id     uuid         not null references public.profiles(id) on delete cascade,
  order_id        uuid         not null references public.orders(id) on delete cascade,
  rating          smallint     not null check (rating between 1 and 5),
  comment         text,
  created_at      timestamptz  not null default now(),
  unique(product_id, consumer_id, order_id)    -- One review per purchase
);

create index reviews_product_idx on public.reviews(product_id);

-- ============================================================
-- CART (persisted, not just local storage)
-- ============================================================
create table public.cart_items (
  id          uuid     primary key default uuid_generate_v4(),
  consumer_id uuid     not null references public.profiles(id) on delete cascade,
  product_id  uuid     not null references public.products(id) on delete cascade,
  quantity    integer  not null default 1 check (quantity > 0),
  created_at  timestamptz not null default now(),
  unique(consumer_id, product_id)
);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile row when user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    coalesce(new.raw_user_meta_data->>'role', 'consumer')::user_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Update updated_at automatically
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_products_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger set_orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger set_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Decrement stock when order is placed (atomic)
create or replace function public.decrement_stock(p_product_id uuid, p_quantity integer)
returns void language plpgsql security definer as $$
begin
  update public.products
  set stock_quantity = stock_quantity - p_quantity
  where id = p_product_id
    and stock_quantity >= p_quantity;

  if not found then
    raise exception 'Insufficient stock for product %', p_product_id;
  end if;
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles    enable row level security;
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
alter table public.reviews     enable row level security;
alter table public.cart_items  enable row level security;

-- PROFILES policies
create policy "Public profiles are viewable" on public.profiles
  for select using (true);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- PRODUCTS policies
create policy "Products are publicly viewable" on public.products
  for select using (is_available = true or farmer_id = auth.uid());
create policy "Farmers can insert own products" on public.products
  for insert with check (
    auth.uid() = farmer_id
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'farmer')
  );
create policy "Farmers can update own products" on public.products
  for update using (auth.uid() = farmer_id);
create policy "Farmers can delete own products" on public.products
  for delete using (auth.uid() = farmer_id);

-- ORDERS policies
create policy "Consumers see own orders" on public.orders
  for select using (auth.uid() = consumer_id);
create policy "Farmers see orders with their items" on public.orders
  for select using (
    exists (
      select 1 from public.order_items
      where order_id = orders.id and farmer_id = auth.uid()
    )
  );
create policy "Consumers can create orders" on public.orders
  for insert with check (auth.uid() = consumer_id);
create policy "Consumers can update own orders (delivery confirm)" on public.orders
  for update using (auth.uid() = consumer_id);

-- ORDER_ITEMS policies
create policy "Viewable by consumer or farmer" on public.order_items
  for select using (
    auth.uid() = farmer_id
    or exists (select 1 from public.orders where id = order_id and consumer_id = auth.uid())
  );
create policy "Insertable on order creation" on public.order_items
  for insert with check (
    exists (select 1 from public.orders where id = order_id and consumer_id = auth.uid())
  );

-- REVIEWS policies
create policy "Reviews are public" on public.reviews for select using (true);
create policy "Consumers can add reviews for purchased items" on public.reviews
  for insert with check (
    auth.uid() = consumer_id
    and exists (select 1 from public.orders where id = order_id and consumer_id = auth.uid() and status = 'completed')
  );

-- CART policies
create policy "Consumers manage own cart" on public.cart_items
  for all using (auth.uid() = consumer_id);

-- ============================================================
-- REALTIME — enable for inventory & orders
-- ============================================================
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.orders;

-- ============================================================
-- SEED DATA (optional, for local dev)
-- ============================================================
-- Insert via the app's sign-up flow. Schema is self-sufficient.
