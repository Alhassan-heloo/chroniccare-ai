CREATE TABLE chroniccare.doctor_patient_relationships (
  doctor_id uuid NOT NULL REFERENCES chroniccare.users(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES chroniccare.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (doctor_id, patient_id),
  CONSTRAINT doctor_patient_distinct_users CHECK (doctor_id <> patient_id)
);

CREATE INDEX doctor_patient_relationships_patient_idx
  ON chroniccare.doctor_patient_relationships(patient_id, doctor_id);

CREATE FUNCTION chroniccare.validate_doctor_patient_roles()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, chroniccare
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM chroniccare.users
    WHERE id = NEW.doctor_id AND role = 'doctor'
  ) THEN
    RAISE EXCEPTION 'doctor_id must reference a doctor account'
      USING ERRCODE = '23514', CONSTRAINT = 'doctor_patient_doctor_role_check';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM chroniccare.users
    WHERE id = NEW.patient_id AND role = 'patient'
  ) THEN
    RAISE EXCEPTION 'patient_id must reference a patient account'
      USING ERRCODE = '23514', CONSTRAINT = 'doctor_patient_patient_role_check';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER doctor_patient_relationship_roles
BEFORE INSERT OR UPDATE ON chroniccare.doctor_patient_relationships
FOR EACH ROW EXECUTE FUNCTION chroniccare.validate_doctor_patient_roles();

COMMENT ON TABLE chroniccare.doctor_patient_relationships IS
  'Operator-managed authorization boundary for read-only doctor access to patient records.';
