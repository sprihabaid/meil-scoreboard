-- ============================================================
-- MEIL SALES SCOREBOARD — SUPABASE SCHEMA v1.0
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'data_entry', 'sales_manager', 'salesperson');
CREATE TYPE team_type AS ENUM ('frontend', 'backend');
CREATE TYPE kra_status AS ENUM ('green', 'amber', 'red', 'pending');
CREATE TYPE plant_name AS ENUM ('Reengus', 'Jaipur');
CREATE TYPE unit_name AS ENUM ('Unit 1 (Rd. No. 1)', 'Unit 2 (Reengus)', 'VKI Jaipur');
CREATE TYPE product_category AS ENUM ('CRGO Steel', 'Amorphous');
CREATE TYPE final_product AS ENUM ('Slitting', 'Cutting', 'Assembly');
CREATE TYPE badge_category AS ENUM (
  'king_of_mt', 'premium_closer', 'market_opener', 'loyalty_builder',
  'comeback_champion', 'pipeline_king', 'speed_award',
  'first_order', 'century_club', 'hat_trick', 'streak_shield',
  'comeback_kid', 'zero_to_hero', 'speed_demon', 'iron_consistency',
  'weekly_mvp', 'personal_best'
);
CREATE TYPE level_name AS ENUM ('Trainee', 'Hustler', 'Closer', 'Elite', 'Legend');
CREATE TYPE audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'PERMISSION_CHANGE');

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'salesperson',
  team team_type,
  avatar_url TEXT,
  join_date DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT TRUE,
  -- Flexible permissions (superadmin can toggle any of these)
  perm_view_leaderboard BOOLEAN DEFAULT TRUE,
  perm_view_team_panel BOOLEAN DEFAULT TRUE,
  perm_view_all_scorecards BOOLEAN DEFAULT FALSE,
  perm_enter_data BOOLEAN DEFAULT FALSE,
  perm_approve_kra BOOLEAN DEFAULT FALSE,
  perm_manage_users BOOLEAN DEFAULT FALSE,
  perm_declare_badges BOOLEAN DEFAULT FALSE,
  perm_view_audit_log BOOLEAN DEFAULT FALSE,
  perm_export_reports BOOLEAN DEFAULT FALSE,
  perm_set_targets BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default permissions by role (applied on insert via trigger)
CREATE OR REPLACE FUNCTION set_default_permissions()
RETURNS TRIGGER AS $$
BEGIN
  CASE NEW.role
    WHEN 'superadmin' THEN
      NEW.perm_view_leaderboard := TRUE;
      NEW.perm_view_team_panel := TRUE;
      NEW.perm_view_all_scorecards := TRUE;
      NEW.perm_enter_data := TRUE;
      NEW.perm_approve_kra := TRUE;
      NEW.perm_manage_users := TRUE;
      NEW.perm_declare_badges := TRUE;
      NEW.perm_view_audit_log := TRUE;
      NEW.perm_export_reports := TRUE;
      NEW.perm_set_targets := TRUE;
    WHEN 'admin' THEN
      NEW.perm_view_leaderboard := TRUE;
      NEW.perm_view_team_panel := TRUE;
      NEW.perm_view_all_scorecards := TRUE;
      NEW.perm_enter_data := TRUE;
      NEW.perm_approve_kra := TRUE;
      NEW.perm_manage_users := FALSE;
      NEW.perm_declare_badges := FALSE;
      NEW.perm_view_audit_log := FALSE;
      NEW.perm_export_reports := TRUE;
      NEW.perm_set_targets := FALSE;
    WHEN 'data_entry' THEN
      NEW.perm_view_leaderboard := TRUE;
      NEW.perm_view_team_panel := TRUE;
      NEW.perm_view_all_scorecards := FALSE;
      NEW.perm_enter_data := TRUE;
      NEW.perm_approve_kra := FALSE;
      NEW.perm_manage_users := FALSE;
      NEW.perm_declare_badges := FALSE;
      NEW.perm_view_audit_log := FALSE;
      NEW.perm_export_reports := FALSE;
      NEW.perm_set_targets := FALSE;
    WHEN 'sales_manager' THEN
      NEW.perm_view_leaderboard := TRUE;
      NEW.perm_view_team_panel := TRUE;
      NEW.perm_view_all_scorecards := TRUE;
      NEW.perm_enter_data := FALSE;
      NEW.perm_approve_kra := FALSE;
      NEW.perm_manage_users := FALSE;
      NEW.perm_declare_badges := FALSE;
      NEW.perm_view_audit_log := FALSE;
      NEW.perm_export_reports := TRUE;
      NEW.perm_set_targets := FALSE;
    WHEN 'salesperson' THEN
      NEW.perm_view_leaderboard := TRUE;
      NEW.perm_view_team_panel := TRUE;
      NEW.perm_view_all_scorecards := FALSE;
      NEW.perm_enter_data := FALSE;
      NEW.perm_approve_kra := FALSE;
      NEW.perm_manage_users := FALSE;
      NEW.perm_declare_badges := FALSE;
      NEW.perm_view_audit_log := FALSE;
      NEW.perm_export_reports := FALSE;
      NEW.perm_set_targets := FALSE;
  END CASE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profile_insert_set_permissions
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION set_default_permissions();

