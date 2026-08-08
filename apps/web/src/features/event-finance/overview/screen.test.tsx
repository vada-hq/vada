import { http, HttpResponse } from "msw";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";

import { AppProviders, createAppRuntime } from "../../../app/runtime";
import { sampleEventId } from "../../../mocks/purchase-request-fixtures";
import { server } from "../../../mocks/server";
import type { EventBoardItem, EventBudgetSummary } from "./query";

const eventId = sampleEventId;
const financePath = `/events/${eventId}/finance`;
const budgetUrl = `*/events/${eventId}/budget-summary`;
const itemsUrl = `*/events/${eventId}/purchase-request-items`;

function problem(status: number, code: string, title: string) {
  return HttpResponse.json(
    { type: `urn:vada:error:${code}`, title, status, code },
    { status, headers: { "content-type": "application/problem+json" } },
  );
}

function item(overrides: Partial<EventBoardItem> = {}): EventBoardItem {
  return {
    itemId: "item-001",
    requestId: "request-001",
    itemName: "현수막",
    requesterName: "박해랑",
    requestDepartmentName: "기획부",
    estimatedTotalPrice: 120_000,
    progressState: "under_review",
    requestedByViewer: false,
    ...overrides,
  };
}

function serve({
  budget,
  items,
}: {
  budget?: Partial<EventBudgetSummary>;
  items?: EventBoardItem[];
} = {}) {
  const summary: EventBudgetSummary = {
    allocatedTotal: 1_000_000,
    committedTotal: 250_000,
    availableTotal: 750_000,
    ...budget,
  };
  server.use(
    http.get(budgetUrl, () => HttpResponse.json(summary)),
    http.get(itemsUrl, () => HttpResponse.json({ items: items ?? [] })),
  );
}

function renderScreen() {
  render(<AppProviders runtime={createAppRuntime({ initialPath: financePath })} />);
}

async function column(label: string) {
  // 열마다 region으로 이름을 준다. 제목의 조상을 더듬으면 격자 전체가 잡힌다.
  return screen.findByRole("region", { name: `${label} 열` });
}

describe("행사 재정 개요 화면", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  test("로딩 중에는 샘플 값 대신 진행 상태만 알린다", async () => {
    server.use(
      http.get(budgetUrl, () => new Promise(() => {})),
      http.get(itemsUrl, () => new Promise(() => {})),
    );
    renderScreen();

    // role=status는 내용에서 접근 이름을 만들지 않는다. 문구와 역할을 따로 본다.
    expect(await screen.findByText(/행사 재정을 불러오는 중/)).toHaveAttribute(
      "role",
      "status",
    );
    expect(screen.queryByText(/원$/)).not.toBeInTheDocument();
  });

  test("예산 요약을 서버 값 그대로 표시한다", async () => {
    serve();
    renderScreen();

    const summary = await screen.findByRole("region", { name: "예산 요약" });
    expect(within(summary).getByText("1,000,000원")).toBeInTheDocument();
    expect(within(summary).getByText("250,000원")).toBeInTheDocument();
    expect(within(summary).getByText("750,000원")).toBeInTheDocument();
  });

  test("배정이 없으면 초과가 아니라 미배정으로 말한다", async () => {
    // 배정을 만드는 흐름이 없어 음수가 나온다. 초과로 물들이면 사용자가 없는
    // 문제를 쫓는다.
    serve({
      budget: { allocatedTotal: 0, committedTotal: 250_000, availableTotal: -250_000 },
    });
    renderScreen();

    const summary = await screen.findByRole("region", { name: "예산 요약" });
    expect(
      within(summary).getByText("예산이 배정되지 않았습니다."),
    ).toBeInTheDocument();
    expect(within(summary).queryByText("예산을 초과했습니다.")).not.toBeInTheDocument();
  });

  test("실제 지출은 0원이 아니라 미도입으로 표시한다", async () => {
    serve();
    renderScreen();

    const summary = await screen.findByRole("region", { name: "예산 요약" });
    const spent = within(summary).getByText("실제 지출").closest("div");
    expect(within(spent as HTMLElement).getByText("—")).toBeInTheDocument();
    expect(
      within(spent as HTMLElement).getByText("아직 제공하지 않습니다."),
    ).toBeInTheDocument();
  });

  test("보완 필요는 확인 필요 열에, 검토 중은 검토 중 열에 놓는다", async () => {
    serve({
      items: [
        item({
          itemId: "mine",
          itemName: "보완 품목",
          progressState: "needs_attention",
          requestedByViewer: true,
        }),
        item({ itemId: "other", itemName: "검토 품목", progressState: "under_review" }),
      ],
    });
    renderScreen();

    expect(within(await column("확인 필요")).getByText("보완 품목")).toBeInTheDocument();
    expect(within(await column("검토 중")).getByText("검토 품목")).toBeInTheDocument();
  });

  test("반려된 품목은 확인 필요 열에 남는다", async () => {
    // 종결이지만 요청자가 결과를 알아야 한다.
    serve({
      items: [
        item({ itemId: "rejected", itemName: "반려 품목", progressState: "rejected" }),
      ],
    });
    renderScreen();

    const needsAttention = await column("확인 필요");
    expect(within(needsAttention).getByText("반려 품목")).toBeInTheDocument();
    expect(within(needsAttention).getByText("반려")).toBeInTheDocument();
  });

  test("구매 준비 이후 열은 0건이 아니라 미도입으로 말한다", async () => {
    serve({ items: [item()] });
    renderScreen();

    for (const label of ["구매 준비", "주문 완료", "정산 중", "처리 완료"]) {
      const target = await column(label);
      expect(within(target).getByText("아직 제공하지 않습니다.")).toHaveAttribute(
        "role",
        "status",
      );
      expect(within(target).queryByText("0건")).not.toBeInTheDocument();
    }
  });

  test("구매 요청이 없으면 빈 결과를 status로 알린다", async () => {
    serve({ items: [] });
    renderScreen();

    expect(await screen.findByText(/아직 구매 요청이 없습니다/)).toHaveAttribute(
      "role",
      "status",
    );
  });

  test("권한 없음은 다른 조직 데이터의 존재를 드러내지 않는다", async () => {
    server.use(
      http.get(budgetUrl, () =>
        problem(403, "PURCHASE_REQUEST_ACTION_FORBIDDEN", "권한이 없습니다."),
      ),
      http.get(itemsUrl, () =>
        problem(403, "PURCHASE_REQUEST_ACTION_FORBIDDEN", "권한이 없습니다."),
      ),
    );
    renderScreen();

    // 실패 안내는 제목과 알림 두 곳에 같은 문구를 낸다. 하나라도 있으면 된다.
    expect(await screen.findAllByText("행사 재정을 볼 수 없습니다.")).not.toHaveLength(
      0,
    );
    expect(screen.queryByRole("region", { name: "예산 요약" })).not.toBeInTheDocument();
  });

  test("일시 장애에는 예산이나 목록을 지어내지 않는다", async () => {
    server.use(
      http.get(budgetUrl, () =>
        problem(503, "PURCHASE_REQUEST_PERSISTENCE_UNAVAILABLE", "일시 장애"),
      ),
      http.get(itemsUrl, () =>
        problem(503, "PURCHASE_REQUEST_PERSISTENCE_UNAVAILABLE", "일시 장애"),
      ),
    );
    renderScreen();

    expect(
      await screen.findAllByText("행사 재정을 일시적으로 불러오지 못했습니다."),
    ).not.toHaveLength(0);
    expect(screen.queryByRole("region", { name: "품목 현황" })).not.toBeInTheDocument();
  });
});

