-- Power Poly Supplies
-- Supabase foundation migration for account, ordering, rewards, and ops data.
--
-- Safe to run more than once:
-- - creates missing tables
-- - adds missing columns
-- - adds indexes and basic constraints
--
-- This migration prepares the database for features already present in the UI.
-- A few frontend/backend flows still need code changes to start writing to these tables.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Core table hardening

alter table if exists public.users
  add column if not exists updated_at timestamptz not null default timezone('utc', now()),
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table if exists public.products
  add column if not exists updated_at timestamptz not null default timezone('utc', now()),
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table if exists public.orders
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table if exists public.deliveries
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table if exists public.reviews
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table if exists public.feedback
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table if exists public.messages
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table if exists public.help_requests
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table if exists public.verification_codes
  add column if not exists updated_at timestamptz not null default timezone('utc', now()),
  add column if not exists created_at timestamptz not null default timezone('utc', now());

create table if not exists public.payment_methods (
  id text primary key,
  customer_email text not null,
  square_customer_id text,
  brand text,
  last4 text,
  exp_month integer,
  exp_year integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payment_methods_last4_len check (last4 is null or char_length(last4) <= 4)
);

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null,
  label text not null,
  name text not null,
  line1 text not null,
  line2 text,
  city text not null,
  province text not null,
  postal text not null,
  country text not null default 'Canada',
  phone text,
  is_default boolean not null default false,
  delivery_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.favorites (
  customer_email text not null,
  product_id text not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (customer_email, product_id)
);

create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.wishlist_items (
  wishlist_id uuid not null,
  product_id text not null,
  price_alert_enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (wishlist_id, product_id)
);

create table if not exists public.order_templates (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.order_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null,
  product_id text not null,
  qty integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  constraint order_template_items_qty_positive check (qty > 0),
  constraint order_template_items_unique_item unique (template_id, product_id)
);

create table if not exists public.notification_preferences (
  customer_email text primary key,
  order_updates boolean not null default true,
  back_in_stock boolean not null default true,
  member_deals boolean not null default true,
  low_stock boolean not null default true,
  price_drops boolean not null default true,
  browser_notifications boolean not null default false,
  low_stock_threshold integer not null default 20,
  price_drop_percent integer not null default 5,
  watched_product_ids text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint notification_preferences_low_stock_threshold check (low_stock_threshold >= 0),
  constraint notification_preferences_price_drop_percent check (price_drop_percent between 0 and 90)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null,
  type text not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.rewards_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null,
  kind text not null,
  points integer not null,
  code text,
  title text,
  money_value_cents integer,
  source text,
  meta jsonb not null default '{}'::jsonb,
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint rewards_ledger_kind check (kind in ('earn', 'redeem', 'adjustment', 'reward_code')),
  constraint rewards_ledger_money_nonnegative check (money_value_cents is null or money_value_cents >= 0)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  order_id text,
  movement_type text not null,
  quantity_delta integer not null,
  stock_before integer,
  stock_after integer,
  reason text,
  created_by text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint inventory_movements_type check (movement_type in ('sale', 'restock', 'manual_adjustment', 'refund', 'correction'))
);

create table if not exists public.account_activity (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null,
  activity_type text not null,
  label text not null,
  ip text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

-- Order line table alignment

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text not null,
  product_id text not null,
  product_name text,
  qty integer not null default 1,
  unit_price_cents integer not null default 0,
  currency text not null default 'CAD',
  item_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint order_items_qty_positive check (qty > 0)
);

alter table if exists public.order_items
  add column if not exists product_id text,
  add column if not exists product_name text,
  add column if not exists qty integer not null default 1,
  add column if not exists unit_price_cents integer not null default 0,
  add column if not exists currency text not null default 'CAD',
  add column if not exists item_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default timezone('utc', now()),
  add column if not exists created_at timestamptz not null default timezone('utc', now());

