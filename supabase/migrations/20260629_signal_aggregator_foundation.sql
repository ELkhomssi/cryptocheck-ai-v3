-- Signal Aggregator foundation (Prompt 0)
-- Postgres via Supabase. Timescale hypertable optional (enable if extension available).

create table if not exists public.signal_raw_archive (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  message_id text not null,
  event_type text not null check (event_type in ('new', 'edit', 'delete')),
  raw_text text,
  entities jsonb default '[]'::jsonb,
  msg_timestamp timestamptz not null,
  ingest_timestamp timestamptz not null default now(),
  unique (channel, message_id, event_type, ingest_timestamp)
);

create index if not exists signal_raw_archive_channel_ts_idx
  on public.signal_raw_archive (channel, msg_timestamp desc);

create table if not exists public.signal_normalized (
  id text primary key,
  source_channel text not null,
  source_message_id text not null,
  chain text not null,
  contract_address text not null,
  token_symbol text not null,
  pair text,
  price numeric,
  signal_type text not null check (signal_type in ('buy', 'sell', 'mention')),
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  parse_method text not null check (parse_method in ('regex', 'adapter', 'llm')),
  raw_text text not null,
  msg_timestamp timestamptz not null,
  ingest_timestamp timestamptz not null,
  resolved boolean not null default false,
  sentinel_verdict text not null default 'scanning'
    check (sentinel_verdict in ('scanning', 'safe', 'caution', 'danger')),
  neural_score integer,
  sources text[] not null default '{}',
  source_count integer not null default 1,
  sample boolean not null default false,
  dropped boolean not null default false,
  drop_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists signal_normalized_contract_idx
  on public.signal_normalized (contract_address);

create index if not exists signal_normalized_verdict_ts_idx
  on public.signal_normalized (sentinel_verdict, msg_timestamp desc);

create index if not exists signal_normalized_chain_ts_idx
  on public.signal_normalized (chain, msg_timestamp desc);

-- Full-text + trigram search (requires pg_trgm extension)
create extension if not exists pg_trgm;

create index if not exists signal_normalized_raw_text_trgm_idx
  on public.signal_normalized using gin (raw_text gin_trgm_ops);

create index if not exists signal_normalized_symbol_trgm_idx
  on public.signal_normalized using gin (token_symbol gin_trgm_ops);

create table if not exists public.signal_subscription (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'premium')),
  premium_until timestamptz,
  push_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.signal_normalized is
  'Master Feed rows — async-upgrade: sentinel_verdict starts scanning, flips after Sentinel gate.';

-- Optional Timescale hypertable (uncomment when timescaledb extension is enabled):
-- select create_hypertable('public.signal_normalized', 'msg_timestamp', if_not_exists => true);
