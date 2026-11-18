import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "./Button";
import { useI18n } from "@/i18n/context";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return <div className="copy-control"><Button variant="secondary" onClick={async () => {
    try { await navigator.clipboard.writeText(value); setState("copied"); }
    catch { setState("failed"); }
  }}>{state === "copied" ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}{state === "copied" ? t("finalExperience.copied") : label}</Button><p role="status">{state === "failed" ? t("finalExperience.copyFailed") : ""}</p></div>;
}