-- ============================================================
-- TARGETS
-- ============================================================

CREATE TABLE public.targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  plant plant_name NOT NULL,
  unit unit_name NOT NULL,
  category product_category NOT NULL,
  final_product final_product NOT NULL,
  target_mt NUMERIC(10,2) NOT NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE, -- NULL = currently active
  set_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- KRA targets (configurable per person per month)
CREATE TABLE public.kra_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  kra_name TEXT NOT NULL,
  target_value NUMERIC(10,2) NOT NULL,
  target_unit TEXT NOT NULL, -- 'count', 'percentage', 'hours', 'MT'
  month DATE NOT NULL, -- first day of month
  set_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, kra_name, month)
);

-- ============================================================
-- DAILY ENTRIES (core data)
-- ============================================================

CREATE TABLE public.daily_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  entry_date DATE NOT NULL,
  -- Leaderboard metrics
  mt_brought NUMERIC(10,2) DEFAULT 0,
  inquiries_in_mt NUMERIC(10,2) DEFAULT 0,
  quotes_sent INTEGER DEFAULT 0,
  new_clients INTEGER DEFAULT 0,
  avg_closing_price NUMERIC(10,2) DEFAULT 0,
  retention_count INTEGER DEFAULT 0, -- clients who reordered
  total_clients INTEGER DEFAULT 0,   -- for retention % calc
  inquiry_to_quote_hours NUMERIC(6,2) DEFAULT 0,
  -- Revenue
  revenue_rs_cr NUMERIC(10,4) DEFAULT 0,
  orders_count INTEGER DEFAULT 0,
  -- Lock after 48 hours
  is_locked BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  -- Entry metadata
  entered_by UUID NOT NULL REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, entry_date)
);

-- Auto-lock entries older than 48 hours (called via cron or on-read)
CREATE OR REPLACE FUNCTION lock_old_entries()
RETURNS void AS $$
BEGIN
  UPDATE public.daily_entries
  SET is_locked = TRUE, locked_at = NOW()
  WHERE is_locked = FALSE
    AND created_at < NOW() - INTERVAL '48 hours';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- KRA LOGS
-- ============================================================

CREATE TABLE public.kra_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  log_date DATE NOT NULL,
  kra_name TEXT NOT NULL,
  target_value NUMERIC(10,2),
  actual_value NUMERIC(10,2),
  status kra_status DEFAULT 'pending',
  notes TEXT,
  -- Approval
  submitted_by UUID NOT NULL REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, log_date, kra_name)
);

-- ============================================================
-- TEAM METRICS (entered once daily by admin)
-- ============================================================

CREATE TABLE public.team_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_date DATE NOT NULL UNIQUE,
  -- Revenue
  team_revenue_rs_cr NUMERIC(10,4) DEFAULT 0,
  team_orders_count INTEGER DEFAULT 0,
  inquiries_received INTEGER DEFAULT 0,
  quotes_sent INTEGER DEFAULT 0,
  orders_won INTEGER DEFAULT 0,
  -- Inquiry sources (for donut chart)
  source_referrals NUMERIC(10,2) DEFAULT 0,
  source_website NUMERIC(10,2) DEFAULT 0,
  source_expo NUMERIC(10,2) DEFAULT 0,
  source_cold_outreach NUMERIC(10,2) DEFAULT 0,
  source_international NUMERIC(10,2) DEFAULT 0,
  entered_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PLANT-WISE MT ENTRIES
