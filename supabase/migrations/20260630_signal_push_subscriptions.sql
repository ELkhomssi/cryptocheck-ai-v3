-- Signal push subscriptions (Prompt 6)

create table if not exists public.signal_push_subscription (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists signal_push_subscription_user_idx
  on public.signal_push_subscription (user_id);
