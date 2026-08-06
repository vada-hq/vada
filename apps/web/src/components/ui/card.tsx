import type { ComponentProps } from "react";

import { cn } from "../../lib/cn";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "rounded-md border border-border bg-card p-surface text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
