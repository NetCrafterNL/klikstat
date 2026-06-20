-- ─── UTM columns on events ────────────────────────────────────────────────
ALTER TABLE events ADD COLUMN IF NOT EXISTS utm_source   TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS utm_medium   TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

CREATE INDEX IF NOT EXISTS idx_events_utm ON events (site_id, utm_campaign) WHERE utm_campaign IS NOT NULL;

-- ─── Goals table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id    UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  event      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_owner" ON goals
  USING  (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()))
  WITH CHECK (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

-- ─── Public sharing on sites ──────────────────────────────────────────────
ALTER TABLE sites ADD COLUMN IF NOT EXISTS public_token UUID DEFAULT gen_random_uuid();
ALTER TABLE sites ADD COLUMN IF NOT EXISTS is_public    BOOLEAN DEFAULT false;

-- ─── get_technology RPC ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_technology(p_site_id UUID, p_days INT DEFAULT 30)
RETURNS JSONB LANGUAGE SQL SECURITY INVOKER VOLATILE AS $$
  SELECT jsonb_build_object(
    'devices',
      (SELECT jsonb_agg(r) FROM (
        SELECT device AS name, COUNT(DISTINCT session_id) AS count
        FROM events WHERE site_id=p_site_id AND device IS NOT NULL
          AND timestamp >= now()-(p_days||' days')::INTERVAL
        GROUP BY 1 ORDER BY 2 DESC
      ) r),
    'browsers',
      (SELECT jsonb_agg(r) FROM (
        SELECT browser AS name, COUNT(DISTINCT session_id) AS count
        FROM events WHERE site_id=p_site_id AND browser IS NOT NULL
          AND timestamp >= now()-(p_days||' days')::INTERVAL
        GROUP BY 1 ORDER BY 2 DESC
      ) r),
    'os',
      (SELECT jsonb_agg(r) FROM (
        SELECT os AS name, COUNT(DISTINCT session_id) AS count
        FROM events WHERE site_id=p_site_id AND os IS NOT NULL
          AND timestamp >= now()-(p_days||' days')::INTERVAL
        GROUP BY 1 ORDER BY 2 DESC
      ) r)
  )
$$;

-- ─── get_campaigns RPC ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_campaigns(p_site_id UUID, p_days INT DEFAULT 30)
RETURNS JSONB LANGUAGE SQL SECURITY INVOKER VOLATILE AS $$
  SELECT jsonb_agg(r ORDER BY r.visitors DESC)
  FROM (
    SELECT
      COALESCE(NULLIF(utm_campaign,''), '(not set)') AS campaign,
      COALESCE(NULLIF(utm_source,''),   '(not set)') AS source,
      COALESCE(NULLIF(utm_medium,''),   '(not set)') AS medium,
      COUNT(DISTINCT session_id) AS visitors,
      COUNT(*)                   AS pageviews
    FROM events
    WHERE site_id = p_site_id
      AND utm_campaign IS NOT NULL AND utm_campaign != ''
      AND timestamp >= now()-(p_days||' days')::INTERVAL
    GROUP BY 1,2,3
    ORDER BY visitors DESC
    LIMIT 100
  ) r
$$;

-- ─── get_goals_data RPC ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_goals_data(p_site_id UUID, p_days INT DEFAULT 30)
RETURNS JSONB LANGUAGE SQL SECURITY INVOKER VOLATILE AS $$
  SELECT jsonb_agg(r ORDER BY r.completions DESC)
  FROM (
    SELECT
      g.id,
      g.name,
      g.event,
      COUNT(e.id)                   AS completions,
      COUNT(DISTINCT e.session_id)  AS unique_completions,
      ROUND(
        COUNT(DISTINCT e.session_id)::NUMERIC
          / NULLIF((SELECT COUNT(DISTINCT session_id) FROM events WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL),0)
          * 100, 2
      ) AS conversion_rate
    FROM goals g
    LEFT JOIN events e
      ON e.site_id = g.site_id
      AND e.type = g.event
      AND e.timestamp >= now()-(p_days||' days')::INTERVAL
    WHERE g.site_id = p_site_id
    GROUP BY g.id, g.name, g.event
  ) r
$$;

-- ─── get_site_stats_public (no RLS — called with service key) ─────────────
-- Used by the public share endpoint; identical to get_site_stats but SECURITY DEFINER
CREATE OR REPLACE FUNCTION get_site_stats_public(p_site_id UUID, p_days INT DEFAULT 30)
RETURNS JSONB LANGUAGE SQL SECURITY DEFINER VOLATILE AS $$
  SELECT jsonb_build_object(
    'visitors',    (SELECT COUNT(DISTINCT session_id) FROM events WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL),
    'pageviews',   (SELECT COUNT(*) FROM events WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL),
    'bounceRate',  COALESCE((SELECT AVG(CASE WHEN bounced THEN 100.0 ELSE 0.0 END) FROM sessions WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL),0),
    'avgDuration', COALESCE((SELECT AVG(duration) FROM sessions WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL AND pageviews>1 AND duration>0),0),
    'goals',       (SELECT COUNT(*) FROM events WHERE site_id=p_site_id AND type!='pageview' AND timestamp>=now()-(p_days||' days')::INTERVAL),
    'chart',       (SELECT jsonb_agg(r ORDER BY r.day) FROM (SELECT date_trunc('day',timestamp)::DATE::TEXT AS day, COUNT(DISTINCT session_id) AS v FROM events WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL GROUP BY 1) r),
    'topPages',    (SELECT jsonb_agg(r) FROM (SELECT pathname, COUNT(*) AS count FROM events WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL GROUP BY pathname ORDER BY count DESC LIMIT 10) r),
    'locations',   (SELECT jsonb_agg(r) FROM (SELECT country, COUNT(DISTINCT session_id) AS count FROM events WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL AND country IS NOT NULL GROUP BY country ORDER BY count DESC LIMIT 10) r),
    'channels',    (SELECT jsonb_agg(r) FROM (SELECT CASE WHEN referrer IS NULL OR referrer='' THEN 'Direct' WHEN referrer~*'(google\.|bing\.|duckduckgo\.|yahoo\.|baidu\.)' THEN 'Search' WHEN referrer~*'(facebook\.|twitter\.|x\.com|linkedin\.|reddit\.|instagram\.|tiktok\.|youtube\.)' THEN 'Social' ELSE 'Referral' END AS name, COUNT(*) AS count FROM events WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL GROUP BY 1 ORDER BY 2 DESC) r)
  )
$$;
