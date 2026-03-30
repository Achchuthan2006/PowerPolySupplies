# Supabase Notes

This folder now contains a first real migration for the project:

- `migrations/20260330_account_and_ops_foundation.sql`

## What this migration adds

- Missing `payment_methods` table used by the backend
- Persistent account tables for:
  - `customer_addresses`
  - `favorites`
  - `wishlists`
  - `wishlist_items`
  - `order_templates`
  - `order_template_items`
  - `notification_preferences`
  - `notifications`
  - `rewards_ledger`
  - `inventory_movements`
  - `account_activity`
- Hardening for existing tables:
  - timestamps
  - indexes
  - uniqueness rules
  - selected foreign keys
  - starter RLS policies

## Important

This migration prepares the database, but some app features are still stored only in browser `localStorage`.

The frontend/backend still need code updates to start reading/writing these new tables for:

- addresses
- favorites
- wishlists
- templates
- rewards ledger
- notifications
- activity log
- inventory movement history
- proper inserts into `order_items`

## Recommended rollout

1. Run the migration in Supabase SQL Editor.
2. Confirm all new tables appear in the dashboard.
3. Update backend routes to write to the new tables.
4. Move account-page local storage features into API-backed storage.
5. Backfill `order_items` from existing `orders.items` JSON if needed.
