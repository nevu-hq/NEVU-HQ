-- NEVU HQ FOUNDATION — HOLDING / SECURITY LAYER
-- Run this in Supabase SQL Editor as one query.
-- This is additive: it does not delete or alter the existing OTP/holding activation flow.

begin;

-- 1) Holding membership / authority
create table if not exists public.nevu_holding_members (
    id uuid primary key default gen_random_uuid(),
    holding_id uuid not null references public.holdings(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    authority_level text not null default 'administrator'
        check (authority_level in ('administrator')),
    is_active boolean not null default true,
    joined_at timestamptz not null default now(),
    unique (holding_id, user_id)
);

create index if not exists idx_nevu_members_user
on public.nevu_holding_members(user_id);

create index if not exists idx_nevu_members_holding
on public.nevu_holding_members(holding_id);

-- 2) Board Room presence
create table if not exists public.nevu_presence (
    user_id uuid primary key references auth.users(id) on delete cascade,
    holding_id uuid references public.holdings(id) on delete cascade,
    status text not null default 'offline'
        check (status in ('active','away','dnd','offline')),
    personal_ai_present boolean not null default false,
    presence_visible boolean not null default true,
    last_seen_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_nevu_presence_holding
on public.nevu_presence(holding_id);

-- 3) New-holding governance requests
create table if not exists public.nevu_holding_requests (
    id uuid primary key default gen_random_uuid(),
    requested_by uuid not null references auth.users(id) on delete restrict,
    proposed_legal_name text not null,
    proposed_admin_username text not null,
    proposed_holding_name text not null,
    proposed_email text not null,
    status text not null default 'pending'
        check (status in ('pending','approved','rejected','cancelled')),
    created_at timestamptz not null default now(),
    resolved_at timestamptz
);

create index if not exists idx_nevu_holding_requests_status
on public.nevu_holding_requests(status, created_at desc);

-- 4) One vote per existing administrator per request
create table if not exists public.nevu_holding_request_votes (
    id uuid primary key default gen_random_uuid(),
    request_id uuid not null references public.nevu_holding_requests(id) on delete cascade,
    voter_user_id uuid not null references auth.users(id) on delete restrict,
    vote boolean not null,
    created_at timestamptz not null default now(),
    unique (request_id, voter_user_id)
);

-- 5) Permanent six-digit NEVU allocation code
create table if not exists public.nevu_holding_codes (
    id uuid primary key default gen_random_uuid(),
    holding_id uuid not null unique references public.holdings(id) on delete cascade,
    nevu_code text not null unique,
    issued_at timestamptz not null default now(),
    issued_for_registration boolean not null default true,
    consumed_at timestamptz
);

-- 6) Explicit resource sharing foundation
create table if not exists public.nevu_shares (
    id uuid primary key default gen_random_uuid(),
    sender_user_id uuid not null references auth.users(id) on delete restrict,
    sender_holding_id uuid not null references public.holdings(id) on delete cascade,
    recipient_holding_id uuid references public.holdings(id) on delete cascade,
    resource_type text not null,
    resource_id uuid,
    message text,
    created_at timestamptz not null default now(),
    expires_at timestamptz
);

create index if not exists idx_nevu_shares_recipient
on public.nevu_shares(recipient_holding_id, created_at desc);

-- 7) Basic AI connection registry.
-- Actual OAuth credentials/tokens must be encrypted/server-side;
-- this table stores connection metadata only.
create table if not exists public.nevu_ai_connections (
    id uuid primary key default gen_random_uuid(),
    holding_id uuid not null references public.holdings(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    provider text not null
        check (provider in ('google_gemini','openai','xai_grok','anthropic_claude')),
    status text not null default 'disconnected'
        check (status in ('connected','disconnected','expired','revoked','error')),
    account_label text,
    scopes jsonb not null default '[]'::jsonb,
    connected_at timestamptz,
    last_checked_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (holding_id, provider)
);

-- 8) Agent permissions per connection
create table if not exists public.nevu_ai_connection_agents (
    connection_id uuid not null references public.nevu_ai_connections(id) on delete cascade,
    agent_key text not null,
    allowed boolean not null default true,
    created_at timestamptz not null default now(),
    primary key (connection_id, agent_key)
);

