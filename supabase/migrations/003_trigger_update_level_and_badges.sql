-- ============================================================
-- Migration 003: sync user_levels and auto-award badges
-- after every INSERT or UPDATE on daily_entries
-- ============================================================
--
-- Covers:
--   • user_levels  — recalculate all-time MT, set current level
--   • recognition_feed — fire a level-up event on upgrade
--   • earned_badges / personal_bests — award century_club,
--     hat_trick, and personal_best badges
--
-- Badges that require cross-user comparison (king_of_mt,
-- premium_closer, market_opener, etc.) are NOT auto-awarded
-- here — they are declared manually via Hall of Fame.
-- Badges requiring KRA data (streak_shield, iron_consistency)
-- are handled by the KRA approval flow.
-- ============================================================

CREATE OR REPLACE FUNCTION sync_user_level_and_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER   -- needed: user_levels has no INSERT/UPDATE RLS policy
AS $$
DECLARE
  v_alltime_mt     NUMERIC;
  v_mtd_mt         NUMERIC;
  v_weekly_clients INTEGER;
  v_new_level      level_name;
  v_old_level      level_name;
  v_old_level_min  NUMERIC;
  v_new_level_min  NUMERIC;
  v_prev_pb        NUMERIC;
  v_first_of_month DATE;
  v_first_of_week  DATE;
  v_week_num       INTEGER;
