import { ArrowRight, CalendarDays, ChartNoAxesCombined, HeartPulse, Pill, RefreshCw, Users } from "lucide-react";
import { Link, useParams } from "react-router";
import { useDoctorPatient, useDoctorPatients } from "@/hooks/queries/useDoctorPatients";
import { useI18n } from "@/i18n/context";
import type { Measurement } from "@/lib/types/measurement";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Feedback } from "@/components/ui/Feedback";
import { PageHeading as WorkspaceHeading } from "@/components/ui/PageHeading";

function PageHeading({ title, description, connect = false }: { title: string; description: string; connect?: boolean }) {
  const { t } = useI18n();
  return <WorkspaceHeading title={title} description={description} eyebrow={t("doctor.eyebrow")} action={connect ? <Link className="btn btn-secondary" to="/doctor/connect">{t("connections.connect")}</Link> : undefined} />;
}

export function DoctorDashboard() {
  const { data, isPending, isError, refetch } = useDoctorPatients();
  const { t, formatNumber } = useI18n();
  return <div className="doctor-page stack" data-i18n="declarative">
    <PageHeading title={t("doctor.dashboard")} description={t("doctor.dashboardDescription")} connect />
    {isPending ? <Feedback kind="loading">{t("doctor.loading")}</Feedback>
      : isError || !data ? <Feedback kind="error" action={<Button variant="secondary" onClick={() => void refetch()}><RefreshCw size={17} aria-hidden="true" />{t("common.actions.retry")}</Button>}>{t("doctor.error")}</Feedback>
        : <>
          <Card className="doctor-summary-card">
            <span className="icon-tile tone-info" aria-hidden="true"><Users size={24} /></span>
            <div><span>{t("doctor.assignedPatients")}</span><strong>{formatNumber(data.length)}</strong></div>
            <Link className="btn btn-primary" to="/doctor/patients">{t("doctor.openPatients")}<ArrowRight size={17} aria-hidden="true" /></Link>
          </Card>
          <Feedback kind={data.length ? "info" : "empty"}>{t(data.length ? "doctor.readOnlyNotice" : "doctor.empty")}</Feedback>
        </>}
  </div>;
}

export function DoctorPatients() {
  const { data, isPending, isError, refetch } = useDoctorPatients();
  const { t } = useI18n();
  return <div className="doctor-page stack" data-i18n="declarative">
    <PageHeading title={t("doctor.patients")} description={t("doctor.patientsDescription")} connect />
    {isPending ? <Feedback kind="loading">{t("doctor.loading")}</Feedback>
      : isError || !data ? <Feedback kind="error" action={<Button variant="secondary" onClick={() => void refetch()}>{t("common.actions.retry")}</Button>}>{t("doctor.error")}</Feedback>
        : data.length ? <ul className="doctor-patient-list">
          {data.map(patient => <li key={patient.id}>
            <Card className="doctor-patient-card">
              <span className="doctor-patient-avatar" aria-hidden="true">{patient.name.slice(0, 1)}</span>
              <div><h2><bdi>{patient.name}</bdi></h2><p>{t("doctor.authorizedRelationship")}</p></div>
              <Link className="btn btn-secondary" to={`/doctor/patients/${patient.id}`}>{t("doctor.openRecord")}</Link>
            </Card>
          </li>)}
        </ul> : <Feedback kind="empty">{t("doctor.empty")}</Feedback>}
  </div>;
}

function measurementValue(measurement: Measurement, formatNumber: (value: number) => string) {
  return measurement.kind === "bloodPressure"
    ? `${formatNumber(measurement.systolic)}/${formatNumber(measurement.diastolic)} mmHg`
    : `${formatNumber(measurement.value)} mg/dL`;
}

