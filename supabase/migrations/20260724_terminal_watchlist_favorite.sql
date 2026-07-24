-- Phase 10.4 — watchlist favorites + sort order for terminal persistence
-- Safe to re-run: ADD COLUMN IF NOT EXISTS

ALTER TABLE public.watchlist
  ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;

ALTER TABLE public.watchlist
  ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0;

-- Backfill nulls if column existed without default applied
UPDATE public.watchlist SET is_favorite = false WHERE is_favorite IS NULL;
UPDATE public.watchlist SET sort_order = 0 WHERE sort_order IS NULL;

CREATE INDEX IF NOT EXISTS idx_watchlist_user_fav_sort
  ON public.watchlist (user_id, is_favorite DESC, sort_order ASC, created_at DESC);
