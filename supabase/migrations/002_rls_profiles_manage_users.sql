-- ============================================================
-- Migration 002: allow manage_users to see ALL profiles
-- ============================================================
-- The original policy hides inactive profiles from everyone.
-- We replace it with two permissive policies that Postgres OR's:
--   1. Anyone can see active profiles  (existing behaviour)
--   2. Users with perm_manage_users can see ALL profiles
-- This lets admins view and reactivate deactivated accounts.
-- ============================================================

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

-- All authenticated users see active profiles
CREATE POLICY "profiles_select_active"
  ON public.profiles FOR SELECT
  USING (is_active = TRUE);

-- Users with manage_users permission see every profile (active + inactive)
CREATE POLICY "profiles_select_manage_users"
  ON public.profiles FOR SELECT
  USING ((get_my_profile()).perm_manage_users = TRUE);
