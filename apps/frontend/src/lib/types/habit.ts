export const habitTemplateKeys = ["walking", "water", "produce", "relaxation", "bedtime", "movement-breaks", "foot-check"] as const;
export type HabitTemplateKey = typeof habitTemplateKeys[number];
export interface HabitInput {
  title: string;
  unit: "steps" | "minutes" | "cups" | "times";
  target: number;
}
export interface HabitCreateInput extends HabitInput {
  templateKey?: HabitTemplateKey;
}
export interface Habit extends HabitInput {
  id: string;
  templateKey: HabitTemplateKey | null;
  progress: number;
  recordedOn: string;
}
