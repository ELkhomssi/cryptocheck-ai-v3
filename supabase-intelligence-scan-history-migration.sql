-- Intelligence Terminal — shareable scan id (Phase 2)
-- Run in Supabase SQL Editor after `scan_history` exists (see supabase-credits-migration.sql).

ALTER TABLE scan_history ADD COLUMN IF NOT EXISTS scan_id UUID;

-- Unique when present (multiple NULLs allowed for legacy rows).
CREATE UNIQUE INDEX IF NOT EXISTS scan_history_scan_id_key ON scan_history(scan_id);

COMMENT ON COLUMN scan_history.scan_id IS 'Client-facing UUID returned in TokenIntelligenceReport.meta.scanId; enables future /scan/[id] links.';