-- ============================================================

CREATE TABLE public.plant_mt_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_date DATE NOT NULL,
  plant plant_name NOT NULL,
  unit unit_name NOT NULL,
  category product_category NOT NULL,
  final_product final_product NOT NULL,
  target_mt NUMERIC(10,2) DEFAULT 0,
  actual_mt NUMERIC(10,2) DEFAULT 0,
  entered_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_date, plant, unit, category, final_product)
);

-- ============================================================
-- GAMIFICATION — LEVELS
-- ============================================================

CREATE TABLE public.user_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id),
  current_level level_name DEFAULT 'Trainee',
  total_mt_all_time NUMERIC(10,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Level thresholds
CREATE TABLE public.level_thresholds (
  level level_name PRIMARY KEY,
  min_mt_required NUMERIC(10,2) NOT NULL,
  display_color TEXT NOT NULL,
  icon TEXT NOT NULL
);

INSERT INTO public.level_thresholds VALUES
  ('Trainee',  0,    '#6B7280', '🌱'),
  ('Hustler',  50,   '#3B82F6', '⚡'),
  ('Closer',   200,  '#8B5CF6', '🔥'),
  ('Elite',    500,  '#F59E0B', '💎'),
  ('Legend',   1000, '#EF4444', '👑');

-- ============================================================
-- GAMIFICATION — BADGES (earned, permanent)
-- ============================================================

CREATE TABLE public.earned_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  badge_category badge_category NOT NULL,
  earned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  month DATE, -- for monthly badges
  week_number INTEGER,
  awarded_by UUID REFERENCES public.profiles(id), -- NULL = auto-awarded
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Badge definitions
CREATE TABLE public.badge_definitions (
  category badge_category PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  is_auto_awarded BOOLEAN DEFAULT TRUE,
  award_criteria TEXT -- description of how it's auto-calculated
);

INSERT INTO public.badge_definitions VALUES
  ('king_of_mt',       'King of MT',           'Highest orders in MT this month',                '👑', '#F59E0B', FALSE, NULL),
  ('premium_closer',   'Premium Closer',        'Highest avg closing price per MT this month',    '💰', '#10B981', FALSE, NULL),
  ('market_opener',    'Market Opener',         'Most new clients unlocked this month',           '🚀', '#3B82F6', FALSE, NULL),
  ('loyalty_builder',  'Loyalty Builder',       'Best client retention rate this month',          '🤝', '#8B5CF6', FALSE, NULL),
  ('comeback_champion','Comeback Champion',     'Biggest MT improvement this month',              '⚡', '#EF4444', FALSE, NULL),
  ('pipeline_king',    'Pipeline King',         'Highest inquiries in MT this month',             '🔮', '#06B6D4', FALSE, NULL),
  ('speed_award',      'Speed Award',           'Fastest inquiry-to-quote TAT this month',        '⚡', '#F97316', FALSE, NULL),
  ('first_order',      'First Order',           'First person to log an order this month',        '🥇', '#F59E0B', TRUE,  'First daily_entry with orders_count > 0 each month'),
  ('century_club',     'Century Club',          'Crossed 100 MT in a single month',               '💯', '#10B981', TRUE,  'MTD MT >= 100'),
  ('hat_trick',        'Hat Trick',             '3 new clients in a single week',                 '🎯', '#8B5CF6', TRUE,  'Weekly new_clients >= 3'),
  ('streak_shield',    'Streak Shield',         'Maintained a 4-week KRA streak',                 '🛡️', '#3B82F6', TRUE,  'kra_streak >= 4'),
  ('comeback_kid',     'Comeback Kid',          'Jumped 3+ positions on leaderboard in one week', '📈', '#EF4444', TRUE,  'Rank improvement >= 3 in any leaderboard'),
  ('zero_to_hero',     'Zero to Hero',          'Went from last to top 3 in any category',        '🦸', '#F97316', TRUE,  'Was last, now top 3'),
  ('speed_demon',      'Speed Demon',           'Best TAT 3 weeks in a row',                      '💨', '#06B6D4', TRUE,  'Best TAT for 3 consecutive weeks'),
  ('iron_consistency', 'Iron Consistency',      'Never missed a KRA log in a full month',         '🔩', '#6B7280', TRUE,  'All KRAs logged every day of month'),
  ('weekly_mvp',       'Weekly MVP',            'Best combined week across MT + inquiries + KRA', '⭐', '#F59E0B', TRUE,  'Auto-calculated weekly'),
  ('personal_best',    'Personal Best',         'Set a new personal record in any metric',        '🏆', '#10B981', TRUE,  'New all-time high in any metric');

-- ============================================================
-- GAMIFICATION — STREAKS
-- ============================================================

CREATE TABLE public.streaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id),
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_logged_date DATE,
  streak_at_risk BOOLEAN DEFAULT FALSE, -- true if not logged by 8 PM today
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GAMIFICATION — PERSONAL BESTS
-- ============================================================

