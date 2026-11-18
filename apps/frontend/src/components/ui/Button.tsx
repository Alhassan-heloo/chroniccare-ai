import type { ButtonHTMLAttributes, Ref } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
export function Button({
  className,
  variant = "primary",
  type = "button",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      type={type}
      className={cn("btn", `btn-${variant}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle className="ui-spinner" size={18} aria-hidden="true" />}
      {children}
    </button>
  );
}
