create table if not exists app_state (
  key text primary key,
  payload jsonb not null
);

create table if not exists wineries (
  id text primary key,
  label text,
  status text,
  ref1 text,
  ref2 text,
  sort_order numeric,
  time1 timestamptz,
  time2 timestamptz,
  payload jsonb not null
);
create index if not exists idx_wineries_status on wineries(status);
create index if not exists idx_wineries_ref1 on wineries(ref1);
create index if not exists idx_wineries_ref2 on wineries(ref2);

create table if not exists wines (
  id text primary key,
  label text,
  status text,
  ref1 text,
  ref2 text,
  sort_order numeric,
  time1 timestamptz,
  time2 timestamptz,
  payload jsonb not null
);
create index if not exists idx_wines_status on wines(status);
create index if not exists idx_wines_ref1 on wines(ref1);
create index if not exists idx_wines_ref2 on wines(ref2);

create table if not exists tracks (
  id text primary key,
  label text,
  status text,
  ref1 text,
  ref2 text,
  sort_order numeric,
  time1 timestamptz,
  time2 timestamptz,
  payload jsonb not null
);
create index if not exists idx_tracks_status on tracks(status);
create index if not exists idx_tracks_ref1 on tracks(ref1);
create index if not exists idx_tracks_ref2 on tracks(ref2);

create table if not exists download_assets (
  id text primary key,
  label text,
  status text,
  ref1 text,
  ref2 text,
  sort_order numeric,
  time1 timestamptz,
  time2 timestamptz,
  payload jsonb not null
);
create index if not exists idx_download_assets_status on download_assets(status);
create index if not exists idx_download_assets_ref1 on download_assets(ref1);
create index if not exists idx_download_assets_ref2 on download_assets(ref2);

create table if not exists products (
  id text primary key,
  label text,
  status text,
  ref1 text,
  ref2 text,
  sort_order numeric,
  time1 timestamptz,
  time2 timestamptz,
  payload jsonb not null
);
create index if not exists idx_products_status on products(status);
create index if not exists idx_products_ref1 on products(ref1);
create index if not exists idx_products_ref2 on products(ref2);

create table if not exists product_skus (
  id text primary key,
  label text,
  status text,
  ref1 text,
  ref2 text,
  sort_order numeric,
  time1 timestamptz,
  time2 timestamptz,
  payload jsonb not null
);
create index if not exists idx_product_skus_status on product_skus(status);
create index if not exists idx_product_skus_ref1 on product_skus(ref1);
create index if not exists idx_product_skus_ref2 on product_skus(ref2);

create table if not exists users (
  id text primary key,
  label text,
  status text,
  ref1 text,
  ref2 text,
  sort_order numeric,
  time1 timestamptz,
  time2 timestamptz,
  payload jsonb not null
);
create index if not exists idx_users_status on users(status);
create index if not exists idx_users_ref1 on users(ref1);
create index if not exists idx_users_ref2 on users(ref2);

create table if not exists membership_plans (
  id text primary key,
  label text,
  status text,
  ref1 text,
  ref2 text,
  sort_order numeric,
  time1 timestamptz,
  time2 timestamptz,
  payload jsonb not null
);
create index if not exists idx_membership_plans_status on membership_plans(status);
create index if not exists idx_membership_plans_ref1 on membership_plans(ref1);
create index if not exists idx_membership_plans_ref2 on membership_plans(ref2);

create table if not exists memberships (
  id text primary key,
  label text,
  status text,
  ref1 text,
  ref2 text,
  sort_order numeric,
  time1 timestamptz,
  time2 timestamptz,
  payload jsonb not null
);
create index if not exists idx_memberships_status on memberships(status);
create index if not exists idx_memberships_ref1 on memberships(ref1);
create index if not exists idx_memberships_ref2 on memberships(ref2);

create table if not exists download_entitlements (
  id text primary key,
  label text,
  status text,
  ref1 text,
  ref2 text,
  sort_order numeric,
  time1 timestamptz,
  time2 timestamptz,
  payload jsonb not null
);
create index if not exists idx_download_entitlements_status on download_entitlements(status);
create index if not exists idx_download_entitlements_ref1 on download_entitlements(ref1);
create index if not exists idx_download_entitlements_ref2 on download_entitlements(ref2);

create table if not exists download_logs (
  id text primary key,
  label text,
  status text,
  ref1 text,
  ref2 text,
  sort_order numeric,
  time1 timestamptz,
  time2 timestamptz,
  payload jsonb not null
);
create index if not exists idx_download_logs_status on download_logs(status);
create index if not exists idx_download_logs_ref1 on download_logs(ref1);
create index if not exists idx_download_logs_ref2 on download_logs(ref2);

create table if not exists download_tickets (
  id text primary key,
  label text,
  status text,
  ref1 text,
  ref2 text,
  sort_order numeric,
  time1 timestamptz,
  time2 timestamptz,
  payload jsonb not null
);
create index if not exists idx_download_tickets_status on download_tickets(status);
create index if not exists idx_download_tickets_ref1 on download_tickets(ref1);
create index if not exists idx_download_tickets_ref2 on download_tickets(ref2);

