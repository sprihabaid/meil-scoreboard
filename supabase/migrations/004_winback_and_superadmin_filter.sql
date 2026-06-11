-- ============================================================
-- Migration 004: winback_clients column + superadmin exclusion
-- ============================================================
-- 1. Adds winback_clients to daily_entries for Win-Back Champion award
-- 2. Recreates v_current_month_leaderboard to:
--    a) exclude superadmins from all rankings
--    b) surface total_winback_clients and rank_winback
-- ============================================================

ALTER TABLE public.daily_entries
  ADD COLUMN IF NOT EXISTS winback_clients INTEGER DEFAULT 0;

-- Recreate view: superadmins excluded, winback added
CREATE OR REPLACE VIEW public.v_current_month_leaderboard AS
WITH month_data AS (
  SELECT
    u.id, u.full_name, u.avatar_url, u.team,
    ul.current_level,
    s.current_streak,
    s.streak_at_risk,
    COALESCE(SUM(de.mt_brought), 0)                                                   AS total_mt,
    COALESCE(SUM(de.inquiries_in_mt), 0)                                              AS total_inquiries,
    COALESCE(SUM(de.new_clients), 0)                                                  AS total_new_clients,
    COALESCE(SUM(de.winback_clients), 0)                                              AS total_winback_clients,
    COALESCE(SUM(de.revenue_rs_cr), 0)                                                AS total_revenue,
    COALESCE(AVG(NULLIF(de.avg_closing_price, 0)), 0)                                 AS avg_closing_price,
    COALESCE(AVG(NULLIF(de.inquiry_to_quote_hours, 0)), 0)                            AS avg_tat,
    COALESCE(
      SUM(de.retention_count)::FLOAT / NULLIF(SUM(de.total_clients), 0) * 100,
      0
    ) AS retention_rate
  FROM public.profiles u
  LEFT JOIN public.daily_entries de
    ON de.user_id = u.id
    AND DATE_TRUNC('month', de.entry_date) = DATE_TRUNC('month', CURRENT_DATE)
  LEFT JOIN public.user_levels ul ON ul.user_id = u.id
  LEFT JOIN public.streaks s ON s.user_id = u.id
  WHERE u.is_active = TRUE
    AND u.role != 'superadmin'
  GROUP BY u.id, u.full_name, u.avatar_url, u.team, ul.current_level, s.current_streak, s.streak_at_risk
)
SELECT *,
  RANK() OVER (ORDER BY total_mt DESC)              AS rank_mt,
  RANK() OVER (ORDER BY avg_closing_price DESC)      AS rank_closing_price,
  RANK() OVER (ORDER BY total_new_clients DESC)      AS rank_new_clients,
  RANK() OVER (ORDER BY total_winback_clients DESC)  AS rank_winback,
  RANK() OVER (ORDER BY retention_rate DESC)         AS rank_retention,
  RANK() OVER (ORDER BY total_inquiries DESC)        AS rank_inquiries,
  RANK() OVER (ORDER BY avg_tat ASC NULLS LAST)      AS rank_tat
FROM month_data;
