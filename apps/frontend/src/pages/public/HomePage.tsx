import { Link } from "react-router";
import {
  HeartPulse,
  ShieldCheck,
  Activity,
  ArrowLeft,
  Check,
  Droplet,
} from "lucide-react";
import { Brand } from "@/components/layout/Brand";
import { Card } from "@/components/ui/Card";
export default function HomePage() {
  return (
    <div className="home">
      <header className="public-header">
        <Brand />
        <nav aria-label="روابط الحساب">
          <Link to="/login" className="btn btn-ghost">
            تسجيل الدخول
          </Link>
          <Link to="/register" className="btn btn-primary">
            إنشاء حساب
          </Link>
        </nav>
      </header>
      <main className="home-main">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">رعاية أقرب. حياة أكثر اطمئنانًا.</span>
            <h1>
              صحتك..
              <br />
              بذكاء واهتمام<span>.</span>
            </h1>
            <p>
              مساحتك اليومية لمتابعة القياسات والأدوية والعادات الصحية، بخطوات
              بسيطة وواضحة.
            </p>
            <Link to="/patient/dashboard" className="btn btn-primary hero-cta">
              استكشف لوحة المريض <ArrowLeft size={21} />
            </Link>
            <small>نسخة تجريبية · لا تحتاج إلى حساب</small>
          </div>
          <div className="hero-visual">
            <div className="hero-heart">
              <HeartPulse size={96} strokeWidth={1.4} />
            </div>
            <Card className="hero-reading">
              <span className="icon-tile tone-danger">
                <HeartPulse />
              </span>
              <span>
                ضغط الدم<strong dir="ltr">120/80</strong>
              </span>
              <span className="badge badge-success">
                <Check size={14} /> طبيعي
              </span>
            </Card>
            <Card className="hero-reading second">
              <span className="icon-tile tone-info">
                <Droplet />
              </span>
              <span>
                سكر الدم
                <strong dir="ltr">
                  98 <small>mg/dL</small>
                </strong>
              </span>
            </Card>
            <span className="visual-caption">اهتمام يومي، لحياة أفضل</span>
          </div>
        </section>
        <section className="home-features" aria-label="عن المنصة">
          <Card>
            <Activity />
            <h2>متابعة يومية واضحة</h2>
            <p>أهم قياساتك ومهامك في مكان واحد.</p>
          </Card>
          <Card>
            <HeartPulse />
            <h2>عادات صغيرة، أثر كبير</h2>
            <p>تابع روتينك الصحي خطوة بخطوة.</p>
          </Card>
          <Card>
            <ShieldCheck />
            <h2>تجربة بسيطة للجميع</h2>
            <p>واجهة عربية تناسب الكمبيوتر والجوال.</p>
          </Card>
        </section>
      </main>
      <footer className="public-footer">
        ChronicCare AI · مشروع تخرج · واجهة تجريبية
      </footer>
    </div>
  );
}
