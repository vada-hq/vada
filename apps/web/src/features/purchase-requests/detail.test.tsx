import { http, HttpResponse } from "msw";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";

import { AppProviders, createAppRuntime } from "../../app/runtime";
import {
  detailViewExample as detailExample,
  sampleEventId,
} from "../../mocks/purchase-request-fixtures";
import { server } from "../../mocks/server";

const eventId = sampleEventId;
const requestId = "request-001";
const detailPath = `/events/${eventId}/purchase-requests/${requestId}`;
const detailUrl = `*${detailPath}`;

function problem(status: number, code: string, title: string) {
  return HttpResponse.json(
    { type: `urn:vada:error:${code}`, title, status, code },
    { status, headers: { "content-type": "application/problem+json" } },
  );
}

function renderDetail() {
  render(<AppProviders runtime={createAppRuntime({ initialPath: detailPath })} />);
}

describe("구매 요청 상세 화면", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  test("직접 진입에서 서버가 준 행사명·요청자명과 저장 기록을 표시한다", async () => {
    server.use(http.get(detailUrl, () => HttpResponse.json(detailExample)));

    renderDetail();

    expect(
      await screen.findByRole("heading", { name: "가을 축제 운영 물품" }),
    ).toBeInTheDocument();

    // display 값을 그대로 표시하고 record의 식별자에서 이름을 추정하지 않는다.
    expect(screen.getByText("2026 가을 축제")).toBeInTheDocument();
    expect(screen.getByText("김바다")).toBeInTheDocument();
    expect(screen.queryByText("user-001")).not.toBeInTheDocument();
    expect(screen.queryByText("event-001")).not.toBeInTheDocument();

    expect(screen.getByText("검토 대기")).toBeInTheDocument();
    expect(screen.getByText("390,000원")).toBeInTheDocument();
  });

  test("모든 품목과 품목별 금액을 표시한다", async () => {
    server.use(http.get(detailUrl, () => HttpResponse.json(detailExample)));

    renderDetail();

    const list = await screen.findByRole("list", { name: "품목" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("명찰 케이스")).toBeInTheDocument();
    expect(within(items[0]).getByText("30,000원")).toBeInTheDocument();
    expect(within(items[1]).getByText("행사 음향 운영")).toBeInTheDocument();
    expect(within(items[1]).getByText("360,000원")).toBeInTheDocument();
  });

  test("예산 초과 기록은 초과 표시를 함께 보여준다", async () => {
    server.use(
      http.get(detailUrl, () =>
        HttpResponse.json({
          ...detailExample,
          record: { ...detailExample.record, overBudget: true },
        }),
      ),
    );

    renderDetail();

    expect(await screen.findByText("예산 초과")).toBeInTheDocument();
    expect(screen.getByText("검토 대기")).toBeInTheDocument();
  });

  test("로딩 중에는 이전 데이터나 샘플 대신 진행 상태만 알린다", async () => {
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(detailUrl, async () => {
        await pending;
        return HttpResponse.json(detailExample);
      }),
    );

    renderDetail();

    expect(await screen.findByRole("status")).toHaveTextContent("불러오는 중");
    expect(screen.queryByText("가을 축제 운영 물품")).not.toBeInTheDocument();

    release?.();
    expect(
      await screen.findByRole("heading", { name: "가을 축제 운영 물품" }),
    ).toBeInTheDocument();
  });

  test("새로고침으로 다시 진입하면 상세를 서버에서 다시 조회한다", async () => {
    let calls = 0;
    server.use(
      http.get(detailUrl, () => {
        calls += 1;
        return HttpResponse.json(detailExample);
      }),
    );

    renderDetail();
    await screen.findByRole("heading", { name: "가을 축제 운영 물품" });
    expect(calls).toBe(1);

    // 새로고침은 애플리케이션을 새 런타임으로 다시 시작하는 것과 같다.
    renderDetail();
    await screen.findAllByRole("heading", { name: "가을 축제 운영 물품" });
    expect(calls).toBe(2);
  });

  test("찾을 수 없음은 목록 복귀만 제공하고 재시도를 제공하지 않는다", async () => {
    server.use(
      http.get(detailUrl, () =>
        problem(404, "http_resource_not_found", "찾을 수 없습니다."),
      ),
    );

    renderDetail();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAccessibleName("요청을 찾을 수 없습니다.");
    expect(alert).not.toHaveTextContent("조직");
    expect(
      screen.getByRole("link", { name: "내 구매 요청 목록으로" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다시 시도" })).not.toBeInTheDocument();
  });

  test("일시 장애는 재시도를 제공하고 재시도가 성공하면 상세를 표시한다", async () => {
    const user = userEvent.setup();
    let attempt = 0;
    server.use(
      http.get(detailUrl, () => {
        attempt += 1;
        return attempt === 1
          ? problem(
              503,
              "purchase_request_persistence_unavailable",
              "일시적으로 처리할 수 없습니다.",
            )
          : HttpResponse.json(detailExample);
      }),
    );

    renderDetail();

    const retry = await screen.findByRole("button", { name: "다시 시도" });
    expect(
      screen.getByRole("link", { name: "내 구매 요청 목록으로" }),
    ).toBeInTheDocument();

    retry.focus();
    expect(retry).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(
      await screen.findByRole("heading", { name: "가을 축제 운영 물품" }),
    ).toBeInTheDocument();
  });

  test("인증이 끊기면 재인증 안내만 표시하고 상세를 대신 보여주지 않는다", async () => {
    server.use(
      http.get(detailUrl, () =>
        problem(401, "http_unauthenticated", "다시 인증해야 합니다."),
      ),
    );

    renderDetail();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAccessibleName("다시 인증해야 합니다.");
    expect(screen.queryByText("가을 축제 운영 물품")).not.toBeInTheDocument();
    expect(screen.queryByText("김바다")).not.toBeInTheDocument();
  });
});
