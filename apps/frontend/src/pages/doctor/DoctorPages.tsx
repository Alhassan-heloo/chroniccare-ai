import { lazy, Suspense } from "react";
import { ArrowRight, CalendarDays, ChartNoAxesCombined, ChevronDown, HeartPulse, Pill, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { Link, useParams } from "react-router";
import { useDoctorPatient, useDoctorPatients } from "@/hooks/queries/useDoctorPatients";
import { useI18n } from "@/i18n/context";
import type { Measurement } from "@/lib/types/measurement";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Feedback } from "@/components/ui/Feedback";
import { PageHeading as WorkspaceHeading } from "@/components/ui/PageHeading";
import type { DoctorPatient } from "@/lib/types/doctor";
import { summarizeReport } from "@/lib/utils/reports";
import "@/styles/evolution/clinical.css";

const TrendChart = lazy(() => import("@/components/charts/TrendChart").then(module => ({ default: module.TrendChart })));

function PatientRoster({ patients }: { patients: DoctorPatient[] }) {
  const { t } = useI18n();
  return <ul className="doctor-patient-list clinical-directory">{patients.map(patient => <li key={patient.id}>
    <Card className="doctor-patient-card">
      <span className="doctor-patient-avatar" aria-hidden="true">{patient.name.slice(0, 1)}</span>
      <div className="clinical-patient-name"><h3><bdi>{patient.name}</bdi></h3><p><ShieldCheck size={14} aria-hidden="true" />{t("doctor.authorizedRelationship")}</p></div>
      <Link className="btn btn-secondary" to={`/doctor/patients/${patient.id}`}>{t("doctor.openRecord")}<ArrowRight size={17} aria-hidden="true" /></Link>
    </Card>
  </li>)}</ul>;
}

function PageHeading({ title, description, connect = false }: { title: string; description: string; connect?: boolean }) {
  const { t } = useI18n();
  return <WorkspaceHeading title={title} description={description} action={connect ? <Link className="btn btn-secondary" to="/doctor/connect">{t("connections.connect")}</Link> : undefined} />;
}

export function DoctorDashboard() {
  const { data, isPending, isError, refetch } = useDoctorPatients();
  const { t, formatNumber, language } = useI18n();
  return <div className="doctor-page stack evolution-clinical doctor-workspace" data-i18n="declarative">
    <PageHeading title={t("doctor.dashboard")} description={t("doctor.dashboardDescription")} />
    {isPending ? <Feedback kind="loading">{t("doctor.loading")}</Feedback>
      : isError || !data ? <Feedback kind="error" action={<Button variant="secondary" onClick={() => void refetch()}><RefreshCw size={17} aria-hidden="true" />{t("common.actions.retry")}</Button>}>{t("doctor.error")}</Feedback>
        : <>
          <div className="clinical-workspace-grid"><section className="clinical-roster" aria-labelledby="clinical-patients-title"><header className="clinical-roster-heading"><div><Users size={21} aria-hidden="true" /><h2 id="clinical-patients-title">{t("doctor.patients")}</h2><span className="clinical-count">{formatNumber(data.length)}</span></div><Link to="/doctor/patients">{t("doctor.openPatients")}</Link></header>
            {data.length ? <PatientRoster patients={data} /> : <Feedback kind="empty">{t("doctor.empty")}</Feedback>}
            <p className="clinical-roster-note"><ShieldCheck size={16} aria-hidden="true" />{t("doctor.readOnlyNotice")}</p>
          </section><aside className="clinical-connection-panel"><span className="clinical-panel-symbol"><Users size={25} aria-hidden="true" /></span><h2>{t("connections.connect")}</h2><p>{t("connections.doctorIntro")}</p><Link className="btn btn-primary" to="/doctor/connect">{t("connections.generate")}<ArrowRight size={17} aria-hidden="true" /></Link><div className="clinical-connection-boundary"><ShieldCheck size={18} aria-hidden="true" /><span>{language === "ar" ? "الوصول للقراءة فقط، وبموافقة المريض." : "Read-only access, with patient approval."}</span></div></aside></div>
        </>}
  </div>;
}