create table if not exists code_batches (
  id text primary key,
  label text,
  status text,
  ref1 text,
  ref2 text,
  sort_order numeric,
  time1 timestamptz,
  time2 timestamptz,
  payload jsonb not null
);
create index if not exists idx_code_batches_status on code_batches(status);
create index if not exists idx_code_batches_ref1 on code_batches(ref1);
create index if not exists idx_code_batches_ref2 on code_batches(ref2);

create table if not exists scan_codes (
  id text primary key,
  label text,
  status text,
  ref1 text,
  ref2 text,
  sort_order numeric,
  time1 timestamptz,
  time2 timestamptz,
  payload jsonb not null
);
create index if not exists idx_scan_codes_status on scan_codes(status);
create index if not exists idx_scan_codes_ref1 on scan_codes(ref1);
create index if not exists idx_scan_codes_ref2 on scan_codes(ref2);

create table if not exists scan_sessions (
  id text primary key,
  label text,
  status text,
  ref1 text,
  ref2 text,
  sort_order numeric,
  time1 timestamptz,
  time2 timestamptz,
  payload jsonb not null
);
create index if not exists idx_scan_sessions_status on scan_sessions(status);
create index if not exists idx_scan_sessions_ref1 on scan_sessions(ref1);
create index if not exists idx_scan_sessions_ref2 on scan_sessions(ref2);

create table if not exists cart_items (
  id text primary key,
  label text,
  status text,
  ref1 text,
  ref2 text,
  sort_order numeric,
  time1 timestamptz,
  time2 timestamptz,
  payload jsonb not null
);
create index if not exists idx_cart_items_status on cart_items(status);
create index if not exists idx_cart_items_ref1 on cart_items(ref1);
create index if not exists idx_cart_items_ref2 on cart_items(ref2);

create table if not exists orders (
  id text primary key,
  label text,
  status text,
  ref1 text,
  ref2 text,
  sort_order numeric,
  time1 timestamptz,
  time2 timestamptz,
  payload jsonb not null
);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_ref1 on orders(ref1);
create index if not exists idx_orders_ref2 on orders(ref2);

create table if not exists order_items (
  id text primary key,
  label text,
  status text,
  ref1 text,
  ref2 text,
  sort_order numeric,
  time1 timestamptz,
  time2 timestamptz,
  payload jsonb not null
);
create index if not exists idx_order_items_status on order_items(status);
create index if not exists idx_order_items_ref1 on order_items(ref1);
create index if not exists idx_order_items_ref2 on order_items(ref2);

create table if not exists payments (
  id text primary key,
  label text,
  status text,
  ref1 text,
  ref2 text,
  sort_order numeric,
  time1 timestamptz,
  time2 timestamptz,
  payload jsonb not null
);
create index if not exists idx_payments_status on payments(status);
create index if not exists idx_payments_ref1 on payments(ref1);
create index if not exists idx_payments_ref2 on payments(ref2);

create table if not exists admin_roles (
  id text primary key,
  label text,
  status text,
  ref1 text,
  ref2 text,
  sort_order numeric,
  time1 timestamptz,
  time2 timestamptz,
  payload jsonb not null
);
create index if not exists idx_admin_roles_status on admin_roles(status);
create index if not exists idx_admin_roles_ref1 on admin_roles(ref1);
create index if not exists idx_admin_roles_ref2 on admin_roles(ref2);

create table if not exists admin_users (
  id text primary key,
  label text,
  status text,
  ref1 text,
  ref2 text,
  sort_order numeric,
  time1 timestamptz,
  time2 timestamptz,
  payload jsonb not null
);
create index if not exists idx_admin_users_status on admin_users(status);
create index if not exists idx_admin_users_ref1 on admin_users(ref1);
create index if not exists idx_admin_users_ref2 on admin_users(ref2);

create table if not exists admin_sessions (
  id text primary key,
  label text,
  status text,
  ref1 text,
  ref2 text,
  sort_order numeric,
  time1 timestamptz,
  time2 timestamptz,
  payload jsonb not null
);
create index if not exists idx_admin_sessions_status on admin_sessions(status);
create index if not exists idx_admin_sessions_ref1 on admin_sessions(ref1);
create index if not exists idx_admin_sessions_ref2 on admin_sessions(ref2);

create table if not exists audit_logs (
  id text primary key,
  label text,
  status text,
  ref1 text,
  ref2 text,
  sort_order numeric,
  time1 timestamptz,
  time2 timestamptz,
  payload jsonb not null
);
create index if not exists idx_audit_logs_status on audit_logs(status);
create index if not exists idx_audit_logs_ref1 on audit_logs(ref1);
create index if not exists idx_audit_logs_ref2 on audit_logs(ref2);