CREATE TABLE public.personal_bests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  metric_name TEXT NOT NULL, -- 'mt_brought', 'inquiries_in_mt', 'new_clients', etc.
  best_value NUMERIC(10,2) NOT NULL,
  achieved_date DATE NOT NULL,
  period TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, metric_name, period)
);

-- ============================================================
-- GAMIFICATION — RIVALRY MODE
-- ============================================================

CREATE TABLE public.rivalries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_a_id UUID NOT NULL REFERENCES public.profiles(id),
  user_b_id UUID NOT NULL REFERENCES public.profiles(id),
  month DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_a_id, user_b_id, month)
);

-- ============================================================
-- RECOGNITION — MONTHLY BADGES (Hall of Fame)
-- ============================================================

CREATE TABLE public.monthly_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  month DATE NOT NULL,
  badge_category badge_category NOT NULL,
  winner_id UUID NOT NULL REFERENCES public.profiles(id),
  reward_type TEXT, -- 'cash', 'voucher', 'recognition'
  reward_description TEXT,
  shoutout_text TEXT,
  declared_by UUID NOT NULL REFERENCES public.profiles(id),
  declared_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(month, badge_category)
);

-- ============================================================
-- RECOGNITION — SHOUTOUTS
-- ============================================================

CREATE TABLE public.shoutouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id),
  action_text TEXT NOT NULL,
  impact_text TEXT NOT NULL,
  meil_value TEXT, -- linked company value
  is_auto_generated BOOLEAN DEFAULT FALSE,
  auto_trigger TEXT, -- what triggered it if auto
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RECOGNITION — AUTO RECOGNITION EVENTS (home feed)
-- ============================================================

CREATE TABLE public.recognition_feed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  event_type TEXT NOT NULL, -- 'badge_earned', 'personal_best', 'streak_milestone', 'rank_change', 'target_crossed', 'level_up', 'weekly_mvp'
  event_title TEXT NOT NULL,
  event_body TEXT NOT NULL,
  emoji TEXT DEFAULT '🎉',
  metric_value TEXT, -- the number/value that triggered it
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- ============================================================
-- MONTH-END SNAPSHOTS
-- ============================================================

CREATE TABLE public.monthly_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_month DATE NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  -- Rankings
  rank_mt INTEGER,
  rank_closing_price INTEGER,
  rank_new_clients INTEGER,
  rank_retention INTEGER,
  rank_most_improved INTEGER,
  rank_inquiries INTEGER,
  rank_tat INTEGER,
  -- Totals
  total_mt NUMERIC(10,2),
  total_revenue NUMERIC(10,4),
  total_new_clients INTEGER,
  avg_closing_price NUMERIC(10,2),
  retention_rate NUMERIC(5,2),
  total_inquiries_mt NUMERIC(10,2),
  avg_tat_hours NUMERIC(6,2),
  -- KRA compliance
  kra_compliance_pct NUMERIC(5,2),
  streak_at_month_end INTEGER,
  -- Badges earned this month (JSON array)
  badges_earned JSONB DEFAULT '[]',
  -- Level at month end
  level_at_month_end level_name,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(snapshot_month, user_id)
);

-- ============================================================
-- CLIENT FEEDBACK
-- ============================================================

CREATE TABLE public.client_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  client_name TEXT NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  feedback_date DATE DEFAULT CURRENT_DATE,
  category TEXT, -- 'delivery', 'quality', 'communication', 'pricing'
  entered_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG — every action tracked
