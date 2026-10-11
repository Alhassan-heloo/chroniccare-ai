import type { LocaleShape } from "../catalogTypes";
import type { arCatalog } from "./ar";

export const enCatalog = {
  common: {
    reminder: { glucose: "Measure blood glucose", evening: "Today, at 10 PM" },
    layout: { space: "My health space", daily: "Daily follow-up", demo: "Demo", notifications: "Notifications", showNotifications: "Show notifications", account: "Patient account", caption: "Your health space", mainNav: "Main navigation", start: "Your health starts with one step", noteFirst: "Simple tracking every day,", noteLast: "and care that lasts.", demoVersion: "Demo version", mobileNav: "Mobile navigation", health: "My health", assistant: "Assistant", more: "More", showMore: "Show more pages", notificationDemo: "Demo reminder inside the app; real notifications are not enabled.", skip: "Skip to content", footer: "Daily follow-up, in simple steps.", brandHome: "ChronicCare AI, home page", brandTagline: "Together toward a healthier life" },
    preferences: { enableLight: "Enable light mode", enableDark: "Enable dark mode", lightTooltip: "Light mode", darkTooltip: "Dark mode", switchEnglish: "Switch to English", switchArabic: "Switch to Arabic", arabic: "العربية", english: "EN" },
    navigation: { home: "Home", measurements: "My health & measurements", medications: "My medications", habits: "Daily habits", reports: "Reports", assistant: "Health assistant", profile: "My account" },
    chart: { pressureDescription: "Trend of recorded blood pressure readings over the last 7 days, in mmHg", glucoseDescription: "Trend of recorded blood glucose readings over the last 7 days, in mg/dL", systolic: "Systolic", diastolic: "Diastolic", glucose: "Glucose" },
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
