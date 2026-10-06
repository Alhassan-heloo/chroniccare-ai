import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { MeasurementFilters as Filters } from "@/lib/types/measurementFilters";
export function MeasurementFilters({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (value: Filters) => void;
}) {
  const invalidRange = !!value.from && !!value.to && value.from > value.to;
  return (
    <Card className="measurements-filters">
      <div className="filter-fields">
        <div className="field">
          <label htmlFor="filter-kind">نوع القياس</label>
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
            <option value="all">كل القياسات</option>
            <option value="bloodPressure">ضغط الدم</option>
            <option value="glucose">سكر الدم</option>
          </select>
        </div>
        <Input
          label="من تاريخ"
          type="date"
          value={value.from}
          onChange={(event) => onChange({ ...value, from: event.target.value })}
        />
        <Input
          label="إلى تاريخ"
          type="date"
          value={value.to}
          error={
            invalidRange
              ? "اختر تاريخًا يساوي تاريخ البداية أو يأتي بعده"
              : undefined
          }
          onChange={(event) => onChange({ ...value, to: event.target.value })}
        />
        <Button
          variant="secondary"
          onClick={() => onChange({ kind: "all", from: "", to: "" })}
        >
          مسح الفلاتر
        </Button>
      </div>
      <p className="filter-caption">
        يشمل البحث يوم البداية والنهاية حسب توقيت جهازك.
      </p>
    </Card>
  );
}
