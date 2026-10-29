import express from "express";
import cors from "cors";
import helmet from "helmet";
import { apiRoutes } from "./routes/index.js";
import { errorHandler, HttpError, notFound } from "./middleware/errors.js";
import type { AuthStore } from "./auth/store.js";
import { authRoutes } from "./routes/auth.js";
import type { MeasurementStore } from "./measurements/store.js";
import { measurementRoutes } from "./routes/measurements.js";
import type { MedicationStore } from "./medications/store.js";
import { medicationRoutes } from "./routes/medications.js";

export interface AppOptions {
  corsOrigins: readonly string[];
  checkDatabase: () => Promise<void>;
  reportError?: () => void;
  authStore?: AuthStore;
  measurementStore?: MeasurementStore;
  medicationStore?: MedicationStore;
}

// No listening socket, environment reads, or database connections on import.
export function createApp(options: AppOptions) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", false);
  app.use(helmet());
  app.use((_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || options.corsOrigins.includes(origin)) callback(null, true);
      else callback(new HttpError(403, "ORIGIN_NOT_ALLOWED", "Request origin is not allowed."));
    },
    methods: ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
    maxAge: 600,
  }));
  app.use(express.json({ limit: "32kb", strict: true, inflate: false }));
  if (options.authStore) app.use("/api/auth", authRoutes(options.authStore));
  if (options.measurementStore) {
    if (!options.authStore) throw new Error("Measurement routes require authentication.");
    app.use("/api/measurements", measurementRoutes(options.authStore, options.measurementStore));
  }
  if (options.medicationStore) {
    if (!options.authStore) throw new Error("Medication routes require authentication.");
    app.use("/api/medications", medicationRoutes(options.authStore, options.medicationStore));
  }
  app.use("/api", apiRoutes(options.checkDatabase));
  app.use(notFound);
  app.use(errorHandler(options.reportError));
  return app;
}
