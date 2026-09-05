-- NEVU HQ — Unified Master System database
-- Supersedes earlier member-oriented semantics: each Holding has exactly one Administrator.
-- AI specialists are agents, not human members.

create extension if not exists pgcrypto;

-- ---------- Core identity ----------
create table if not exists public.nevu_administrators (
  id uuid primary key references auth.users(id) on delete cascade,
  legal_name text not null check (legal_name in ('Nwachuku','Ezra','Victor','Uchechukwu')),
  full_name text not null,
  username text not null unique,
  email text not null,
  is_sole_administrator boolean not null default true check (is_sole_administrator),
  setup_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  administrator_id uuid not null unique references public.nevu_administrators(id) on delete cascade,
  legal_name text not null unique check (legal_name in ('Nwachuku','Ezra','Victor','Uchechukwu')),
  holding_name text not null,
  nevu_code text not null unique check (nevu_code ~ '^[0-9]{6}$'),
  base_currency text not null default 'NGN',
  primary_focus text not null default 'Nigeria → Africa',
  setup_capital numeric(24,2) not null default 0 check (setup_capital >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_nevu_holding_admin on public.holdings(administrator_id);
create unique index if not exists idx_nevu_holding_legal on public.holdings(legal_name);

-- ---------- Governance ----------
create table if not exists public.nevu_holding_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by_holding_id uuid not null references public.holdings(id) on delete restrict,
  proposed_legal_name text not null check (proposed_legal_name in ('Nwachuku','Ezra','Victor','Uchechukwu') or length(trim(proposed_legal_name)) > 0),
  proposed_admin_username text not null,
  proposed_holding_name text not null,
  proposed_email text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists idx_nevu_requests_status on public.nevu_holding_requests(status, created_at desc);

create table if not exists public.nevu_holding_request_votes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.nevu_holding_requests(id) on delete cascade,
  voter_holding_id uuid not null references public.holdings(id) on delete cascade,
  vote boolean not null,
  created_at timestamptz not null default now(),
  unique(request_id, voter_holding_id)
);

-- ---------- Presence ----------
create table if not exists public.nevu_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  holding_id uuid not null references public.holdings(id) on delete cascade,
  status text not null default 'offline' check (status in ('active','away','dnd','offline')),
  personal_ai_present boolean not null default false,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Holding Discussion Rooms / Sessions ----------
create table if not exists public.nevu_sessions (
  id uuid primary key default gen_random_uuid(),
  holding_id uuid not null references public.holdings(id) on delete cascade,
  title text not null default 'New Session',
  purpose text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'active' check (status in ('active','paused','closed')),
  current_capital numeric(24,2),
  created_by uuid not null references public.nevu_administrators(id) on delete restrict
);
create index if not exists idx_nevu_sessions_holding on public.nevu_sessions(holding_id, started_at desc);

create table if not exists public.nevu_messages (
  id uuid primary key default gen_random_uuid(),
  holding_id uuid not null references public.holdings(id) on delete cascade,
  session_id uuid references public.nevu_sessions(id) on delete cascade,
  sender_type text not null check (sender_type in ('administrator','agent','system')),
  sender_user_id uuid references auth.users(id) on delete set null,
  agent_key text,
  message_type text not null default 'text' check (message_type in ('text','voice','image','file','system')),
  message text,
  storage_path text,
  reply_to uuid references public.nevu_messages(id) on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check ((sender_type='administrator' and sender_user_id is not null and agent_key is null) or (sender_type='agent' and agent_key is not null and sender_user_id is null) or sender_type='system')
);
create index if not exists idx_nevu_messages_session on public.nevu_messages(session_id, created_at);

-- ---------- Polls ----------
create table if not exists public.nevu_polls (
  id uuid primary key default gen_random_uuid(),
  holding_id uuid not null references public.holdings(id) on delete cascade,
  session_id uuid references public.nevu_sessions(id) on delete cascade,
  message_id uuid references public.nevu_messages(id) on delete cascade,
  question text not null,
  multiple_choice boolean not null default false,
  closes_at timestamptz,
  created_by uuid not null references public.nevu_administrators(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table if not exists public.nevu_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.nevu_polls(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0
);
create table if not exists public.nevu_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.nevu_polls(id) on delete cascade,
  option_id uuid not null references public.nevu_poll_options(id) on delete cascade,
  voter_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(poll_id, option_id, voter_user_id)
);

-- ---------- NEVU HQ Boardroom ----------
create table if not exists public.nevu_hq_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'NEVU HQ Boardroom Session',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'active' check (status in ('active','paused','closed')),
  created_by uuid not null references public.nevu_administrators(id) on delete restrict
);

create table if not exists public.nevu_hq_messages (
  id uuid primary key default gen_random_uuid(),
  hq_session_id uuid not null references public.nevu_hq_sessions(id) on delete cascade,
  sender_type text not null check (sender_type in ('administrator','nevu_ai','system')),
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_holding_id uuid references public.holdings(id) on delete set null,
  agent_key text,
  message_type text not null default 'text' check (message_type in ('text','voice','image','file','poll','system')),
  message text,
  storage_path text,
  reply_to uuid references public.nevu_hq_messages(id) on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_nevu_hq_messages_session on public.nevu_hq_messages(hq_session_id, created_at);

create table if not exists public.nevu_hq_polls (
  id uuid primary key default gen_random_uuid(),
  hq_session_id uuid not null references public.nevu_hq_sessions(id) on delete cascade,
  question text not null,
  multiple_choice boolean not null default false,
  closes_at timestamptz,
  created_by uuid not null references public.nevu_administrators(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table if not exists public.nevu_hq_poll_options (
  id uuid primary key default gen_random_uuid(), poll_id uuid not null references public.nevu_hq_polls(id) on delete cascade, label text not null, sort_order integer not null default 0
);
create table if not exists public.nevu_hq_poll_votes (
  id uuid primary key default gen_random_uuid(), poll_id uuid not null references public.nevu_hq_polls(id) on delete cascade, option_id uuid not null references public.nevu_hq_poll_options(id) on delete cascade, voter_user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(poll_id, option_id, voter_user_id)
);

-- ---------- AI ----------
create table if not exists public.nevu_ai_connections (
  id uuid primary key default gen_random_uuid(),
  holding_id uuid not null references public.holdings(id) on delete cascade,
  provider text not null check (provider in ('openai','anthropic','google_gemini','xai_grok','huggingface_llama','local_bridge')),
  status text not null default 'disconnected' check (status in ('connected','disconnected','expired','revoked','error','bridge_offline')),
  account_label text,
  scopes jsonb not null default '[]'::jsonb,
  connected_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(holding_id, provider)
);
create table if not exists public.nevu_agent_assignments (
  holding_id uuid not null references public.holdings(id) on delete cascade,
  agent_key text not null,
  provider text not null check (provider in ('openai','anthropic','google_gemini','xai_grok','huggingface_llama','local_bridge')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(holding_id, agent_key)
);

create table if not exists public.nevu_ai_runs (
  id uuid primary key default gen_random_uuid(),
  holding_id uuid references public.holdings(id) on delete cascade,
  session_id uuid references public.nevu_sessions(id) on delete set null,
  hq_session_id uuid references public.nevu_hq_sessions(id) on delete set null,
  agent_key text not null,
  provider text not null,
  prompt text not null,
  response text,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

-- ---------- Portfolio ----------
create table if not exists public.nevu_portfolio_positions (
  id uuid primary key default gen_random_uuid(),
  holding_id uuid not null references public.holdings(id) on delete cascade,
  symbol text not null,
  instrument_name text not null,
  market text not null default 'NGX',
  quantity numeric(24,6) not null default 0,
  average_cost numeric(24,6) not null default 0,
  current_value numeric(24,2) not null default 0,
  currency text not null default 'NGN',
  status text not null default 'open' check(status in ('open','closed')),
  updated_at timestamptz not null default now(),
  unique(holding_id, symbol)
);
create table if not exists public.nevu_capital_snapshots (
  id uuid primary key default gen_random_uuid(), holding_id uuid not null references public.holdings(id) on delete cascade, session_id uuid references public.nevu_sessions(id) on delete set null, capital_used numeric(24,2) not null default 0, available_cash numeric(24,2) not null default 0, total_capital numeric(24,2) not null default 0, note text, created_at timestamptz not null default now()
);

create table if not exists public.nevu_decisions (
  id uuid primary key default gen_random_uuid(),
  holding_id uuid not null references public.holdings(id) on delete cascade,
  session_id uuid not null references public.nevu_sessions(id) on delete cascade,
  title text not null,
  recommended_path text,
  reasons text,
  alternatives text,
  risk_short_term text,
  risk_long_term text,
  risk_combined text,
  verdict text check(verdict in ('Buy','Hold','Reduce','Avoid')),
  confidence numeric(5,2) check(confidence between 0 and 100),
  educational_note text,
  freshness text,
  uncertainty text,
  archive_comparison text,
  status text not null default 'pending_approval' check(status in ('pending_approval','approved','rejected','hold','executed')),
  approval_phrase text,
  approved_at timestamptz,
  approved_by uuid references public.nevu_administrators(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Minutes / Archive ----------
create table if not exists public.nevu_minutes (
  id uuid primary key default gen_random_uuid(), holding_id uuid not null references public.holdings(id) on delete cascade, session_id uuid not null references public.nevu_sessions(id) on delete cascade, content text not null, confirmed boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.nevu_archive_records (
  id uuid primary key default gen_random_uuid(), holding_id uuid not null references public.holdings(id) on delete cascade, session_id uuid not null references public.nevu_sessions(id) on delete cascade, decision_id uuid references public.nevu_decisions(id) on delete set null, title text not null, exact_datetime timestamptz not null default now(), summary text, participants jsonb not null default '[]'::jsonb, data_used jsonb not null default '[]'::jsonb, files_used jsonb not null default '[]'::jsonb, combined_verdict text, risk_levels jsonb not null default '{}'::jsonb, confidence_score numeric(5,2), approval_stamp text, full_record text not null, created_at timestamptz not null default now()
);
create index if not exists idx_nevu_archive_holding on public.nevu_archive_records(holding_id, exact_datetime desc);

-- ---------- Sharing / files ----------
create table if not exists public.nevu_shares (
  id uuid primary key default gen_random_uuid(),
  sender_holding_id uuid not null references public.holdings(id) on delete cascade,
  recipient_holding_id uuid references public.holdings(id) on delete cascade,
  resource_type text not null,
  resource_id uuid,
  message text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
create table if not exists public.nevu_files (
  id uuid primary key default gen_random_uuid(), holding_id uuid not null references public.holdings(id) on delete cascade, session_id uuid references public.nevu_sessions(id) on delete set null, uploaded_by uuid not null references auth.users(id) on delete restrict, storage_path text not null, file_name text not null, mime_type text, size_bytes bigint, created_at timestamptz not null default now()
);

-- ---------- Audit ----------
create table if not exists public.nevu_audit_events (
  id uuid primary key default gen_random_uuid(), holding_id uuid references public.holdings(id) on delete cascade, actor_user_id uuid references auth.users(id) on delete set null, event_type text not null, entity_type text, entity_id uuid, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists idx_nevu_audit_holding_time on public.nevu_audit_events(holding_id, created_at desc);

-- ---------- Helpers ----------
create or replace function public.nevu_my_holding_id() returns uuid language sql stable security definer set search_path=public as $$ select id from public.holdings where administrator_id=auth.uid() limit 1 $$;
create or replace function public.nevu_is_my_holding(p_holding_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.holdings where id=p_holding_id and administrator_id=auth.uid()) $$;
create or replace function public.nevu_hq_access() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.nevu_administrators where id=auth.uid() and setup_complete=true) $$;

-- ---------- Signup bootstrap trigger ----------
create or replace function public.nevu_bootstrap_administrator() returns trigger language plpgsql security definer set search_path=public as $$
declare v_legal text; v_username text; v_full text; v_holding text; v_capital numeric; v_code text;
begin
  v_legal := trim(coalesce(new.raw_user_meta_data->>'legal_name',''));
  if v_legal not in ('Nwachuku','Ezra','Victor','Uchechukwu') then
    raise exception 'NEVU access denied';
  end if;
  v_username := trim(coalesce(new.raw_user_meta_data->>'username',''));
  v_full := trim(coalesce(new.raw_user_meta_data->>'full_name',''));
  v_holding := trim(coalesce(new.raw_user_meta_data->>'holding_name',''));
  v_capital := greatest(coalesce((new.raw_user_meta_data->>'capital')::numeric,0),0);
  if v_username='' or v_full='' or v_holding='' then raise exception 'NEVU setup fields incomplete'; end if;
  if exists(select 1 from public.nevu_administrators where legal_name=v_legal) then raise exception 'That approved legal stakeholder already has an Administrator account'; end if;
  loop v_code := lpad((floor(random()*1000000))::bigint::text,6,'0'); exit when not exists(select 1 from public.holdings where nevu_code=v_code); end loop;
  insert into public.nevu_administrators(id,legal_name,full_name,username,email,setup_complete) values(new.id,v_legal,v_full,v_username,new.email,false);
  insert into public.holdings(administrator_id,legal_name,holding_name,nevu_code,setup_capital) values(new.id,v_legal,v_holding,v_code,v_capital);
  insert into public.nevu_presence(user_id,holding_id,status,personal_ai_present) values(new.id,(select id from public.holdings where administrator_id=new.id),'offline',false);
  return new;
end; $$;

drop trigger if exists nevu_on_auth_user_created on auth.users;
create trigger nevu_on_auth_user_created after insert on auth.users for each row execute function public.nevu_bootstrap_administrator();

-- ---------- Approval / execution helpers ----------
create or replace function public.nevu_approve_decision(p_decision_id uuid, p_phrase text) returns boolean language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_username text; v_holding uuid; v_expected text;
begin
 select username into v_username from public.nevu_administrators where id=v_user and setup_complete=true;
 v_holding:=public.nevu_my_holding_id();
 if v_username is null or v_holding is null then raise exception 'Administrator access required'; end if;
 v_expected:='Approved by '||v_username;
 if p_phrase <> v_expected then return false; end if;
 update public.nevu_decisions set status='approved',approval_phrase=p_phrase,approved_at=now(),approved_by=v_user where id=p_decision_id and holding_id=v_holding;
 return found;
end; $$;

-- ---------- RLS ----------
alter table public.nevu_administrators enable row level security;
alter table public.holdings enable row level security;
alter table public.nevu_holding_requests enable row level security;
alter table public.nevu_holding_request_votes enable row level security;
alter table public.nevu_presence enable row level security;
alter table public.nevu_sessions enable row level security;
alter table public.nevu_messages enable row level security;
alter table public.nevu_polls enable row level security;
alter table public.nevu_poll_options enable row level security;
alter table public.nevu_poll_votes enable row level security;
alter table public.nevu_hq_sessions enable row level security;
alter table public.nevu_hq_messages enable row level security;
alter table public.nevu_hq_polls enable row level security;
alter table public.nevu_hq_poll_options enable row level security;
alter table public.nevu_hq_poll_votes enable row level security;
alter table public.nevu_ai_connections enable row level security;
alter table public.nevu_agent_assignments enable row level security;
alter table public.nevu_ai_runs enable row level security;
alter table public.nevu_portfolio_positions enable row level security;
alter table public.nevu_capital_snapshots enable row level security;
alter table public.nevu_decisions enable row level security;
alter table public.nevu_minutes enable row level security;
alter table public.nevu_archive_records enable row level security;
alter table public.nevu_shares enable row level security;
alter table public.nevu_files enable row level security;
alter table public.nevu_audit_events enable row level security;

-- Administrator can only see own identity.
drop policy if exists nevu_admin_self on public.nevu_administrators;
create policy nevu_admin_self on public.nevu_administrators for select to authenticated using(id=auth.uid());
drop policy if exists nevu_admin_update_self on public.nevu_administrators;
create policy nevu_admin_update_self on public.nevu_administrators for update to authenticated using(id=auth.uid()) with check(id=auth.uid());

drop policy if exists nevu_holding_self on public.holdings;
create policy nevu_holding_self on public.holdings for select to authenticated using(administrator_id=auth.uid());
drop policy if exists nevu_holding_update_self on public.holdings;
create policy nevu_holding_update_self on public.holdings for update to authenticated using(administrator_id=auth.uid()) with check(administrator_id=auth.uid());

drop policy if exists nevu_presence_self on public.nevu_presence;
create policy nevu_presence_self on public.nevu_presence for select to authenticated using(user_id=auth.uid());
drop policy if exists nevu_presence_update_self on public.nevu_presence;
create policy nevu_presence_update_self on public.nevu_presence for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists nevu_presence_insert_self on public.nevu_presence;
create policy nevu_presence_insert_self on public.nevu_presence for insert to authenticated with check(user_id=auth.uid() and public.nevu_is_my_holding(holding_id));

drop policy if exists nevu_session_self on public.nevu_sessions;
create policy nevu_session_self on public.nevu_sessions for all to authenticated using(public.nevu_is_my_holding(holding_id)) with check(public.nevu_is_my_holding(holding_id));
drop policy if exists nevu_message_self on public.nevu_messages;
create policy nevu_message_self on public.nevu_messages for all to authenticated using(public.nevu_is_my_holding(holding_id)) with check(public.nevu_is_my_holding(holding_id) and (sender_type<>'administrator' or sender_user_id=auth.uid()));
drop policy if exists nevu_polls_self on public.nevu_polls;
create policy nevu_polls_self on public.nevu_polls for all to authenticated using(public.nevu_is_my_holding(holding_id)) with check(public.nevu_is_my_holding(holding_id) and created_by=auth.uid());
drop policy if exists nevu_poll_options_self on public.nevu_poll_options;
create policy nevu_poll_options_self on public.nevu_poll_options for all to authenticated using(exists(select 1 from public.nevu_polls p where p.id=poll_id and public.nevu_is_my_holding(p.holding_id))) with check(exists(select 1 from public.nevu_polls p where p.id=poll_id and public.nevu_is_my_holding(p.holding_id)));
drop policy if exists nevu_poll_votes_self on public.nevu_poll_votes;
create policy nevu_poll_votes_self on public.nevu_poll_votes for all to authenticated using(voter_user_id=auth.uid()) with check(voter_user_id=auth.uid() and exists(select 1 from public.nevu_polls p where p.id=poll_id and public.nevu_is_my_holding(p.holding_id)));

-- HQ: every verified Administrator may participate, but no one gains private Holding data.
drop policy if exists nevu_hq_session_read on public.nevu_hq_sessions;
create policy nevu_hq_session_read on public.nevu_hq_sessions for select to authenticated using(public.nevu_hq_access());
drop policy if exists nevu_hq_session_create on public.nevu_hq_sessions;
create policy nevu_hq_session_create on public.nevu_hq_sessions for insert to authenticated with check(public.nevu_hq_access() and created_by=auth.uid());
drop policy if exists nevu_hq_session_update on public.nevu_hq_sessions;
create policy nevu_hq_session_update on public.nevu_hq_sessions for update to authenticated using(public.nevu_hq_access()) with check(public.nevu_hq_access());
drop policy if exists nevu_hq_message_read on public.nevu_hq_messages;
create policy nevu_hq_message_read on public.nevu_hq_messages for select to authenticated using(public.nevu_hq_access());
drop policy if exists nevu_hq_message_insert on public.nevu_hq_messages;
create policy nevu_hq_message_insert on public.nevu_hq_messages for insert to authenticated with check(public.nevu_hq_access() and ((sender_type='administrator' and sender_user_id=auth.uid() and sender_holding_id=public.nevu_my_holding_id()) or sender_type='nevu_ai' or sender_type='system'));
drop policy if exists nevu_hq_polls_all on public.nevu_hq_polls;
create policy nevu_hq_polls_all on public.nevu_hq_polls for all to authenticated using(public.nevu_hq_access()) with check(public.nevu_hq_access() and created_by=auth.uid());
drop policy if exists nevu_hq_poll_options_all on public.nevu_hq_poll_options;
create policy nevu_hq_poll_options_all on public.nevu_hq_poll_options for all to authenticated using(public.nevu_hq_access()) with check(public.nevu_hq_access());
drop policy if exists nevu_hq_poll_votes_all on public.nevu_hq_poll_votes;
create policy nevu_hq_poll_votes_all on public.nevu_hq_poll_votes for all to authenticated using(public.nevu_hq_access()) with check(public.nevu_hq_access() and voter_user_id=auth.uid());

drop policy if exists nevu_ai_conn_self on public.nevu_ai_connections;
create policy nevu_ai_conn_self on public.nevu_ai_connections for all to authenticated using(public.nevu_is_my_holding(holding_id)) with check(public.nevu_is_my_holding(holding_id));
drop policy if exists nevu_agent_assign_self on public.nevu_agent_assignments;
create policy nevu_agent_assign_self on public.nevu_agent_assignments for all to authenticated using(public.nevu_is_my_holding(holding_id)) with check(public.nevu_is_my_holding(holding_id));
drop policy if exists nevu_ai_runs_self on public.nevu_ai_runs;
create policy nevu_ai_runs_self on public.nevu_ai_runs for select to authenticated using(holding_id is null or public.nevu_is_my_holding(holding_id));
drop policy if exists nevu_portfolio_self on public.nevu_portfolio_positions;
create policy nevu_portfolio_self on public.nevu_portfolio_positions for all to authenticated using(public.nevu_is_my_holding(holding_id)) with check(public.nevu_is_my_holding(holding_id));
drop policy if exists nevu_capital_self on public.nevu_capital_snapshots;
create policy nevu_capital_self on public.nevu_capital_snapshots for all to authenticated using(public.nevu_is_my_holding(holding_id)) with check(public.nevu_is_my_holding(holding_id));
drop policy if exists nevu_decision_self on public.nevu_decisions;
create policy nevu_decision_self on public.nevu_decisions for all to authenticated using(public.nevu_is_my_holding(holding_id)) with check(public.nevu_is_my_holding(holding_id));
drop policy if exists nevu_minutes_self on public.nevu_minutes;
create policy nevu_minutes_self on public.nevu_minutes for all to authenticated using(public.nevu_is_my_holding(holding_id)) with check(public.nevu_is_my_holding(holding_id));
drop policy if exists nevu_archive_self on public.nevu_archive_records;
create policy nevu_archive_self on public.nevu_archive_records for all to authenticated using(public.nevu_is_my_holding(holding_id)) with check(public.nevu_is_my_holding(holding_id));
drop policy if exists nevu_shares_participant on public.nevu_shares;
create policy nevu_shares_participant on public.nevu_shares for select to authenticated using(public.nevu_is_my_holding(sender_holding_id) or (recipient_holding_id is not null and public.nevu_is_my_holding(recipient_holding_id)));
drop policy if exists nevu_shares_create on public.nevu_shares;
create policy nevu_shares_create on public.nevu_shares for insert to authenticated with check(public.nevu_is_my_holding(sender_holding_id));
drop policy if exists nevu_files_self on public.nevu_files;
create policy nevu_files_self on public.nevu_files for all to authenticated using(public.nevu_is_my_holding(holding_id)) with check(public.nevu_is_my_holding(holding_id) and uploaded_by=auth.uid());
drop policy if exists nevu_audit_self on public.nevu_audit_events;
create policy nevu_audit_self on public.nevu_audit_events for select to authenticated using(holding_id is null or public.nevu_is_my_holding(holding_id));

-- Governance requests are visible only to the requesting Holding and voting Holdings, not as private Holding data.
drop policy if exists nevu_requests_read on public.nevu_holding_requests;
create policy nevu_requests_read on public.nevu_holding_requests for select to authenticated using(public.nevu_is_my_holding(requested_by_holding_id));
drop policy if exists nevu_requests_create on public.nevu_holding_requests;
create policy nevu_requests_create on public.nevu_holding_requests for insert to authenticated with check(public.nevu_is_my_holding(requested_by_holding_id));
drop policy if exists nevu_votes_read on public.nevu_holding_request_votes;
create policy nevu_votes_read on public.nevu_holding_request_votes for select to authenticated using(public.nevu_is_my_holding(voter_holding_id));
drop policy if exists nevu_votes_create on public.nevu_holding_request_votes;
create policy nevu_votes_create on public.nevu_holding_request_votes for insert to authenticated with check(public.nevu_is_my_holding(voter_holding_id));

-- Realtime publication (safe if already present).
do $$ begin if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='nevu_messages') then alter publication supabase_realtime add table public.nevu_messages; end if; end $$;
do $$ begin if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='nevu_hq_messages') then alter publication supabase_realtime add table public.nevu_hq_messages; end if; end $$;
do $$ begin if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='nevu_presence') then alter publication supabase_realtime add table public.nevu_presence; end if; end $$;
do $$ begin if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='nevu_sessions') then alter publication supabase_realtime add table public.nevu_sessions; end if; end $$;
do $$ begin if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='nevu_hq_sessions') then alter publication supabase_realtime add table public.nevu_hq_sessions; end if; end $$;

-- Storage bucket for NEVU files / voice notes. Storage RLS can be tightened further in dashboard if needed.
insert into storage.buckets(id,name,public) values('nevu-files','nevu-files',false) on conflict(id) do nothing;

create or replace function public.nevu_complete_setup() returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Email verification required'; end if;
  update public.nevu_administrators set setup_complete=true,updated_at=now() where id=auth.uid();
  return found;
end; $$;
grant execute on function public.nevu_complete_setup() to authenticated;
grant execute on function public.nevu_approve_decision(uuid,text) to authenticated;

-- Safe NEVU HQ directory: exposes only what is needed for Boardroom identity/presence.
create or replace function public.nevu_hq_directory()
returns table(holding_id uuid, holding_name text, username text, presence_status text, personal_ai_present boolean)
language sql stable security definer set search_path=public as $$
  select h.id, h.holding_name, a.username, coalesce(p.status,'offline'), coalesce(p.personal_ai_present,false)
  from public.holdings h join public.nevu_administrators a on a.id=h.administrator_id
  left join public.nevu_presence p on p.holding_id=h.id
  where h.is_active=true order by h.created_at;
$$;
grant execute on function public.nevu_hq_directory() to authenticated;

-- Tighten agent/system writes: client Administrators cannot impersonate an AI agent.
drop policy if exists nevu_message_self on public.nevu_messages;
drop policy if exists nevu_message_read_self on public.nevu_messages;
create policy nevu_message_read_self on public.nevu_messages for select to authenticated using(public.nevu_is_my_holding(holding_id));
drop policy if exists nevu_message_admin_insert on public.nevu_messages;
create policy nevu_message_admin_insert on public.nevu_messages for insert to authenticated with check(public.nevu_is_my_holding(holding_id) and sender_type='administrator' and sender_user_id=auth.uid());
drop policy if exists nevu_message_admin_update on public.nevu_messages;
create policy nevu_message_admin_update on public.nevu_messages for update to authenticated using(public.nevu_is_my_holding(holding_id) and sender_type='administrator' and sender_user_id=auth.uid()) with check(public.nevu_is_my_holding(holding_id) and sender_type='administrator' and sender_user_id=auth.uid());
drop policy if exists nevu_message_admin_delete on public.nevu_messages;
create policy nevu_message_admin_delete on public.nevu_messages for delete to authenticated using(public.nevu_is_my_holding(holding_id) and sender_type='administrator' and sender_user_id=auth.uid());

drop policy if exists nevu_hq_message_insert on public.nevu_hq_messages;
drop policy if exists nevu_hq_message_admin_insert on public.nevu_hq_messages;
create policy nevu_hq_message_admin_insert on public.nevu_hq_messages for insert to authenticated with check(public.nevu_hq_access() and sender_type='administrator' and sender_user_id=auth.uid() and sender_holding_id=public.nevu_my_holding_id());

-- Unanimous governance vote helper. A request becomes approved only after every existing Holding has voted yes.
create or replace function public.nevu_cast_holding_vote(p_request_id uuid, p_vote boolean) returns text language plpgsql security definer set search_path=public as $$
declare v_holding uuid:=public.nevu_my_holding_id(); v_total int; v_yes int; v_no int;
begin
 if v_holding is null then raise exception 'Administrator access required'; end if;
 if not exists(select 1 from public.nevu_holding_requests where id=p_request_id and status='pending') then raise exception 'Request is not pending'; end if;
 insert into public.nevu_holding_request_votes(request_id,voter_holding_id,vote) values(p_request_id,v_holding,p_vote)
 on conflict(request_id,voter_holding_id) do update set vote=excluded.vote,created_at=now();
 select count(*) into v_total from public.holdings where is_active=true;
 select count(*) into v_yes from public.nevu_holding_request_votes where request_id=p_request_id and vote=true;
 select count(*) into v_no from public.nevu_holding_request_votes where request_id=p_request_id and vote=false;
 if v_no>0 then update public.nevu_holding_requests set status='rejected',resolved_at=now() where id=p_request_id; return 'rejected'; end if;
 if v_yes>=v_total then update public.nevu_holding_requests set status='approved',resolved_at=now() where id=p_request_id; return 'approved'; end if;
 return 'pending';
end; $$;
grant execute on function public.nevu_cast_holding_vote(uuid,boolean) to authenticated;

create or replace function public.nevu_network_requests()
returns table(request_id uuid, proposed_legal_name text, proposed_holding_name text, status text, yes_votes bigint, total_holdings bigint, created_at timestamptz)
language sql stable security definer set search_path=public as $$
 select r.id,r.proposed_legal_name,r.proposed_holding_name,r.status,
        (select count(*) from public.nevu_holding_request_votes v where v.request_id=r.id and v.vote=true),
        (select count(*) from public.holdings h where h.is_active=true),r.created_at
 from public.nevu_holding_requests r order by r.created_at desc;
$$;
grant execute on function public.nevu_network_requests() to authenticated;

-- Replace bootstrap rules with the founding-four + unanimous-expansion model.
create or replace function public.nevu_bootstrap_administrator() returns trigger language plpgsql security definer set search_path=public as $$
declare v_legal text; v_username text; v_full text; v_holding text; v_capital numeric; v_code text; v_count int; v_approved boolean;
begin
  v_legal := trim(coalesce(new.raw_user_meta_data->>'legal_name',''));
  v_username := trim(coalesce(new.raw_user_meta_data->>'username',''));
  v_full := trim(coalesce(new.raw_user_meta_data->>'full_name',''));
  v_holding := trim(coalesce(new.raw_user_meta_data->>'holding_name',''));
  v_capital := greatest(coalesce((new.raw_user_meta_data->>'capital')::numeric,0),0);
  if v_username='' or v_full='' or v_holding='' then raise exception 'NEVU setup fields incomplete'; end if;
  select count(*) into v_count from public.holdings where is_active=true;
  if v_count < 4 then
    if v_legal not in ('Nwachuku','Ezra','Victor','Uchechukwu') then raise exception 'Access Denied'; end if;
    if exists(select 1 from public.nevu_administrators where legal_name=v_legal) then raise exception 'That founding stakeholder already has an Administrator account'; end if;
  else
    select exists(select 1 from public.nevu_holding_requests where status='approved' and proposed_legal_name=v_legal and lower(proposed_email)=lower(new.email) and proposed_admin_username=v_username) into v_approved;
    if not v_approved then raise exception 'A unanimous NEVU Holding approval is required before this Administrator can be created'; end if;
  end if;
  loop v_code := lpad((floor(random()*1000000))::bigint::text,6,'0'); exit when not exists(select 1 from public.holdings where nevu_code=v_code); end loop;
  insert into public.nevu_administrators(id,legal_name,full_name,username,email,setup_complete) values(new.id,v_legal,v_full,v_username,new.email,false);
  insert into public.holdings(administrator_id,legal_name,holding_name,nevu_code,setup_capital) values(new.id,v_legal,v_holding,v_code,v_capital);
  insert into public.nevu_presence(user_id,holding_id,status,personal_ai_present) values(new.id,(select id from public.holdings where administrator_id=new.id),'offline',false);
  return new;
end; $$;

-- Approval creates the official archive and minutes automatically. Actual brokerage execution remains manual.
create or replace function public.nevu_approve_decision(p_decision_id uuid, p_phrase text) returns boolean language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_username text; v_holding uuid; v_expected text; v_session uuid; v_title text; v_verdict text; v_conf numeric; v_record text;
begin
 select username into v_username from public.nevu_administrators where id=v_user and setup_complete=true;
 v_holding:=public.nevu_my_holding_id(); if v_username is null or v_holding is null then raise exception 'Administrator access required'; end if;
 v_expected:='Approved by '||v_username; if p_phrase<>v_expected then return false; end if;
 select session_id,title,verdict,confidence into v_session,v_title,v_verdict,v_conf from public.nevu_decisions where id=p_decision_id and holding_id=v_holding and status='pending_approval';
 if v_session is null then return false; end if;
 update public.nevu_decisions set status='approved',approval_phrase=p_phrase,approved_at=now(),approved_by=v_user where id=p_decision_id;
 select coalesce(string_agg(to_char(created_at,'YYYY-MM-DD HH24:MI:SS TZ')||' ['||sender_type||coalesce(':'||agent_key,'')||'] '||coalesce(message,''),E'\n' order by created_at),'No messages recorded.') into v_record from public.nevu_messages where session_id=v_session;
 insert into public.nevu_archive_records(holding_id,session_id,decision_id,title,exact_datetime,summary,participants,data_used,files_used,combined_verdict,risk_levels,confidence_score,approval_stamp,full_record)
 values(v_holding,v_session,p_decision_id,v_title,now(),'Official approved NEVU decision.',jsonb_build_array(v_username,'NEVU specialist agents'),'[]'::jsonb,'[]'::jsonb,v_verdict,'{}'::jsonb,v_conf,v_expected,v_record||E'\n\nApproval: '||v_expected);
 insert into public.nevu_minutes(holding_id,session_id,content,confirmed) values(v_holding,v_session,'Approval recorded for '||v_title||'. Archive Agent official record created. Minute Agent confirmation pending.',true);
 return true;
end; $$;

grant execute on function public.nevu_approve_decision(uuid,text) to authenticated;
create or replace function public.nevu_mark_decision_executed(p_decision_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin update public.nevu_decisions set status='executed' where id=p_decision_id and holding_id=public.nevu_my_holding_id() and status='approved'; return found; end; $$;
grant execute on function public.nevu_mark_decision_executed(uuid) to authenticated;

-- Private storage policies: object paths begin with the Holding UUID.
drop policy if exists nevu_storage_read on storage.objects;
drop policy if exists nevu_storage_insert on storage.objects;
drop policy if exists nevu_storage_update on storage.objects;
drop policy if exists nevu_storage_delete on storage.objects;
drop policy if exists nevu_storage_read on storage.objects;
create policy nevu_storage_read on storage.objects for select to authenticated using(bucket_id='nevu-files' and public.nevu_is_my_holding((storage.foldername(name))[1]::uuid));
drop policy if exists nevu_storage_insert on storage.objects;
create policy nevu_storage_insert on storage.objects for insert to authenticated with check(bucket_id='nevu-files' and public.nevu_is_my_holding((storage.foldername(name))[1]::uuid));
drop policy if exists nevu_storage_update on storage.objects;
create policy nevu_storage_update on storage.objects for update to authenticated using(bucket_id='nevu-files' and public.nevu_is_my_holding((storage.foldername(name))[1]::uuid)) with check(bucket_id='nevu-files' and public.nevu_is_my_holding((storage.foldername(name))[1]::uuid));
drop policy if exists nevu_storage_delete on storage.objects;
create policy nevu_storage_delete on storage.objects for delete to authenticated using(bucket_id='nevu-files' and public.nevu_is_my_holding((storage.foldername(name))[1]::uuid));

drop function if exists public.nevu_hq_directory();
create or replace function public.nevu_hq_directory()
returns table(holding_id uuid, holding_name text, username text, presence_status text)
language sql stable security definer set search_path=public as $$
  select h.id,h.holding_name,a.username,coalesce(p.status,'offline')
  from public.holdings h join public.nevu_administrators a on a.id=h.administrator_id
  left join public.nevu_presence p on p.holding_id=h.id
  where h.is_active=true order by h.created_at;
$$;
grant execute on function public.nevu_hq_directory() to authenticated;

-- ---------- Private Holding-to-Holding chat ----------
create table if not exists public.nevu_holding_chats (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Private Holding Chat',
  is_group boolean not null default false,
  created_by_holding_id uuid not null references public.holdings(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.nevu_holding_chat_participants (
  chat_id uuid not null references public.nevu_holding_chats(id) on delete cascade,
  holding_id uuid not null references public.holdings(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(chat_id,holding_id)
);
create table if not exists public.nevu_holding_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.nevu_holding_chats(id) on delete cascade,
  sender_holding_id uuid not null references public.holdings(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  message_type text not null default 'text' check(message_type in ('text','voice','image','file','poll')),
  message text,
  storage_path text,
  created_at timestamptz not null default now()
);
create index if not exists idx_nevu_holding_chat_messages on public.nevu_holding_chat_messages(chat_id,created_at);
alter table public.nevu_holding_chats enable row level security;
alter table public.nevu_holding_chat_participants enable row level security;
alter table public.nevu_holding_chat_messages enable row level security;
drop policy if exists nevu_chat_read on public.nevu_holding_chats;
create policy nevu_chat_read on public.nevu_holding_chats for select to authenticated using(exists(select 1 from public.nevu_holding_chat_participants p where p.chat_id=id and public.nevu_is_my_holding(p.holding_id)));
drop policy if exists nevu_chat_participant_read on public.nevu_holding_chat_participants;
create policy nevu_chat_participant_read on public.nevu_holding_chat_participants for select to authenticated using(public.nevu_is_my_holding(holding_id));
drop policy if exists nevu_chat_message_read on public.nevu_holding_chat_messages;
create policy nevu_chat_message_read on public.nevu_holding_chat_messages for select to authenticated using(exists(select 1 from public.nevu_holding_chat_participants p where p.chat_id=chat_id and public.nevu_is_my_holding(p.holding_id)));
drop policy if exists nevu_chat_message_insert on public.nevu_holding_chat_messages;
create policy nevu_chat_message_insert on public.nevu_holding_chat_messages for insert to authenticated with check(sender_holding_id=public.nevu_my_holding_id() and sender_user_id=auth.uid() and exists(select 1 from public.nevu_holding_chat_participants p where p.chat_id=chat_id and public.nevu_is_my_holding(p.holding_id)));
create or replace function public.nevu_create_holding_chat(p_recipient_holding_id uuid,p_title text default 'Private Holding Chat') returns uuid language plpgsql security definer set search_path=public as $$
declare v_mine uuid:=public.nevu_my_holding_id(); v_chat uuid;
begin
 if v_mine is null or p_recipient_holding_id is null or p_recipient_holding_id=v_mine then raise exception 'Invalid Holding chat target'; end if;
 insert into public.nevu_holding_chats(title,is_group,created_by_holding_id) values(coalesce(nullif(trim(p_title),''),'Private Holding Chat'),false,v_mine) returning id into v_chat;
 insert into public.nevu_holding_chat_participants(chat_id,holding_id) values(v_chat,v_mine),(v_chat,p_recipient_holding_id);
 return v_chat;
end; $$;
grant execute on function public.nevu_create_holding_chat(uuid,text) to authenticated;
do $$ begin if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='nevu_holding_chat_messages') then alter publication supabase_realtime add table public.nevu_holding_chat_messages; end if; end $$;
create or replace function public.nevu_create_holding_group(p_recipient_holding_ids uuid[], p_title text) returns uuid language plpgsql security definer set search_path=public as $$
declare v_mine uuid:=public.nevu_my_holding_id(); v_chat uuid; v_id uuid;
begin
 if v_mine is null or coalesce(array_length(p_recipient_holding_ids,1),0)<1 then raise exception 'Choose at least one other Holding'; end if;
 insert into public.nevu_holding_chats(title,is_group,created_by_holding_id) values(coalesce(nullif(trim(p_title),''),'NEVU Holding Group'),true,v_mine) returning id into v_chat;
 insert into public.nevu_holding_chat_participants(chat_id,holding_id) values(v_chat,v_mine);
 foreach v_id in array p_recipient_holding_ids loop if v_id<>v_mine then insert into public.nevu_holding_chat_participants(chat_id,holding_id) values(v_chat,v_id) on conflict do nothing; end if; end loop;
 return v_chat;
end; $$;
grant execute on function public.nevu_create_holding_group(uuid[],text) to authenticated;
create or replace function public.nevu_create_holding_request(p_legal_name text,p_username text,p_holding_name text,p_email text) returns uuid language plpgsql security definer set search_path=public as $$
declare v_mine uuid:=public.nevu_my_holding_id(); v_count int; v_id uuid;
begin
 if v_mine is null then raise exception 'Administrator access required'; end if;
 select count(*) into v_count from public.holdings where is_active=true;
 if v_count<4 then raise exception 'The first four founding Holdings must be established before expansion requests are opened'; end if;
 insert into public.nevu_holding_requests(requested_by_holding_id,proposed_legal_name,proposed_admin_username,proposed_holding_name,proposed_email) values(v_mine,trim(p_legal_name),trim(p_username),trim(p_holding_name),lower(trim(p_email))) returning id into v_id;
 return v_id;
end; $$;
grant execute on function public.nevu_create_holding_request(text,text,text,text) to authenticated;

create or replace function public.nevu_seed_agent_assignments() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.nevu_agent_assignments(holding_id,agent_key,provider,enabled)
 values
 (new.id,'educator','local_bridge',true),(new.id,'analyst','local_bridge',true),(new.id,'market_context','local_bridge',true),(new.id,'risk_officer','local_bridge',true),(new.id,'portfolio_architect','local_bridge',true),(new.id,'compliance_decision','local_bridge',true),(new.id,'personal_assistant','local_bridge',true),(new.id,'minute_keeper','local_bridge',true),(new.id,'archive','local_bridge',true)
 on conflict(holding_id,agent_key) do nothing;
 return new;
end; $$;
drop trigger if exists nevu_seed_agents_on_holding on public.holdings;
create trigger nevu_seed_agents_on_holding after insert on public.holdings for each row execute function public.nevu_seed_agent_assignments();
insert into public.nevu_agent_assignments(holding_id,agent_key,provider,enabled)
select h.id,a.agent_key,'local_bridge',true from public.holdings h cross join (values('educator'),('analyst'),('market_context'),('risk_officer'),('portfolio_architect'),('compliance_decision'),('personal_assistant'),('minute_keeper'),('archive')) a(agent_key)
on conflict(holding_id,agent_key) do nothing;
