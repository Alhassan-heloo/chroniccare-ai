export interface Habit {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  kind: "walk" | "water";
}
