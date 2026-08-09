import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { server } from "../../mocks/server";
import { sessionViewerExample } from "../../mocks/session-fixtures";
import { AppShell } from "../ui/app-shell";

const VIEWER = "*/api/v1/session/viewer";

function withQueries(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderShell() {
  return render(withQueries(<AppShell title="아무 화면">본문</AppShell>));
}

describe("셸이 보여 주는 나", () => {
  it("서버가 준 이름과 조직 이름을 그린다", async () => {
    renderShell();

    expect(
      await screen.findByText(sessionViewerExample.displayName),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(sessionViewerExample.organizationName),
    ).toBeInTheDocument();
  });

  // 와이어프레임은 이름 아래에 `부서 · 직급`을 적는다. 계약이 역할 이름을
  // 내려보내지 않기로 했으므로 화면에도 없어야 한다. 없어야 하는 것을 보지
  // 않으면 언젠가 조용히 생긴다.
  it("직급을 적지 않는다", async () => {
    renderShell();
    await screen.findByText(sessionViewerExample.displayName);

    for (const label of ["회장단", "부서장", "부원"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  // 셸은 모든 화면을 감싼다. 여기서 던지면 아무것도 안 보인다.
  it("못 읽었으면 이름을 지어내지 않고 그대로 말한다", async () => {
    server.use(
      http.get(VIEWER, () => new HttpResponse(null, { status: 503 })),
    );

    renderShell();

    expect(
      await screen.findByText("내 정보를 불러오지 못했습니다."),
    ).toBeInTheDocument();
    // 본문은 살아 있어야 한다.
    expect(screen.getByText("본문")).toBeInTheDocument();
    // 와이어프레임의 고정 문자열이 되살아나지 않는지 본다.
    expect(screen.queryByText("소프트웨어융합대학")).not.toBeInTheDocument();
  });
});
