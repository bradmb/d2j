CREATE TABLE IF NOT EXISTS ticket_checks (
  ticket_key TEXT PRIMARY KEY,
  last_checked TEXT NOT NULL
);
