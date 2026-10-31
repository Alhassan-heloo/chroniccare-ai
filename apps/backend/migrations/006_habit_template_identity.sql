ALTER TABLE chroniccare.habits
  ADD COLUMN template_key text;

ALTER TABLE chroniccare.habits
  ADD CONSTRAINT habits_valid_template_key CHECK (
    template_key IS NULL OR template_key IN (
      'walking',
      'water',
      'produce',
      'relaxation',
      'bedtime',
      'movement-breaks',
      'foot-check'
    )
  );

-- Preserve the identity of templates activated before this column existed.
-- If old duplicate rows exist, only the earliest matching row is linked; no
-- habit or progress row is deleted or merged.
WITH mapped AS (
  SELECT id, patient_id, created_at,
    CASE lower(btrim(title))
      WHEN lower('Daily walking') THEN 'walking'
      WHEN lower('المشي اليومي') THEN 'walking'
      WHEN lower('Drinking water') THEN 'water'
      WHEN lower('شرب الماء') THEN 'water'
      WHEN lower('Add vegetables or fruit to meals') THEN 'produce'
      WHEN lower('إضافة الخضار أو الفاكهة للوجبات') THEN 'produce'
      WHEN lower('Relaxation or breathing') THEN 'relaxation'
      WHEN lower('الاسترخاء أو التنفس') THEN 'relaxation'
      WHEN lower('Bedtime routine') THEN 'bedtime'
      WHEN lower('روتين وقت النوم') THEN 'bedtime'
      WHEN lower('Light movement breaks') THEN 'movement-breaks'
      WHEN lower('استراحات حركة خفيفة') THEN 'movement-breaks'
      WHEN lower('Daily foot self-check') THEN 'foot-check'
      WHEN lower('الفحص الذاتي اليومي للقدمين') THEN 'foot-check'
    END AS template_key
  FROM chroniccare.habits
), ranked AS (
  SELECT id, template_key,
    row_number() OVER (PARTITION BY patient_id, template_key ORDER BY created_at, id) AS position
  FROM mapped
  WHERE template_key IS NOT NULL
)
UPDATE chroniccare.habits AS habit
SET template_key = ranked.template_key
FROM ranked
WHERE habit.id = ranked.id AND ranked.position = 1;

CREATE UNIQUE INDEX habits_patient_template_key_unique
  ON chroniccare.habits(patient_id, template_key)
  WHERE template_key IS NOT NULL;

COMMENT ON COLUMN chroniccare.habits.template_key IS
  'Stable optional identity for a curated client template; independent of the patient-editable title.';
