import {
  Link,
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import type { RouterHistory } from "@tanstack/react-router";

import { PurchaseRequestDetailScreen } from "../features/purchase-requests/detail-screen";
import { PurchaseRequestEditorScreen } from "../features/purchase-requests/editor-screen";
import { PurchaseRequestOwnListScreen } from "../features/purchase-requests/own-list-screen";

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

const routeTree = rootRoute.addChildren([
  indexRoute,
  ownListRoute,
  editorRoute,
  detailRoute,
]);

function EditorPage() {
  const { eventId } = editorRoute.useParams();

  return <PurchaseRequestEditorScreen eventId={eventId} />;
}

function OwnListPage() {
  const { eventId } = ownListRoute.useParams();
  const { overBudget, submitted } = ownListRoute.useSearch();

  return (
    <PurchaseRequestOwnListScreen
      eventId={eventId}
      submitted={submitted ? { overBudget: overBudget === "1" } : undefined}
    />
  );
}

function DetailPage() {
  const { eventId, requestId } = detailRoute.useParams();

  return (
    <PurchaseRequestDetailScreen eventId={eventId} requestId={requestId} />
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
