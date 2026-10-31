import { HttpError } from "../middleware/errors.js";

export type HabitUnit = "steps" | "minutes" | "cups" | "times";
export const habitTemplateKeys = ["walking", "water", "produce", "relaxation", "bedtime", "movement-breaks", "foot-check"] as const;
export type HabitTemplateKey = typeof habitTemplateKeys[number];
export interface HabitInput { title: string; unit: HabitUnit; target: number }
export interface HabitCreateInput extends HabitInput { templateKey?: HabitTemplateKey }
export interface Habit extends HabitInput { id: string; templateKey: HabitTemplateKey | null; progress: number; recordedOn: string }
export interface ProgressInput { date: string; value: number }

function invalid(code = "INVALID_HABIT"): never { throw new HttpError(400, code, "Check the habit fields."); }
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function exact(fields: Record<string, unknown>, allowed: readonly string[]) {
  if (Object.keys(fields).some(key => !allowed.includes(key))) invalid();
}
export function habitDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid("INVALID_HABIT_DATE");
  const [year, month, day] = value.split("-").map(Number), parsed = new Date(value + "T00:00:00.000Z");
  if (year === undefined || month === undefined || day === undefined || year < 1
    || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) invalid("INVALID_HABIT_DATE");
  return value;
}
export function validateHabit(body: unknown, allowTemplateKey: true): HabitCreateInput;
export function validateHabit(body: unknown, allowTemplateKey?: false): HabitInput;
export function validateHabit(body: unknown, allowTemplateKey = false): HabitCreateInput {
  if (!object(body)) invalid();
  exact(body, allowTemplateKey ? ["title", "unit", "target", "templateKey"] : ["title", "unit", "target"]);
  if (typeof body.title !== "string" || typeof body.unit !== "string" || typeof body.target !== "number") invalid();
  const title = body.title.trim();
  if (title.length < 2 || title.length > 80 || !["steps", "minutes", "cups", "times"].includes(body.unit)
    || !Number.isInteger(body.target) || body.target < 1 || body.target > 100000) invalid();
  if (body.templateKey !== undefined && (typeof body.templateKey !== "string"
    || !habitTemplateKeys.includes(body.templateKey as HabitTemplateKey))) invalid();
  return {
    title,
    unit: body.unit as HabitUnit,
    target: body.target,
    ...(body.templateKey === undefined ? {} : { templateKey: body.templateKey as HabitTemplateKey }),
  };
}
export function validateProgress(body: unknown): ProgressInput {
  if (!object(body)) invalid("INVALID_HABIT_PROGRESS");
  exact(body, ["date", "value"]);
  if (typeof body.value !== "number" || !Number.isInteger(body.value) || body.value < 0 || body.value > 100000) invalid("INVALID_HABIT_PROGRESS");
  return { date: habitDate(body.date), value: body.value };
}
export function habitId(value: string): string {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) {
    throw new HttpError(400, "INVALID_HABIT_ID", "Habit ID is invalid.");
  }
  return value;
}
