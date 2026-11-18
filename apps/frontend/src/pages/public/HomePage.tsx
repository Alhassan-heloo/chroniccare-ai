import { ArrowDown, ArrowDownRight, ClipboardList, HeartPulse, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "@/auth/context";
import { roleHome } from "@/auth/api";
import { PublicLayout } from "@/components/public/PublicLayout";
import { useI18n } from "@/i18n/context";
import { DailyCareDemo, MorningReadingTime, PressureValue } from "./DailyCareDemo";
import "./clinical-home.css";

const copy = {
  ar: {
    title: "رعايتك اليومية",
    emphasis: "في صورة أوضح.",
    intro: "تابع قياساتك وأدويتك وعاداتك في مكان واحد، وراجع سجلّك قبل موعدك مع الطبيب.",
    tryDemo: "جرّب يومًا من رعايتك",
    demoNav: "العرض التفاعلي",
    photo: "زوجان يتابعان قياس ضغط الدم في المنزل",
    sample: "قراءة توضيحية",
    latest: "ضغط الدم · قياس الصبح",
    openReading: "استكشف قراءة الصبح",
    visitTitle: "راجع سجلّك قبل الموعد.",
    visitBody: "اطّلع على قياساتك الأخيرة وجدول أدويتك وعاداتك. وجودها في مكان واحد يساعدك على تحديد ما تريد مناقشته مع طبيبك.",
    privacy: "بموافقتك، يمكن لطبيبك قراءة السجل الذي تشاركه. ويمكنك إيقاف المشاركة متى شئت.",
    openSpace: "افتح مساحتك الصحية",
  },
  en: {
    title: "See your daily care",
    emphasis: "more clearly.",
    intro: "Track readings, medications, and habits in one place. Review your record before your next visit.",
    tryDemo: "Try a day of care",
    demoNav: "Interactive demo",
    photo: "An older couple checking blood pressure together at home",
    sample: "Example reading",
    latest: "Blood pressure · Morning",
    openReading: "Explore the morning reading",
    visitTitle: "Review your record before the visit.",
    visitBody: "See your latest readings, medication schedule, and daily habits together so you can decide what to discuss with your doctor.",
    privacy: "Your doctor gets read-only access to the records you share with your approval. You can revoke access at any time.",
    openSpace: "Open your health space",
  },
};

export default function HomePage() {
  const { user } = useAuth();
  const { search } = useLocation();
  const { language, t } = useI18n();
  const [activeScene, setActiveScene] = useState(0);
  const c = copy[language];
  const demoRoute = { search, hash: "#product-preview" };
  const accountRoute = user ? roleHome(user.role) : "/register";

  return (
    <PublicLayout homepageDemoLabel={c.demoNav}>
      <main id="public-content" className="clinical-home" tabIndex={-1}>
        <section className="clinical-hero" aria-labelledby="home-title">
          <div className="clinical-hero-copy">
            <h1 id="home-title">{c.title}<span>{c.emphasis}</span></h1>
            <p>{c.intro}</p>
            <Link className="clinical-action clinical-action-hero" to={demoRoute}>
              {c.tryDemo}<ArrowDown size={19} aria-hidden="true" />
            </Link>
            {!user && (
              <div className="clinical-hero-account">
                <Link to="/login">{t("auth.signIn")}</Link>
                <Link to="/register">{t("auth.register")}</Link>
              </div>
            )}
          </div>
          <figure className="clinical-hero-visual">
            {/* Yaroslav Shuraev, Pexels 8088856. https://www.pexels.com/license/ */}
            <img src={(import.meta.env?.BASE_URL ?? "/") + "images/home-blood-pressure.webp"} alt={c.photo} width={1350} height={900} fetchPriority="high" />
            <Link className="clinical-reading-link" to={demoRoute} onClick={() => setActiveScene(0)}>
              <span className="clinical-reading-icon"><HeartPulse size={23} aria-hidden="true" /></span>
              <span className="clinical-reading-copy">
                <span className="clinical-reading-meta">{c.sample}</span>
                <strong>{c.latest}</strong>
                <PressureValue />
                <span className="sr-only">{c.openReading}</span>
              </span>
              <span className="clinical-reading-end">
                <MorningReadingTime />
                <ArrowDownRight className="clinical-direction-arrow" size={19} aria-hidden="true" />
              </span>
            </Link>
          </figure>
        </section>

        <DailyCareDemo active={activeScene} onSceneChange={setActiveScene} />

        <section className="clinical-visit" id="weekly-scene" aria-labelledby="visit-title">
          <div>
            <ClipboardList className="clinical-visit-icon" size={28} aria-hidden="true" />
            <h2 id="visit-title">{c.visitTitle}</h2>
          </div>
          <div className="clinical-visit-copy">
            <p>{c.visitBody}</p>
            <p className="clinical-privacy-note"><ShieldCheck size={21} aria-hidden="true" />{c.privacy}</p>
            <Link className="clinical-action" to={accountRoute}>
              {user ? c.openSpace : t("auth.register")}<ArrowDownRight className="clinical-direction-arrow" size={19} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}
