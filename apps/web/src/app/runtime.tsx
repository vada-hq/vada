import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import type { PropsWithChildren } from "react";

import { createAppQueryClient } from "./query-client";
import { createAppRouter } from "./router";

export interface CreateAppRuntimeOptions {
  /** 브라우저 주소 대신 시작 경로를 고정한다. 테스트에서만 사용한다. */
  initialPath?: string;
}

export function createAppRuntime(options: CreateAppRuntimeOptions = {}) {
  const queryClient = createAppQueryClient();
  const history = options.initialPath
    ? createMemoryHistory({ initialEntries: [options.initialPath] })
    : undefined;
  const router = createAppRouter(queryClient, history);

  return { queryClient, router };
}

export type AppRuntime = ReturnType<typeof createAppRuntime>;

export interface AppProvidersProps extends PropsWithChildren {
  runtime: AppRuntime;
}

export function AppProviders({ children, runtime }: AppProvidersProps) {
  return (
    <QueryClientProvider client={runtime.queryClient}>
      {children ?? <RouterProvider router={runtime.router} />}
    </QueryClientProvider>
  );
}
