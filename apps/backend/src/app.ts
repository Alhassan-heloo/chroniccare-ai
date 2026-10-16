import express from "express";
import cors from "cors";
import helmet from "helmet";
import { apiRoutes } from "./routes/index.js";
import { errorHandler, HttpError, notFound } from "./middleware/errors.js";
import type { AuthStore } from "./auth/store.js";
import { authRoutes } from "./routes/auth.js";

export interface AppOptions {
  corsOrigins: readonly string[];
  checkDatabase: () => Promise<void>;
  reportError?: () => void;
  authStore?: AuthStore;
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
    methods: ["GET", "HEAD", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
    maxAge: 600,
  }));
  app.use(express.json({ limit: "32kb", strict: true, inflate: false }));
  if (options.authStore) app.use("/api/auth", authRoutes(options.authStore));
  app.use("/api", apiRoutes(options.checkDatabase));
  app.use(notFound);
  app.use(errorHandler(options.reportError));
  return app;
}
