ALTER TABLE chroniccare.doctor_patient_relationships
  ADD COLUMN patient_approved_at timestamptz;
COMMENT ON COLUMN chroniccare.doctor_patient_relationships.patient_approved_at IS
  'Explicit patient confirmation time. NULL preserves legacy operator-managed authorization without claiming patient consent.';

CREATE TABLE chroniccare.doctor_connection_codes (
  code_hash text PRIMARY KEY CHECK (code_hash ~ '^[a-f0-9]{64}$'),
  doctor_id uuid NOT NULL REFERENCES chroniccare.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  consumed_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX doctor_connection_codes_expiry_idx ON chroniccare.doctor_connection_codes(expires_at);
