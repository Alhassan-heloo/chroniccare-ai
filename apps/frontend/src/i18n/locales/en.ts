import type { LocaleShape } from "../catalogTypes";
import type { arCatalog } from "./ar";

export const enCatalog = {
  common: {
    actions: {
      cancel: "Cancel",
      close: "Close",
      delete: "Delete",
      edit: "Edit",
      retry: "Try again",
      save: "Save",
    },
    state: {
      loading: "Loading…",
      noData: "No data",
    },
    theme: {
      label: "Theme mode",
      light: "Light",
      dark: "Dark",
      system: "System",
    },
  },
  auth: {
    signIn: "Sign in",
    register: "Create account",
  },
  patient: {
    dashboard: {
      title: "Home",
      welcome: "Welcome {{name}}",
      summary: "Here is your health summary today",
      loading: "Loading your health summary…",
      error: "Could not load data",
    },
  },
  measurements: {
    title: "My health & measurements",
    add: "Add new reading",
    bloodPressure: "Blood pressure",
    bloodGlucose: "Blood glucose",
    empty: "No matching readings",
  },
  medications: {
    title: "My medications",
    add: "Add medication",
    empty: "No medications recorded",
    dosesTaken: "Doses taken",
  },
  habits: {
    title: "Daily habits",
    add: "Add habit",
    empty: "Start with your first habit",
    completed: "Complete",
  },
  reports: {
    title: "My reports",
    period: "Report period",
    loadingChart: "Loading chart…",
    noReadings: "No readings in this period.",
  },
  doctor: {
    dashboard: "Doctor dashboard",
    patients: "My patients",
  },
  admin: {
    dashboard: "Admin dashboard",
  },
  validation: {
    required: "This field is required",
    invalidNumber: "Enter a valid number",
    operationFailed: "The operation failed. Try again.",
  },
} as const satisfies LocaleShape<typeof arCatalog>;
