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
import type { HabitStore } from "./habits/store.js";
import { habitRoutes } from "./routes/habits.js";
import type { DoctorStore } from "./doctor/store.js";
import { doctorRoutes } from "./routes/doctor.js";
import type { AdminStore } from "./admin/store.js";
import { adminRoutes } from "./routes/admin.js";
import { bootstrapRoutes, type bootstrapService } from "./auth/bootstrap.js";
import type { ConnectionStore } from "./connections/store.js";
import { connectionRoutes } from "./routes/connections.js";
import { browserSecurity, type CookieSettings } from "./auth/cookies.js";
import { accountRoutes } from "./routes/accounts.js";
import type { AccountService } from "./auth/accounts.js";
import type { AssistantProvider } from "./assistant/provider.js";
import { assistantRoutes } from "./routes/assistant.js";
import { notificationRoutes } from "./routes/notifications.js";
import type { NotificationStore } from "./notifications/store.js";
import { registrationRoutes, type RegistrationStore } from "./notifications/registrations.js";

export interface AppOptions {
  corsOrigins: readonly string[];
  checkDatabase: () => Promise<void>;
  reportError?: () => void;
  authStore?: AuthStore;
  measurementStore?: MeasurementStore;
  medicationStore?: MedicationStore;
  habitStore?: HabitStore;
  doctorStore?: DoctorStore;
  adminStore?: AdminStore;
  bootstrap?: ReturnType<typeof bootstrapService>;
  connectionStore?: ConnectionStore;
  cookies?: CookieSettings;
  accountService?: AccountService;
  assistantProvider?: AssistantProvider;
  notificationStore?: NotificationStore;
  registrationStore?: RegistrationStore;
}

// No listening socket, environment reads, or database connections on import.
export function createApp(options: AppOptions) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", options.cookies?.trustedProxy ?? false);
  app.use(helmet());
  app.use((_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || options.corsOrigins.includes(origin)) callback(null, true);
      else callback(new HttpError(403, "ORIGIN_NOT_ALLOWED", "Request origin is not allowed."));
    },
    methods: ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    credentials: true,
    exposedHeaders: ["X-Account-ID"],
    maxAge: 600,
  }));
  app.use(express.json({ limit: "32kb", strict: true, inflate: false }));
  app.use(browserSecurity(options.corsOrigins, options.cookies ?? { secure: false }));
  if (options.accountService) app.use("/api/accounts", accountRoutes(options.accountService));
  app.use("/api/setup", bootstrapRoutes(options.bootstrap));
  if (options.connectionStore) {
    if (!options.authStore) throw new Error("Connections require authentication.");
    app.use("/api/connections", connectionRoutes(options.authStore, options.connectionStore));
  }
  if (options.authStore) app.use("/api/auth", authRoutes(options.authStore, options.accountService?.reservedAdminEmail));
  if (options.authStore) app.use("/api/assistant", assistantRoutes(options.authStore, options.assistantProvider));
  if (options.notificationStore) {
    if (!options.authStore) throw new Error("Notifications require authentication.");
    app.use("/api/notifications", notificationRoutes(options.authStore, options.notificationStore));
  }
  if (options.registrationStore) {
    if (!options.authStore) throw new Error("Browser registrations require authentication.");
    app.use("/api/notifications/browser-registration", registrationRoutes(options.authStore, options.registrationStore));
  }
  if (options.measurementStore) {
    if (!options.authStore) throw new Error("Measurement routes require authentication.");
    app.use("/api/measurements", measurementRoutes(options.authStore, options.measurementStore));
  }
  if (options.medicationStore) {
    if (!options.authStore) throw new Error("Medication routes require authentication.");
    app.use("/api/medications", medicationRoutes(options.authStore, options.medicationStore));
  }
  if (options.habitStore) {
    if (!options.authStore) throw new Error("Habit routes require authentication.");
    app.use("/api/habits", habitRoutes(options.authStore, options.habitStore));
  }
  if (options.doctorStore) {
    if (!options.authStore || !options.measurementStore || !options.medicationStore || !options.habitStore) {
      throw new Error("Doctor routes require authentication and all patient data stores.");
    }
    app.use("/api/doctor", doctorRoutes(options.authStore, options.doctorStore,
      options.measurementStore, options.medicationStore, options.habitStore));
  }
  if (options.adminStore) {
    if (!options.authStore) throw new Error("Admin routes require authentication.");
    app.use("/api/admin", adminRoutes(options.authStore, options.adminStore));
  }
  app.use("/api", apiRoutes(options.checkDatabase));
  app.use(notFound);
  app.use(errorHandler(options.reportError));
  return app;
}
