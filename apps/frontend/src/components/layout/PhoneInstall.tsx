import { useRef } from "react";
import { ChevronDown, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/context";
import { requestPhoneInstall, usePhoneInstallState } from "@/lib/phoneInstall";

export function PhoneInstall() {
  const { t } = useI18n();
  const state = usePhoneInstallState();
  const summary = useRef<HTMLElement>(null);
  if (state === "installed") return null;
  const promptVisible = state === "available" || state === "pending";

  return <details className="phone-install" data-i18n="declarative">
    <summary ref={summary}>
      <Smartphone size={18} aria-hidden="true" />
      <span>{t("phoneInstall.title")}</span>
      <ChevronDown size={16} aria-hidden="true" />
    </summary>
    <div className="phone-install-body">
      {!promptVisible && <dl>
        <div><dt>{t("phoneInstall.android")}</dt><dd>{t("phoneInstall.androidSteps")}</dd></div>
        <div><dt>{t("phoneInstall.iphone")}</dt><dd>{t("phoneInstall.iphoneSteps")}</dd></div>
      </dl>}
      <p>{t("phoneInstall.online")}</p>
      {promptVisible && <Button variant="secondary" loading={state === "pending"} onClick={() => {
        summary.current?.focus();
        void requestPhoneInstall();
      }}>{t("phoneInstall.install")}</Button>}
      <div role="status">{state === "dismissed" && t("phoneInstall.dismissed")}</div>
    </div>
  </details>;
}
