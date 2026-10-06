import { useEffect, useRef, useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-labelledby={id} onCancel={onClose} onClose={onClose}>
      <div className="dialog-heading">
        <h2 id={id}>{title}</h2>
        <Button variant="ghost" onClick={onClose} aria-label="إغلاق">
          <X size={22} />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
