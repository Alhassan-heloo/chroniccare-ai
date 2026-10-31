import type { Habit } from "@/lib/types/habit";
import { habitDay } from "@/lib/utils/habits";
export function createHabitPlaceholders(): Habit[] {
  return [
    {
      id: "steps",
      templateKey: null,
      title: "المشي اليومي",
      unit: "steps",
      target: 10000,
      progress: 4500,
      recordedOn: habitDay(),
    },
    {
      id: "water",
      templateKey: null,
      title: "شرب الماء",
      unit: "cups",
      target: 8,
      progress: 6,
      recordedOn: habitDay(),
    },
  ];
}
