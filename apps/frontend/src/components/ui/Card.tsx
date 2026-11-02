import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
export function Card({ className, padding, ...props }: HTMLAttributes<HTMLDivElement> & { padding?: "comfortable" }) {
  return <div className={cn("card", className)} data-padding={padding} {...props} />;
}