BEGIN
  v_first_of_month := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  v_first_of_week  := DATE_TRUNC('week',  CURRENT_DATE)::DATE;  -- Monday
  v_week_num       := EXTRACT(WEEK FROM CURRENT_DATE)::INTEGER;

  -- ── 1. All-time MT total (basis for level) ─────────────────────────────────
  SELECT COALESCE(SUM(mt_brought), 0)
  INTO   v_alltime_mt
  FROM   public.daily_entries
  WHERE  user_id = NEW.user_id;

  -- ── 2. Determine new level ─────────────────────────────────────────────────
  SELECT level
  INTO   v_new_level
  FROM   public.level_thresholds
  WHERE  min_mt_required <= v_alltime_mt
  ORDER  BY min_mt_required DESC
  LIMIT  1;

  IF v_new_level IS NULL THEN
    v_new_level := 'Trainee';
  END IF;

  -- ── 3. Read existing level before we overwrite it ──────────────────────────
  SELECT current_level
  INTO   v_old_level
  FROM   public.user_levels
  WHERE  user_id = NEW.user_id;

  -- ── 4. Upsert user_levels ──────────────────────────────────────────────────
  INSERT INTO public.user_levels (user_id, current_level, total_mt_all_time, updated_at)
  VALUES (NEW.user_id, v_new_level, v_alltime_mt, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET current_level     = EXCLUDED.current_level,
        total_mt_all_time = EXCLUDED.total_mt_all_time,
        updated_at        = NOW();

  -- ── 5. Recognition event on level upgrade ──────────────────────────────────
  -- Only fire when the new level is strictly higher than the old one.
  -- Compare via the thresholds table to avoid hard-coding enum order.
  IF v_old_level IS NOT NULL AND v_new_level IS DISTINCT FROM v_old_level THEN
    SELECT min_mt_required INTO v_old_level_min
    FROM public.level_thresholds WHERE level = v_old_level;

    SELECT min_mt_required INTO v_new_level_min
    FROM public.level_thresholds WHERE level = v_new_level;

    IF v_new_level_min > v_old_level_min THEN
      INSERT INTO public.recognition_feed
        (user_id, event_type, emoji, event_title, event_body)
      VALUES (
        NEW.user_id,
        'level_up',
        CASE v_new_level
          WHEN 'Hustler' THEN '⚡'
          WHEN 'Closer'  THEN '🔥'
          WHEN 'Elite'   THEN '💎'
          WHEN 'Legend'  THEN '👑'
          ELSE '🌱'
        END,
        'levelled up to ' || v_new_level || '!',
        'All-time MT reached ' || v_alltime_mt || ' — ' || v_new_level || ' status unlocked.'
      );
    END IF;
  END IF;

  -- ══════════════════════════════════════════════════════════════════════════
  -- BADGE: century_club — MTD MT >= 100, once per calendar month
  -- ══════════════════════════════════════════════════════════════════════════
  SELECT COALESCE(SUM(mt_brought), 0)
  INTO   v_mtd_mt
  FROM   public.daily_entries
  WHERE  user_id    = NEW.user_id
    AND  entry_date >= v_first_of_month;

  IF v_mtd_mt >= 100 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.earned_badges
      WHERE  user_id        = NEW.user_id
        AND  badge_category = 'century_club'
        AND  month          = v_first_of_month
    ) THEN
      INSERT INTO public.earned_badges
        (user_id, badge_category, earned_date, month)
      VALUES
        (NEW.user_id, 'century_club', CURRENT_DATE, v_first_of_month);

      INSERT INTO public.recognition_feed
        (user_id, event_type, emoji, event_title, event_body)
      VALUES (
        NEW.user_id, 'badge_earned', '💯',
        'crossed 100 MT this month!',
        'Month-to-date total: ' || ROUND(v_mtd_mt, 1) || ' MT. Century Club badge earned.'
      );
    END IF;
  END IF;

  -- ══════════════════════════════════════════════════════════════════════════
  -- BADGE: hat_trick — 3+ new clients in a calendar week, once per week
  -- Uses week_number + year to deduplicate across weeks.
  -- ══════════════════════════════════════════════════════════════════════════
  IF NEW.new_clients > 0 THEN
    SELECT COALESCE(SUM(new_clients), 0)
    INTO   v_weekly_clients
    FROM   public.daily_entries
    WHERE  user_id    = NEW.user_id
      AND  entry_date >= v_first_of_week;

    IF v_weekly_clients >= 3 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.earned_badges
        WHERE  user_id        = NEW.user_id
          AND  badge_category = 'hat_trick'
          AND  week_number    = v_week_num
          AND  EXTRACT(YEAR FROM earned_date) = EXTRACT(YEAR FROM CURRENT_DATE)
      ) THEN
        INSERT INTO public.earned_badges
          (user_id, badge_category, earned_date, week_number)
        VALUES
          (NEW.user_id, 'hat_trick', CURRENT_DATE, v_week_num);

        INSERT INTO public.recognition_feed
          (user_id, event_type, emoji, event_title, event_body)
        VALUES (
          NEW.user_id, 'badge_earned', '🎯',
          'earned the Hat Trick badge!',
          v_weekly_clients || ' new clients this week — hat trick unlocked.'
        );
      END IF;
    END IF;
  END IF;

  -- ══════════════════════════════════════════════════════════════════════════
  -- BADGE: personal_best — new daily MT high, once per calendar month
  -- Also upserts personal_bests so the record stays current.
  -- ══════════════════════════════════════════════════════════════════════════
  IF NEW.mt_brought > 0 THEN
    SELECT COALESCE(best_value, 0)
    INTO   v_prev_pb
    FROM   public.personal_bests
    WHERE  user_id     = NEW.user_id
      AND  metric_name = 'mt_brought'
      AND  period      = 'daily';

    IF NEW.mt_brought > v_prev_pb THEN
      -- Update the record
      INSERT INTO public.personal_bests
        (user_id, metric_name, best_value, achieved_date, period, updated_at)
      VALUES
        (NEW.user_id, 'mt_brought', NEW.mt_brought, NEW.entry_date, 'daily', NOW())
      ON CONFLICT (user_id, metric_name, period) DO UPDATE
        SET best_value    = EXCLUDED.best_value,
            achieved_date = EXCLUDED.achieved_date,
            updated_at    = NOW();

      -- Award badge once per month to avoid flooding
      IF NOT EXISTS (
        SELECT 1 FROM public.earned_badges
        WHERE  user_id        = NEW.user_id
          AND  badge_category = 'personal_best'
          AND  month          = v_first_of_month
      ) THEN
        INSERT INTO public.earned_badges
          (user_id, badge_category, earned_date, month)
        VALUES
          (NEW.user_id, 'personal_best', CURRENT_DATE, v_first_of_month);
      END IF;

      -- Always fire a feed event for the new record (feed auto-expires in 7 days)
      INSERT INTO public.recognition_feed
        (user_id, event_type, emoji, event_title, event_body)
      VALUES (
        NEW.user_id, 'personal_best', '🏆',
        'set a new personal best!',
        NEW.mt_brought || ' MT brought in a single day — a new record.'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop old trigger if re-running this migration
DROP TRIGGER IF EXISTS on_daily_entry_sync_level ON public.daily_entries;

CREATE TRIGGER on_daily_entry_sync_level
  AFTER INSERT OR UPDATE ON public.daily_entries
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_level_and_badges();
