import { z } from "zod";
const positive = z
  .number({ error: "measurements.ui.invalidNumber" })
  .positive("measurements.ui.positive")
  .finite();
// Technical bounds only; these are not clinical thresholds or a diagnosis.
export const measurementSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("bloodPressure"),
      systolic: positive.max(400, "measurements.ui.checkReading").int("measurements.ui.integer"),
      diastolic: positive.max(300, "measurements.ui.checkReading").int("measurements.ui.integer"),
    })
    .refine((data) => data.systolic > data.diastolic, {
      path: ["diastolic"],
      message: "measurements.ui.diastolicOrder",
    }),
  z.object({
    kind: z.literal("glucose"),
    value: positive.max(1500, "measurements.ui.checkReading"),
  }),
]);
