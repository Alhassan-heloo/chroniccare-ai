CREATE TABLE chroniccare.medications (
  id uuid PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES chroniccare.users(id) ON DELETE RESTRICT,
  name text NOT NULL,
  dosage text NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT medications_valid_text CHECK (
    name = btrim(name) AND char_length(name) BETWEEN 2 AND 100
    AND dosage = btrim(dosage) AND char_length(dosage) BETWEEN 1 AND 100
    AND notes = btrim(notes) AND char_length(notes) <= 400
  )
);

CREATE TABLE chroniccare.medication_schedules (
  medication_id uuid NOT NULL REFERENCES chroniccare.medications(id) ON DELETE CASCADE,
  scheduled_time time(0) without time zone NOT NULL,
  PRIMARY KEY (medication_id, scheduled_time)
);

CREATE TABLE chroniccare.medication_dose_logs (
  medication_id uuid NOT NULL,
  scheduled_time time(0) without time zone NOT NULL,
  taken_on date NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (medication_id, scheduled_time, taken_on),
  FOREIGN KEY (medication_id, scheduled_time)
    REFERENCES chroniccare.medication_schedules(medication_id, scheduled_time)
    ON DELETE CASCADE
);

CREATE INDEX medications_patient_created_idx
  ON chroniccare.medications(patient_id, created_at, id);
CREATE INDEX medication_dose_logs_day_idx
  ON chroniccare.medication_dose_logs(taken_on, medication_id);

COMMENT ON TABLE chroniccare.medications IS 'Patient-owned medication schedule records; not prescriptions or clinical recommendations.';
COMMENT ON COLUMN chroniccare.medication_schedules.scheduled_time IS 'Recurring local wall-clock time (HH:MM), without timezone conversion.';
COMMENT ON COLUMN chroniccare.medication_dose_logs.taken_on IS 'Patient device local calendar date supplied explicitly as YYYY-MM-DD.';
