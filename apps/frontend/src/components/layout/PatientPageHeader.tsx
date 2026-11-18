import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function PatientPageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  action: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("patient-page-header", className)}>
      <div className="patient-page-title">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}
