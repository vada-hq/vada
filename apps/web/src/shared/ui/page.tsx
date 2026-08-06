import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

/** 화면 본문 폭과 여백을 한 곳에서 정한다. */
export function Page({
  children,
  className,
  width = "wide",
}: {
  children: ReactNode;
  className?: string;
  width?: "wide" | "full";
}) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full flex-col gap-section px-base py-section",
        width === "wide" ? "max-w-5xl" : "max-w-6xl",
        className,
      )}
    >
      {children}
    </main>
  );
}

/**
 * 와이어프레임 머리말 위계: 왼쪽에 제목과 범위 설명, 오른쪽에 주요 행동.
 */
export function PageHeader({
  actions,
  description,
  title,
}: {
  actions?: ReactNode;
  description?: ReactNode;
  title: string;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-base">
      <div className="flex flex-col gap-tight">
        <h1 className="text-display font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-body text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions}
    </header>
  );
}

export function SectionHeading({
  actions,
  children,
  meta,
}: {
  actions?: ReactNode;
  children: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-snug">
      <span className="flex items-baseline gap-snug">
        <h2 className="text-body-lg font-semibold">{children}</h2>
        {meta ? (
          <span className="text-label text-muted-foreground">{meta}</span>
        ) : null}
      </span>
      {actions}
    </div>
  );
}
