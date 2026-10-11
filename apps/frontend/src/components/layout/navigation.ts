import {
  House,
  HeartPulse,
  Pill,
  Footprints,
  ChartNoAxesCombined,
  Bot,
  UserRound,
} from "lucide-react";
export const patientNavigation = [
  { to: "/patient/dashboard", label: "common.navigation.home", icon: House },
  { to: "/patient/measurements", label: "common.navigation.measurements", icon: HeartPulse },
  { to: "/patient/medications", label: "common.navigation.medications", icon: Pill },
  { to: "/patient/habits", label: "common.navigation.habits", icon: Footprints },
  { to: "/patient/reports", label: "common.navigation.reports", icon: ChartNoAxesCombined },
  { to: "/patient/assistant", label: "common.navigation.assistant", icon: Bot },
  { to: "/patient/profile", label: "common.navigation.profile", icon: UserRound },
] as const;
