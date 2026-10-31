CREATE TABLE chroniccare.habits (
  id uuid PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES chroniccare.users(id) ON DELETE RESTRICT,
  title text NOT NULL,
  unit text NOT NULL,
  target integer NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT habits_valid_definition CHECK (
    title = btrim(title) AND char_length(title) BETWEEN 2 AND 80
    AND unit IN ('steps', 'minutes', 'cups', 'times')
    AND target BETWEEN 1 AND 100000
  )
);

CREATE TABLE chroniccare.habit_progress (
  habit_id uuid NOT NULL REFERENCES chroniccare.habits(id) ON DELETE CASCADE,
  recorded_on date NOT NULL,
  value integer NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (habit_id, recorded_on),
  CONSTRAINT habit_progress_valid_value CHECK (value BETWEEN 0 AND 100000)
);

CREATE INDEX habits_patient_created_idx ON chroniccare.habits(patient_id, created_at, id);
CREATE INDEX habit_progress_day_idx ON chroniccare.habit_progress(recorded_on, habit_id);

COMMENT ON TABLE chroniccare.habits IS 'Patient-owned habit definitions; targets are user-entered and are not clinical recommendations.';
COMMENT ON COLUMN chroniccare.habit_progress.recorded_on IS 'Patient device local calendar date supplied explicitly as YYYY-MM-DD.';
