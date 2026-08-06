import { http, HttpResponse } from "msw";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";

import { AppProviders, createAppRuntime } from "../../app/runtime";
import { server } from "../../mocks/server";

const eventId = "event-001";
const ownListPath = `/events/${eventId}/purchase-requests/mine`;
const ownListUrl = `*${ownListPath}`;

// 승인 계약 픽스처 contracts/fixtures/CB-FIN-001/R1.json#own-request-list 의 값과 같습니다.
const ownListExample = {
  items: [
    {
      requestId: "request-001",
      title: "가을 축제 운영 물품",
      status: "review_pending",
      estimatedTotal: 390000,
      overBudget: false,
      createdAt: "2026-08-03T10:05:00Z",
    },
    {
      requestId: "request-000",
      title: "여름 행사 준비 물품",
      status: "review_pending",
      estimatedTotal: 100000,
      overBudget: true,
      createdAt: "2026-08-02T09:00:00Z",
    },
  ],
};

function problem(status: number, code: string, title: string) {
  return HttpResponse.json(
    { type: `urn:vada:error:${code}`, title, status, code },
    { status, headers: { "content-type": "application/problem+json" } },
  );
}

function renderOwnList() {
  render(<AppProviders runtime={createAppRuntime({ initialPath: ownListPath })} />);
}

async function listItems() {
  const list = await screen.findByRole("list", { name: "본인 구매 요청" });
  return within(list).getAllByRole("listitem");
}

describe("본인 구매 요청 목록 화면", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  test("로딩 중에는 샘플 결과 대신 진행 상태만 알린다", async () => {
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(ownListUrl, async () => {
        await pending;
        return HttpResponse.json(ownListExample);
      }),
    );

    renderOwnList();

    expect(await screen.findByRole("status")).toHaveTextContent("불러오는 중");
    expect(screen.queryByText("가을 축제 운영 물품")).not.toBeInTheDocument();

    release?.();
    expect(await screen.findByText("가을 축제 운영 물품")).toBeInTheDocument();
  });

  test("빈 목록에는 제출한 요청이 없다는 설명을 표시한다", async () => {
    server.use(http.get(ownListUrl, () => HttpResponse.json({ items: [] })));

    renderOwnList();

    expect(
      await screen.findByText("아직 제출한 구매 요청이 없습니다."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "본인 구매 요청" })).not.toBeInTheDocument();
  });

  test("생성 시각 내림차순으로 상태·총액·예산 초과·생성 시각을 표시한다", async () => {
    server.use(http.get(ownListUrl, () => HttpResponse.json(ownListExample)));

    renderOwnList();

    const items = await listItems();
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("가을 축제 운영 물품");
    expect(items[1]).toHaveTextContent("여름 행사 준비 물품");

    const [newest, oldest] = items;
    expect(within(newest).getByText("검토 대기")).toBeInTheDocument();
    expect(within(newest).getByText("390,000원")).toBeInTheDocument();
    expect(within(newest).getByText("2026-08-03")).toBeInTheDocument();
    expect(within(newest).queryByText("예산 초과")).not.toBeInTheDocument();

    expect(within(oldest).getByText("예산 초과")).toBeInTheDocument();
  });

  test("각 요청을 키보드로 선택해 상세 경로로 이동한다", async () => {
    const user = userEvent.setup();
    server.use(http.get(ownListUrl, () => HttpResponse.json(ownListExample)));

    renderOwnList();

    const items = await listItems();
    const link = within(items[0]).getByRole("link", {
      name: /가을 축제 운영 물품/,
    });
    expect(link).toHaveAttribute(
      "href",
      `/events/${eventId}/purchase-requests/request-001`,
    );

    link.focus();
    expect(link).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(
      await screen.findByRole("heading", { name: "구매 요청 상세" }),
    ).toBeInTheDocument();
    expect(screen.getByText("request-001")).toBeInTheDocument();
  });

  test("권한 없음은 다른 조직 데이터 존재를 노출하지 않고 안전한 복귀를 제공한다", async () => {
    server.use(
      http.get(ownListUrl, () =>
        problem(403, "purchase_request_action_forbidden", "권한이 없습니다."),
      ),
    );

    renderOwnList();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAccessibleName("목록을 볼 수 없습니다.");
    expect(alert).not.toHaveTextContent("조직");
    expect(screen.getByRole("link", { name: "행사 재정으로 돌아가기" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다시 시도" })).not.toBeInTheDocument();
  });

  test("찾을 수 없음도 권한 없음과 같은 수준으로 처리한다", async () => {
    server.use(
      http.get(ownListUrl, () =>
        problem(404, "http_resource_not_found", "찾을 수 없습니다."),
      ),
    );

    renderOwnList();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAccessibleName("목록을 볼 수 없습니다.");
    expect(screen.queryByRole("button", { name: "다시 시도" })).not.toBeInTheDocument();
  });

  test("일시 장애만 재시도를 제공하고 재시도가 성공하면 목록을 표시한다", async () => {
    const user = userEvent.setup();
    let attempt = 0;
    server.use(
      http.get(ownListUrl, () => {
        attempt += 1;
        return attempt === 1
          ? problem(
              503,
              "purchase_request_persistence_unavailable",
              "일시적으로 처리할 수 없습니다.",
            )
          : HttpResponse.json(ownListExample);
      }),
    );

    renderOwnList();

    const retry = await screen.findByRole("button", { name: "다시 시도" });
    await user.click(retry);

    expect(await screen.findByText("가을 축제 운영 물품")).toBeInTheDocument();
  });

  test("인증이 끊기면 재인증 안내만 표시하고 목록을 대신 보여주지 않는다", async () => {
    server.use(
      http.get(ownListUrl, () =>
        problem(401, "http_unauthenticated", "다시 인증해야 합니다."),
      ),
    );

    renderOwnList();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAccessibleName("다시 인증해야 합니다.");
    expect(screen.queryByRole("list", { name: "본인 구매 요청" })).not.toBeInTheDocument();
    expect(screen.queryByText("가을 축제 운영 물품")).not.toBeInTheDocument();
  });
});
