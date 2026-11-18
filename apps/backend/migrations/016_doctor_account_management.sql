ALTER TABLE chroniccare.users ADD COLUMN disabled boolean NOT NULL DEFAULT false;

-- Check every incoming FK, including CASCADE relations, before allowing deletion.
-- Locking the parent serializes this operation with concurrent FK inserts.
CREATE FUNCTION chroniccare.delete_unreferenced_doctor(target uuid) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE relation record; dependent boolean;
BEGIN
  PERFORM 1 FROM chroniccare.users WHERE id=target AND role='doctor' FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  FOR relation IN
    SELECT c.conrelid, c.conkey, a.attname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
    WHERE c.contype='f' AND c.confrelid='chroniccare.users'::regclass
  LOOP
    -- Fail closed if a future schema adds an unfamiliar composite relationship.
    IF cardinality(relation.conkey)<>1 THEN RETURN 'blocked'; END IF;
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s WHERE %I=$1)',relation.conrelid::regclass,relation.attname)
      INTO dependent USING target;
    IF dependent THEN RETURN 'blocked'; END IF;
  END LOOP;
  DELETE FROM chroniccare.users WHERE id=target AND role='doctor';
  RETURN 'deleted';
END;
$$;
