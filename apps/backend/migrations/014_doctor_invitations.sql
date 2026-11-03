ALTER TABLE chroniccare.account_tokens DROP CONSTRAINT account_tokens_purpose_check;
ALTER TABLE chroniccare.account_tokens ADD CONSTRAINT account_tokens_purpose_check
  CHECK (purpose IN ('admin_activation','password_reset','doctor_activation'));
ALTER TABLE chroniccare.account_tokens ADD COLUMN invited_name text;
ALTER TABLE chroniccare.account_tokens ADD CONSTRAINT doctor_invitation_identity_check
  CHECK (purpose <> 'doctor_activation' OR
    (user_id IS NULL AND invited_name IS NOT NULL AND length(trim(invited_name)) BETWEEN 1 AND 100));
