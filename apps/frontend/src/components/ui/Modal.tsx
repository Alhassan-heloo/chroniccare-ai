import { useEffect, useRef, useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";
import { useI18n } from "@/i18n/context";
export function Modal({
  open,
  onClose,
  title,
  children,
  declarativeTitle = false,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  declarativeTitle?: boolean;
  dismissible?: boolean;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-labelledby={id} onCancel={event => { if (!dismissible) event.preventDefault(); else onClose(); }} onClose={onClose}>
      <div className="dialog-heading">
        <h2 id={id} data-i18n={declarativeTitle ? "declarative" : undefined}>{title}</h2>
        <Button variant="ghost" disabled={!dismissible} onClick={onClose} aria-label={t("common.actions.close")} data-i18n="declarative">
          <X size={22} />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