export function DoctorPatientDetails() {
  const { patientId } = useParams();
  const { data, isPending, isError, refetch } = useDoctorPatient(patientId);
  const { t, formatNumber, formatDateTime, formatHabitUnit } = useI18n();
  if (isPending) return <div className="doctor-page stack" data-i18n="declarative"><Link className="doctor-back" to="/doctor/patients">{t("doctor.backToPatients")}</Link><Feedback kind="loading">{t("doctor.loadingRecord")}</Feedback></div>;
  if (isError || !data) return <div className="doctor-page stack" data-i18n="declarative">
    <Link className="doctor-back" to="/doctor/patients">{t("doctor.backToPatients")}</Link>
    <Feedback kind="error" action={<Button variant="secondary" onClick={() => void refetch()}>{t("common.actions.retry")}</Button>}>{t("doctor.recordUnavailable")}</Feedback>
  </div>;
  const taken = data.medications.reduce((sum, medication) => sum + medication.doses.filter(dose => dose.takenOn === data.date).length, 0);
  const doses = data.medications.reduce((sum, medication) => sum + medication.doses.length, 0);
  const completed = data.habits.filter(habit => habit.progress >= habit.target).length;
  return <div className="doctor-page doctor-record stack" data-i18n="declarative">
    <Link className="doctor-back" to="/doctor/patients">{t("doctor.backToPatients")}</Link>
    <PageHeading title={t("doctor.recordTitle", { name: `\u2068${data.patient.name}\u2069` })} description={t("doctor.recordDescription")} />
    <Feedback kind="info">{t("doctor.readOnlyNotice")}</Feedback>
    <div className="doctor-record-meta"><CalendarDays size={17} aria-hidden="true" />{t("doctor.todayDate", { date: data.date })}</div>
    <section className="doctor-record-section" aria-labelledby="doctor-measurements">
      <div className="doctor-section-heading"><HeartPulse size={21} aria-hidden="true" /><h2 id="doctor-measurements">{t("doctor.measurements")}</h2></div>
      {data.measurements.length ? <ul className="doctor-data-list">
        {data.measurements.slice(0, 10).map(measurement => <li key={measurement.id}>
          <strong>{t(measurement.kind === "bloodPressure" ? "measurements.bloodPressure" : "measurements.bloodGlucose")}</strong>
          <span dir="ltr">{measurementValue(measurement, formatNumber)}</span>
          <time dateTime={measurement.recordedAt}>{formatDateTime(measurement.recordedAt)}</time>
        </li>)}
      </ul> : <Feedback kind="empty">{t("doctor.noMeasurements")}</Feedback>}
    </section>
    <div className="doctor-record-grid">
      <section className="doctor-record-section" aria-labelledby="doctor-medications">
        <div className="doctor-section-heading"><Pill size={21} aria-hidden="true" /><h2 id="doctor-medications">{t("doctor.medicationsToday")}</h2></div>
        <p className="doctor-section-summary">{t("doctor.dosesSummary", { taken: formatNumber(taken), total: formatNumber(doses) })}</p>
        {data.medications.length ? <ul className="doctor-data-list compact">{data.medications.map(medication => <li key={medication.id}><strong><bdi>{medication.name}</bdi></strong><span><bdi>{medication.dosage}</bdi></span><small dir="ltr">{medication.doses.map(dose => dose.time).join(" · ")}</small></li>)}</ul>
          : <Feedback kind="empty">{t("doctor.noMedications")}</Feedback>}
      </section>
      <section className="doctor-record-section" aria-labelledby="doctor-habits">
        <div className="doctor-section-heading"><ChartNoAxesCombined size={21} aria-hidden="true" /><h2 id="doctor-habits">{t("doctor.habitsToday")}</h2></div>
        <p className="doctor-section-summary">{t("doctor.habitsSummary", { completed: formatNumber(completed), total: formatNumber(data.habits.length) })}</p>
        {data.habits.length ? <ul className="doctor-data-list compact">{data.habits.map(habit => <li key={habit.id}><strong><bdi>{habit.title}</bdi></strong><span>{t("doctor.habitProgress", { progress: formatNumber(habit.progress), target: formatNumber(habit.target), unit: formatHabitUnit(habit.unit, habit.target) })}</span></li>)}</ul>
          : <Feedback kind="empty">{t("doctor.noHabits")}</Feedback>}
      </section>
    </div>
  </div>;
}