-- Foreign keys where current code/data model is stable enough

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'orders'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'deliveries'
  ) then
    alter table public.deliveries
      drop constraint if exists deliveries_order_id_fkey;
    alter table public.deliveries
      add constraint deliveries_order_id_fkey
      foreign key (order_id) references public.orders(id) on delete cascade;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'orders'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'order_items'
  ) then
    alter table public.order_items
      drop constraint if exists order_items_order_id_fkey;
    alter table public.order_items
      add constraint order_items_order_id_fkey
      foreign key (order_id) references public.orders(id) on delete cascade;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'products'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'reviews'
  ) then
    alter table public.reviews
      drop constraint if exists reviews_product_id_fkey;
    alter table public.reviews
      add constraint reviews_product_id_fkey
      foreign key (product_id) references public.products(id) on delete cascade;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'products'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'favorites'
  ) then
    alter table public.favorites
      drop constraint if exists favorites_product_id_fkey;
    alter table public.favorites
      add constraint favorites_product_id_fkey
      foreign key (product_id) references public.products(id) on delete cascade;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'products'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'wishlist_items'
  ) then
    alter table public.wishlist_items
      drop constraint if exists wishlist_items_product_id_fkey;
    alter table public.wishlist_items
      add constraint wishlist_items_product_id_fkey
      foreign key (product_id) references public.products(id) on delete cascade;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'wishlists'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'wishlist_items'
  ) then
    alter table public.wishlist_items
      drop constraint if exists wishlist_items_wishlist_id_fkey;
    alter table public.wishlist_items
      add constraint wishlist_items_wishlist_id_fkey
      foreign key (wishlist_id) references public.wishlists(id) on delete cascade;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'order_templates'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'order_template_items'
  ) then
    alter table public.order_template_items
      drop constraint if exists order_template_items_template_id_fkey;
    alter table public.order_template_items
      add constraint order_template_items_template_id_fkey
      foreign key (template_id) references public.order_templates(id) on delete cascade;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'products'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'order_template_items'
  ) then
    alter table public.order_template_items
      drop constraint if exists order_template_items_product_id_fkey;
    alter table public.order_template_items
      add constraint order_template_items_product_id_fkey
      foreign key (product_id) references public.products(id) on delete cascade;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'products'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'inventory_movements'
  ) then
    alter table public.inventory_movements
      drop constraint if exists inventory_movements_product_id_fkey;
    alter table public.inventory_movements
      add constraint inventory_movements_product_id_fkey
      foreign key (product_id) references public.products(id) on delete cascade;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'orders'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'inventory_movements'
  ) then
    alter table public.inventory_movements
      drop constraint if exists inventory_movements_order_id_fkey;
    alter table public.inventory_movements
      add constraint inventory_movements_order_id_fkey
      foreign key (order_id) references public.orders(id) on delete set null;
  end if;
end
$$;

-- Useful uniqueness / validation

create unique index if not exists users_email_unique_idx
  on public.users (lower(email));

create unique index if not exists verification_codes_email_unique_idx
  on public.verification_codes (lower(email));

create unique index if not exists payment_methods_customer_email_id_unique_idx
  on public.payment_methods (lower(customer_email), id);

create unique index if not exists customer_addresses_email_label_unique_idx
  on public.customer_addresses (lower(customer_email), lower(label));

create unique index if not exists wishlists_customer_email_name_unique_idx
  on public.wishlists (lower(customer_email), lower(name));

create unique index if not exists rewards_ledger_code_unique_idx
  on public.rewards_ledger (code)
  where code is not null and btrim(code) <> '';

create unique index if not exists customer_addresses_one_default_idx
  on public.customer_addresses (lower(customer_email))
  where is_default = true;

-- Performance indexes

create index if not exists idx_orders_customer_email_created_at
  on public.orders (lower(customer_email), created_at desc);

create index if not exists idx_orders_status_created_at
  on public.orders (status, created_at desc);

create index if not exists idx_orders_square_order_id
  on public.orders (square_order_id)
  where square_order_id is not null;

create index if not exists idx_deliveries_order_id
  on public.deliveries (order_id);

create index if not exists idx_deliveries_customer_email_created_at
  on public.deliveries (lower(customer_email), created_at desc);

create index if not exists idx_deliveries_status_created_at
  on public.deliveries (status, created_at desc);

create index if not exists idx_reviews_product_id_created_at
  on public.reviews (product_id, created_at desc);

create index if not exists idx_messages_created_at
  on public.messages (created_at desc);

create index if not exists idx_help_requests_created_at
  on public.help_requests (created_at desc);

create index if not exists idx_feedback_created_at
  on public.feedback (created_at desc);

create index if not exists idx_payment_methods_customer_email_created_at
  on public.payment_methods (lower(customer_email), created_at desc);

create index if not exists idx_customer_addresses_customer_email
  on public.customer_addresses (lower(customer_email), created_at desc);

create index if not exists idx_favorites_customer_email_created_at
  on public.favorites (lower(customer_email), created_at desc);

create index if not exists idx_favorites_product_id
  on public.favorites (product_id);

create index if not exists idx_wishlists_customer_email_created_at
  on public.wishlists (lower(customer_email), created_at desc);

create index if not exists idx_wishlist_items_product_id
  on public.wishlist_items (product_id);

create index if not exists idx_order_templates_customer_email_created_at
  on public.order_templates (lower(customer_email), created_at desc);

create index if not exists idx_order_template_items_product_id
  on public.order_template_items (product_id);

create index if not exists idx_notifications_customer_email_created_at
  on public.notifications (lower(customer_email), created_at desc);

create index if not exists idx_notifications_customer_email_unread
  on public.notifications (lower(customer_email), read_at, created_at desc);

create index if not exists idx_rewards_ledger_customer_email_created_at
  on public.rewards_ledger (lower(customer_email), created_at desc);

create index if not exists idx_rewards_ledger_customer_email_used_at
  on public.rewards_ledger (lower(customer_email), used_at, created_at desc);

create index if not exists idx_inventory_movements_product_created_at
  on public.inventory_movements (product_id, created_at desc);

create index if not exists idx_inventory_movements_order_id
  on public.inventory_movements (order_id);

