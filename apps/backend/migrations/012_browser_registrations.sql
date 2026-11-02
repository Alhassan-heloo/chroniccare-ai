CREATE TABLE chroniccare.browser_registrations (
  fid text PRIMARY KEY CHECK (fid ~ '^[cdef][A-Za-z0-9_-]{21}$'),
  user_id uuid NOT NULL REFERENCES chroniccare.users(id) ON DELETE CASCADE,
  session_hash text NOT NULL REFERENCES chroniccare.sessions(token_hash) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_hash)
);
CREATE INDEX browser_registrations_user_idx ON chroniccare.browser_registrations(user_id);