export function DoctorPatients() {
  const { data, isPending, isError, refetch } = useDoctorPatients();
  const { t, formatNumber } = useI18n();
  return <div className="doctor-page stack evolution-clinical doctor-directory-page" data-i18n="declarative">
    <PageHeading title={t("doctor.patients")} description={t("doctor.patientsDescription")} connect />
    {isPending ? <Feedback kind="loading">{t("doctor.loading")}</Feedback>
      : isError || !data ? <Feedback kind="error" action={<Button variant="secondary" onClick={() => void refetch()}>{t("common.actions.retry")}</Button>}>{t("doctor.error")}</Feedback>
        : <section className="clinical-roster" aria-labelledby="directory-title"><header className="clinical-roster-heading"><div><Users size={21} aria-hidden="true" /><h2 id="directory-title">{t("doctor.assignedPatients")}</h2><span className="clinical-count">{formatNumber(data.length)}</span></div></header>{data.length ? <PatientRoster patients={data} /> : <Feedback kind="empty">{t("doctor.empty")}</Feedback>}<p className="clinical-roster-note"><ShieldCheck size={16} aria-hidden="true" />{t("doctor.readOnlyNotice")}</p></section>}
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
  const { t, formatNumber, formatDateTime, formatHabitUnit, formatUnit, language } = useI18n();
  if (isPending) return <div className="doctor-page stack" data-i18n="declarative"><Link className="doctor-back" to="/doctor/patients">{t("doctor.backToPatients")}</Link><Feedback kind="loading">{t("doctor.loadingRecord")}</Feedback></div>;
  if (isError || !data) return <div className="doctor-page stack" data-i18n="declarative">
    <Link className="doctor-back" to="/doctor/patients">{t("doctor.backToPatients")}</Link>
    <Feedback kind="error" action={<Button variant="secondary" onClick={() => void refetch()}>{t("common.actions.retry")}</Button>}>{t("doctor.recordUnavailable")}</Feedback>
  </div>;
  const taken = data.medications.reduce((sum, medication) => sum + medication.doses.filter(dose => dose.takenOn === data.date).length, 0);
  const doses = data.medications.reduce((sum, medication) => sum + medication.doses.length, 0);
  const completed = data.habits.filter(habit => habit.progress >= habit.target).length;
  const ordered = [...data.measurements].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  const latestPressure = ordered.find(item => item.kind === "bloodPressure"), latestGlucose = ordered.find(item => item.kind === "glucose");
  const series = summarizeReport(data.measurements, 7).points;
  const pressure = series.some(point => point.systolic !== undefined), glucose = series.some(point => point.glucose !== undefined);
  return <div className="doctor-page doctor-record stack evolution-clinical" data-i18n="declarative">
    <Link className="doctor-back" to="/doctor/patients">{t("doctor.backToPatients")}</Link>
    <header className="clinical-patient-banner"><span className="clinical-record-avatar" aria-hidden="true">{data.patient.name.slice(0, 1)}</span><div><span className="clinical-readonly"><ShieldCheck size={15} aria-hidden="true" />{language === "ar" ? "سجل للقراءة فقط" : "Read-only record"}</span><h1>{t("doctor.recordTitle", { name: `\u2068${data.patient.name}\u2069` })}</h1><p>{t("doctor.recordDescription")}</p></div><div className="doctor-record-meta"><CalendarDays size={17} aria-hidden="true" /><span>{t("doctor.todayDate", { date: data.date })}</span></div></header>
    <nav className="clinical-record-nav" aria-label={t("doctor.recordTitle", { name: data.patient.name })}><a href="#doctor-measurements"><HeartPulse size={18} aria-hidden="true" />{t("doctor.measurements")}<span>{formatNumber(data.measurements.length)}</span></a><a href="#doctor-medications"><Pill size={18} aria-hidden="true" />{t("doctor.medicationsToday")}<span>{formatNumber(data.medications.length)}</span></a><a href="#doctor-habits"><ChartNoAxesCombined size={18} aria-hidden="true" />{t("doctor.habitsToday")}<span>{formatNumber(data.habits.length)}</span></a></nav>
    <div className="clinical-record-workspace"><section className="doctor-record-section clinical-record-main" aria-labelledby="doctor-measurements">
      <div className="doctor-section-heading"><HeartPulse size={21} aria-hidden="true" /><h2 id="doctor-measurements">{t("doctor.measurements")}</h2></div>
      <dl className="clinical-latest-readings"><div><dt>{t("measurements.bloodPressure")}</dt><dd dir="ltr">{latestPressure ? `${formatNumber(latestPressure.systolic)}/${formatNumber(latestPressure.diastolic)}` : "—"}<small>{formatUnit("mmHg")}</small></dd>{latestPressure && <time dateTime={latestPressure.recordedAt}>{formatDateTime(latestPressure.recordedAt)}</time>}</div><div><dt>{t("measurements.bloodGlucose")}</dt><dd dir="ltr">{latestGlucose ? formatNumber(latestGlucose.value) : "—"}<small>{formatUnit("mg/dL")}</small></dd>{latestGlucose && <time dateTime={latestGlucose.recordedAt}>{formatDateTime(latestGlucose.recordedAt)}</time>}</div></dl>
      {(pressure || glucose) && <div className="clinical-record-trends"><p>{language === "ar" ? "متوسطات القراءات اليومية خلال آخر ٧ أيام" : "Daily reading averages over the last 7 days"}</p><div><Suspense fallback={<Feedback kind="loading">{t("doctor.loadingRecord")}</Feedback>}>{pressure && <section><h3>{t("measurements.bloodPressure")}</h3><TrendChart data={series} kind="pressure" /></section>}{glucose && <section><h3>{t("measurements.bloodGlucose")}</h3><TrendChart data={series} kind="glucose" /></section>}</Suspense></div></div>}
      {data.measurements.length ? <details className="clinical-record-history"><summary><span>{language === "ar" ? "أحدث القراءات المسجلة" : "Latest recorded readings"}<small>{formatNumber(Math.min(ordered.length, 10))}</small></span><ChevronDown size={18} aria-hidden="true" /></summary><ul className="doctor-data-list">
        {ordered.slice(0, 10).map(measurement => <li key={measurement.id}>
          <strong>{t(measurement.kind === "bloodPressure" ? "measurements.bloodPressure" : "measurements.bloodGlucose")}</strong>
          <span dir="ltr">{measurementValue(measurement, formatNumber)}</span>
          <time dateTime={measurement.recordedAt}>{formatDateTime(measurement.recordedAt)}</time>
        </li>)}
      </ul></details> : <Feedback kind="empty">{t("doctor.noMeasurements")}</Feedback>}
    </section>
    <aside className="clinical-record-care">
      <section className="doctor-record-section" aria-labelledby="doctor-medications">
        <div className="doctor-section-heading"><Pill size={21} aria-hidden="true" /><h2 id="doctor-medications">{t("doctor.medicationsToday")}</h2></div>
        <p className="doctor-section-summary">{t("doctor.dosesSummary", { taken: formatNumber(taken), total: formatNumber(doses) })}</p>
        {data.medications.length ? <ul className="doctor-data-list compact">{data.medications.map(medication => <li key={medication.id}><strong><bdi>{medication.name}</bdi></strong><span><bdi>{medication.dosage}</bdi></span><small dir="ltr">{medication.doses.map(dose => dose.time).join(" · ")}</small></li>)}</ul>
          : <Feedback kind="empty">{t("doctor.noMedications")}</Feedback>}
      </section>
      <section className="doctor-record-section" aria-labelledby="doctor-habits">
        <div className="doctor-section-heading"><ChartNoAxesCombined size={21} aria-hidden="true" /><h2 id="doctor-habits">{t("doctor.habitsToday")}</h2></div>
        <p className="doctor-section-summary">{t("doctor.habitsSummary", { completed: formatNumber(completed), total: formatNumber(data.habits.length) })}</p>
        {data.habits.length ? <ul className="doctor-data-list compact">{data.habits.map(habit => <li key={habit.id}><strong><bdi>{habit.title}</bdi></strong><span>{t("doctor.habitProgress", { progress: formatNumber(habit.progress), target: formatNumber(habit.target), unit: formatHabitUnit(habit.unit, habit.target) })}</span><progress value={Math.min(habit.progress, habit.target)} max={habit.target} aria-label={habit.title} /></li>)}</ul>
          : <Feedback kind="empty">{t("doctor.noHabits")}</Feedback>}
      </section>
    </aside></div>
    <p className="clinical-roster-note"><ShieldCheck size={16} aria-hidden="true" />{t("doctor.readOnlyNotice")}</p>
  </div>;
}
