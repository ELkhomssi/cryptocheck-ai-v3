-- Verifiable public token calls (Proof Engine) — committed before publish, graded later.

CREATE TABLE IF NOT EXISTS signal_proof_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id text NOT NULL,
  mint text NOT NULL,
  symbol text NOT NULL,
  call_type text NOT NULL CHECK (call_type IN ('rug_alert', 'smart_money', 'safe_entry')),
  verdict text NOT NULL,
  neural_score integer,
  evidence_summary text,
  called_at timestamptz NOT NULL DEFAULT now(),
  commit_tx text NOT NULL,
  data_hash text NOT NULL,
  commitment_hash text NOT NULL UNIQUE,
  hmac_signature text,
  explorer_url text,
  outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'hit', 'miss', 'expired')),
  outcome_evidence text,
  graded_at timestamptz,
  price_at_call numeric,
  price_at_grade numeric,
  sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signal_proof_calls_outcome_called_idx
  ON signal_proof_calls (outcome, called_at DESC);

CREATE INDEX IF NOT EXISTS signal_proof_calls_mint_idx ON signal_proof_calls (mint);

CREATE INDEX IF NOT EXISTS signal_proof_calls_called_at_idx ON signal_proof_calls (called_at DESC);
