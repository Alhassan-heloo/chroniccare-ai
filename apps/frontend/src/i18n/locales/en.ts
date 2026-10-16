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
    name: "Full name", email: "Email address", password: "Password", confirmation: "Confirm password",
    registerIntro: "Create your patient account to begin.", loginIntro: "Welcome back. Sign in to your account.",
    passwordHint: "Use 12–128 characters. Spaces are preserved.", nameInvalid: "Enter a name of 1–100 characters.", emailInvalid: "Enter a valid email address.", mismatch: "Passwords do not match.",
    showPassword: "Show password", hidePassword: "Hide password", working: "Please wait…",
    incorrect: "Email or password is incorrect.", duplicate: "An account with this email already exists.", invalid: "Check your account details.", rateLimited: "Too many attempts. Please try again later.", network: "Could not connect. Check your connection and try again.", failed: "The operation failed. Please try again.",
    created: "Account created. You can now sign in.", expired: "Your session ended. Please sign in again.", logout: "Sign out", logoutFailed: "Signed out locally, but server revocation could not be confirmed. The session may remain valid until it expires.",
    haveAccount: "Already have an account? Sign in", needAccount: "New here? Create a patient account", backHome: "Back to home", exploreDemo: "Explore without an account",
    memoryNotice: "For security, reloading the page requires signing in again.", dataNotice: "Health pages currently use illustrative demo data, not personal medical records.",
    session: "Account navigation", patient: "Patient dashboard", doctor: "Doctor dashboard", admin: "Admin dashboard", demo: "Demo — no authenticated account",
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
    ui: { eyebrow: "Track your health, step by step", description: "Record and review your readings in one place.", notice: "Demo: the history starts with examples from the last 7 days. Changes are temporary and initial examples return on reload. Readings are not medically assessed.", loading: "Loading measurements…", loadError: "Could not load measurement history.", history: "Reading history", count: "{{shown}} of {{total}} readings", adjustRange: "Adjust the date range to show results.", first: "Start with your first reading", firstDescription: "Add a blood pressure or glucose reading to see it here and on the dashboard.", noMatches: "No matching readings", broaden: "Try another type or broaden the date range.", showAll: "Show all readings", edit: "Edit reading", deleteTitle: "Delete reading?", deleteQuestion: "Delete the {{kind}} reading {{value}}? This cannot be undone.", deleteHint: "The dashboard will show the previous reading of the same type, or the default example if the history becomes empty.", deleting: "Deleting…", confirmDelete: "Confirm deletion", formNotice: "Demo reading, kept until the page reloads.", readingKind: "Reading type", systolic: "Systolic pressure", diastolic: "Diastolic pressure", saving: "Saving…", saveChanges: "Save changes", saveReading: "Save reading", filterKind: "Measurement type", all: "All measurements", from: "From date", to: "To date", invalidRange: "Choose a date on or after the start date", clear: "Clear filters", rangeHint: "The search includes both dates in your device time zone.", example: "Sample data", editLabel: "Edit {{kind}} reading {{time}}", deleteLabel: "Delete {{kind}} reading {{time}}", saved: "Reading saved temporarily", updated: "Reading updated", deleted: "Reading deleted", failed: "The operation failed. Try again.", invalidNumber: "Enter a valid number", positive: "The value must be greater than zero", checkReading: "Check the reading", integer: "Enter a whole number", diastolicOrder: "Diastolic pressure must be lower than systolic pressure" },
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
    completedSingle: "{{completed}} of {{total}} completed habit",
    ui: { eyebrow: "Small steps, every day", description: "Set your goals and record today's progress.", notice: "Temporary demo data. Progress resets to zero on a new day in your device time zone, and initial examples return on reload.", loading: "Loading habits…", error: "Could not load habits", achievement: "Today's progress", completedSummary: "{{completed}} of {{total}} completed habits", completedLabel: "Habits completed today", emptyDescription: "Choose a suitable daily goal.", edit: "Edit habit", record: "Record today's progress", deleteTitle: "Delete habit?", deleteQuestion: "Delete ‘{{name}}’ and its recorded progress? This cannot be undone.", confirmDelete: "Confirm deletion", progress: "{{value}} of {{target}} {{unit}}", inProgress: "In progress", progressLabel: "Progress: {{name}}", percent: "{{value}}% of goal", exceeded: "Exceeded the recorded goal", name: "Habit name", unit: "Unit", target: "Daily goal", advice: "Choose a suitable goal. Default goals are examples, not health recommendations.", changeHint: "Changing the unit resets today's progress; changing the goal keeps the recorded amount.", save: "Save habit", totalToday: "Total completed today ({{unit}})", progressHint: "This value replaces today's total; it is not added to it. Enter zero to clear today's progress.", saveProgress: "Save progress", added: "Habit added", updated: "Habit updated", deleted: "Habit deleted", progressUpdated: "Today's progress updated", failed: "Could not update the habit. Try again.", invalidName: "Enter a habit name", longName: "The name is too long", numericGoal: "Enter a numeric goal", integer: "Enter a whole number", positiveGoal: "The goal must be greater than zero", checkGoal: "Check the goal", invalidNumber: "Enter a valid number", negative: "Progress cannot be negative", checkValue: "Check the value" },
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
