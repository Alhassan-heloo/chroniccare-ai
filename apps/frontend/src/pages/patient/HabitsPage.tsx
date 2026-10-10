import { useState } from "react";
import { Plus } from "lucide-react";
import type { Habit } from "@/lib/types/habit";
import { useHabits } from "@/hooks/queries/useHabits";
import { useDeleteHabit } from "@/hooks/mutations/useHabitMutations";
import { progressToday } from "@/lib/utils/habits";
import { HabitCard } from "@/components/health/HabitCard";
import { HabitForm } from "@/components/health/HabitForm";
import { HabitProgressForm } from "@/components/health/HabitProgressForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
export default function HabitsPage() {
  const { data = [], isPending, isError, refetch } = useHabits();
  const [form, setForm] = useState<Habit | "new" | null>(null);
  const [progress, setProgress] = useState<Habit | null>(null);
  const [deleting, setDeleting] = useState<Habit | null>(null);
  const deletion = useDeleteHabit();
  const completed = data.filter(
    (item) => progressToday(item) >= item.target,
  ).length;
  return (
    <div className="stack">
      <div className="section-heading measurements-heading">
        <div>
          <span className="eyebrow">خطوات صغيرة، كل يوم</span>
          <h1>عاداتي اليومية</h1>
          <p>حدد أهدافك وسجّل ما أنجزته اليوم.</p>
        </div>
        <Button onClick={() => setForm("new")}>
          <Plus size={20} />
          إضافة عادة
        </Button>
      </div>
      <p className="measurements-notice">
        بيانات تجريبية مؤقتة. يبدأ تقدم يوم جديد من صفر حسب توقيت جهازك، وتعود
        أمثلة البداية عند تحديث الصفحة.
      </p>
      {isPending ? (
        <Card className="empty-state" role="status">
          جارٍ تحميل العادات…
        </Card>
      ) : isError ? (
        <Card className="empty-state" role="alert">
          <p>تعذر تحميل العادات</p>
          <Button onClick={() => void refetch()}>إعادة المحاولة</Button>
        </Card>
      ) : (
        <>
          <Card className="medication-summary">
            <h2>إنجاز اليوم</h2>
            <p aria-live="polite">
              {completed} من {data.length} عادات مكتملة
            </p>
            <progress
              value={completed}
              max={data.length || 1}
              aria-label="العادات المكتملة اليوم"
            />
          </Card>
          {data.length ? (
            <div className="medication-grid">
              {data.map((item) => (
                <HabitCard
                  key={item.id}
                  habit={item}
                  onProgress={setProgress}
                  onEdit={setForm}
                  onDelete={setDeleting}
                />
              ))}
            </div>
          ) : (
            <Card className="empty-state measurement-empty">
              <h2>ابدأ بعادتك الأولى</h2>
              <p>اختر هدفًا يوميًا مناسبًا لك.</p>
              <Button onClick={() => setForm("new")}>إضافة عادة</Button>
            </Card>
          )}
        </>
      )}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form === "new" ? "إضافة عادة" : "تعديل العادة"}
      >
        {form && (
          <HabitForm
            key={form === "new" ? "new" : form.id}
            initial={form === "new" ? undefined : form}
            onSaved={() => setForm(null)}
          />
        )}
      </Modal>
      <Modal
        open={!!progress}
        onClose={() => setProgress(null)}
        title="تسجيل تقدم اليوم"
      >
        {progress && (
          <HabitProgressForm
            key={progress.id}
            habit={progress}
            onSaved={() => setProgress(null)}
          />
        )}
      </Modal>
      <Modal
        open={!!deleting}
        onClose={() => {
          if (!deletion.isPending) setDeleting(null);
        }}
        title="حذف العادة؟"
      >
        {deleting && (
          <div className="stack">
            <p>
              هل تريد حذف «{deleting.title}» وتقدمها المسجل؟ لا يمكن التراجع.
            </p>
            <div className="confirmation-actions">
              <Button
                autoFocus
                variant="secondary"
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
                تأكيد الحذف
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
