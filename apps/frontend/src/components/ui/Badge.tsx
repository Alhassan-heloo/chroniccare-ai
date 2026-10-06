import type { ReactNode } from "react";
export function Badge({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "success" | "warning" | "danger" | "info";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
