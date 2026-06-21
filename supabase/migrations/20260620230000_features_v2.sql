-- ─── City-level geo ────────────────────────────────────────────────────────
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE events   ADD COLUMN IF NOT EXISTS city TEXT;
CREATE INDEX IF NOT EXISTS idx_events_city ON events (site_id, city) WHERE city IS NOT NULL;

-- ─── Revenue + event properties ───────────────────────────────────────────
ALTER TABLE events ADD COLUMN IF NOT EXISTS revenue NUMERIC(12,2);
ALTER TABLE events ADD COLUMN IF NOT EXISTS props   JSONB;
CREATE INDEX IF NOT EXISTS idx_events_revenue ON events (site_id) WHERE revenue IS NOT NULL;

-- ─── Annotations ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS annotations (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id    UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  label      TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#5B4BE8',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "annotations_owner" ON annotations
  USING  (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()))
  WITH CHECK (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

-- ─── API keys ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id    UUID REFERENCES sites(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  key_hash   TEXT NOT NULL UNIQUE,
  last_used  TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_keys_owner" ON api_keys
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── Email report subscriptions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_subscriptions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id    UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  frequency  TEXT NOT NULL DEFAULT 'weekly',
  enabled    BOOLEAN NOT NULL DEFAULT true,
  last_sent  TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (site_id, user_id)
);
ALTER TABLE email_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_subs_owner" ON email_subscriptions
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── Alert subscriptions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  drop_pct    INT  NOT NULL DEFAULT 30,
  spike_pct   INT  NOT NULL DEFAULT 200,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  last_alerted TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (site_id, user_id)
);
ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alert_subs_owner" ON alert_subscriptions
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── Daily stats rollup ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_stats (
  site_id   UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  date      DATE NOT NULL,
  visitors  INT            NOT NULL DEFAULT 0,
  pageviews INT            NOT NULL DEFAULT 0,
  sessions  INT            NOT NULL DEFAULT 0,
  bounced   INT            NOT NULL DEFAULT 0,
  duration  BIGINT         NOT NULL DEFAULT 0,
  goals     INT            NOT NULL DEFAULT 0,
  revenue   NUMERIC(12,2)  NOT NULL DEFAULT 0,
  PRIMARY KEY (site_id, date)
);

CREATE OR REPLACE FUNCTION rollup_daily_stats(p_site_id UUID, p_date DATE DEFAULT CURRENT_DATE - 1)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO daily_stats (site_id, date, visitors, pageviews, sessions, bounced, duration, goals, revenue)
  SELECT
    p_site_id, p_date,
    COUNT(DISTINCT e.session_id),
    COUNT(e.id) FILTER (WHERE e.type = 'pageview'),
    COUNT(DISTINCT s.id),
    COUNT(s.id) FILTER (WHERE s.bounced),
    COALESCE(SUM(s.duration) FILTER (WHERE s.pageviews > 1), 0),
    COUNT(e.id) FILTER (WHERE e.type != 'pageview'),
    COALESCE(SUM(e.revenue) FILTER (WHERE e.revenue IS NOT NULL), 0)
  FROM events e
  LEFT JOIN sessions s ON s.id = e.session_id
  WHERE e.site_id = p_site_id AND e.timestamp::DATE = p_date
  ON CONFLICT (site_id, date) DO UPDATE SET
    visitors  = EXCLUDED.visitors, pageviews = EXCLUDED.pageviews,
    sessions  = EXCLUDED.sessions, bounced   = EXCLUDED.bounced,
    duration  = EXCLUDED.duration, goals     = EXCLUDED.goals,
    revenue   = EXCLUDED.revenue;
END;
$$;

-- Bulk rollup all sites yesterday (called by cron)
CREATE OR REPLACE FUNCTION rollup_all_sites_yesterday()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM sites LOOP
    PERFORM rollup_daily_stats(r.id, CURRENT_DATE - 1);
  END LOOP;
END;
$$;

-- ─── get_city_breakdown ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_city_breakdown(p_site_id UUID, p_days INT DEFAULT 30)
RETURNS JSONB LANGUAGE SQL SECURITY INVOKER STABLE AS $$
  SELECT jsonb_agg(r) FROM (
    SELECT city, country, COUNT(DISTINCT session_id) AS visitors
    FROM events
    WHERE site_id=p_site_id AND city IS NOT NULL AND city != ''
      AND timestamp >= now()-(p_days||' days')::INTERVAL
    GROUP BY city, country ORDER BY visitors DESC LIMIT 100
  ) r
$$;

-- ─── get_annotations ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_annotations(p_site_id UUID, p_days INT DEFAULT 30)
RETURNS JSONB LANGUAGE SQL SECURITY INVOKER STABLE AS $$
  SELECT jsonb_agg(r ORDER BY r.date)
  FROM (
    SELECT id::TEXT, date::TEXT, label, color
    FROM annotations
    WHERE site_id=p_site_id
      AND date >= (now()-(p_days||' days')::INTERVAL)::DATE
    ORDER BY date
  ) r
