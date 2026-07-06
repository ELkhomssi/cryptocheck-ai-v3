-- Multi-Source Ingestion Engine foundation (Prompt 0)
-- Extends signal_normalized for Telegram + TxODDS (+ future) with collision-free idempotency.

-- ── source identity + subject discriminator ─────────────────────────────────
alter table public.signal_normalized
  add column if not exists source_tag text not null default 'telegram',
  add column if not exists source_ref text,
  add column if not exists subject_type text not null default 'token'
    check (subject_type in ('token', 'match_event')),
  add column if not exists label text,
  add column if not exists event_type text,
  add column if not exists match_id text,
  add column if not exists teams jsonb,
  add column if not exists score jsonb,
  add column if not exists market text,
  add column if not exists score_value numeric,
  add column if not exists raw_payload jsonb;

comment on column public.signal_normalized.source_tag is
  'Ingestion source: telegram | txodds | future. Part of composite idempotency key.';
comment on column public.signal_normalized.source_ref is
  'Source-native id (tg message id, or matchId:eventSeq). UNIQUE with source_tag.';
comment on column public.signal_normalized.subject_type is
  'token → scan gateway; match_event → SportsSignalEvaluator (no swap path).';
comment on column public.signal_normalized.score_value is
  'Neural score (token) or edge score (sports) after gate enrichment.';

-- Backfill legacy Telegram token rows
update public.signal_normalized
set
  source_ref = coalesce(source_ref, source_message_id),
  label = coalesce(label, token_symbol),
  event_type = coalesce(event_type, signal_type),
  source_tag = coalesce(nullif(source_tag, ''), 'telegram'),
  subject_type = coalesce(nullif(subject_type, ''), 'token')
where source_ref is null
   or label is null
   or event_type is null;

-- ── verdict superset (sports may be n/a) ────────────────────────────────────
alter table public.signal_normalized
  drop constraint if exists signal_normalized_sentinel_verdict_check;

alter table public.signal_normalized
  add constraint signal_normalized_sentinel_verdict_check
  check (sentinel_verdict in ('scanning', 'safe', 'caution', 'danger', 'n/a'));

-- ── token rows require on-chain fields; match_event rows do not ─────────────
alter table public.signal_normalized
  alter column chain drop not null,
  alter column contract_address drop not null,
  alter column token_symbol drop not null,
  alter column raw_text drop not null,
  alter column signal_type drop not null;

alter table public.signal_normalized
  drop constraint if exists signal_normalized_token_fields_chk;

alter table public.signal_normalized
  add constraint signal_normalized_token_fields_chk
  check (
    subject_type = 'match_event'
    or (
      chain is not null
      and contract_address is not null
      and token_symbol is not null
      and signal_type is not null
    )
  );

-- ── idempotency + filter indexes ────────────────────────────────────────────
create unique index if not exists signal_normalized_source_tag_ref_uidx
  on public.signal_normalized (source_tag, source_ref)
  where source_ref is not null;

create index if not exists signal_normalized_source_tag_idx
  on public.signal_normalized (source_tag);

create index if not exists signal_normalized_subject_type_idx
  on public.signal_normalized (subject_type, msg_timestamp desc);

create index if not exists signal_normalized_match_id_idx
  on public.signal_normalized (match_id)
  where match_id is not null;
