import { AuthError, type AuthorizedRequest } from "@/auth/api";
import { habitTemplateKeys, type Habit, type HabitCreateInput, type HabitInput, type HabitTemplateKey } from "@/lib/types/habit";
import { habitDay, habitProgressSchema, habitSchema } from "@/lib/utils/habits";

export interface HabitSource {
  list(signal?: AbortSignal): Promise<Habit[]>;
  create(input: HabitCreateInput): Promise<Habit>;
  update(update: { id: string; input: HabitInput }): Promise<Habit>;
  delete(id: string): Promise<void>;
  setProgress(action: { id: string; value: number }): Promise<void>;
}
function date(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
function record(value: unknown): Habit {
  if (!value || typeof value !== "object") throw new AuthError("INVALID_RESPONSE");
  const fields = value as Record<string, unknown>;
  const input = habitSchema.safeParse({ title: fields.title, unit: fields.unit, target: fields.target });
  const progress = habitProgressSchema.safeParse(fields.progress);
  const templateKey = fields.templateKey;
  if (typeof fields.id !== "string" || !date(fields.recordedOn) || !input.success || !progress.success
    || (templateKey !== null && (typeof templateKey !== "string" || !habitTemplateKeys.includes(templateKey as HabitTemplateKey)))) {
    throw new AuthError("INVALID_RESPONSE");
  }
  return { ...input.data, id: fields.id, templateKey: templateKey as HabitTemplateKey | null, progress: progress.data, recordedOn: fields.recordedOn };
}
function single(response: unknown): Habit {
  if (!response || typeof response !== "object" || !("habit" in response)) throw new AuthError("INVALID_RESPONSE");
  return record(response.habit);
}
function dayPath(path: string) {
  return path + (path.includes("?") ? "&" : "?") + "date=" + habitDay();
}
export function authenticatedHabits(request: AuthorizedRequest): HabitSource {
  return {
    async list(signal) {
      const response = await request<unknown>(dayPath("/habits"), { signal });
      if (!response || typeof response !== "object" || !("habits" in response) || !Array.isArray(response.habits)) {
        throw new AuthError("INVALID_RESPONSE");
      }
      return response.habits.map(record);
    },
    async create(input) {
      return single(await request<unknown>(dayPath("/habits"), { method: "POST", body: input }));
    },
    async update({ id, input }) {
      return single(await request<unknown>(dayPath("/habits/" + encodeURIComponent(id)), { method: "PUT", body: input }));
    },
    delete(id) {
      return request<void>("/habits/" + encodeURIComponent(id), { method: "DELETE" });
    },
    setProgress({ id, value }) {
      return request<void>("/habits/" + encodeURIComponent(id) + "/progress",
        { method: "PUT", body: { date: habitDay(), value } });
    },
  };
}
