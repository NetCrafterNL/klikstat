-- Sites (each website the user wants to track)
CREATE TABLE sites (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  domain     TEXT NOT NULL,
  token      UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sessions: privacy-first, no cookies.
-- ID = daily SHA-256(IP + UA + date + token) — resets each UTC day.
CREATE TABLE sessions (
  id         TEXT        PRIMARY KEY,
  site_id    UUID        NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  country    TEXT,
  browser    TEXT,
  os         TEXT,
  device     TEXT,
  referrer   TEXT,
  entry_page TEXT,
  pageviews  INT         NOT NULL DEFAULT 1,
  duration   INT         NOT NULL DEFAULT 0,  -- seconds
  bounced    BOOLEAN     NOT NULL DEFAULT true,
  timestamp  TIMESTAMPTZ NOT NULL,
  last_seen  TIMESTAMPTZ NOT NULL
);

-- Events (one row per pageview or custom event)
CREATE TABLE events (
  id         BIGSERIAL   PRIMARY KEY,
  site_id    UUID        NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  session_id TEXT        NOT NULL,
  type       TEXT        NOT NULL DEFAULT 'pageview',
  pathname   TEXT        NOT NULL,
  referrer   TEXT,
  country    TEXT,
  browser    TEXT,
  os         TEXT,
  device     TEXT,
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON events   (site_id, timestamp);
CREATE INDEX ON sessions (site_id, timestamp);

-- Row Level Security
ALTER TABLE sites    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sites_owner"    ON sites    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "sessions_owner" ON sessions USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));
CREATE POLICY "events_owner"   ON events   USING (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: get_site_stats(p_site_id, p_days)
-- Returns a single JSONB with all dashboard metrics.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_site_stats(p_site_id UUID, p_days INT DEFAULT 30)
RETURNS JSONB
LANGUAGE SQL
SECURITY INVOKER
STABLE
AS $$
  SELECT jsonb_build_object(
    'visitors',
      (SELECT COUNT(DISTINCT session_id)
       FROM events WHERE site_id = p_site_id
         AND timestamp >= now() - (p_days || ' days')::INTERVAL),

    'pageviews',
      (SELECT COUNT(*)
       FROM events WHERE site_id = p_site_id
         AND timestamp >= now() - (p_days || ' days')::INTERVAL),

    'bounceRate',
      COALESCE(
        (SELECT AVG(CASE WHEN bounced THEN 100.0 ELSE 0.0 END)
         FROM sessions WHERE site_id = p_site_id
           AND timestamp >= now() - (p_days || ' days')::INTERVAL),
        0
      ),

    'avgDuration',
      COALESCE(
        (SELECT AVG(duration)
         FROM sessions WHERE site_id = p_site_id
           AND timestamp >= now() - (p_days || ' days')::INTERVAL
           AND pageviews > 1 AND duration > 0),
        0
      ),

    'chart',
      (SELECT jsonb_agg(r ORDER BY r.day)
       FROM (
         SELECT date_trunc('day', timestamp)::DATE::TEXT AS day,
                COUNT(DISTINCT session_id) AS v
         FROM events WHERE site_id = p_site_id
           AND timestamp >= now() - (p_days || ' days')::INTERVAL
         GROUP BY 1
       ) r),

    'topPages',
      (SELECT jsonb_agg(r)
       FROM (
         SELECT pathname, COUNT(*) AS count
         FROM events WHERE site_id = p_site_id
           AND timestamp >= now() - (p_days || ' days')::INTERVAL
         GROUP BY pathname ORDER BY count DESC LIMIT 10
       ) r),

    'locations',
      (SELECT jsonb_agg(r)
       FROM (
         SELECT country, COUNT(DISTINCT session_id) AS count
         FROM events WHERE site_id = p_site_id
           AND timestamp >= now() - (p_days || ' days')::INTERVAL
           AND country IS NOT NULL
         GROUP BY country ORDER BY count DESC LIMIT 10
       ) r),

    'channels',
      (SELECT jsonb_agg(r)
       FROM (
         SELECT
           CASE
             WHEN referrer IS NULL OR referrer = ''       THEN 'Direct'
             WHEN referrer ~* '(google\.|bing\.|duckduckgo\.|yahoo\.|baidu\.|ecosia\.|yandex\.)' THEN 'Search'
             WHEN referrer ~* '(facebook\.|twitter\.|x\.com|linkedin\.|reddit\.|instagram\.|tiktok\.|youtube\.)' THEN 'Social'
             ELSE 'Referral'
           END AS name,
           COUNT(*) AS count
         FROM events WHERE site_id = p_site_id
           AND timestamp >= now() - (p_days || ' days')::INTERVAL
         GROUP BY 1 ORDER BY 2 DESC
       ) r)
  )
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: get_realtime(p_site_id)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_realtime(p_site_id UUID)
RETURNS JSONB
LANGUAGE SQL
SECURITY INVOKER
STABLE
AS $$
  SELECT jsonb_build_object(
    'onlineNow',
      (SELECT COUNT(DISTINCT session_id)
       FROM events WHERE site_id = p_site_id
         AND timestamp >= now() - INTERVAL '5 minutes'),

    'activePages',
      (SELECT jsonb_agg(r)
       FROM (
         SELECT pathname, COUNT(DISTINCT session_id) AS count
         FROM events WHERE site_id = p_site_id
           AND timestamp >= now() - INTERVAL '5 minutes'
         GROUP BY pathname ORDER BY count DESC LIMIT 10
       ) r),

    'liveEvents',
      (SELECT jsonb_agg(r)
       FROM (
         SELECT country, pathname, referrer,
                EXTRACT(EPOCH FROM timestamp)::BIGINT AS ts
         FROM events WHERE site_id = p_site_id
         ORDER BY timestamp DESC LIMIT 20
       ) r),

    'histogram',
      (SELECT jsonb_agg(r ORDER BY r.bucket)
       FROM (
         SELECT FLOOR(EXTRACT(EPOCH FROM (now() - timestamp)) / 60)::INT AS bucket,
                COUNT(*) AS count
         FROM events WHERE site_id = p_site_id
           AND timestamp >= now() - INTERVAL '30 minutes'
         GROUP BY 1
       ) r)
  )
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: generate_demo_data(p_site_id)
-- Fills the last 30 days with realistic fake analytics data.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_demo_data(p_site_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  pages     TEXT[]  := ARRAY['/','/pricing','/blog/launch-week','/docs','/signup','/about','/contact'];
  countries TEXT[]  := ARRAY['US','US','US','DE','GB','IN','CA','FR','AU','BR'];
  browsers  TEXT[]  := ARRAY['Chrome','Firefox','Safari','Edge'];
  oses      TEXT[]  := ARRAY['Windows','macOS','Linux','iOS','Android'];
  devices   TEXT[]  := ARRAY['Desktop','Desktop','Desktop','Mobile','Tablet'];
  refs      TEXT[]  := ARRAY['','','https://google.com','https://twitter.com','https://reddit.com','https://github.com'];
  day_off   INT;
  vis_count INT;
  v         INT;
  s_id      TEXT;
  e_ts      TIMESTAMPTZ;
  pvs       INT;
  p         INT;
BEGIN
  FOR day_off IN 0..29 LOOP
    vis_count := 100 + (random() * 600)::INT;
    FOR v IN 1..vis_count LOOP
      s_id  := md5(p_site_id::TEXT || day_off::TEXT || v::TEXT);
      e_ts  := (now() - (day_off || ' days')::INTERVAL) - (random() * INTERVAL '12 hours');
      pvs   := 1 + (random() * 4)::INT;

      INSERT INTO sessions VALUES (
        s_id, p_site_id,
        countries[1 + (random() * (array_length(countries,1)-1))::INT],
        browsers [1 + (random() * (array_length(browsers ,1)-1))::INT],
        oses     [1 + (random() * (array_length(oses     ,1)-1))::INT],
        devices  [1 + (random() * (array_length(devices  ,1)-1))::INT],
        refs     [1 + (random() * (array_length(refs     ,1)-1))::INT],
        pages    [1 + (random() * (array_length(pages    ,1)-1))::INT],
        pvs, pvs * 60, pvs = 1, e_ts, e_ts + (pvs * 60 || ' seconds')::INTERVAL
      ) ON CONFLICT (id) DO NOTHING;

      FOR p IN 1..pvs LOOP
        INSERT INTO events (site_id, session_id, type, pathname, referrer, country, browser, os, device, timestamp)
        VALUES (
          p_site_id, s_id, 'pageview',
          pages    [1 + (random() * (array_length(pages    ,1)-1))::INT],
          refs     [1 + (random() * (array_length(refs     ,1)-1))::INT],
          countries[1 + (random() * (array_length(countries,1)-1))::INT],
          browsers [1 + (random() * (array_length(browsers ,1)-1))::INT],
          oses     [1 + (random() * (array_length(oses     ,1)-1))::INT],
          devices  [1 + (random() * (array_length(devices  ,1)-1))::INT],
          e_ts + (p * INTERVAL '1 minute')
        );
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;
