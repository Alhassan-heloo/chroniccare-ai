import { useId, type InputHTMLAttributes } from "react";
export function Input({
  label,
  error,
  hint,
  id,
  "aria-describedby": describedBy,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const generated = useId();
  const inputId = id ?? generated;
  const descriptionIds = [...new Set([describedBy, hint && `${inputId}-hint`, error && `${inputId}-error`]
    .filter(Boolean).join(" ").split(/\s+/).filter(Boolean))].join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        aria-invalid={!!error}
        {...props}
        aria-describedby={descriptionIds}
      />
      {hint && <small id={`${inputId}-hint`} className="muted">{hint}</small>}
      {error && (
        <p id={`${inputId}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
