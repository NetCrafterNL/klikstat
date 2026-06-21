-- ─── 1. get_site_stats: hourly chart for 1-day range ─────────────────────
CREATE OR REPLACE FUNCTION get_site_stats(p_site_id UUID, p_days INT DEFAULT 30)
RETURNS JSONB LANGUAGE SQL SECURITY INVOKER STABLE AS $$
  SELECT jsonb_build_object(
    'visitors',    (SELECT COUNT(DISTINCT session_id) FROM events WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL),
    'pageviews',   (SELECT COUNT(*) FROM events WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL),
    'bounceRate',  COALESCE((SELECT AVG(CASE WHEN bounced THEN 100.0 ELSE 0.0 END) FROM sessions WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL),0),
    'avgDuration', COALESCE((SELECT AVG(duration) FROM sessions WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL AND pageviews>1 AND duration>0),0),
    'goals',       (SELECT COUNT(*) FROM events WHERE site_id=p_site_id AND type!='pageview' AND timestamp>=now()-(p_days||' days')::INTERVAL),
    'chart', CASE WHEN p_days = 1 THEN
      (SELECT jsonb_agg(r ORDER BY r.day) FROM (
        SELECT to_char(date_trunc('hour', timestamp AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:00:00"Z"') AS day,
               COUNT(DISTINCT session_id) AS v
        FROM events WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL
        GROUP BY 1
      ) r)
    ELSE
      (SELECT jsonb_agg(r ORDER BY r.day) FROM (
        SELECT date_trunc('day',timestamp)::DATE::TEXT AS day, COUNT(DISTINCT session_id) AS v
        FROM events WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL
        GROUP BY 1
      ) r)
    END,
    'topPages',    (SELECT jsonb_agg(r) FROM (SELECT pathname, COUNT(*) AS count FROM events WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL GROUP BY pathname ORDER BY count DESC LIMIT 10) r),
    'locations',   (SELECT jsonb_agg(r) FROM (SELECT country, COUNT(DISTINCT session_id) AS count FROM events WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL AND country IS NOT NULL GROUP BY country ORDER BY count DESC LIMIT 10) r),
    'channels',    (SELECT jsonb_agg(r) FROM (SELECT CASE WHEN referrer IS NULL OR referrer='' THEN 'Direct' WHEN referrer~*'(google\.|bing\.|duckduckgo\.|yahoo\.|baidu\.|ecosia\.|yandex\.)' THEN 'Search' WHEN referrer~*'(facebook\.|twitter\.|x\.com|linkedin\.|reddit\.|instagram\.|tiktok\.|youtube\.)' THEN 'Social' ELSE 'Referral' END AS name, COUNT(*) AS count FROM events WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL GROUP BY 1 ORDER BY 2 DESC) r)
  )
$$;

-- ─── 2. get_comparison_stats: previous period for trend badges ────────────
CREATE OR REPLACE FUNCTION get_comparison_stats(p_site_id UUID, p_days INT DEFAULT 30)
RETURNS JSONB LANGUAGE SQL SECURITY INVOKER STABLE AS $$
  SELECT jsonb_build_object(
    'visitors',
      (SELECT COUNT(DISTINCT session_id) FROM events WHERE site_id=p_site_id
         AND timestamp >= now()-(p_days*2||' days')::INTERVAL
         AND timestamp <  now()-(p_days||' days')::INTERVAL),
    'pageviews',
      (SELECT COUNT(*) FROM events WHERE site_id=p_site_id
         AND timestamp >= now()-(p_days*2||' days')::INTERVAL
         AND timestamp <  now()-(p_days||' days')::INTERVAL),
    'bounceRate',
      COALESCE((SELECT AVG(CASE WHEN bounced THEN 100.0 ELSE 0.0 END) FROM sessions WHERE site_id=p_site_id
         AND timestamp >= now()-(p_days*2||' days')::INTERVAL
         AND timestamp <  now()-(p_days||' days')::INTERVAL), 0),
    'avgDuration',
      COALESCE((SELECT AVG(duration) FROM sessions WHERE site_id=p_site_id
         AND timestamp >= now()-(p_days*2||' days')::INTERVAL
         AND timestamp <  now()-(p_days||' days')::INTERVAL
         AND pageviews>1 AND duration>0), 0),
    'goals',
      (SELECT COUNT(*) FROM events WHERE site_id=p_site_id AND type!='pageview'
         AND timestamp >= now()-(p_days*2||' days')::INTERVAL
         AND timestamp <  now()-(p_days||' days')::INTERVAL)
  )
$$;

-- ─── 3. get_entry_exit_pages ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_entry_exit_pages(p_site_id UUID, p_days INT DEFAULT 30)
RETURNS JSONB LANGUAGE SQL SECURITY INVOKER STABLE AS $$
  SELECT jsonb_build_object(
    'entry',
      (SELECT jsonb_agg(r) FROM (
        SELECT entry_page AS pathname,
               COUNT(*)   AS sessions,
               ROUND(AVG(CASE WHEN bounced THEN 100.0 ELSE 0.0 END)::NUMERIC, 1) AS bounce_rate
        FROM sessions
        WHERE site_id=p_site_id AND entry_page IS NOT NULL
          AND timestamp >= now()-(p_days||' days')::INTERVAL
        GROUP BY entry_page ORDER BY sessions DESC LIMIT 100
      ) r),
    'exit',
      (SELECT jsonb_agg(r) FROM (
        SELECT e.pathname,
               COUNT(DISTINCT e.session_id) AS sessions
        FROM events e
        INNER JOIN (
          SELECT session_id, MAX(timestamp) AS last_ts
          FROM events
          WHERE site_id=p_site_id
            AND timestamp >= now()-(p_days||' days')::INTERVAL
          GROUP BY session_id
        ) last_ev ON last_ev.session_id = e.session_id AND last_ev.last_ts = e.timestamp
        WHERE e.site_id=p_site_id
        GROUP BY e.pathname ORDER BY sessions DESC LIMIT 100
      ) r)
  )
$$;