-- 9) Workspace audit events (no token tracking)
create table if not exists public.nevu_audit_events (
    id uuid primary key default gen_random_uuid(),
    holding_id uuid references public.holdings(id) on delete cascade,
    actor_user_id uuid references auth.users(id) on delete set null,
    event_type text not null,
    entity_type text,
    entity_id uuid,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_nevu_audit_holding_time
on public.nevu_audit_events(holding_id, created_at desc);

-- 10) Helper: authenticated user belongs to a holding.
create or replace function public.nevu_is_holding_member(p_holding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.nevu_holding_members m
        where m.holding_id = p_holding_id
          and m.user_id = auth.uid()
          and m.is_active = true
    )
    or exists (
        select 1
        from public.holdings h
        where h.id = p_holding_id
          and h.user_id = auth.uid()
    );
$$;

-- 11) Helper: any authenticated administrator.
create or replace function public.nevu_is_existing_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.holdings h
        where h.user_id = auth.uid()
    );
$$;

-- 12) RLS
alter table public.nevu_holding_members enable row level security;
alter table public.nevu_presence enable row level security;
alter table public.nevu_holding_requests enable row level security;
alter table public.nevu_holding_request_votes enable row level security;
alter table public.nevu_holding_codes enable row level security;
alter table public.nevu_shares enable row level security;
alter table public.nevu_ai_connections enable row level security;
alter table public.nevu_ai_connection_agents enable row level security;
alter table public.nevu_audit_events enable row level security;

-- Members: own membership only
drop policy if exists "NEVU members read own membership" on public.nevu_holding_members;
create policy "NEVU members read own membership"
on public.nevu_holding_members for select to authenticated
using (user_id = auth.uid() or public.nevu_is_holding_member(holding_id));

-- Presence: visible HQ presence, but only authenticated users
drop policy if exists "NEVU authenticated presence read" on public.nevu_presence;
create policy "NEVU authenticated presence read"
on public.nevu_presence for select to authenticated
using (presence_visible = true);

drop policy if exists "NEVU users write own presence" on public.nevu_presence;
create policy "NEVU users write own presence"
on public.nevu_presence for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "NEVU users update own presence" on public.nevu_presence;
create policy "NEVU users update own presence"
on public.nevu_presence for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Holding requests: requester can read/create; existing admins can read.
drop policy if exists "NEVU admins read holding requests" on public.nevu_holding_requests;
create policy "NEVU admins read holding requests"
on public.nevu_holding_requests for select to authenticated
using (public.nevu_is_existing_admin());

drop policy if exists "NEVU admins create holding requests" on public.nevu_holding_requests;
create policy "NEVU admins create holding requests"
on public.nevu_holding_requests for insert to authenticated
with check (requested_by = auth.uid() and public.nevu_is_existing_admin());

-- Votes: existing admins can read/insert their own vote.
drop policy if exists "NEVU admins read holding votes" on public.nevu_holding_request_votes;
create policy "NEVU admins read holding votes"
on public.nevu_holding_request_votes for select to authenticated
using (public.nevu_is_existing_admin());

drop policy if exists "NEVU admins cast own holding vote" on public.nevu_holding_request_votes;
create policy "NEVU admins cast own holding vote"
on public.nevu_holding_request_votes for insert to authenticated
with check (voter_user_id = auth.uid() and public.nevu_is_existing_admin());

-- Codes: owner holding only. Do not expose codes globally.
drop policy if exists "NEVU holding owner reads own code" on public.nevu_holding_codes;
create policy "NEVU holding owner reads own code"
on public.nevu_holding_codes for select to authenticated
using (public.nevu_is_holding_member(holding_id));

-- Shares: sender/recipient holding members only.
drop policy if exists "NEVU share participants read shares" on public.nevu_shares;
create policy "NEVU share participants read shares"
on public.nevu_shares for select to authenticated
using (
    public.nevu_is_holding_member(sender_holding_id)
    or (
        recipient_holding_id is not null
        and public.nevu_is_holding_member(recipient_holding_id)
    )
);

drop policy if exists "NEVU users create shares" on public.nevu_shares;
create policy "NEVU users create shares"
on public.nevu_shares for insert to authenticated
with check (
    sender_user_id = auth.uid()
    and public.nevu_is_holding_member(sender_holding_id)
);

-- AI connections: private to owning holding.
drop policy if exists "NEVU holding reads AI connections" on public.nevu_ai_connections;
create policy "NEVU holding reads AI connections"
on public.nevu_ai_connections for select to authenticated
using (public.nevu_is_holding_member(holding_id));

-- Audit: own holding only.
drop policy if exists "NEVU holding reads audit" on public.nevu_audit_events;
create policy "NEVU holding reads audit"
on public.nevu_audit_events for select to authenticated
using (
    holding_id is null
    or public.nevu_is_holding_member(holding_id)
);

commit;
