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
      {/*
        content-start가 없으면 남는 높이를 행들이 나눠 먹는다. 나란한 두 필드
        중 한쪽에만 설명문이 있으면 반대쪽 입력칸이 그만큼 늘어나 높이가
        어긋난다. 옆 칸에 글을 붙였더니 이쪽 입력칸이 커지는 셈이다.
      */}
      <div className={cn("grid content-start gap-tight", className)}>
        <label className="text-body font-medium" htmlFor={id}>
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
