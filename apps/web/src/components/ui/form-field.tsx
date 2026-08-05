import {
  createContext,
  useContext,
  type PropsWithChildren,
  type ReactNode,
} from "react";

import { cn } from "../../lib/cn";

interface FormFieldContextValue {
  controlId: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

const FormFieldContext = createContext<FormFieldContextValue | null>(null);

export interface FormFieldProps extends PropsWithChildren {
  className?: string;
  description?: ReactNode;
  error?: ReactNode;
  id: string;
  label: ReactNode;
  required?: boolean;
}

export function FormField({
  children,
  className,
  description,
  error,
  id,
  label,
  required = false,
}: FormFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <FormFieldContext.Provider
      value={{
        controlId: id,
        describedBy,
        invalid: Boolean(error),
        required,
      }}
    >
      <div className={cn("grid gap-2", className)}>
        <label className="text-sm font-medium" htmlFor={id}>
          {label}
          {required ? (
            <span aria-hidden="true" className="ml-1 text-danger">
              *
            </span>
          ) : null}
        </label>
        {children}
        {description ? (
          <p className="text-sm text-muted-foreground" id={descriptionId}>
            {description}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-danger" id={errorId} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </FormFieldContext.Provider>
  );
}

export function useFormFieldControl() {
  return useContext(FormFieldContext);
}
