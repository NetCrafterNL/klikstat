-- get_pages: full page breakdown for the Pages screen
CREATE OR REPLACE FUNCTION get_pages(p_site_id UUID, p_days INT DEFAULT 30)
RETURNS JSONB
LANGUAGE SQL SECURITY INVOKER STABLE AS $$
  SELECT jsonb_agg(r ORDER BY r.pageviews DESC)
  FROM (
    SELECT
      e.pathname,
      COUNT(*)                     AS pageviews,
      COUNT(DISTINCT e.session_id) AS visitors,
      ROUND(AVG(CASE WHEN s.bounced THEN 100.0 ELSE 0.0 END)::NUMERIC, 1) AS bounce_rate,
      ROUND(AVG(CASE WHEN s.duration > 0 AND NOT s.bounced THEN s.duration ELSE NULL END)::NUMERIC, 0) AS avg_duration
    FROM events e
    JOIN sessions s ON s.id = e.session_id
    WHERE e.site_id = p_site_id
      AND e.timestamp >= now() - (p_days || ' days')::INTERVAL
    GROUP BY e.pathname
    ORDER BY pageviews DESC
    LIMIT 100
  ) r
$$;

-- get_sources: referrer domain breakdown for the Sources screen
CREATE OR REPLACE FUNCTION get_sources(p_site_id UUID, p_days INT DEFAULT 30)
RETURNS JSONB
LANGUAGE SQL SECURITY INVOKER STABLE AS $$
  SELECT jsonb_agg(r ORDER BY r.visitors DESC)
  FROM (
    SELECT
      CASE
        WHEN e.referrer IS NULL OR e.referrer = '' THEN 'Direct'
        ELSE regexp_replace(e.referrer, '^https?://(?:www\.)?([^/?#]+).*$', '\1')
      END AS source,
      CASE
        WHEN e.referrer IS NULL OR e.referrer = '' THEN 'Direct'
        WHEN e.referrer ~* '(google\.|bing\.|duckduckgo\.|yahoo\.|baidu\.|ecosia\.|yandex\.)' THEN 'Search'
        WHEN e.referrer ~* '(facebook\.|twitter\.|x\.com|linkedin\.|reddit\.|instagram\.|tiktok\.|youtube\.)' THEN 'Social'
        ELSE 'Referral'
      END AS channel,
      COUNT(DISTINCT e.session_id) AS visitors,
      COUNT(*)                     AS pageviews
    FROM events e
    WHERE e.site_id = p_site_id
      AND e.timestamp >= now() - (p_days || ' days')::INTERVAL
    GROUP BY 1, 2
    ORDER BY visitors DESC
    LIMIT 100
  ) r
$$;

-- Update get_site_stats to add goals count
CREATE OR REPLACE FUNCTION get_site_stats(p_site_id UUID, p_days INT DEFAULT 30)
RETURNS JSONB LANGUAGE SQL SECURITY INVOKER STABLE AS $$
  SELECT jsonb_build_object(
    'visitors',    (SELECT COUNT(DISTINCT session_id) FROM events WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL),
    'pageviews',   (SELECT COUNT(*) FROM events WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL),
    'bounceRate',  COALESCE((SELECT AVG(CASE WHEN bounced THEN 100.0 ELSE 0.0 END) FROM sessions WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL),0),
    'avgDuration', COALESCE((SELECT AVG(duration) FROM sessions WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL AND pageviews>1 AND duration>0),0),
    'goals',       (SELECT COUNT(*) FROM events WHERE site_id=p_site_id AND type!='pageview' AND timestamp>=now()-(p_days||' days')::INTERVAL),
    'chart',       (SELECT jsonb_agg(r ORDER BY r.day) FROM (SELECT date_trunc('day',timestamp)::DATE::TEXT AS day, COUNT(DISTINCT session_id) AS v FROM events WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL GROUP BY 1) r),
    'topPages',    (SELECT jsonb_agg(r) FROM (SELECT pathname, COUNT(*) AS count FROM events WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL GROUP BY pathname ORDER BY count DESC LIMIT 10) r),
    'locations',   (SELECT jsonb_agg(r) FROM (SELECT country, COUNT(DISTINCT session_id) AS count FROM events WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL AND country IS NOT NULL GROUP BY country ORDER BY count DESC LIMIT 10) r),
    'channels',    (SELECT jsonb_agg(r) FROM (SELECT CASE WHEN referrer IS NULL OR referrer='' THEN 'Direct' WHEN referrer~*'(google\.|bing\.|duckduckgo\.|yahoo\.|baidu\.|ecosia\.|yandex\.)' THEN 'Search' WHEN referrer~*'(facebook\.|twitter\.|x\.com|linkedin\.|reddit\.|instagram\.|tiktok\.|youtube\.)' THEN 'Social' ELSE 'Referral' END AS name, COUNT(*) AS count FROM events WHERE site_id=p_site_id AND timestamp>=now()-(p_days||' days')::INTERVAL GROUP BY 1 ORDER BY 2 DESC) r)
  )
$$;
