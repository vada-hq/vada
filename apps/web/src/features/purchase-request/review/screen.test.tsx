import { http, HttpResponse } from "msw";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";

import { AppProviders, createAppRuntime } from "../../../app/runtime";
import {
  reviewViewExample,
  sampleEventId,
} from "../../../mocks/purchase-request-fixtures";
import { server } from "../../../mocks/server";

const eventId = sampleEventId;
const requestId = "request-001";
const reviewPath = `/events/${eventId}/purchase-requests/${requestId}/review`;
const reviewUrl = `*/api/v1/events/${eventId}/purchase-requests/${requestId}/review`;

function problem(status: number, code: string, title: string) {
  return HttpResponse.json(
    { type: `urn:vada:error:${code}`, title, status, code },
    { status, headers: { "content-type": "application/problem+json" } },
  );
}

function renderReview() {
  render(<AppProviders runtime={createAppRuntime({ initialPath: reviewPath })} />);
}

describe("구매 요청 검토 화면", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  test("로딩 중에는 샘플 값 대신 진행 상태만 알린다", async () => {
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(reviewUrl, async () => {
        await pending;
        return HttpResponse.json(reviewViewExample);
      }),
    );

    renderReview();

    expect(await screen.findByRole("status")).toHaveTextContent("불러오는 중");
    expect(screen.queryByText("명찰 케이스")).not.toBeInTheDocument();

    release?.();
    expect(await screen.findByText("명찰 케이스")).toBeInTheDocument();
  });

  test("품목마다 한 행씩, 현재 상태와 함께 표시한다", async () => {
    server.use(http.get(reviewUrl, () => HttpResponse.json(reviewViewExample)));
    renderReview();

    const table = await screen.findByRole("table", { name: "품목 검토" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["품목명", "수량", "요청액", "가격 근거", "현재 상태"]);

    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(reviewViewExample.detail.record.content.items.length);
    expect(within(rows[0]).getByText("검토 대기")).toBeInTheDocument();
  });

  test("보완 요청된 품목은 사유가 아니라 기한을 함께 보여준다", async () => {
    server.use(
      http.get(reviewUrl, () =>
        HttpResponse.json({
          ...reviewViewExample,
          itemReviewStates: [
            {
              itemId: "item-001",
              reviewStatus: "revision_requested",
              revisionReason: "가격 근거가 없습니다.",
              revisionDueDate: "2026-08-20",
            },
            { itemId: "item-002", reviewStatus: "approved" },
          ],
        }),
      ),
    );
    renderReview();

    const table = await screen.findByRole("table", { name: "품목 검토" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("보완 요청")).toBeInTheDocument();
    expect(within(rows[0]).getByText("2026-08-20까지")).toBeInTheDocument();
    expect(within(rows[1]).getByText("승인")).toBeInTheDocument();
  });

  test("처리 기록을 시간순으로 보여준다", async () => {
    server.use(
      http.get(reviewUrl, () =>
        HttpResponse.json({
          ...reviewViewExample,
          history: [
            {
              recordedAt: "2026-08-03T10:05:00Z",
              actorName: "김바다",
              summary: "구매 요청을 제출했습니다.",
            },
            {
              recordedAt: "2026-08-05T02:00:00Z",
              actorName: "김민준",
              summary: "검토 대기에서 승인(으)로 바꿨습니다.",
              itemId: "item-001",
            },
          ],
        }),
      ),
    );
    renderReview();

    // 사이드바 메뉴도 listitem이라 처리 기록 안에서만 찾는다.
    const history = await screen.findByRole("list", { name: "처리 기록" });
    const entries = within(history).getAllByRole("listitem");
    expect(entries[0]).toHaveTextContent("구매 요청을 제출했습니다.");
    expect(entries[1]).toHaveTextContent("검토 대기에서 승인");
    expect(entries[1]).toHaveTextContent("김민준");
  });

  test("검토 권한이 없으면 다른 조직 데이터를 노출하지 않는다", async () => {
    server.use(
      http.get(reviewUrl, () =>
        problem(403, "purchase_request_action_forbidden", "권한이 없습니다."),
      ),
    );
    renderReview();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAccessibleName("검토 권한이 없습니다.");
    expect(alert).not.toHaveTextContent("조직");
    expect(screen.queryByRole("button", { name: "다시 시도" })).not.toBeInTheDocument();
  });

  test("일시 장애는 재시도를 제공하고 성공하면 화면을 표시한다", async () => {
    let attempt = 0;
    server.use(
      http.get(reviewUrl, () => {
        attempt += 1;
        return attempt === 1
          ? problem(
              503,
              "purchase_request_persistence_unavailable",
              "일시적으로 처리할 수 없습니다.",
            )
          : HttpResponse.json(reviewViewExample);
      }),
    );
    renderReview();

    const retry = await screen.findByRole("button", { name: "다시 시도" });
    retry.click();

    expect(await screen.findByText("명찰 케이스")).toBeInTheDocument();
  });

  test("인증이 끊기면 재인증 안내만 표시한다", async () => {
    server.use(
      http.get(reviewUrl, () =>
        problem(401, "http_unauthenticated", "다시 인증해야 합니다."),
      ),
    );
    renderReview();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAccessibleName("다시 인증해야 합니다.");
    expect(screen.queryByText("명찰 케이스")).not.toBeInTheDocument();
  });
});
