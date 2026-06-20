-- Funnel definitions
CREATE TABLE funnels (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id    UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  steps      TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE funnels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "funnels_owner" ON funnels
  USING  (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()))
  WITH CHECK (site_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

-- get_funnel_data: for each step, count unique sessions that visited that pathname
-- Steps are independent counts — shows natural page-level drop-off.
CREATE OR REPLACE FUNCTION get_funnel_data(
  p_site_id UUID,
  p_steps   TEXT[],
  p_days    INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE SQL
SECURITY INVOKER
VOLATILE
AS $$
  SELECT jsonb_agg(
    jsonb_build_object('step', s.step, 'count', s.cnt)
    ORDER BY s.idx
  )
  FROM (
    SELECT
      t.step,
      t.idx,
      (
        SELECT COUNT(DISTINCT session_id)
        FROM events
        WHERE site_id = p_site_id
          AND pathname = t.step
          AND timestamp >= now() - (p_days || ' days')::INTERVAL
      ) AS cnt
    FROM unnest(p_steps) WITH ORDINALITY AS t(step, idx)
  ) s
$$;
