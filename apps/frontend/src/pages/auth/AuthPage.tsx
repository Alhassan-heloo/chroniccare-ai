import { Link } from "react-router";
import { Brand } from "@/components/layout/Brand";
import { PlaceholderPage } from "@/components/ui/PlaceholderPage";
export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  return (
    <main className="public-shell">
      <Brand />
      <PlaceholderPage
        title={mode === "login" ? "تسجيل الدخول" : "إنشاء حساب"}
        description="المصادقة الحقيقية ستُضاف عند جاهزية الخادم. يمكنك الآن استكشاف لوحة المريض التجريبية دون إدخال بيانات شخصية."
      />
      <Link to="/">العودة للرئيسية</Link>
    </main>
  );
}
