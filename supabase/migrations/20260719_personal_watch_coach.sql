-- Personal watch + coach: platform-wide token snapshots + per-user degrade events.
-- Scans scale with unique mints, not user×mint pairs.
--
-- Also ensures Saved-You foundation tables exist (20260713_saved_you.sql) so this
-- migration is safe to run even if that earlier file was never applied.

-- ── Saved-You foundation (idempotent) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  mint text NOT NULL,
  symbol text,
  verdict text NOT NULL,
  score integer,
  evidence text,
  source text NOT NULL,
  intended_amount_usd numeric,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL DEFAULT 'pending'
    CHECK (outcome IN ('pending', 'rugged', 'survived', 'expired')),
  graded_at timestamptz
);

CREATE INDEX IF NOT EXISTS user_blocks_pending_idx ON public.user_blocks (outcome, blocked_at ASC)
  WHERE outcome = 'pending';
CREATE INDEX IF NOT EXISTS user_blocks_user_idx ON public.user_blocks (user_id, blocked_at DESC);
CREATE INDEX IF NOT EXISTS user_blocks_mint_idx ON public.user_blocks (mint);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_blocks_select_own ON public.user_blocks;
CREATE POLICY user_blocks_select_own ON public.user_blocks
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.saved_you (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id uuid NOT NULL REFERENCES public.user_blocks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  mint text NOT NULL,
  symbol text,
  blocked_at timestamptz NOT NULL,
  graded_at timestamptz NOT NULL DEFAULT now(),
  price_at_block numeric,
  price_at_grade numeric,
  drawdown_pct numeric,
  loss_avoided_estimate numeric,
  outcome_evidence text NOT NULL,
  explorer_url text,
  UNIQUE (block_id)
);

CREATE INDEX IF NOT EXISTS saved_you_user_idx ON public.saved_you (user_id, graded_at DESC);
CREATE INDEX IF NOT EXISTS saved_you_graded_idx ON public.saved_you (graded_at DESC);

ALTER TABLE public.saved_you ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS saved_you_select ON public.saved_you;
CREATE POLICY saved_you_select ON public.saved_you
  FOR SELECT USING (true);

-- Allow continuous-watch near-misses to feed Saved-You (source = 'watch').
-- Drop any prior source check (name varies if created with inline CHECK).
ALTER TABLE public.user_blocks DROP CONSTRAINT IF EXISTS user_blocks_source_check;
DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'user_blocks'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%source%'
  LOOP
    EXECUTE format('ALTER TABLE public.user_blocks DROP CONSTRAINT IF EXISTS %I', cname);
  END LOOP;
END $$;

ALTER TABLE public.user_blocks
  ADD CONSTRAINT user_blocks_source_check
  CHECK (source IN ('swap', 'snipe', 'manual', 'watch'));

COMMENT ON TABLE public.user_blocks IS
  'DANGER near-misses (swap/snipe/manual/watch). Graded honestly — never fabricate saves.';
COMMENT ON TABLE public.saved_you IS
  'Proven saves: only created when compound rug evidence is found. loss_avoided_estimate is an estimate.';

-- ── Personal watch tables ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.token_watch_snapshots (
  mint text PRIMARY KEY,
  safety_score integer NOT NULL,
  risk_score integer NOT NULL,
  verdict text NOT NULL,
  evidence_labels text[] NOT NULL DEFAULT '{}',
  evidence_line text,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS token_watch_snapshots_scanned_idx
  ON public.token_watch_snapshots (scanned_at DESC);

COMMENT ON TABLE public.token_watch_snapshots IS
  'Last Neural V4 gateway verdict per mint for continuous personal-watch rescans. One row per mint platform-wide.';

CREATE TABLE IF NOT EXISTS public.watch_degrade_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mint text NOT NULL,
  prev_verdict text NOT NULL,
  new_verdict text NOT NULL,
  prev_risk integer,
  new_risk integer,
  reason text NOT NULL,
  held boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS watch_degrade_events_user_idx
  ON public.watch_degrade_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS watch_degrade_events_mint_idx
  ON public.watch_degrade_events (mint, created_at DESC);

ALTER TABLE public.watch_degrade_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS watch_degrade_events_select_own ON public.watch_degrade_events;
CREATE POLICY watch_degrade_events_select_own ON public.watch_degrade_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.watch_degrade_events IS
  'Per-user watch degrade alerts. Emitted when a token the user holds/watches worsens — never fabricated.';
