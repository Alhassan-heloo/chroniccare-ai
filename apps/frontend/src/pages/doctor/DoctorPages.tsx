import { lazy, Suspense, useEffect, useRef } from "react";
import { ArrowRight, CalendarDays, ChartNoAxesCombined, ChevronDown, HeartPulse, Pill, ShieldCheck, Users } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router";
import { useDoctorPatient, useDoctorPatients } from "@/hooks/queries/useDoctorPatients";
import { useI18n } from "@/i18n/context";
import type { Measurement } from "@/lib/types/measurement";
import { Button } from "@/components/ui/Button";
import { Feedback } from "@/components/ui/Feedback";
import { PageHeading as WorkspaceHeading } from "@/components/ui/PageHeading";
import { summarizeReport } from "@/lib/utils/reports";
import {ReadingValue} from "@/components/health/ReadingValue";
import {PatientActivity,PatientPeriodComparison} from "@/components/health/PatientActivity";
import "@/styles/evolution/clinical.css";

const TrendChart = lazy(() => import("@/components/charts/TrendChart").then(module => ({ default: module.TrendChart })));


function DoctorWorkspace() {
  const { data, isPending, isError, refetch } = useDoctorPatients();
  const { t, formatNumber } = useI18n();
  const [params,setParams] = useSearchParams();
  const listPosition = useRef(0);
  const listRef = useRef<HTMLUListElement>(null);
  const lastSelected = useRef("");
  const hadSelection = useRef(false);
  const explicit = params.get("patient");
  const selected = data?.find(patient => patient.id === explicit)?.id ?? (!explicit ? data?.[0]?.id : undefined);
  useEffect(() => {
    const returning = hadSelection.current && !explicit;
    hadSelection.current = Boolean(explicit);
    if (!returning) return;
    const frame = requestAnimationFrame(() => { window.scrollTo({top:listPosition.current,behavior:"instant"}); listRef.current?.querySelector<HTMLAnchorElement>(`a[href$="?patient=${encodeURIComponent(lastSelected.current)}"]`)?.focus({preventScroll:true}); });
    return () => cancelAnimationFrame(frame);
  }, [explicit]);
  function choose(id: string) { listPosition.current=window.scrollY; lastSelected.current=id; setParams({patient:id}, {preventScrollReset:true}); window.scrollTo({top:0,behavior:"instant"}); }
  function back() { setParams({}, {replace:true,preventScrollReset:true}); }
  return <div className="doctor-page stack evolution-clinical doctor-workspace doctor-review-workspace" data-focused={Boolean(explicit)} data-i18n="declarative">
    <WorkspaceHeading title={t("doctor.patients")} description={t("doctor.patientsDescription")} />
    {isPending ? <Feedback kind="loading">{t("doctor.loading")}</Feedback> : isError || !data ? <Feedback kind="error" action={<Button variant="secondary" onClick={()=>void refetch()}>{t("common.actions.retry")}</Button>}>{t("doctor.error")}</Feedback> :
      <div className="doctor-review-grid">
        <section className="clinical-roster" aria-labelledby="clinical-patients-title">
          <header className="clinical-roster-heading"><div><Users size={20} aria-hidden="true" /><h2 id="clinical-patients-title">{t("doctor.patients")}</h2><span className="clinical-count">{formatNumber(data.length)}</span></div><Link className="btn btn-secondary" to="/doctor/connect">{t("finalExperience.invite")}</Link></header>
          {data.length ? <ul ref={listRef} className="doctor-selection-list">{data.map(patient=><li key={patient.id}><Link to={"?patient="+encodeURIComponent(patient.id)} aria-current={selected===patient.id ? "true" : undefined} onClick={event=>{event.preventDefault();choose(patient.id);}}><span className="doctor-patient-avatar" aria-hidden="true">{patient.name.slice(0,1)}</span><span><bdi>{patient.name}</bdi><small>{t("doctor.openRecord")}</small></span><ArrowRight size={17} aria-hidden="true" /></Link></li>)}</ul> : <Feedback kind="empty">{t("doctor.empty")}</Feedback>}
        </section>
        <section className="doctor-selected-record" aria-label={t("finalExperience.selected")}>
          {selected ? <DoctorPatientDetails key={selected} selectedPatientId={selected} onBack={back} embedded /> : <Feedback kind={explicit ? "error" : "empty"}>{t(explicit ? "doctor.recordUnavailable" : "finalExperience.choosePatient")}{explicit && <Button variant="secondary" onClick={back}>{t("doctor.backToPatients")}</Button>}</Feedback>}
        </section>
      </div>}
  </div>;
}
export function DoctorDashboard() { return <DoctorWorkspace />; }
export function DoctorPatients() { return <DoctorWorkspace />; }

function measurementValue(measurement: Measurement, formatNumber: (value: number) => string) {
  return measurement.kind === "bloodPressure"
    ? `${formatNumber(measurement.systolic)}/${formatNumber(measurement.diastolic)} mmHg`
    : `${formatNumber(measurement.value)} mg/dL`;
}

