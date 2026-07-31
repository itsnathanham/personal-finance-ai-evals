/** Shared DDL for PGlite local/demo and optional Neon bootstrap. */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS households (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  household_id text NOT NULL REFERENCES households(id),
  display_name text NOT NULL,
  email text NOT NULL
);
CREATE TABLE IF NOT EXISTS accounts (
  id text PRIMARY KEY,
  household_id text NOT NULL REFERENCES households(id),
  name text NOT NULL,
  type text NOT NULL,
  institution text NOT NULL,
  mask text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  balance numeric(12,2) NOT NULL
);
CREATE TABLE IF NOT EXISTS transactions (
  id text PRIMARY KEY,
  household_id text NOT NULL REFERENCES households(id),
  account_id text NOT NULL REFERENCES accounts(id),
  posted_at text NOT NULL,
  merchant text NOT NULL,
  category text NOT NULL,
  amount numeric(12,2) NOT NULL,
  memo text,
  is_recurring boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS budgets (
  id text PRIMARY KEY,
  household_id text NOT NULL REFERENCES households(id),
  category text NOT NULL,
  month text NOT NULL,
  limit_amount numeric(12,2) NOT NULL
);
CREATE TABLE IF NOT EXISTS goals (
  id text PRIMARY KEY,
  household_id text NOT NULL REFERENCES households(id),
  name text NOT NULL,
  target_amount numeric(12,2) NOT NULL,
  current_amount numeric(12,2) NOT NULL,
  target_date text
);
CREATE TABLE IF NOT EXISTS audit_events (
  id text PRIMARY KEY,
  household_id text NOT NULL,
  tool_name text NOT NULL,
  args_json text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  latency_ms integer
);
CREATE TABLE IF NOT EXISTS eval_runs (
  id text PRIMARY KEY,
  status text NOT NULL,
  suite_ids_json text NOT NULL,
  model_ids_json text NOT NULL,
  total_cases integer NOT NULL DEFAULT 0,
  completed_cases integer NOT NULL DEFAULT 0,
  passed_cases integer NOT NULL DEFAULT 0,
  failed_cases integer NOT NULL DEFAULT 0,
  error_cases integer NOT NULL DEFAULT 0,
  current_label text,
  summary_json text,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE TABLE IF NOT EXISTS eval_case_results (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES eval_runs(id),
  suite_id text NOT NULL,
  case_id text NOT NULL,
  case_description text NOT NULL,
  model_id text NOT NULL,
  prompt text NOT NULL,
  output text,
  tools_used_json text,
  pass boolean,
  fail_reasons_json text,
  latency_ms integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS accounts_household_idx ON accounts(household_id);
CREATE INDEX IF NOT EXISTS tx_household_idx ON transactions(household_id);
CREATE INDEX IF NOT EXISTS tx_posted_idx ON transactions(posted_at);
CREATE INDEX IF NOT EXISTS tx_category_idx ON transactions(category);
CREATE INDEX IF NOT EXISTS budgets_household_month_idx ON budgets(household_id, month);
CREATE INDEX IF NOT EXISTS eval_case_results_run_idx ON eval_case_results(run_id);
`;
