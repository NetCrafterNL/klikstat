-- Change get_realtime to VOLATILE so PostgREST uses POST (no caching).
-- STABLE causes GET requests which browsers/CDNs cache, returning stale data.
CREATE OR REPLACE FUNCTION get_realtime(p_site_id UUID)
RETURNS JSONB
LANGUAGE SQL
SECURITY INVOKER
VOLATILE
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