export function DoctorPatientDetails({ selectedPatientId, onBack, embedded = false }: { selectedPatientId?: string; onBack?: () => void; embedded?: boolean } = {}) {
  const route = useParams();
  const patientId = selectedPatientId ?? route.patientId;
  const { record, activity, denied, checkAgain } = useDoctorPatient(patientId);
  const { data, isPending, isError, isFetchedAfterMount } = record;
  const recordName = !denied && isFetchedAfterMount && !isError ? data?.patient.name : undefined;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (embedded && recordName && matchMedia("(max-width: 47.99rem)").matches) heading.current?.focus({preventScroll:true}); }, [embedded, recordName, patientId]);
  const { t, formatNumber, formatDateTime, formatHabitUnit, formatUnit, language } = useI18n();
  const backLink = onBack ? <Button className="doctor-back" variant="secondary" onClick={onBack}>{t("doctor.backToPatients")}</Button> : <Link className="doctor-back" to="/doctor/patients">{t("doctor.backToPatients")}</Link>;
  if (!denied && (isPending || (!isError && !isFetchedAfterMount))) return <div className="doctor-page stack" data-i18n="declarative">{backLink}<Feedback kind="loading">{t("doctor.loadingRecord")}</Feedback></div>;
  if (denied || isError || !data || data.patient.id !== patientId) return <div className="doctor-page stack" data-i18n="declarative">
    {backLink}
    <Feedback kind="error" action={<Button variant="secondary" onClick={checkAgain}>{t("common.actions.retry")}</Button>}>{t("doctor.recordUnavailable")}</Feedback>
  </div>;
  const taken = data.medications.reduce((sum, medication) => sum + medication.doses.filter(dose => dose.takenOn === data.date).length, 0);
  const doses = data.medications.reduce((sum, medication) => sum + medication.doses.length, 0);
  const completed = data.habits.filter(habit => habit.progress >= habit.target).length;
  const ordered = [...data.measurements].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  const latestPressure = ordered.find(item => item.kind === "bloodPressure"), latestGlucose = ordered.find(item => item.kind === "glucose");
  const series = summarizeReport(data.measurements, 7).points;
  const pressure = series.some(point => point.systolic !== undefined), glucose = series.some(point => point.glucose !== undefined);
  const RecordTitle = embedded ? "h2" : "h1";
  return <div className={"doctor-page doctor-record stack evolution-clinical" + (embedded ? " embedded-record" : "")} data-i18n="declarative">
    {backLink}
    <header className="clinical-patient-banner"><span className="clinical-record-avatar" aria-hidden="true">{data.patient.name.slice(0, 1)}</span><div><span className="clinical-readonly"><ShieldCheck size={15} aria-hidden="true" />{language === "ar" ? "سجل للقراءة فقط" : "Read-only record"}</span><RecordTitle ref={heading} tabIndex={-1} className="doctor-record-title">{t("doctor.recordTitle", { name: `\u2068${data.patient.name}\u2069` })}</RecordTitle><p>{t("doctor.recordDescription")}</p>{ordered[0]&&<p className="record-last-time">{t("graduation.lastRecorded")}: <time dateTime={ordered[0].recordedAt}>{formatDateTime(ordered[0].recordedAt)}</time></p>}</div><div className="doctor-record-meta"><CalendarDays size={17} aria-hidden="true" /><span>{t("doctor.todayDate", { date: data.date })}</span></div></header>
    <nav className="clinical-record-nav" aria-label={t("doctor.recordTitle", { name: data.patient.name })}><a href="#doctor-measurements"><HeartPulse size={18} aria-hidden="true" />{t("doctor.measurements")}<span>{formatNumber(data.measurements.length)}</span></a><a href="#doctor-medications"><Pill size={18} aria-hidden="true" />{t("doctor.medicationsToday")}<span>{formatNumber(data.medications.length)}</span></a><a href="#doctor-habits"><ChartNoAxesCombined size={18} aria-hidden="true" />{t("doctor.habitsToday")}<span>{formatNumber(data.habits.length)}</span></a></nav>
    <div className="clinical-record-workspace"><section className="doctor-record-section clinical-record-main" aria-labelledby="doctor-measurements">
      <div className="doctor-section-heading"><HeartPulse size={21} aria-hidden="true" /><h2 id="doctor-measurements">{t("doctor.measurements")}</h2></div>
      <div className="clinical-latest-readings shared-reading-caption"><div><h3>{t("measurements.bloodPressure")}</h3><ReadingValue value={latestPressure?`${formatNumber(latestPressure.systolic)}/${formatNumber(latestPressure.diastolic)}`:"—"} unit={formatUnit("mmHg")} recordedAt={latestPressure?.recordedAt} /></div><div><h3>{t("measurements.bloodGlucose")}</h3><ReadingValue value={latestGlucose?formatNumber(latestGlucose.value):"—"} unit={formatUnit("mg/dL")} recordedAt={latestGlucose?.recordedAt} /></div></div>
      {!embedded && (pressure || glucose) && <div className="clinical-record-trends"><p>{language === "ar" ? "متوسطات القراءات اليومية خلال آخر ٧ أيام" : "Daily reading averages over the last 7 days"}</p><div><Suspense fallback={<Feedback kind="loading">{t("doctor.loadingRecord")}</Feedback>}>{pressure && <section><h3>{t("measurements.bloodPressure")}</h3><TrendChart data={series} kind="pressure" /></section>}{glucose && <section><h3>{t("measurements.bloodGlucose")}</h3><TrendChart data={series} kind="glucose" /></section>}</Suspense></div></div>}
      {data.measurements.length ? <details className="clinical-record-history" open={!embedded}><summary><span>{language === "ar" ? "أحدث القراءات المسجلة" : "Latest recorded readings"}<small>{formatNumber(Math.min(ordered.length, 5))}</small></span><ChevronDown size={18} aria-hidden="true" /></summary><ul className="doctor-data-list">
        {ordered.slice(0, 5).map(measurement => <li key={measurement.id}>
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
    <PatientActivity record={data} activity={activity} />
    <PatientPeriodComparison record={data} />
    <p className="clinical-roster-note"><ShieldCheck size={16} aria-hidden="true" />{t("doctor.readOnlyNotice")}</p>
  </div>;
}
