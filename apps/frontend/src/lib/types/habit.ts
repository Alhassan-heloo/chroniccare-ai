export interface HabitInput {
  title: string;
  unit: "steps" | "minutes" | "cups" | "times";
  target: number;
}
export interface Habit extends HabitInput {
  id: string;
  progress: number;
  recordedOn: string;
}
