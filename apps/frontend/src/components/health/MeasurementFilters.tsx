import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { MeasurementFilters as Filters } from "@/lib/types/measurementFilters";
import { useI18n } from "@/i18n/context";
import { SlidersHorizontal } from "lucide-react";
export function MeasurementFilters({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (value: Filters) => void;
}) {
  const { t } = useI18n();
  const invalidRange = !!value.from && !!value.to && value.from > value.to;
  return (
    <Card className="measurements-filters glass" data-i18n="declarative">
      <div className="measurement-filter-heading dashboard-panel-heading"><span className="dashboard-feature-icon"><SlidersHorizontal size={20} aria-hidden="true" /></span><h2>{t("measurements.living.filters")}</h2></div>
      <div className="filter-fields">
        <div className="field">
          <label htmlFor="filter-kind">{t("measurements.ui.filterKind")}</label>
          <select
            id="filter-kind"
            value={value.kind}
            onChange={(event) =>
              onChange({
                ...value,
                kind: event.target.value as Filters["kind"],
              })
            }
          >
            <option value="all">{t("measurements.ui.all")}</option>
            <option value="bloodPressure">{t("measurements.bloodPressure")}</option>
            <option value="glucose">{t("measurements.bloodGlucose")}</option>
          </select>
        </div>
        <Input
          label={t("measurements.ui.from")}
          type="date"
          value={value.from}
          onChange={(event) => onChange({ ...value, from: event.target.value })}
        />
        <Input
          label={t("measurements.ui.to")}
          type="date"
          value={value.to}
          error={
            invalidRange
              ? t("measurements.ui.invalidRange")
              : undefined
          }
          onChange={(event) => onChange({ ...value, to: event.target.value })}
        />
        <Button
          className="button"
          variant="secondary"
          onClick={() => onChange({ kind: "all", from: "", to: "" })}
        >
          {t("measurements.ui.clear")}
        </Button>
      </div>
      <p className="filter-caption">
        {t("measurements.ui.rangeHint")}
      </p>
    </Card>
  );
}
