import {
  Link,
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import type * as React from "react";
import type { RouterHistory } from "@tanstack/react-router";

import { Dialog } from "../components/ui/dialog";
import { AppShell } from "../shared/ui/app-shell";
import { EventFinanceOverviewScreen } from "../features/event-finance/overview/screen";
import { OrganizationRolesScreen } from "../features/organization/roles/screen";
import { PurchaseRequestDetailScreen } from "../features/purchase-request/detail/screen";
import { PurchaseRequestEditorScreen } from "../features/purchase-request/editor/screen";
import { PurchaseRequestOwnListScreen } from "../features/purchase-request/own-list/screen";
import { PurchaseRequestReviewScreen } from "../features/purchase-request/review/screen";
import { PurchaseRequestRevisionScreen } from "../features/purchase-request/revision/screen";

export interface AppRouterContext {
  queryClient: QueryClient;
}

interface OwnListSearch {
  submitted?: string;
  overBudget?: "1";
}

const rootRoute = createRootRouteWithContext<AppRouterContext>()({
  component: Outlet,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const ownListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/events/$eventId/purchase-requests/mine",
  component: OwnListPage,
  // 제출 성공 결과를 목록의 확인 영역으로 전달한다. 값이 없으면 키를 남기지 않는다.
  validateSearch: (search: Record<string, unknown>): OwnListSearch => ({
    ...(typeof search.submitted === "string"
      ? { submitted: search.submitted }
      : {}),
    ...(search.overBudget === "1" ? { overBudget: "1" as const } : {}),
  }),
});

const editorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/events/$eventId/purchase-requests/new",
  component: EditorPage,
});

const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/events/$eventId/purchase-requests/$requestId",
  component: DetailPage,
});

// 재정부가 요청을 검토하는 화면. 상세와 달리 결정 권한이 필요하다.
const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/events/$eventId/purchase-requests/$requestId/review",
  component: ReviewPage,
});

function ReviewPage() {
  const { eventId, requestId } = reviewRoute.useParams();

  return (
    <PurchaseRequestShell current="구매 요청 검토">
      <PurchaseRequestReviewScreen eventId={eventId} requestId={requestId} />
    </PurchaseRequestShell>
  );
}

// 행사 재정 개요. 구매 요청 화면들이 돌아오는 자리다.
const eventFinanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/events/$eventId/finance",
  component: EventFinancePage,
});

function EventFinancePage() {
  const { eventId } = eventFinanceRoute.useParams();

  return (
    <PurchaseRequestShell current="행사 재정">
      <EventFinanceOverviewScreen eventId={eventId} />
    </PurchaseRequestShell>
  );
}

// 요청자가 보완 요청을 확인하고 다시 내는 화면. 검토 화면과 짝이다.
const revisionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/events/$eventId/purchase-requests/$requestId/revision",
  component: RevisionPage,
});

function RevisionPage() {
  const { eventId, requestId } = revisionRoute.useParams();

  return (
    <PurchaseRequestShell current="보완 요청 확인·재제출">
      <PurchaseRequestRevisionScreen eventId={eventId} requestId={requestId} />
    </PurchaseRequestShell>
  );
}

// 회장단이 구성원의 기본 직급을 바꾸는 화면. 행사 밖의 조직 화면이다.
const organizationRolesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/organization/roles",
  component: OrganizationRolesPage,
});

function OrganizationRolesPage() {
  return (
    <PurchaseRequestShell current="역할 및 권한 관리">
      <OrganizationRolesScreen />
    </PurchaseRequestShell>
  );
}

const routeTree = rootRoute.addChildren([
  indexRoute,
  eventFinanceRoute,
  ownListRoute,
  editorRoute,
  detailRoute,
  reviewRoute,
  revisionRoute,
  organizationRolesRoute,
]);

/**
 * 구매 요청 화면들이 공유하는 셸이다. 행사 이름은 아직 화면별 계약에서만
 * 오므로 브레드크럼의 마지막 조각만 화면이 정한다.
 */
function PurchaseRequestShell({
  children,
  current,
}: {
  children: React.ReactNode;
  current: string;
}) {
  return (
    <AppShell
      activeNav="운영"
      breadcrumb={["운영", "행사", "재정", current]}
      tabs={[
        { label: "개요" },
        { label: "업무" },
        { label: "재정", active: true },
        { label: "기록" },
      ]}
      title={current}
    >
      {children}
    </AppShell>
  );
}

/**
 * 구매 요청 작성은 독립 화면이 아니라 팝업이다(와이어프레임 FIN-REQ-01B).
 * 경로는 남겨 두어 새로고침·뒤로가기·링크 공유가 되게 하되, 그 경로가 그리는
 * 것은 여는 화면인 내 구매 요청이고 그 위에 작성 팝업을 얹는다.
 */
function EditorPage() {
  const { eventId } = editorRoute.useParams();
  const navigate = editorRoute.useNavigate();

  return (
    <PurchaseRequestShell current="내 구매 요청">
      <PurchaseRequestOwnListScreen eventId={eventId} />
      <Dialog
        description="행사 운영에 필요한 물품 또는 용역의 구매를 요청합니다."
        onClose={() => {
          void navigate({
            params: { eventId },
            to: "/events/$eventId/purchase-requests/mine",
          });
        }}
        open
        title="구매 요청서 작성"
      >
        <PurchaseRequestEditorScreen eventId={eventId} />
      </Dialog>
    </PurchaseRequestShell>
  );
}

function OwnListPage() {
  const { eventId } = ownListRoute.useParams();
  const { overBudget, submitted } = ownListRoute.useSearch();

  return (
    <PurchaseRequestShell current="내 구매 요청">
      <PurchaseRequestOwnListScreen
        eventId={eventId}
        submitted={submitted ? { overBudget: overBudget === "1" } : undefined}
      />
    </PurchaseRequestShell>
  );
}

function DetailPage() {
  const { eventId, requestId } = detailRoute.useParams();

  return (
    <PurchaseRequestShell current="구매 요청 상세">
      <PurchaseRequestDetailScreen eventId={eventId} requestId={requestId} />
    </PurchaseRequestShell>
  );
}

function HomePage() {
  // 공통 셸이 생기기 전까지 구현된 화면으로 들어가는 임시 진입점이다.
  const eventId = "event-001";
  const entries = [
    {
      description: "새 구매 요청을 작성하고 임시 저장하거나 제출합니다.",
      params: { eventId },
      title: "구매 요청 작성",
      to: "/events/$eventId/purchase-requests/new" as const,
    },
    {
      description: "이 행사에서 내가 제출한 구매 요청을 봅니다.",
      params: { eventId },
      title: "내 구매 요청",
      to: "/events/$eventId/purchase-requests/mine" as const,
    },
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-12">
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          학생회 통합 운영 플랫폼
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">VADA</h1>
      </div>

      <nav aria-label="구현된 화면">
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.to}>
              <Link
                className="block rounded-md border border-border px-5 py-4 hover:bg-muted"
                params={entry.params}
                to={entry.to}
              >
                <span className="font-medium">{entry.title}</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {entry.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}

export function createAppRouter(
  queryClient: QueryClient,
  history?: RouterHistory,
) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    ...(history ? { history } : {}),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
