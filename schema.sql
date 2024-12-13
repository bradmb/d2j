CREATE TABLE IF NOT EXISTS ticket_checks (
  ticket_key TEXT PRIMARY KEY,
  last_checked TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS thread_mappings (
  jira_ticket_key TEXT PRIMARY KEY,
  slack_thread_ts TEXT NOT NULL,
  last_checked TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_thread_mappings_thread_ts ON thread_mappings(slack_thread_ts);
