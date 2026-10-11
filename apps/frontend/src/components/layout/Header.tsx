import { useState } from "react";
import { Bell, ChevronDown } from "lucide-react";
import { Link } from "react-router";
import { Brand } from "./Brand";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { usePatientDashboard } from "@/hooks/queries/usePatientDashboard";
import { Preferences } from "./Preferences";
import { useI18n } from "@/i18n/context";
export function Header() {
  const [open, setOpen] = useState(false);
  const { data } = usePatientDashboard();
  const { language, t } = useI18n();
  return (
    <header className="header">
      <div className="header-breadcrumb" data-i18n="declarative">
        {t("common.layout.space")} <span>/</span> {t("common.layout.daily")}
      </div>
      <div className="mobile-brand">
        <Brand />
      </div>
      <div className="header-actions">
        <Preferences />
        <span className="demo-label" data-i18n="declarative">{t("common.layout.demo")}</span>
        <Button
          variant="ghost"
          data-i18n="declarative"
          aria-label={t("common.layout.showNotifications")}
          onClick={() => setOpen(true)}
        >
          <Bell size={22} />
        </Button>
        <Link to="/patient/profile" className="profile-link">
          <span className="avatar">{language === "ar" ? "م" : "M"}</span>
          <span className="profile-name">
            {data?.patient.name ?? <span data-i18n="declarative">{t("common.navigation.profile")}</span>}
            <small data-i18n="declarative">{t("common.layout.account")}</small>
          </span>
          <ChevronDown size={16} />
        </Link>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={t("common.layout.notifications")} declarativeTitle>
        <p data-i18n={data?.reminder.id === "glucose-reminder" ? "declarative" : undefined}>
          {data?.reminder.id === "glucose-reminder" ? <>{t("common.reminder.glucose")} — {t("common.reminder.evening")}</> : <>{data?.reminder.title} — {data?.reminder.description}</>}
        </p>
        <p className="muted" data-i18n="declarative">
          {t("common.layout.notificationDemo")}
        </p>
      </Modal>
    </header>
  );
}
