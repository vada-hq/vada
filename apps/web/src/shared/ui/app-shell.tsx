import type { ReactNode } from "react";

import { cn } from "../../lib/cn";
import { OrganizationName, ViewerBadge } from "../session/viewer";

export interface BreadcrumbEntry {
  label: string;
}

export interface ShellTab {
  active?: boolean;
  label: string;
}

/**
 * 승인 와이어프레임 DesktopShell의 구조다.
 * 사이드바 · 브레드크럼과 제목 · 행사 탭 · 본문 순서를 화면마다 다시 만들지 않는다.
 *
 * 사용자 정보는 계약 CB-IDENTITY-001@R1이 소유한다. 메뉴 이동은 아직 계약이
 * 없어 구조만 두고, 실제 이동은 각 화면 작업에서 계약이 생길 때 붙인다.
 */
const navItems = [
  "홈",
  "내 업무",
  "운영",
  "재정",
  "기록",
  "조직 관리",
  "메시지",
];

export function AppShell({
  activeNav,
  breadcrumb,
  children,
  tabs,
  title,
}: {
  activeNav?: string;
  breadcrumb?: string[];
  children: ReactNode;
  tabs?: ShellTab[];
  title?: string;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-base py-snug">
          <span className="flex items-center gap-snug">
            <span
              aria-hidden="true"
              className="flex size-7 items-center justify-center rounded-sm bg-primary text-body font-bold text-primary-foreground"
            >
              V
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-body-lg font-semibold">Vada</span>
              <OrganizationName />
            </span>
          </span>
        </div>

        <nav aria-label="주 메뉴" className="flex-1 px-tight py-snug">
          <ul className="flex flex-col gap-0.5">
            {navItems.map((item) => (
              <li key={item}>
                {/* 각 메뉴의 화면과 이동 계약은 해당 화면 작업에서 붙인다. */}
                <span
                  aria-current={item === activeNav ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-snug rounded-sm px-snug py-tight text-body-lg",
                    item === activeNav
                      ? "bg-primary-soft font-medium text-primary-soft-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </nav>

        <ViewerBadge />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center border-b border-border bg-card px-base">
          <div className="flex flex-col gap-0.5">
            {breadcrumb?.length ? (
              <nav aria-label="현재 위치">
                <ol className="flex flex-wrap items-center gap-tight text-label text-muted-foreground">
                  {breadcrumb.map((entry, index) => (
                    <li className="flex items-center gap-tight" key={entry}>
                      {index > 0 ? <span aria-hidden="true">›</span> : null}
                      <span
                        className={
                          index === breadcrumb.length - 1
                            ? "text-foreground"
                            : undefined
                        }
                      >
                        {entry}
                      </span>
                    </li>
                  ))}
                </ol>
              </nav>
            ) : null}
            {title ? (
              <p className="text-body-lg font-semibold">{title}</p>
            ) : null}
          </div>
        </header>

        {tabs?.length ? (
          <div className="flex shrink-0 gap-0 border-b border-border bg-card px-base">
            {tabs.map((tab) => (
              <span
                aria-current={tab.active ? "page" : undefined}
                className={cn(
                  "-mb-px border-b-2 px-snug py-snug text-body-lg",
                  tab.active
                    ? "border-primary font-medium text-primary-soft-foreground"
                    : "border-transparent text-muted-foreground",
                )}
                key={tab.label}
              >
                {tab.label}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
