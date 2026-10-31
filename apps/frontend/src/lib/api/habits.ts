import type { Habit, HabitInput } from "@/lib/types/habit";
import { createHabitPlaceholders } from "@/lib/placeholder-data/habits.placeholder";
import {
  habitSchema,
  habitProgressSchema,
  habitDay,
  progressToday,
} from "@/lib/utils/habits";
const habits = createHabitPlaceholders();
export function getHabitsSnapshot(): Habit[] {
  return habits.map((item) => ({
    ...item,
    progress: progressToday(item),
    recordedOn: habitDay(),
  }));
}
export async function getHabits() {
  return getHabitsSnapshot();
}
export async function addHabit(input: HabitInput) {
  const item: Habit = {
    ...habitSchema.parse(input),
    id: crypto.randomUUID(),
    templateKey: null,
    progress: 0,
    recordedOn: habitDay(),
  };
  habits.push(item);
  return { ...item };
}
export async function updateHabit({
  id,
  input,
}: {
  id: string;
  input: HabitInput;
}) {
  const index = habits.findIndex((item) => item.id === id);
  const old = habits[index];
  if (!old) throw new Error("العادة غير موجودة");
  const valid = habitSchema.parse(input);
  const item: Habit = {
    ...valid,
    id,
    templateKey: old.templateKey,
    progress: old.unit === valid.unit ? progressToday(old) : 0,
    recordedOn: habitDay(),
  };
  habits[index] = item;
  return { ...item };
}
export async function deleteHabit(id: string) {
  const index = habits.findIndex((item) => item.id === id);
  if (index < 0) throw new Error("العادة غير موجودة");
  habits.splice(index, 1);
}
export async function setHabitProgress({
  id,
  value,
}: {
  id: string;
  value: number;
}) {
  const item = habits.find((item) => item.id === id);
  if (!item) throw new Error("العادة غير موجودة");
  item.progress = habitProgressSchema.parse(value);
  item.recordedOn = habitDay();
  return { ...item };
}
