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
        "w-full rounded-sm border border-input bg-card px-snug py-tight text-body-lg text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-danger aria-invalid:ring-danger/20",
        className,
      )}
      id={id ?? field?.controlId}
      required={required ?? field?.required}
      {...props}
    />
  );
}
