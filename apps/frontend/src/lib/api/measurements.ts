import { AuthError, type AuthorizedRequest } from "@/auth/api";
import type { Measurement, MeasurementInput } from "@/lib/types/measurement";
import { measurementSchema } from "@/lib/utils/measurementSchema";

export function parseMeasurement(value: unknown): Measurement {
  if (!value || typeof value !== "object") throw new AuthError("INVALID_RESPONSE");
  const fields = value as Record<string, unknown>;
  const input = measurementSchema.safeParse(value);
  if (!input.success || typeof fields.id !== "string" || typeof fields.recordedAt !== "string" || fields.isExample !== false || !Number.isFinite(Date.parse(fields.recordedAt))) throw new AuthError("INVALID_RESPONSE");
  return { ...input.data, id: fields.id, recordedAt: fields.recordedAt, isExample: false };
}
function single(response: unknown): Measurement {
  if (!response || typeof response !== "object" || !("measurement" in response)) throw new AuthError("INVALID_RESPONSE");
  return parseMeasurement(response.measurement);
}

export interface MeasurementSource {
  list(signal?: AbortSignal): Promise<Measurement[]>;
  create(input: MeasurementInput): Promise<Measurement>;
  update(update: { id: string; input: MeasurementInput }): Promise<Measurement>;
  delete(id: string): Promise<void>;
}
export function authenticatedMeasurements(request: AuthorizedRequest): MeasurementSource {
  return {
    async list(signal) {
      const response = await request<unknown>("/measurements", { signal });
      if (!response || typeof response !== "object" || !("measurements" in response) || !Array.isArray(response.measurements)) throw new AuthError("INVALID_RESPONSE");
      return response.measurements.map(parseMeasurement);
    },
    async create(input) { return single(await request<unknown>("/measurements", { method: "POST", body: input })); },
    async update({ id, input }) { return single(await request<unknown>(`/measurements/${encodeURIComponent(id)}`, { method: "PUT", body: input })); },
    delete(id) { return request<void>(`/measurements/${encodeURIComponent(id)}`, { method: "DELETE" }); },
  };
}
