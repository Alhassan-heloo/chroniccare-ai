CREATE TABLE chroniccare.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES chroniccare.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('connection_approved','connection_revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX notifications_user_created_idx ON chroniccare.notifications(user_id,created_at DESC,id DESC);
CREATE INDEX notifications_user_unread_idx ON chroniccare.notifications(user_id) WHERE read_at IS NULL;

-- Emit only for real relationship transitions, in the same transaction. No backfill
-- or fabricated consent for legacy rows, and no events from account-delete cascades.
CREATE FUNCTION chroniccare.notify_connection_change() RETURNS trigger
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
  INSERT INTO chroniccare.notifications(user_id,type) VALUES(doctor,event_type),(patient,event_type);
  RETURN NULL;
END;
$$;
CREATE TRIGGER relationship_notifications
AFTER INSERT OR UPDATE OR DELETE ON chroniccare.doctor_patient_relationships
FOR EACH ROW EXECUTE FUNCTION chroniccare.notify_connection_change();
