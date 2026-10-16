-- Application tables are introduced in future migrations, starting with Task 1B.
-- This namespace keeps future users, measurements, medication/habit events,
-- alerts, and doctor-patient relationships separate from migration metadata.
CREATE SCHEMA chroniccare;
COMMENT ON SCHEMA chroniccare IS 'ChronicCare application data; managed by versioned migrations';
