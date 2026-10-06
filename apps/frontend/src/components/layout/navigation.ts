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
  { to: "/patient/dashboard", label: "الرئيسية", icon: House },
  { to: "/patient/measurements", label: "صحتي وقياساتي", icon: HeartPulse },
  { to: "/patient/medications", label: "أدويتي", icon: Pill },
  { to: "/patient/habits", label: "عاداتي اليومية", icon: Footprints },
  { to: "/patient/reports", label: "التقارير", icon: ChartNoAxesCombined },
  { to: "/patient/assistant", label: "المساعد الصحي", icon: Bot },
  { to: "/patient/profile", label: "حسابي", icon: UserRound },
];