-- ============================================================

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action audit_action NOT NULL,
  table_name TEXT,
  record_id UUID,
  user_id UUID REFERENCES public.profiles(id),
  user_name TEXT, -- stored denormalized in case user is deleted
  user_role TEXT,
  -- Change details
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[], -- list of field names that changed
  -- Context
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT,
  notes TEXT, -- required for superadmin overrides on locked entries
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log trigger function
CREATE OR REPLACE FUNCTION log_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_changed_fields TEXT[];
  v_old_json JSONB;
  v_new_json JSONB;
BEGIN
  -- Get current user from session
  v_user_id := auth.uid();

  IF TG_OP = 'DELETE' THEN
    v_old_json := to_jsonb(OLD);
    INSERT INTO public.audit_log (action, table_name, record_id, user_id, old_values, new_values)
    VALUES ('DELETE', TG_TABLE_NAME, OLD.id, v_user_id, v_old_json, NULL);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);
    -- Compute changed fields
    SELECT ARRAY_AGG(key) INTO v_changed_fields
    FROM jsonb_each(v_old_json) old_vals
    WHERE old_vals.value IS DISTINCT FROM (v_new_json -> old_vals.key);
    INSERT INTO public.audit_log (action, table_name, record_id, user_id, old_values, new_values, changed_fields)
    VALUES ('UPDATE', TG_TABLE_NAME, NEW.id, v_user_id, v_old_json, v_new_json, v_changed_fields);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    v_new_json := to_jsonb(NEW);
    INSERT INTO public.audit_log (action, table_name, record_id, user_id, old_values, new_values)
    VALUES ('INSERT', TG_TABLE_NAME, NEW.id, v_user_id, NULL, v_new_json);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to all critical tables
CREATE TRIGGER audit_profiles          AFTER INSERT OR UPDATE OR DELETE ON public.profiles          FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER audit_daily_entries     AFTER INSERT OR UPDATE OR DELETE ON public.daily_entries     FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER audit_kra_logs          AFTER INSERT OR UPDATE OR DELETE ON public.kra_logs          FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER audit_targets           AFTER INSERT OR UPDATE OR DELETE ON public.targets           FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER audit_kra_targets       AFTER INSERT OR UPDATE OR DELETE ON public.kra_targets       FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER audit_monthly_badges    AFTER INSERT OR UPDATE OR DELETE ON public.monthly_badges    FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER audit_rivalries         AFTER INSERT OR UPDATE OR DELETE ON public.rivalries         FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER audit_plant_mt_entries  AFTER INSERT OR UPDATE OR DELETE ON public.plant_mt_entries  FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER audit_team_metrics      AFTER INSERT OR UPDATE OR DELETE ON public.team_metrics      FOR EACH ROW EXECUTE FUNCTION log_audit();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kra_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.targets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kra_targets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_metrics      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_mt_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_badges    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoutouts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recognition_feed  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earned_badges     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_bests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rivalries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_feedback   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_levels       ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's profile
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS public.profiles AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES: everyone sees active profiles; only superadmin manages users
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (is_active = TRUE);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK ((get_my_profile()).perm_manage_users = TRUE);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING ((get_my_profile()).perm_manage_users = TRUE OR id = auth.uid());

-- DAILY ENTRIES: enter if perm_enter_data; view all if perm_view_leaderboard
CREATE POLICY "entries_select" ON public.daily_entries FOR SELECT USING ((get_my_profile()).perm_view_leaderboard = TRUE);
CREATE POLICY "entries_insert" ON public.daily_entries FOR INSERT WITH CHECK ((get_my_profile()).perm_enter_data = TRUE);
CREATE POLICY "entries_update" ON public.daily_entries FOR UPDATE USING (
  (get_my_profile()).perm_enter_data = TRUE AND (
    is_locked = FALSE OR (get_my_profile()).role = 'superadmin'
  )
);

-- KRA LOGS: own entries + approve if perm_approve_kra
CREATE POLICY "kra_select" ON public.kra_logs FOR SELECT USING (user_id = auth.uid() OR (get_my_profile()).perm_approve_kra = TRUE OR (get_my_profile()).perm_view_all_scorecards = TRUE);
CREATE POLICY "kra_insert" ON public.kra_logs FOR INSERT WITH CHECK (submitted_by = auth.uid());
CREATE POLICY "kra_update" ON public.kra_logs FOR UPDATE USING (submitted_by = auth.uid() OR (get_my_profile()).perm_approve_kra = TRUE);

