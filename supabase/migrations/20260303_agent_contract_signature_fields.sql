begin;

alter table public.pending_users
  add column if not exists contract_signer_full_name text,
  add column if not exists contract_signer_signature text,
  add column if not exists contract_agent_name text,
  add column if not exists contract_counterparty_full_name text,
  add column if not exists contract_counterparty_signature text;

commit;
