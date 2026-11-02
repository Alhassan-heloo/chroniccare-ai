ALTER TABLE chroniccare.sessions ADD COLUMN last_seen_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE chroniccare.account_tokens (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  purpose text NOT NULL CHECK (purpose IN ('admin_activation','password_reset')),
  email text NOT NULL CHECK (email=lower(email)),
  user_id uuid REFERENCES chroniccare.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  delivered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_tokens_email_purpose_idx ON chroniccare.account_tokens(email,purpose);
