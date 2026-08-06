import { http, HttpResponse } from "msw";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";

import { AppProviders, createAppRuntime } from "../../../app/runtime";
import {
  budgetSummaryExample,
  eventListExample,
  sampleEventId,
} from "../../../mocks/event-finance-fixtures";
import { server } from "../../../mocks/server";

const eventId = sampleEventId;
const financePath = `/events/${eventId}/finance`;
const budgetUrl = `*/events/${eventId}/budget-summary`;
const listUrl = `*/events/${eventId}/purchase-requests`;

function problem(status: number, code: string, title: string) {
  return HttpResponse.json(
    { type: `urn:vada:error:${code}`, title, status, code },
    { status, headers: { "content-type": "application/problem+json" } },
  );
}

function renderFinance() {
  render(<AppProviders runtime={createAppRuntime({ initialPath: financePath })} />);
}

function ok() {
  server.use(
    http.get(budgetUrl, () => HttpResponse.json(budgetSummaryExample)),
    http.get(listUrl, () => HttpResponse.json(eventListExample)),
  );
}

describe("행사 재정 개요", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  test("로딩 중에는 샘플 값 대신 진행 상태만 알린다", async () => {
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(budgetUrl, async () => {
        await pending;
        return HttpResponse.json(budgetSummaryExample);
      }),
      http.get(listUrl, () => HttpResponse.json(eventListExample)),
    );

    renderFinance();

    expect(await screen.findByRole("status")).toHaveTextContent("불러오는 중");
    expect(screen.queryByText("3,000,000원")).not.toBeInTheDocument();

    release?.();
    expect(await screen.findByText("3,000,000원")).toBeInTheDocument();
  });

  test("예산 요약을 배정·집행 예정·사용 가능 셋으로 표시한다", async () => {
    ok();
    renderFinance();

    const summary = await screen.findByRole("region", { name: "예산 요약" });
    expect(within(summary).getByText("배정 예산")).toBeInTheDocument();
    expect(within(summary).getByText("3,000,000원")).toBeInTheDocument();
    expect(within(summary).getByText("승인·집행 예정액")).toBeInTheDocument();
    expect(within(summary).getByText("1,100,000원")).toBeInTheDocument();
    expect(within(summary).getByText("사용 가능액")).toBeInTheDocument();
    expect(within(summary).getByText("1,900,000원")).toBeInTheDocument();

    // 계약에 없는 실제 지출액은 표시하지 않는다.
    expect(within(summary).queryByText("실제 지출액")).not.toBeInTheDocument();
  });

  test("예산 항목별 배정을 표시한다", async () => {
    ok();
    renderFinance();

    const table = await screen.findByRole("table", { name: "예산 항목별 배정" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("행사 운영비")).toBeInTheDocument();
    expect(within(rows[0]).getByText("1,500,000원")).toBeInTheDocument();
  });

  test("전체 목록을 최신순으로 표시하고 요청 부서를 함께 보여준다", async () => {
    ok();
    renderFinance();

    const table = await screen.findByRole("table", { name: "행사 구매 요청" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["요청일", "구매 요청명", "요청 부서", "전체 요청액", "현재 상태"]);

    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("가을 축제 운영 물품")).toBeInTheDocument();
    expect(within(rows[0]).getByText("운영부")).toBeInTheDocument();
    expect(within(rows[1]).getByText("홍보부")).toBeInTheDocument();
  });

  test("긴급 요청은 목록에서 구분해 표시한다", async () => {
    ok();
    renderFinance();

    const table = await screen.findByRole("table", { name: "행사 구매 요청" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(within(rows[1]).getByText("긴급")).toBeInTheDocument();
    expect(within(rows[0]).queryByText("긴급")).not.toBeInTheDocument();
  });

  test("처리 단계 보드로 전환하면 계약 상태만 단계로 묶는다", async () => {
    const user = userEvent.setup();
    ok();
    renderFinance();

    await screen.findByRole("table", { name: "행사 구매 요청" });
    await user.click(screen.getByRole("tab", { name: "처리 단계" }));

    const review = await screen.findByRole("region", { name: "검토 필요" });
    expect(within(review).getByText("가을 축제 운영 물품")).toBeInTheDocument();

    const purchase = screen.getByRole("region", { name: "구매 필요" });
    expect(within(purchase).getByText("여름 행사 준비 물품")).toBeInTheDocument();

    // 계약에 없는 단계는 만들지 않고 없다고 알린다.
    const evidence = screen.getByRole("region", { name: "증빙 필요" });
    expect(within(evidence).getByText("아직 처리 단계가 없습니다.")).toBeInTheDocument();
  });

  test("검토 대기 건수를 표시한다", async () => {
    ok();
    renderFinance();

    expect(await screen.findByLabelText("검토 대기 건수")).toHaveTextContent("1");
  });

  test("요청이 없으면 단계별 빈 상태와 예산 요약을 함께 표시한다", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(budgetUrl, () => HttpResponse.json(budgetSummaryExample)),
      http.get(listUrl, () => HttpResponse.json({ items: [] })),
    );

    renderFinance();

    expect(
      await screen.findByText("이 행사에 제출된 구매 요청이 없습니다."),
    ).toBeInTheDocument();
    // 예산 요약은 그대로 보여준다.
    expect(screen.getByText("3,000,000원")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "처리 단계" }));
    const review = await screen.findByRole("region", { name: "검토 필요" });
    expect(within(review).getByText("항목 없음")).toBeInTheDocument();
    // 계약에 없는 단계는 비어 있는 이유가 다르다.
    const settled = screen.getByRole("region", { name: "정산 완료" });
    expect(within(settled).getByText("아직 처리 단계가 없습니다.")).toBeInTheDocument();
  });

  test("사용 가능액이 음수면 초과로 구분해 표시한다", async () => {
    server.use(
      http.get(budgetUrl, () =>
        HttpResponse.json({
          ...budgetSummaryExample,
          committedTotal: 3_500_000,
          availableTotal: -500_000,
        }),
      ),
      http.get(listUrl, () => HttpResponse.json(eventListExample)),
    );

    renderFinance();

    const summary = await screen.findByRole("region", { name: "예산 요약" });
    expect(within(summary).getByText("예산 초과")).toBeInTheDocument();
  });

  test("목록 항목을 선택하면 상세로 이동한다", async () => {
    const user = userEvent.setup();
    ok();
    server.use(
      http.get(`*/events/${eventId}/purchase-requests/request-001`, () =>
        problem(404, "http_resource_not_found", "찾을 수 없습니다."),
      ),
    );

    renderFinance();

    const table = await screen.findByRole("table", { name: "행사 구매 요청" });
    const link = within(table).getByRole("link", { name: /가을 축제 운영 물품/ });
    expect(link).toHaveAttribute(
      "href",
      `/events/${eventId}/purchase-requests/request-001`,
    );

    await user.click(link);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  test("권한 없음은 다른 조직 데이터 존재를 노출하지 않는다", async () => {
    server.use(
      http.get(budgetUrl, () =>
        problem(403, "purchase_request_action_forbidden", "권한이 없습니다."),
      ),
      http.get(listUrl, () => HttpResponse.json(eventListExample)),
    );

    renderFinance();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAccessibleName("행사 재정을 볼 수 없습니다.");
    expect(alert).not.toHaveTextContent("조직");
    expect(screen.queryByRole("button", { name: "다시 시도" })).not.toBeInTheDocument();
  });

  test("일시 장애는 재시도를 제공하고 성공하면 화면을 표시한다", async () => {
    const user = userEvent.setup();
    let attempt = 0;
    server.use(
      http.get(budgetUrl, () => {
        attempt += 1;
        return attempt === 1
          ? problem(
              503,
              "purchase_request_persistence_unavailable",
              "일시적으로 처리할 수 없습니다.",
            )
          : HttpResponse.json(budgetSummaryExample);
      }),
      http.get(listUrl, () => HttpResponse.json(eventListExample)),
    );

    renderFinance();

    await user.click(await screen.findByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("3,000,000원")).toBeInTheDocument();
  });

  test("인증이 끊기면 재인증 안내만 표시한다", async () => {
    server.use(
      http.get(budgetUrl, () =>
        problem(401, "http_unauthenticated", "다시 인증해야 합니다."),
      ),
      http.get(listUrl, () => HttpResponse.json(eventListExample)),
    );

    renderFinance();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAccessibleName("다시 인증해야 합니다.");
    expect(screen.queryByText("3,000,000원")).not.toBeInTheDocument();
  });
});
