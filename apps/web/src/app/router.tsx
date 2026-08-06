import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import type { RouterHistory } from "@tanstack/react-router";

import { PurchaseRequestDetailScreen } from "../features/purchase-request/detail/screen";
import { PurchaseRequestEditorScreen } from "../features/purchase-request/editor/screen";
import { PurchaseRequestOwnListScreen } from "../features/purchase-request/own-list/screen";

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
