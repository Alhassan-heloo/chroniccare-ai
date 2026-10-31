import type { TranslationKey } from "@/i18n/catalog";
import { translateCatalogMessage } from "@/i18n/catalog";
import type { Habit, HabitInput } from "@/lib/types/habit";

export type HabitTemplateId =
  | "walking"
  | "water"
  | "produce"
  | "relaxation"
  | "bedtime"
  | "movement-breaks"
  | "foot-check";

export interface HabitTemplate {
  id: HabitTemplateId;
  titleKey: TranslationKey;
  unit: HabitInput["unit"];
  exampleTarget?: number;
  group: "core" | "additional";
  diabetesRelated?: boolean;
}

export const habitTemplates: readonly HabitTemplate[] = [
  { id: "walking", titleKey: "habits.templates.items.walking", unit: "minutes", exampleTarget: 20, group: "core" },
  { id: "water", titleKey: "habits.templates.items.water", unit: "cups", group: "core" },
  { id: "produce", titleKey: "habits.templates.items.produce", unit: "times", exampleTarget: 1, group: "core" },
  { id: "relaxation", titleKey: "habits.templates.items.relaxation", unit: "minutes", exampleTarget: 5, group: "core" },
  { id: "bedtime", titleKey: "habits.templates.items.bedtime", unit: "times", exampleTarget: 1, group: "additional" },
  { id: "movement-breaks", titleKey: "habits.templates.items.movementBreaks", unit: "times", exampleTarget: 3, group: "additional" },
  { id: "foot-check", titleKey: "habits.templates.items.footCheck", unit: "times", exampleTarget: 1, group: "additional", diabetesRelated: true },
] as const;

function normalized(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export function findTemplateHabit(template: HabitTemplate, habits: Habit[]) {
  const titles = new Set([
    normalized(translateCatalogMessage("ar", template.titleKey)),
    normalized(translateCatalogMessage("en", template.titleKey)),
  ]);
  return habits.find((habit) => titles.has(normalized(habit.title)));
}
