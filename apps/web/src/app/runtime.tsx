import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import type { PropsWithChildren } from "react";

import { createAppQueryClient } from "./query-client";
import { createAppRouter } from "./router";

export function createAppRuntime() {
  const queryClient = createAppQueryClient();
  const router = createAppRouter(queryClient);

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
