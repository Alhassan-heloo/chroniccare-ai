import {
  House,
  HeartPulse,
  Pill,
  Footprints,
  ChartNoAxesCombined,
  Bot,
  UserRound,
  Users,
  LayoutDashboard,
  Link2,
} from "lucide-react";
import type { TranslationKey } from "@/i18n/catalog";
import type { User } from "@/lib/types/user";
import type { LucideIcon } from "lucide-react";
export interface NavigationItem { to: string; label: TranslationKey; icon: LucideIcon }
export const pressureRecordQuery = { key: "record", value: "pressure" } as const;
export const recordPressurePath = `/patient/measurements?${pressureRecordQuery.key}=${pressureRecordQuery.value}`;
export const patientNavigation = [
  { to: "/patient/dashboard", label: "common.workspace.patient", icon: House },
  { to: "/patient/measurements", label: "common.navigation.measurements", icon: HeartPulse },
  { to: "/patient/medications", label: "common.navigation.medications", icon: Pill },
  { to: "/patient/habits", label: "common.navigation.habits", icon: Footprints },
  { to: "/patient/reports", label: "common.navigation.reports", icon: ChartNoAxesCombined },
  { to: "/patient/doctors", label: "connections.myDoctors", icon: Users },
  { to: "/patient/assistant", label: "common.navigation.assistant", icon: Bot },
  { to: "/patient/profile", label: "common.navigation.profile", icon: UserRound },
] as const;
export function roleNavigation(role: User["role"]): readonly NavigationItem[] {
  if (role === "doctor") return [
    { to: "/doctor/dashboard", label: "common.workspace.doctor", icon: LayoutDashboard },
    { to: "/doctor/patients", label: "doctor.patients", icon: Users },
    { to: "/doctor/connect", label: "connections.connect", icon: Link2 },
  ];
  if (role === "admin") return [{ to: "/admin/dashboard", label: "common.workspace.admin", icon: LayoutDashboard }];
  return patientNavigation;
}
