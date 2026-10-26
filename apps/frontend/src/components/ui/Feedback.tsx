import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, Inbox, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const icons = { error: CircleAlert, success: CircleCheck, info: Info, empty: Inbox, loading: LoaderCircle };

/** Callers supply localized copy. Static empty states do not create live regions. */
export function Feedback({ kind = "info", children, action, className }: {
  kind?: keyof typeof icons;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = icons[kind];
  return <div className={cn("ui-feedback", `ui-feedback-${kind}`, className)} role={kind === "error" ? "alert" : kind === "empty" ? undefined : "status"}>
    <Icon size={20} aria-hidden="true" />
    <div className="ui-feedback-copy">{children}</div>
    {action && <div className="ui-feedback-action">{action}</div>}
  </div>;
}
