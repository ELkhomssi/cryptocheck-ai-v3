-- Scout Growth Intelligence Operating System
-- Tables: scout_* · Redis keys: ccai:scout:*

CREATE TABLE IF NOT EXISTS public.scout_articles (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  topic_id TEXT,
  mint TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'approved', 'published', 'rejected')),
  body JSONB NOT NULL DEFAULT '{}'::jsonb,
  quality_score INTEGER,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scout_articles_status_published
  ON public.scout_articles (status, published_at DESC);

CREATE TABLE IF NOT EXISTS public.scout_distributions (
  id UUID PRIMARY KEY,
  article_id UUID REFERENCES public.scout_articles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  adapted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scout_distributions_article
  ON public.scout_distributions (article_id);

CREATE TABLE IF NOT EXISTS public.scout_dashboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scout_learning_signals (
  id UUID PRIMARY KEY,
  topic_id TEXT,
  article_id UUID,
  signal TEXT NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scout_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_dashboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_learning_signals ENABLE ROW LEVEL SECURITY;

-- Public read for published articles only (blog)
DROP POLICY IF EXISTS scout_articles_public_read ON public.scout_articles;
CREATE POLICY scout_articles_public_read
  ON public.scout_articles FOR SELECT TO anon, authenticated
  USING (status = 'published');

COMMENT ON TABLE public.scout_articles IS 'Scout growth content drafts/published articles (engine-cited, approval-gated).';

-- Map Scout agent activity → research module (timeline)
CREATE OR REPLACE FUNCTION public.intel_core_timeline_from_agent_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.timeline_events (source_table, source_id, event_type, summary, module, created_at)
  VALUES (
    'agent_activity',
    NEW.id::text,
    NEW.kind || ':' || NEW.status,
    COALESCE(NULLIF(TRIM(NEW.description), ''), NEW.agent_name || ' · ' || NEW.kind),
    CASE
      WHEN NEW.agent_id IN ('whale-analyst') THEN 'market'
      WHEN NEW.agent_id IN ('scam-investigator') THEN 'security'
      WHEN NEW.agent_id IN ('trading-coach') THEN 'trading'
      WHEN NEW.agent_id IN ('portfolio-manager', 'risk-manager') THEN 'portfolio'
      WHEN NEW.agent_id IN ('launch-advisor') THEN 'launch'
      WHEN NEW.agent_id IN ('research-analyst', 'market-strategist', 'news-intelligence', 'scout') THEN 'research'
      ELSE NULL
    END,
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (source_table, source_id, event_type) DO NOTHING;
  RETURN NEW;
END;
$$;