create index if not exists idx_account_activity_customer_email_created_at
  on public.account_activity (lower(customer_email), created_at desc);

create index if not exists idx_order_items_order_id
  on public.order_items (order_id);

create index if not exists idx_order_items_product_id
  on public.order_items (product_id);

-- Triggers for updated_at maintenance

drop trigger if exists set_updated_at_users on public.users;
create trigger set_updated_at_users
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_products on public.products;
create trigger set_updated_at_products
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_orders on public.orders;
create trigger set_updated_at_orders
before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_deliveries on public.deliveries;
create trigger set_updated_at_deliveries
before update on public.deliveries
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_reviews on public.reviews;
create trigger set_updated_at_reviews
before update on public.reviews
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_feedback on public.feedback;
create trigger set_updated_at_feedback
before update on public.feedback
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_messages on public.messages;
create trigger set_updated_at_messages
before update on public.messages
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_help_requests on public.help_requests;
create trigger set_updated_at_help_requests
before update on public.help_requests
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_verification_codes on public.verification_codes;
create trigger set_updated_at_verification_codes
before update on public.verification_codes
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_payment_methods on public.payment_methods;
create trigger set_updated_at_payment_methods
before update on public.payment_methods
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_customer_addresses on public.customer_addresses;
create trigger set_updated_at_customer_addresses
before update on public.customer_addresses
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_wishlists on public.wishlists;
create trigger set_updated_at_wishlists
before update on public.wishlists
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_order_templates on public.order_templates;
create trigger set_updated_at_order_templates
before update on public.order_templates
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_notification_preferences on public.notification_preferences;
create trigger set_updated_at_notification_preferences
before update on public.notification_preferences
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_rewards_ledger on public.rewards_ledger;
create trigger set_updated_at_rewards_ledger
before update on public.rewards_ledger
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_order_items on public.order_items;
create trigger set_updated_at_order_items
before update on public.order_items
for each row execute function public.set_updated_at();

-- Recommended starter RLS posture
-- The backend currently uses the service role, so these policies are safe defaults
-- for future client-side reads/writes if you later move some account flows to Supabase auth.

alter table public.payment_methods enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.favorites enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.order_templates enable row level security;
alter table public.order_template_items enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.rewards_ledger enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.account_activity enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customer_addresses'
      and policyname = 'customer_addresses_owner_all'
  ) then
    create policy customer_addresses_owner_all on public.customer_addresses
      using (lower(customer_email) = lower(auth.email()))
      with check (lower(customer_email) = lower(auth.email()));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'favorites'
      and policyname = 'favorites_owner_all'
  ) then
    create policy favorites_owner_all on public.favorites
      using (lower(customer_email) = lower(auth.email()))
      with check (lower(customer_email) = lower(auth.email()));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'wishlists'
      and policyname = 'wishlists_owner_all'
  ) then
    create policy wishlists_owner_all on public.wishlists
      using (lower(customer_email) = lower(auth.email()))
      with check (lower(customer_email) = lower(auth.email()));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'wishlist_items'
      and policyname = 'wishlist_items_owner_all'
  ) then
    create policy wishlist_items_owner_all on public.wishlist_items
      using (
        exists (
          select 1
          from public.wishlists w
          where w.id = wishlist_id
            and lower(w.customer_email) = lower(auth.email())
        )
      )
      with check (
        exists (
          select 1
          from public.wishlists w
          where w.id = wishlist_id
            and lower(w.customer_email) = lower(auth.email())
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'order_templates'
      and policyname = 'order_templates_owner_all'
  ) then
    create policy order_templates_owner_all on public.order_templates
      using (lower(customer_email) = lower(auth.email()))
      with check (lower(customer_email) = lower(auth.email()));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'order_template_items'
      and policyname = 'order_template_items_owner_all'
  ) then
    create policy order_template_items_owner_all on public.order_template_items
      using (
        exists (
          select 1
          from public.order_templates t
          where t.id = template_id
            and lower(t.customer_email) = lower(auth.email())
        )
      )
      with check (
        exists (
          select 1
          from public.order_templates t
          where t.id = template_id
            and lower(t.customer_email) = lower(auth.email())
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_preferences'
      and policyname = 'notification_preferences_owner_all'
  ) then
    create policy notification_preferences_owner_all on public.notification_preferences
      using (lower(customer_email) = lower(auth.email()))
      with check (lower(customer_email) = lower(auth.email()));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'notifications_owner_read'
  ) then
    create policy notifications_owner_read on public.notifications
      for select
      using (lower(customer_email) = lower(auth.email()));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rewards_ledger'
      and policyname = 'rewards_ledger_owner_read'
  ) then
    create policy rewards_ledger_owner_read on public.rewards_ledger
      for select
      using (lower(customer_email) = lower(auth.email()));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'account_activity'
      and policyname = 'account_activity_owner_read'
  ) then
    create policy account_activity_owner_read on public.account_activity
      for select
      using (lower(customer_email) = lower(auth.email()));
  end if;
end
$$;
