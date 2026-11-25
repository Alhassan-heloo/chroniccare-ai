ALTER TABLE chroniccare.patient_invitations
  ADD COLUMN rejected boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT patient_invitations_rejection_consumed_check
    CHECK (NOT rejected OR (consumed_at IS NOT NULL AND patient_id IS NOT NULL));
