import { lazy, Suspense, useState } from "react";
import { Plus, Activity, Info, HeartPulse, Droplet, SlidersHorizontal } from "lucide-react";
import { useMeasurements } from "@/hooks/queries/usePatientDashboard";
import { useDeleteMeasurement } from "@/hooks/mutations/useMeasurementMutations";
import { useDashboardActions } from "@/context/DashboardContext";
import type { Measurement } from "@/lib/types/measurement";
import type { MeasurementFilters as Filters } from "@/lib/types/measurementFilters";
import {
  filterMeasurements,
} from "@/lib/utils/measurementFilters";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { MeasurementFilters } from "@/components/health/MeasurementFilters";
import { MeasurementListCard } from "@/components/health/MeasurementListCard";
import { MeasurementForm } from "@/components/health/MeasurementForm";
import { useI18n } from "@/i18n/context";
import { summarizeReport } from "@/lib/utils/reports";
import "@/styles/evolution/records.css";

const ReportChart = lazy(() => import("@/components/charts/ReportChart"));

export default function MeasurementsPage() {
  const { t, formatNumber, formatDate, formatUnit, language } = useI18n();
  const { data = [], isPending, isError, refetch } = useMeasurements();
  const { openMeasurement } = useDashboardActions();
  const [filters, setFilters] = useState<Filters>({
    kind: "all",
    from: "",
    to: "",
  });
  const [editing, setEditing] = useState<Measurement | null>(null);
  const [deleting, setDeleting] = useState<Measurement | null>(null);
  const [trend, setTrend] = useState<"pressure" | "glucose">("pressure");
  const deletion = useDeleteMeasurement();
  const invalidRange =
    !!filters.from && !!filters.to && filters.from > filters.to;
  const filtered = invalidRange ? [] : filterMeasurements(data, filters);
  const latest = [...data].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  const pressure = latest.find(item => item.kind === "bloodPressure");
  const glucose = latest.find(item => item.kind === "glucose");
  const overview = summarizeReport(data, 30);
  return (
    <div className="measurements-page records-page grid gap-6" data-i18n="declarative">
      <div className="measurements-heading records-heading">
        <div>
          <h1>{t("measurements.title")}</h1>
          <p>{t("measurements.ui.description")}</p>
        </div>
        <Button className="add-reading" onClick={openMeasurement}><Plus size={19} aria-hidden="true" />{t("measurements.add")}</Button>
      </div>
      {!isPending && !isError && <section className="measurement-canvas" aria-label={t("patient.clinical.latest")}>
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
      {data.some(item => item.isExample) && <span className="sample-label"><i aria-hidden="true" />{t("patient.overview.includesExamples")}</span>}
      <div className="measurements-workbench grid gap-4">
      <details className="measurement-filter-panel"><summary><SlidersHorizontal size={19} aria-hidden="true" />{t("measurements.living.filters")}{(filters.kind !== "all" || filters.from || filters.to) && <span className="badge">{language === "ar" ? "مفعّل" : "Active"}</span>}</summary><MeasurementFilters value={filters} onChange={setFilters} /></details>
      <section className="measurement-results" aria-label={t("measurements.ui.history")}>
      {isPending ? (
        <Card className="empty-state" role="status">
          {t("measurements.ui.loading")}
        </Card>
      ) : isError ? (
        <Card className="empty-state" role="alert">
          <p>{t("measurements.ui.loadError")}</p>
          <Button onClick={() => void refetch()}>{t("common.actions.retry")}</Button>
        </Card>
      ) : (
        <>
          <div className="measurement-history-heading dashboard-panel-heading">
            <div><h2>{t("measurements.ui.history")}</h2>
            <p role="status" aria-live="polite">
              {t("measurements.ui.count", { shown: formatNumber(filtered.length), total: formatNumber(data.length) })}
            </p></div>
          </div>
          {invalidRange ? (
            <Card className="empty-state">
              {t("measurements.ui.adjustRange")}
            </Card>
          ) : data.length === 0 ? (
            <Card className="empty-state measurement-empty">
              <Activity size={36} />
              <h2>{t("measurements.ui.first")}</h2>
              <p>{t("measurements.ui.firstDescription")}</p>
              <Button onClick={openMeasurement}>{t("measurements.add")}</Button>
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="empty-state measurement-empty">
              <h2>{t("measurements.ui.noMatches")}</h2>
              <p>{t("measurements.ui.broaden")}</p>
              <Button
                variant="secondary"
                onClick={() => setFilters({ kind: "all", from: "", to: "" })}
              >
                {t("measurements.ui.showAll")}
              </Button>
            </Card>
          ) : (
            <div className="measurements-list">
              {filtered.map((item) => (
                <MeasurementListCard
                  key={item.id}
                  item={item}
                  onEdit={setEditing}
                  onDelete={setDeleting}
                />
              ))}
            </div>
          )}
        </>
      )}
      </section>
      </div>
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
            onSaved={() => setEditing(null)}
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
                className="btn-danger"
                disabled={deletion.isPending}
                onClick={() =>
                  deletion.mutate(deleting.id, {
                    onSuccess: () => setDeleting(null),
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
