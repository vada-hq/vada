import { useId, type ComponentProps, type ReactNode } from "react";

import { cn } from "../../lib/cn";

export interface AlertProps extends Omit<ComponentProps<"div">, "title"> {
  title: ReactNode;
  tone?: "info" | "danger";
}

export function Alert({
  children,
  className,
  title,
  tone = "info",
  ...props
}: AlertProps) {
  const titleId = useId();

  return (
    <div
      aria-labelledby={titleId}
      className={cn(
        "rounded-md border px-4 py-3 text-sm",
        tone === "danger"
          ? "border-danger/30 bg-danger/10 text-danger"
          : "border-border bg-muted text-foreground",
        className,
      )}
      role={tone === "danger" ? "alert" : "status"}
      {...props}
    >
      <p className="font-medium" id={titleId}>
        {title}
      </p>
      <div className="mt-1 text-current/80">{children}</div>
    </div>
  );
}
