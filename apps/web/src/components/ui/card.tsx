import type { ComponentProps } from "react";

import { cn } from "../../lib/cn";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
