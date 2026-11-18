-- Separate targeted links preserve the existing manual-code API and its semantics.
CREATE TABLE chroniccare.patient_invitations (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  doctor_id uuid NOT NULL REFERENCES chroniccare.users(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES chroniccare.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '10 minutes'),
  consumed_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX patient_invitations_expiry_idx ON chroniccare.patient_invitations(expires_at);
