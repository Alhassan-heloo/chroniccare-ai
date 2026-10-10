import HabitsPage from "@/pages/patient/HabitsPage";
import MedicationsPage from "@/pages/patient/MedicationsPage";
import { Outlet, type RouteObject } from "react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PlaceholderPage } from "@/components/ui/PlaceholderPage";
import HomePage from "@/pages/public/HomePage";
import AuthPage from "@/pages/auth/AuthPage";
import DashboardPage from "@/pages/patient/DashboardPage";
import MeasurementsPage from "@/pages/patient/MeasurementsPage";
import {
  ReportsPage,
  AssistantPage,
  ProfilePage,
} from "@/pages/patient/PlaceholderPages";
import { DoctorDashboard, DoctorPatients } from "@/pages/doctor/DoctorPages";
import AdminDashboard from "@/pages/admin/AdminDashboard";
export const routes: RouteObject[] = [
  {
    element: <Outlet />,
    errorElement: (
      <main className="public-shell">
        <PlaceholderPage
          title="تعذر عرض الصفحة"
          description="حاول العودة إلى لوحة المريض."
        />
      </main>
    ),
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/login", element: <AuthPage mode="login" /> },
      { path: "/register", element: <AuthPage mode="register" /> },
      {
        path: "/patient",
        element: <DashboardLayout />,
        children: [
          { path: "dashboard", element: <DashboardPage /> },
          { path: "measurements", element: <MeasurementsPage /> },
          { path: "medications", element: <MedicationsPage /> },
          { path: "habits", element: <HabitsPage /> },
          { path: "reports", element: <ReportsPage /> },
          { path: "assistant", element: <AssistantPage /> },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
      {
        path: "/doctor/dashboard",
        element: (
          <main className="public-shell">
            <DoctorDashboard />
          </main>
        ),
      },
      {
        path: "/doctor/patients",
        element: (
          <main className="public-shell">
            <DoctorPatients />
          </main>
        ),
      },
      {
        path: "/admin/dashboard",
        element: (
          <main className="public-shell">
            <AdminDashboard />
          </main>
        ),
      },
      {
        path: "*",
        element: (
          <main className="public-shell">
            <PlaceholderPage
              title="الصفحة غير موجودة"
              description="تحقق من الرابط أو عد إلى لوحة المريض."
            />
          </main>
        ),
      },
    ],
  },
];
