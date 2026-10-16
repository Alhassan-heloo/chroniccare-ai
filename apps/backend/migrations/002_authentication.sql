CREATE TABLE chroniccare.users (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  email text NOT NULL UNIQUE CHECK (email = lower(email) AND char_length(email) <= 254),
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'doctor', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chroniccare.sessions (
  token_hash text PRIMARY KEY CHECK (char_length(token_hash) = 64),
  user_id uuid NOT NULL REFERENCES chroniccare.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON chroniccare.sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON chroniccare.sessions(expires_at);
