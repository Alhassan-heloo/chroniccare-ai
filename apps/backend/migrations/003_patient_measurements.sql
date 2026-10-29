CREATE TABLE chroniccare.measurements (
  id uuid PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES chroniccare.users(id) ON DELETE RESTRICT,
  kind text NOT NULL,
  systolic integer,
  diastolic integer,
  value double precision,
  recorded_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT measurements_valid_reading CHECK (
    (kind = 'bloodPressure' AND systolic IS NOT NULL AND diastolic IS NOT NULL
      AND systolic > 0 AND systolic <= 400 AND diastolic > 0 AND diastolic <= 300
      AND systolic > diastolic AND value IS NULL)
    OR
    (kind = 'glucose' AND value IS NOT NULL AND value > 0 AND value <= 1500
      AND systolic IS NULL AND diastolic IS NULL)
  )
);
CREATE INDEX measurements_patient_recorded_idx ON chroniccare.measurements(patient_id, recorded_at DESC, id);
COMMENT ON TABLE chroniccare.measurements IS 'Patient-owned readings. Bounds are technical validation, not clinical classifications.';
COMMENT ON COLUMN chroniccare.measurements.kind IS 'bloodPressure uses mmHg; glucose uses mg/dL. No unit conversion is performed.';
COMMENT ON COLUMN chroniccare.measurements.recorded_at IS 'Measurement time, immutable during value/type updates; API returns UTC ISO 8601 milliseconds.';
