import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import type { RouterHistory } from "@tanstack/react-router";

import { PurchaseRequestOwnListScreen } from "../features/purchase-requests/own-list-screen";

export interface AppRouterContext {
  queryClient: QueryClient;
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
});

const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/events/$eventId/purchase-requests/$requestId",
  component: DetailPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  ownListRoute,
  detailRoute,
]);

function OwnListPage() {
  const { eventId } = ownListRoute.useParams();

  return <PurchaseRequestOwnListScreen eventId={eventId} />;
}

/**
 * 상세 화면은 WORK:purchase-request-detail-ui@R3에서 구현한다.
 * 목록의 상세 연결을 검증할 수 있도록 경로만 먼저 등록하며 서버 데이터를 표시하지 않는다.
 */
function DetailPage() {
  const { requestId } = detailRoute.useParams();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">구매 요청 상세</h1>
      <p>{requestId}</p>
    </main>
  );
}

function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-12">
      <p className="text-sm font-medium text-muted-foreground">
        학생회 통합 운영 플랫폼
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">VADA</h1>
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
