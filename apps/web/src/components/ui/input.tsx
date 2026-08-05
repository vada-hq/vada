import type { ComponentProps } from "react";

import { cn } from "../../lib/cn";
import { useFormFieldControl } from "./form-field";

export function Input({
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  className,
  id,
  required,
  ...props
}: ComponentProps<"input">) {
  const field = useFormFieldControl();

  return (
    <input
      aria-describedby={ariaDescribedBy ?? field?.describedBy}
      aria-invalid={ariaInvalid ?? field?.invalid}
      className={cn(
        "min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-danger/20",
        className,
      )}
      id={id ?? field?.controlId}
      required={required ?? field?.required}
      {...props}
    />
  );
}
