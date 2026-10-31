import { useMemo, useRef, useState } from "react";
import { Apple, BedDouble, CircleCheck, Droplets, Footprints, HeartPulse, Plus, Sparkles, Wind } from "lucide-react";
import { useAddHabit } from "@/hooks/mutations/useHabitMutations";
import { useI18n } from "@/i18n/context";
import { findTemplateHabit, habitTemplates, type HabitTemplate, type HabitTemplateId } from "@/lib/habitTemplates";
import type { Habit } from "@/lib/types/habit";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const icons = {
  walking: Footprints,
  water: Droplets,
  produce: Apple,
  relaxation: Wind,
  bedtime: BedDouble,
  "movement-breaks": HeartPulse,
  "foot-check": CircleCheck,
} as const;

export function HabitTemplateLibrary({
  habits,
  onCustomize,
  onEdit,
}: {
  habits: Habit[];
  onCustomize: (template: HabitTemplate) => void;
  onEdit: (habit: Habit) => void;
}) {
  const { t, formatNumber, formatHabitUnit } = useI18n();
  const add = useAddHabit();
  const locks = useRef(new Set<HabitTemplateId>());
  const [pending, setPending] = useState<Set<HabitTemplateId>>(() => new Set());
  const active = useMemo(
    () => new Map(habitTemplates.map((template) => [template.id, findTemplateHabit(template, habits)])),
    [habits],
  );

  const activate = async (template: HabitTemplate) => {
    if (active.get(template.id) || locks.current.has(template.id)) return;
    if (template.exampleTarget === undefined) {
      onCustomize(template);
      return;
    }
    locks.current.add(template.id);
    setPending((current) => new Set(current).add(template.id));
    try {
      await add.mutateAsync({
        title: t(template.titleKey),
        unit: template.unit,
        target: template.exampleTarget,
        templateKey: template.id,
      });
    } catch {
      // The mutation hook owns translated error feedback. Keep the template available.
    } finally {
      locks.current.delete(template.id);
      setPending((current) => {
        const next = new Set(current);
        next.delete(template.id);
        return next;
      });
    }
  };

  return (
    <section className="habit-templates" aria-labelledby="habit-templates-title" data-i18n="declarative">
      <div className="habit-templates-heading">
        <span className="dashboard-feature-icon" aria-hidden="true"><Sparkles size={20} /></span>
        <div>
          <span className="eyebrow">{t("habits.templates.eyebrow")}</span>
          <h2 id="habit-templates-title">{t("habits.templates.title")}</h2>
          <p>{t("habits.templates.description")}</p>
        </div>
      </div>
      <div className="habit-template-grid">
        {habitTemplates.map((template) => {
          const Icon = icons[template.id];
          const existing = active.get(template.id);
          const isPending = pending.has(template.id);
          const target = template.exampleTarget;
          return (
            <Card
              className="habit-template-card glass"
              data-template={template.id}
              key={template.id}
              aria-busy={isPending || undefined}
            >
              <div className="habit-template-title">
                <span className="habit-template-icon" aria-hidden="true"><Icon size={19} /></span>
                <div>
                  <Badge tone="info">
                    {t(`habits.templates.${template.group}`)}
                  </Badge>
                  <h3>{t(template.titleKey)}</h3>
                </div>
              </div>
              <p className="habit-template-goal">
                {target === undefined
                  ? t("habits.templates.chooseFluidGoal")
                  : t("habits.templates.exampleGoal", {
                      target: formatNumber(target),
                      unit: formatHabitUnit(template.unit, target),
                    })}
              </p>
              {template.diabetesRelated && (
                <p className="habit-template-safety">{t("habits.templates.diabetesOptional")}</p>
              )}
              <div className="habit-template-actions">
                {existing ? (
                  <>
                    <Button variant="secondary" disabled><CircleCheck size={17} aria-hidden="true" />{t("habits.templates.added")}</Button>
                    <Button variant="ghost" onClick={() => onEdit(existing)}>{t("habits.templates.editActive")}</Button>
                  </>
                ) : (
                  <>
                    <Button
                      className="habit-template-add"
                      disabled={isPending}
                      onClick={() => void activate(template)}
                    >
                      <Plus size={17} aria-hidden="true" />
                      {isPending
                        ? t("habits.templates.adding")
                        : target === undefined
                          ? t("habits.templates.chooseGoal")
                          : t("habits.templates.add")}
                    </Button>
                    <Button variant="ghost" disabled={isPending} onClick={() => onCustomize(template)}>
                      {t("habits.templates.customize")}
                    </Button>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      <p className="habit-template-disclosure">{t("habits.templates.disclosure")}</p>
    </section>
  );
}