$$;

-- ─── get_revenue_stats ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_revenue_stats(p_site_id UUID, p_days INT DEFAULT 30)
RETURNS JSONB LANGUAGE SQL SECURITY INVOKER STABLE AS $$
  SELECT jsonb_build_object(
    'total',    COALESCE(SUM(revenue), 0),
    'count',    COUNT(*) FILTER (WHERE revenue IS NOT NULL AND revenue > 0),
    'avg',      COALESCE(AVG(revenue) FILTER (WHERE revenue IS NOT NULL AND revenue > 0), 0),
    'by_day',   (SELECT jsonb_agg(r ORDER BY r.day) FROM (
                  SELECT date_trunc('day',timestamp)::DATE::TEXT AS day,
                         COALESCE(SUM(revenue),0) AS rev,
                         COUNT(*) FILTER (WHERE revenue > 0) AS txns
                  FROM events WHERE site_id=p_site_id AND revenue IS NOT NULL
                    AND timestamp >= now()-(p_days||' days')::INTERVAL
                  GROUP BY 1
                ) r),
    'by_page',  (SELECT jsonb_agg(r) FROM (
                  SELECT pathname, SUM(revenue) AS rev, COUNT(*) AS txns
                  FROM events WHERE site_id=p_site_id AND revenue IS NOT NULL AND revenue > 0
                    AND timestamp >= now()-(p_days||' days')::INTERVAL
                  GROUP BY pathname ORDER BY rev DESC LIMIT 10
                ) r)
  )
  FROM events
  WHERE site_id=p_site_id AND type != 'pageview'
    AND timestamp >= now()-(p_days||' days')::INTERVAL
$$;

-- ─── get_retention ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_retention(p_site_id UUID, p_weeks INT DEFAULT 8)
RETURNS JSONB LANGUAGE SQL SECURITY INVOKER STABLE AS $$
  WITH cohorts AS (
    SELECT session_id,
           date_trunc('week', MIN(timestamp))::DATE AS cohort_week
    FROM events
    WHERE site_id=p_site_id
      AND timestamp >= now() - ((p_weeks+2)*7||' days')::INTERVAL
    GROUP BY session_id
  ),
  activity AS (
    SELECT DISTINCT e.session_id,
           date_trunc('week', e.timestamp)::DATE AS active_week
    FROM events e
    WHERE e.site_id=p_site_id
      AND e.timestamp >= now() - ((p_weeks+2)*7||' days')::INTERVAL
  ),
  grid AS (
    SELECT c.cohort_week,
           EXTRACT(EPOCH FROM (a.active_week::TIMESTAMPTZ - c.cohort_week::TIMESTAMPTZ))::INT / 604800 AS week_num,
           COUNT(DISTINCT c.session_id) AS retained
    FROM cohorts c JOIN activity a USING (session_id)
    GROUP BY c.cohort_week, week_num
  ),
  sizes AS (
    SELECT cohort_week, COUNT(*) AS total FROM cohorts GROUP BY cohort_week
  )
  SELECT jsonb_agg(row ORDER BY row.cohort_week)
  FROM (
    SELECT g.cohort_week::TEXT, sz.total AS cohort_size,
           jsonb_object_agg(g.week_num::TEXT, ROUND(g.retained::NUMERIC/sz.total*100,1)) AS weeks
    FROM grid g JOIN sizes sz USING (cohort_week)
    WHERE g.week_num >= 0 AND g.week_num <= p_weeks
    GROUP BY g.cohort_week, sz.total
  ) row
$$;

-- ─── get_aggregate_stats ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_aggregate_stats(p_days INT DEFAULT 30)
RETURNS JSONB LANGUAGE SQL SECURITY INVOKER STABLE AS $$
  SELECT jsonb_agg(r ORDER BY r.visitors DESC)
  FROM (
    SELECT s.id::TEXT AS site_id, s.name AS site_name, s.domain,
           COUNT(DISTINCT e.session_id)                                      AS visitors,
           COUNT(e.id) FILTER (WHERE e.type='pageview')                      AS pageviews,
           ROUND(COALESCE(AVG(CASE WHEN se.bounced THEN 100.0 ELSE 0.0 END),0)::NUMERIC,1) AS bounce_rate,
           COALESCE(SUM(e.revenue),0)                                        AS revenue
    FROM sites s
    LEFT JOIN events  e  ON e.site_id=s.id AND e.timestamp >= now()-(p_days||' days')::INTERVAL
    LEFT JOIN sessions se ON se.id=e.session_id
    WHERE s.user_id=auth.uid()
    GROUP BY s.id, s.name, s.domain
  ) r
$$;