describe("행사 재정 개요 화면 · 재정부", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  function financeItem(overrides: Partial<EventBoardItem> = {}) {
    return item({ financeStage: "review_pending", ...overrides });
  }

  test("재정부에게는 두 묶음이 보이고 기본 탭은 처리 단계다", async () => {
    serve({ items: [financeItem()] });
    renderScreen();

    const stage = await screen.findByRole("tab", { name: "처리 단계" });
    expect(stage).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tablist", { name: "작업 보드" })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "기록" })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "처리 단계" })).toBeInTheDocument();
  });

  test("일반 구성원에게는 하위 메뉴 없이 품목 현황만 보인다", async () => {
    // financeStage가 없다는 것이 권한 판정 결과다. 화면이 역할을 다시 비교하지
    // 않는다.
    serve({ items: [item()] });
    renderScreen();

    expect(await screen.findByRole("region", { name: "품목 현황" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist", { name: "기록" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "처리 단계" })).not.toBeInTheDocument();
  });

  test("처리 단계에는 재정부가 처리할 품목만 나온다", async () => {
    // 보완 요청된 품목은 요청자를 기다린다. 재정부의 할 일이 아니다.
    serve({
      items: [
        financeItem({ itemId: "pending", itemName: "검토 대기 품목" }),
        item({
          itemId: "waiting",
          itemName: "보완 대기 품목",
          progressState: "needs_attention",
        }),
      ],
    });
    renderScreen();

    const stage = await screen.findByRole("region", { name: "처리 단계" });
    expect(within(stage).getByText("검토 대기 품목")).toBeInTheDocument();
    expect(within(stage).queryByText("보완 대기 품목")).not.toBeInTheDocument();
  });

  test("기록은 품목을 요청 단위로 묶어 보여준다", async () => {
    serve({
      items: [
        financeItem({ itemId: "a", requestId: "request-001", estimatedTotalPrice: 100 }),
        financeItem({ itemId: "b", requestId: "request-001", estimatedTotalPrice: 200 }),
        financeItem({ itemId: "c", requestId: "request-002", estimatedTotalPrice: 300 }),
      ],
    });
    renderScreen();

    await userEvent.click(await screen.findByRole("tab", { name: "구매 요청" }));

    const table = await screen.findByRole("table", { name: "구매 요청 기록" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("2건")).toBeInTheDocument();
    expect(within(rows[0]).getByText("300원")).toBeInTheDocument();
  });

  test("내 요청 필터가 남의 요청을 감춘다", async () => {
    serve({
      items: [
        financeItem({ itemId: "mine", itemName: "내 품목", requestedByViewer: true }),
        financeItem({ itemId: "theirs", itemName: "남의 품목" }),
      ],
    });
    renderScreen();

    await userEvent.click(await screen.findByRole("tab", { name: "품목 현황" }));
    expect(await screen.findByText("남의 품목")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "내 요청" }));
    expect(screen.getByText("내 품목")).toBeInTheDocument();
    expect(screen.queryByText("남의 품목")).not.toBeInTheDocument();
  });

  test("같은 요청 품목이 한 열에 둘이면 스택으로 묶는다", async () => {
    serve({
      items: [
        item({ itemId: "a", requestId: "request-001", itemName: "현수막" }),
        item({ itemId: "b", requestId: "request-001", itemName: "포스터" }),
      ],
    });
    renderScreen();

    const column = await screen.findByRole("region", { name: "검토 중 열" });
    expect(within(column).getByText(/request-001 · 품목 2건/)).toBeInTheDocument();
    expect(within(column).getByText("현수막")).toBeInTheDocument();
    expect(within(column).getByText("포스터")).toBeInTheDocument();
  });
});
