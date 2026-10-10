import { useState } from "react";
import { Plus, Activity } from "lucide-react";
import { useMeasurements } from "@/hooks/queries/usePatientDashboard";
import { useDeleteMeasurement } from "@/hooks/mutations/useMeasurementMutations";
import { useDashboardActions } from "@/context/DashboardContext";
import type { Measurement } from "@/lib/types/measurement";
import type { MeasurementFilters as Filters } from "@/lib/types/measurementFilters";
import {
  filterMeasurements,
  measurementLabel,
  measurementValue,
} from "@/lib/utils/measurementFilters";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { MeasurementFilters } from "@/components/health/MeasurementFilters";
import { MeasurementListCard } from "@/components/health/MeasurementListCard";
import { MeasurementForm } from "@/components/health/MeasurementForm";

export default function MeasurementsPage() {
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
    <div className="stack measurements-page">
      <div className="section-heading measurements-heading">
        <div>
          <span className="eyebrow">خطوة بخطوة، تابع صحتك</span>
          <h1>صحتي وقياساتي</h1>
          <p>سجل قراءاتك وراجعها في مكان واحد.</p>
        </div>
        <Button onClick={openMeasurement}>
          <Plus size={21} />
          إضافة قراءة جديدة
        </Button>
      </div>
      <p className="measurements-notice">
        نسخة تجريبية: يبدأ السجل بأمثلة لآخر 7 أيام. التغييرات مؤقتة وتعود أمثلة
        البداية عند تحديث الصفحة. لا يتم تقييم القراءات طبيًا.
      </p>
      <MeasurementFilters value={filters} onChange={setFilters} />
      {isPending ? (
        <Card className="empty-state" role="status">
          جارٍ تحميل القياسات…
        </Card>
      ) : isError ? (
        <Card className="empty-state" role="alert">
          <p>تعذر تحميل سجل القياسات.</p>
          <Button onClick={() => void refetch()}>إعادة المحاولة</Button>
        </Card>
      ) : (
        <>
          <div className="section-heading">
            <h2>سجل القراءات</h2>
            <p role="status" aria-live="polite">
              {filtered.length} من {data.length} قراءة
            </p>
          </div>
          {invalidRange ? (
            <Card className="empty-state">
              عدّل الفترة الزمنية لعرض النتائج.
            </Card>
          ) : data.length === 0 ? (
            <Card className="empty-state measurement-empty">
              <Activity size={36} />
              <h2>ابدأ بأول قراءة</h2>
              <p>أضف قياس الضغط أو السكر ليظهر هنا وفي لوحة المريض.</p>
              <Button onClick={openMeasurement}>إضافة قراءة</Button>
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="empty-state measurement-empty">
              <h2>لا توجد قراءات مطابقة</h2>
              <p>جرّب نوعًا آخر أو وسّع الفترة الزمنية.</p>
              <Button
                variant="secondary"
                onClick={() => setFilters({ kind: "all", from: "", to: "" })}
              >
                عرض جميع القراءات
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
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="تعديل القراءة"
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
        title="حذف القراءة؟"
      >
        {deleting && (
          <div className="stack">
            <p>
              هل تريد حذف قراءة {measurementLabel(deleting)}{" "}
              <bdi>{measurementValue(deleting)}</bdi>؟ لا يمكن التراجع عن الحذف.
            </p>
            <p className="muted">
              ستعرض لوحة المريض القراءة السابقة من نفس النوع، أو المثال
              الافتراضي إذا أصبح السجل فارغًا.
            </p>
            <div className="confirmation-actions">
              <Button
                variant="secondary"
                autoFocus
                disabled={deletion.isPending}
                onClick={() => setDeleting(null)}
              >
                إلغاء
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
                {deletion.isPending ? "جارٍ الحذف…" : "تأكيد الحذف"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
