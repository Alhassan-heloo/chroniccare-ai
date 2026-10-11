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
    metric: { progress: "Progress: {{label}}", goal: "{{value}}% of today's goal", walking: "Daily walking", water: "Drink water" },
    overview: { eyebrow: "Every day, one step toward better health", metrics: "Daily measurements summary", example: "Sample data", recorded: "Recorded reading", noReading: "No reading recorded", activity: "Activity", steps: "steps of {{goal}}", tasks: "What should I do today?", routine: "A simple routine makes a difference", today: "Today's tasks", weeklyLoading: "Loading weekly summary…", demo: "This is a demo with illustrative data marked as ‘Sample data’. Readings are not medically assessed.", weekly: "Your health this week", readings: "A view of your readings", includesExamples: "Includes sample data", chartType: "Summary chart type", weeklyEmpty: "No readings of this type in the last 7 days.", textReadings: "Show readings as text", nextDose: "First time not recorded today: {{time}}", allTaken: "All doses recorded as taken", addMedication: "Add your medication and times from the Medications page", taken: "Taken", update: "Update", inProgress: "In progress", habitProgress: "{{value}} / {{target}} {{unit}}", stepsUnit: "step", cupsUnit: "cup", minutesUnit: "minute", timesUnit: "time", companion: "Your health journey companion", assistantQuestion: "How can I help you today?", askAssistant: "Ask the assistant", assistantUnavailable: "Coming soon · Not connected to AI" },
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