-- TARGETS: set if perm_set_targets; view own or all if perm_view_all_scorecards
CREATE POLICY "targets_select" ON public.targets FOR SELECT USING (user_id = auth.uid() OR (get_my_profile()).perm_view_all_scorecards = TRUE);
CREATE POLICY "targets_insert" ON public.targets FOR INSERT WITH CHECK ((get_my_profile()).perm_set_targets = TRUE);
CREATE POLICY "targets_update" ON public.targets FOR UPDATE USING ((get_my_profile()).perm_set_targets = TRUE);

-- TEAM METRICS: all can view; enter if perm_enter_data
CREATE POLICY "team_metrics_select" ON public.team_metrics FOR SELECT USING ((get_my_profile()).perm_view_team_panel = TRUE);
CREATE POLICY "team_metrics_insert" ON public.team_metrics FOR INSERT WITH CHECK ((get_my_profile()).perm_enter_data = TRUE);
CREATE POLICY "team_metrics_update" ON public.team_metrics FOR UPDATE USING ((get_my_profile()).perm_enter_data = TRUE);

-- PLANT MT: all can view; enter if perm_enter_data
CREATE POLICY "plant_mt_select" ON public.plant_mt_entries FOR SELECT USING ((get_my_profile()).perm_view_team_panel = TRUE);
CREATE POLICY "plant_mt_insert" ON public.plant_mt_entries FOR INSERT WITH CHECK ((get_my_profile()).perm_enter_data = TRUE);
CREATE POLICY "plant_mt_update" ON public.plant_mt_entries FOR UPDATE USING ((get_my_profile()).perm_enter_data = TRUE);

-- BADGES: all can view; declare if perm_declare_badges
CREATE POLICY "badges_select" ON public.monthly_badges FOR SELECT USING (TRUE);
CREATE POLICY "badges_insert" ON public.monthly_badges FOR INSERT WITH CHECK ((get_my_profile()).perm_declare_badges = TRUE);

-- EARNED BADGES: all can view
CREATE POLICY "earned_badges_select" ON public.earned_badges FOR SELECT USING (TRUE);
CREATE POLICY "earned_badges_insert" ON public.earned_badges FOR INSERT WITH CHECK ((get_my_profile()).perm_enter_data = TRUE OR (get_my_profile()).role = 'superadmin');

-- SHOUTOUTS: all can view; superadmin/admin can create
CREATE POLICY "shoutouts_select" ON public.shoutouts FOR SELECT USING (NOW() < expires_at);
CREATE POLICY "shoutouts_insert" ON public.shoutouts FOR INSERT WITH CHECK ((get_my_profile()).perm_declare_badges = TRUE OR (get_my_profile()).perm_approve_kra = TRUE);

-- RECOGNITION FEED: all can view
CREATE POLICY "feed_select" ON public.recognition_feed FOR SELECT USING (NOW() < expires_at);
CREATE POLICY "feed_insert" ON public.recognition_feed FOR INSERT WITH CHECK (TRUE); -- inserted by triggers/functions

-- AUDIT LOG: only perm_view_audit_log
CREATE POLICY "audit_select" ON public.audit_log FOR SELECT USING ((get_my_profile()).perm_view_audit_log = TRUE);

-- STREAKS, PERSONAL BESTS, LEVELS: all can view
CREATE POLICY "streaks_select"   ON public.streaks          FOR SELECT USING (TRUE);
CREATE POLICY "levels_select"    ON public.user_levels       FOR SELECT USING (TRUE);
CREATE POLICY "pb_select"        ON public.personal_bests    FOR SELECT USING (TRUE);
CREATE POLICY "rivalries_select" ON public.rivalries         FOR SELECT USING (user_a_id = auth.uid() OR user_b_id = auth.uid() OR (get_my_profile()).perm_view_all_scorecards = TRUE);
CREATE POLICY "snapshots_select" ON public.monthly_snapshots FOR SELECT USING (user_id = auth.uid() OR (get_my_profile()).perm_view_all_scorecards = TRUE);
CREATE POLICY "feedback_select"  ON public.client_feedback   FOR SELECT USING (user_id = auth.uid() OR (get_my_profile()).perm_view_all_scorecards = TRUE);
CREATE POLICY "feedback_insert"  ON public.client_feedback   FOR INSERT WITH CHECK (entered_by = auth.uid() OR (get_my_profile()).perm_enter_data = TRUE);

