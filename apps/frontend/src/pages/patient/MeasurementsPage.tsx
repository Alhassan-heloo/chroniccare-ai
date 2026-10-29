import { useState } from "react";
import { Plus, Activity, Info } from "lucide-react";
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
import { SignatureArtwork, LivingPulse } from "@/components/public/living/ui";
import { useAuth } from "@/auth/context";

export default function MeasurementsPage() {
  const { t, formatNumber } = useI18n();
  const { demo } = useAuth();
  const { data = [], isPending, isError, refetch } = useMeasurements();
  const { openMeasurement } = useDashboardActions();
  const [filters, setFilters] = useState<Filters>({
    kind: "all",
    from: "",
    to: "",
  });
  const [editing, setEditing] = useState<Measurement | null>(null);
  const [deleting, setDeleting] = useState<Measurement | null>(null);
  const deletion = useDeleteMeasurement();
  const invalidRange =
    !!filters.from && !!filters.to && filters.from > filters.to;
  const filtered = invalidRange ? [] : filterMeasurements(data, filters);
  return (
    <div className="stack measurements-page" data-i18n="declarative">
      <div className="measurements-heading dashboard-welcome">
        <SignatureArtwork />
        <div>
          <span className="eyebrow">{t("measurements.ui.eyebrow")}</span>
          <h1>{t("measurements.title")}</h1>
          <p>{t("measurements.ui.description")}</p>
        </div>
      </div>
      <div className="measurements-actions dashboard-canvas-actions">
        <span className="sample-label">{data.some(item => item.isExample) && <><i aria-hidden="true" />{t("patient.overview.includesExamples")}</>}</span>
        <Button className="add-reading" onClick={openMeasurement}><Plus size={19} aria-hidden="true" />{t("measurements.add")}</Button>
      </div>
      <div className="measurements-workbench dashboard-living-grid">
      <aside className="measurement-filter-panel dashboard-routine" aria-label={t("measurements.living.filters")}><MeasurementFilters value={filters} onChange={setFilters} /></aside>
      <section className="measurement-results dashboard-primary health-canvas glass" data-kind={filters.kind === "glucose" ? "glucose" : "pressure"} aria-label={t("measurements.ui.history")}>
      <LivingPulse cue={`${filters.kind}:${filters.from}:${filters.to}`} />
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
      <p className="dashboard-disclosure"><Info size={18} aria-hidden="true" /><span>{t(demo ? "measurements.ui.notice" : "measurements.persistence.notice")}</span></p>
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
              {t(demo ? "measurements.ui.deleteHint" : "measurements.persistence.deleteHint")}
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
