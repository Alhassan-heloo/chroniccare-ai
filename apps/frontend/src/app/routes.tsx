import ReportsPage from "@/pages/patient/ReportsPage";
import HabitsPage from "@/pages/patient/HabitsPage";
import MedicationsPage from "@/pages/patient/MedicationsPage";
import { Outlet, type RouteObject } from "react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import UnavailablePage from "@/pages/public/UnavailablePage";
import AuthPage from "@/pages/auth/AuthPage";
import AccountEmailPage from "@/pages/auth/AccountEmailPage";
import DashboardPage from "@/pages/patient/DashboardPage";
import MeasurementsPage from "@/pages/patient/MeasurementsPage";
import {
  AssistantPage,
  ProfilePage,
} from "@/pages/patient/PlaceholderPages";
import { DoctorDashboard, DoctorPatientDetails, DoctorPatients } from "@/pages/doctor/DoctorPages";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import { ProtectedRoute } from "@/auth/RouteAccess";
import { ConnectPatientPage, MyDoctorsPage } from "@/pages/connections/ConnectionPages";
export const routes: RouteObject[] = [
  {
    element: <Outlet />,
    errorElement: <UnavailablePage error />,
    children: [
      {
        path: "/",
        lazy: async () => ({ Component: (await import("@/pages/public/HybridHomePage")).default }),
        HydrateFallback: () => null,
      },
      { path: "/login", element: <AuthPage key="login" mode="login" /> },
      { path: "/register", element: <AuthPage key="register" mode="register" /> },
      { path: "/setup", element: <AuthPage key="setup" mode="setup" /> },
      { path: "/activate-admin", element: <AccountEmailPage key="activate" mode="activate-admin" /> },
      { path: "/activate-doctor", element: <AccountEmailPage key="activate-doctor" mode="activate-doctor" /> },
      { path: "/forgot-password", element: <AccountEmailPage key="forgot" mode="forgot-password" /> },
      { path: "/reset-password", element: <AccountEmailPage key="reset" mode="reset-password" /> },
      {
        path: "/patient",
        element: <ProtectedRoute role="patient" />,
        children: [{ element: <DashboardLayout />, children: [
          { path: "dashboard", element: <DashboardPage /> },
          { path: "measurements", element: <MeasurementsPage /> },
          { path: "medications", element: <MedicationsPage /> },
          { path: "habits", element: <HabitsPage /> },
          { path: "reports", element: <ReportsPage /> },
          { path: "assistant", element: <AssistantPage /> },
          { path: "profile", element: <ProfilePage /> },
          { path: "doctors", element: <MyDoctorsPage /> },
        ] }],
      },
      {
        path: "/doctor",
        element: <ProtectedRoute role="doctor" />,
        children: [{ element: <DashboardLayout role="doctor" />, children: [
          { path: "dashboard", element: <DoctorDashboard /> },
          { path: "patients", element: <DoctorPatients /> },
          { path: "connect", element: <ConnectPatientPage /> },
          { path: "patients/:patientId", element: <DoctorPatientDetails /> },
        ] }],
      },
      {
        path: "/admin",
        element: <ProtectedRoute role="admin" />,
        children: [{ element: <DashboardLayout role="admin" />, children: [
          { path: "dashboard", element: <AdminDashboard /> },
        ] }],
      },
      {
        path: "*",
        element: <UnavailablePage />,
      },
    ],
  },
];
