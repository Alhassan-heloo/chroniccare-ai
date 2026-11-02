CREATE TABLE chroniccare.push_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  enabled boolean NOT NULL DEFAULT false,
  enabled_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO chroniccare.push_control(singleton) VALUES(true);
CREATE TABLE chroniccare.push_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES chroniccare.notifications(id) ON DELETE CASCADE,
  fid text NOT NULL, session_hash text NOT NULL, registration_created_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  attempts integer NOT NULL DEFAULT 0,
  due_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  lease uuid, lease_until timestamptz,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sent','skipped','failed')),
  UNIQUE(notification_id,fid)
);
CREATE INDEX push_jobs_due ON chroniccare.push_jobs(due_at) WHERE state='pending';
CREATE FUNCTION chroniccare.enqueue_push() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,chroniccare AS $$
BEGIN
  IF NEW.type NOT IN ('connection_approved','connection_revoked') THEN RETURN NULL; END IF;
  IF NOT EXISTS(SELECT 1 FROM chroniccare.push_control WHERE enabled) THEN RETURN NULL; END IF;
  INSERT INTO chroniccare.push_jobs(notification_id,fid,session_hash,registration_created_at)
    SELECT NEW.id,r.fid,r.session_hash,r.created_at FROM chroniccare.browser_registrations r
    WHERE r.user_id=NEW.user_id ON CONFLICT DO NOTHING;
  RETURN NULL;
END; $$;
CREATE TRIGGER notification_push AFTER INSERT ON chroniccare.notifications
FOR EACH ROW EXECUTE FUNCTION chroniccare.enqueue_push();