-- ============================================================
-- USEFUL VIEWS
-- ============================================================

-- Current month leaderboard (all 7 competitions)
CREATE VIEW public.v_current_month_leaderboard AS
WITH month_data AS (
  SELECT
    u.id, u.full_name, u.avatar_url, u.team,
    ul.current_level,
    s.current_streak,
    s.streak_at_risk,
    -- Aggregate month-to-date
    COALESCE(SUM(de.mt_brought), 0) AS total_mt,
    COALESCE(SUM(de.inquiries_in_mt), 0) AS total_inquiries,
    COALESCE(SUM(de.new_clients), 0) AS total_new_clients,
    COALESCE(SUM(de.revenue_rs_cr), 0) AS total_revenue,
    COALESCE(AVG(NULLIF(de.avg_closing_price, 0)), 0) AS avg_closing_price,
    COALESCE(AVG(NULLIF(de.inquiry_to_quote_hours, 0)), 0) AS avg_tat,
    COALESCE(SUM(de.retention_count)::FLOAT / NULLIF(SUM(de.total_clients), 0) * 100, 0) AS retention_rate
  FROM public.profiles u
  LEFT JOIN public.daily_entries de ON de.user_id = u.id
    AND DATE_TRUNC('month', de.entry_date) = DATE_TRUNC('month', CURRENT_DATE)
  LEFT JOIN public.user_levels ul ON ul.user_id = u.id
  LEFT JOIN public.streaks s ON s.user_id = u.id
  WHERE u.is_active = TRUE
  GROUP BY u.id, u.full_name, u.avatar_url, u.team, ul.current_level, s.current_streak, s.streak_at_risk
)
SELECT *,
  RANK() OVER (ORDER BY total_mt DESC) AS rank_mt,
  RANK() OVER (ORDER BY avg_closing_price DESC) AS rank_closing_price,
  RANK() OVER (ORDER BY total_new_clients DESC) AS rank_new_clients,
  RANK() OVER (ORDER BY retention_rate DESC) AS rank_retention,
  RANK() OVER (ORDER BY total_inquiries DESC) AS rank_inquiries,
  RANK() OVER (ORDER BY avg_tat ASC NULLS LAST) AS rank_tat
FROM month_data;

-- Team MTD/QTD/YTD summary
CREATE VIEW public.v_team_summary AS
SELECT
  SUM(mt_brought) FILTER (WHERE DATE_TRUNC('month', entry_date) = DATE_TRUNC('month', CURRENT_DATE)) AS mtd_mt,
  SUM(mt_brought) FILTER (WHERE DATE_TRUNC('quarter', entry_date) = DATE_TRUNC('quarter', CURRENT_DATE)) AS qtd_mt,
  SUM(mt_brought) FILTER (WHERE DATE_TRUNC('year', entry_date) = DATE_TRUNC('year', CURRENT_DATE)) AS ytd_mt,
  SUM(revenue_rs_cr) FILTER (WHERE DATE_TRUNC('month', entry_date) = DATE_TRUNC('month', CURRENT_DATE)) AS mtd_revenue,
  SUM(revenue_rs_cr) FILTER (WHERE DATE_TRUNC('quarter', entry_date) = DATE_TRUNC('quarter', CURRENT_DATE)) AS qtd_revenue,
  SUM(revenue_rs_cr) FILTER (WHERE DATE_TRUNC('year', entry_date) = DATE_TRUNC('year', CURRENT_DATE)) AS ytd_revenue,
  COUNT(*) FILTER (WHERE DATE_TRUNC('month', entry_date) = DATE_TRUNC('month', CURRENT_DATE)) AS mtd_orders
FROM public.daily_entries;

-- ============================================================
-- SEED: Initial superadmin setup instructions
-- After running this schema, create your first user via
-- Supabase Auth dashboard, then run:
--
-- INSERT INTO public.profiles (id, full_name, email, role)
-- VALUES ('<auth-user-uuid>', 'Spriha', 'your@email.com', 'superadmin');
-- ============================================================
