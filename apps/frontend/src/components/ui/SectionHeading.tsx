import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function SectionHeading({ id, eyebrow, title, description, action, className }: {
  id: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return <div className={cn("ui-section-heading", className)}>
    <div>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 id={id}>{title}</h2>
      {description && <p>{description}</p>}
    </div>
    {action && <div className="ui-section-action">{action}</div>}
  </div>;
}
