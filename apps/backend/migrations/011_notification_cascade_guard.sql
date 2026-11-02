-- 010 was already applied to the isolated test database. Preserve its checksum
-- and harden its trigger without dropping data or changing prior migrations.
CREATE OR REPLACE FUNCTION chroniccare.notify_connection_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, chroniccare AS $$
DECLARE event_type text; doctor uuid; patient uuid;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NULL; END IF;
  IF TG_OP = 'DELETE' THEN
    event_type := 'connection_revoked'; doctor := OLD.doctor_id; patient := OLD.patient_id;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.patient_approved_at IS NULL THEN RETURN NULL; END IF;
    event_type := 'connection_approved'; doctor := NEW.doctor_id; patient := NEW.patient_id;
  ELSE
    IF OLD.patient_approved_at IS NOT NULL OR NEW.patient_approved_at IS NULL THEN RETURN NULL; END IF;
    event_type := 'connection_approved'; doctor := NEW.doctor_id; patient := NEW.patient_id;
  END IF;
  -- FK cascade AFTER triggers may run at depth one. Both accounts must still
  -- exist: an account cleanup is not a patient-initiated relationship revocation.
  IF NOT EXISTS (SELECT 1 FROM chroniccare.users WHERE id=doctor)
     OR NOT EXISTS (SELECT 1 FROM chroniccare.users WHERE id=patient) THEN RETURN NULL; END IF;
  INSERT INTO chroniccare.notifications(user_id,type) VALUES(doctor,event_type),(patient,event_type);
  RETURN NULL;
END;
$$;
