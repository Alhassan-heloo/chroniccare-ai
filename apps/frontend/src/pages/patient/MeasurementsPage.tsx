import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Plus, Activity, Info, HeartPulse, Droplet, SlidersHorizontal } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { useMeasurements } from "@/hooks/queries/usePatientDashboard";
import { useDeleteMeasurement } from "@/hooks/mutations/useMeasurementMutations";
import type { Measurement } from "@/lib/types/measurement";
import type { MeasurementFilters as Filters } from "@/lib/types/measurementFilters";
import { filterMeasurements, localDateKey } from "@/lib/utils/measurementFilters";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { MeasurementFilters } from "@/components/health/MeasurementFilters";
import { MeasurementListCard } from "@/components/health/MeasurementListCard";
import { MeasurementForm } from "@/components/health/MeasurementForm";
import { PatientPageHeader } from "@/components/layout/PatientPageHeader";
import { pressureRecordQuery } from "@/components/layout/navigation";
import { useI18n } from "@/i18n/context";
import { summarizeReport } from "@/lib/utils/reports";
import "@/styles/evolution/records.css";

const ReportChart = lazy(() => import("@/components/charts/ReportChart"));
const allReadings: Filters = { kind: "all", from: "", to: "" };

export default function MeasurementsPage() {
  const { t, formatNumber, formatDate, formatUnit, language } = useI18n();
  const { data = [], isPending, isError, refetch } = useMeasurements();
  const [filters, setFilters] = useState<Filters>(allReadings);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDay = searchParams.get("day") ?? "";
  useEffect(() => {
    const parsed = new Date(selectedDay + "T12:00:00");
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(selectedDay) && Number.isFinite(parsed.getTime()) && localDateKey(parsed.toISOString()) === selectedDay;
    if (valid) setFilters({kind:"all",from:selectedDay,to:selectedDay});
  }, [selectedDay]);
  const opensFromLink = searchParams.get(pressureRecordQuery.key) === pressureRecordQuery.value;
  const [addingHere, setAddingHere] = useState(false);
  const adding = opensFromLink || addingHere;
  const [saved, setSaved] = useState<Measurement | null>(null);
  const [showTrend, setShowTrend] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const addPanel = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState<Measurement | null>(null);
  const [deleting, setDeleting] = useState<Measurement | null>(null);
  const [trend, setTrend] = useState<"pressure" | "glucose">("pressure");
  const deletion = useDeleteMeasurement();
  useEffect(() => {
    if (!opensFromLink) return;
    const frame = requestAnimationFrame(() => addPanel.current?.querySelector<HTMLInputElement>('[name="systolic"]')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [opensFromLink]);
  const invalidRange =
    !!filters.from && !!filters.to && filters.from > filters.to;
  const filtered = invalidRange ? [] : filterMeasurements(data, filters);
  const days = new Map<string, Measurement[]>();
  for (const reading of filtered) {
    const day = localDateKey(reading.recordedAt);
    const group = days.get(day);
    if (group) group.push(reading);
    else days.set(day, [reading]);
  }
  const latest = showTrend ? filterMeasurements(data, allReadings) : [];
  const pressure = latest.find(item => item.kind === "bloodPressure");
  const glucose = latest.find(item => item.kind === "glucose");
  const overview = showTrend ? summarizeReport(data, 30) : null;
  const savedOutsideFilters = saved && (invalidRange || !filterMeasurements([saved], filters).length);
  const filtersActive = filters.kind !== "all" || filters.from || filters.to;
  const formatDay = (timestamp: string) => formatDate(timestamp, { day: "numeric", month: "long", year: "numeric" });
  const closeForm = () => {
    setAddingHere(false);
    if (opensFromLink) {
      const next = new URLSearchParams(searchParams);
      next.delete(pressureRecordQuery.key);
      setSearchParams(next, { replace: true });
    }
    addButton.current?.focus();
  };
  return (
    <div className="measurements-page records-page grid" data-i18n="declarative">
      <PatientPageHeader
        className="measurements-heading"
        title={t("measurements.title")}
        description={t("measurements.ui.description")}
        action={
          <Button ref={addButton} className="add-reading patient-record-action" aria-expanded={adding} aria-controls="measurement-add-panel" onClick={() => {
            setSaved(null);
            setAddingHere(true);
          }}>
            <Plus size={18} aria-hidden="true" />{t("measurements.dayLog.recordPressure")}
          </Button>
        }
      />
      <section ref={addPanel} id="measurement-add-panel" className="measurement-add-panel" hidden={!adding} aria-label={t("measurements.dayLog.recordPressure")}>
        {adding && <MeasurementForm onCancel={closeForm} onSaved={(measurement) => {
          setSaved(measurement);
          closeForm();
        }} />}
      </section>
      <div className="measurement-save-feedback">
        <p role="status" aria-atomic="true">{saved && (savedOutsideFilters
          ? t("measurements.dayLog.savedOutside", { date: formatDay(saved.recordedAt) })
          : t("measurements.persistence.saved"))}</p>
        {savedOutsideFilters && <Button variant="secondary" onClick={() => {
          const day = localDateKey(saved.recordedAt);
          setFilters({ kind: saved.kind, from: day, to: day });
          document.getElementById("measurement-history-title")?.focus();
        }}>{t("measurements.dayLog.showSavedDay")}</Button>}
        {saved && <Link className="btn btn-secondary" to="/patient/dashboard">{t("measurements.dayLog.backToDashboard")}</Link>}
      </div>
      {data.some(item => item.isExample) && <span className="sample-label"><i aria-hidden="true" />{t("patient.overview.includesExamples")}</span>}
      <section className="measurement-results" aria-labelledby="measurement-history-title">
        <div className="measurement-history-heading">
          <div>
            <h2 id="measurement-history-title" tabIndex={-1}>{t("measurements.dayLog.history")}</h2>
            {!isPending && !isError && <p>{t("measurements.ui.count", { shown: formatNumber(filtered.length), total: formatNumber(data.length) })}</p>}
          </div>
          <details className="measurement-filter-panel">
            <summary>
              <SlidersHorizontal size={19} aria-hidden="true" />
              {t("measurements.living.filters")}
              {filtersActive && <span className="badge">{t("measurements.dayLog.filterActive")}</span>}
            </summary>
            <MeasurementFilters value={filters} onChange={setFilters} />
          </details>
        </div>
        {isPending ? (
          <Card className="empty-state" role="status">{t("measurements.ui.loading")}</Card>
        ) : isError ? (
          <Card className="empty-state" role="alert">
            <p>{t("measurements.ui.loadError")}</p>
            <Button onClick={() => void refetch()}>{t("common.actions.retry")}</Button>
          </Card>
        ) : invalidRange ? (
          <Card className="empty-state">{t("measurements.ui.adjustRange")}</Card>
        ) : data.length === 0 ? (
          <Card className="empty-state measurement-empty">
            <Activity size={36} aria-hidden="true" />
            <h3>{t("measurements.ui.first")}</h3>
            <p>{t("measurements.ui.firstDescription")}</p>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="empty-state measurement-empty">
            <h3>{t("measurements.ui.noMatches")}</h3>
            <p>{t("measurements.ui.broaden")}</p>
            <Button variant="secondary" onClick={() => setFilters(allReadings)}>{t("measurements.ui.showAll")}</Button>
          </Card>
        ) : (
          <div className="measurements-list">
            {[...days].map(([day, readings]) => (
              <section className="measurement-day" key={day}>
                <h3 className="measurement-day-title"><time dateTime={day}>{formatDay(`${day}T12:00:00`)}</time></h3>
                <ul className="measurement-day-list patient-reading-surface">
                  {readings.map((item) => (
                    <li key={item.id} data-saved={item.id === saved?.id || undefined}>
                      <MeasurementListCard item={item} onEdit={setEditing} onDelete={setDeleting} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
      {!isPending && !isError && <details className="measurements-trend-disclosure" onToggle={(event) => setShowTrend(event.currentTarget.open)}>
        <summary>{t("measurements.dayLog.trend")}</summary>
        {overview && <section className="measurement-canvas" aria-label={t("patient.clinical.latest")}>
        <div className="records-section-title"><div><h2>{language === "ar" ? "صورة قياساتك" : "Your measurement picture"}</h2><p>{language === "ar" ? "آخر قراءة، واتجاه آخر ٣٠ يوماً" : "Latest readings and your last 30 days"}</p></div><span>{t("reports.count", { count: formatNumber(overview.measurements.length) })}</span></div>
        <div className="records-latest" role="group" aria-label={t("measurements.ui.filterKind")}>
          {([pressure, glucose] as const).map((item, index) => <button type="button" className="records-latest-item" data-kind={index === 0 ? "pressure" : "glucose"} key={index} aria-pressed={trend === (index === 0 ? "pressure" : "glucose")} onClick={() => setTrend(index === 0 ? "pressure" : "glucose")}>
            <span className="records-latest-label">{index === 0 ? <HeartPulse size={20} aria-hidden="true" /> : <Droplet size={20} aria-hidden="true" />}{t(index === 0 ? "measurements.bloodPressure" : "measurements.bloodGlucose")}</span>
            <span className="records-latest-value"><strong dir="ltr">{item ? item.kind === "bloodPressure" ? `${formatNumber(item.systolic)}/${formatNumber(item.diastolic)}` : formatNumber(item.value) : "—"}</strong><small dir="ltr">{formatUnit(index === 0 ? "mmHg" : "mg/dL")}</small></span>
            {item ? <><time dateTime={item.recordedAt}>{formatDate(item.recordedAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>{item.isExample && <span className="records-example">{t("measurements.ui.example")}</span>}</> : <small>{t("patient.overview.noReading")}</small>}
          </button>)}
        </div>
        <div className="records-trend" data-kind={trend}>
          <Suspense fallback={<p role="status">{t("reports.loadingChart")}</p>}><ReportChart points={overview.points} kind={trend} /></Suspense>
        </div>
        </section>}
      </details>}
      <p className="dashboard-disclosure"><Info size={18} aria-hidden="true" /><span>{t("measurements.persistence.notice")}</span></p>
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={t("measurements.ui.edit")}
        declarativeTitle
      >
        {editing && (
          <MeasurementForm
            key={editing.id}
            initial={editing}
            onSaved={(measurement) => {
              if (saved?.id === measurement.id) setSaved(measurement);
              setEditing(null);
            }}
          />
        )}
      </Modal>
      <Modal
        open={!!deleting}
        onClose={() => {
          if (!deletion.isPending) setDeleting(null);
        }}
        title={t("measurements.ui.deleteTitle")}
        declarativeTitle
      >
        {deleting && (
          <div className="stack">
            <p>
              {t("measurements.ui.deleteQuestion", { kind: t(deleting.kind === "bloodPressure" ? "measurements.bloodPressure" : "measurements.bloodGlucose"), value: deleting.kind === "bloodPressure" ? `${formatNumber(deleting.systolic)}/${formatNumber(deleting.diastolic)}` : formatNumber(deleting.value) })}
            </p>
            <p className="muted">
              {t("measurements.persistence.deleteHint")}
            </p>
            <div className="confirmation-actions">
              <Button
                variant="secondary"
                autoFocus
                disabled={deletion.isPending}
                onClick={() => setDeleting(null)}
              >
                {t("common.actions.cancel")}
              </Button>
              <Button
                variant="danger"
                disabled={deletion.isPending}
                onClick={() =>
                  deletion.mutate(deleting.id, {
                    onSuccess: () => {
                      if (saved?.id === deleting.id) setSaved(null);
                      setDeleting(null);
                    },
                  })
                }
              >
                {t(deletion.isPending ? "measurements.ui.deleting" : "measurements.ui.confirmDelete")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
