import { http, HttpResponse } from "msw";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";

import { AppProviders, createAppRuntime } from "../../../app/runtime";
import { sampleEventId } from "../../../mocks/purchase-request-fixtures";
import { server } from "../../../mocks/server";
import type { RevisionView } from "./query";

const eventId = sampleEventId;
const requestId = "request-001";
const path = `/events/${eventId}/purchase-requests/${requestId}/revision`;
const viewUrl = `*${path}`;
const submitUrl = `*/events/${eventId}/purchase-requests/${requestId}/revisions`;

function problem(status: number, code: string, title: string) {
  return HttpResponse.json(
    { type: `urn:vada:error:${code}`, title, status, code },
    { status, headers: { "content-type": "application/problem+json" } },
  );
}

function view(overrides: Partial<RevisionView> = {}): RevisionView {
  return {
    requestId,
    requestTitle: "가을 축제 운영 물품",
    revisionItems: [
      {
        itemId: "item-101",
        itemName: "음향 장비 대여",
        revisionReason: "견적 근거가 없습니다.",
        revisionDueDate: "2999-09-01",
        content: { name: "음향 장비 대여", quantity: 1, estimatedUnitPrice: 360_000 },
      },
    ],
    otherItems: [
      {
        itemId: "item-102",
        itemName: "행사 현수막 (5m)",
        reviewStatus: "approved",
        estimatedTotalPrice: 180_000,
      },
    ],
    ...overrides,
  };
}

function serve(body: RevisionView = view()) {
  server.use(http.get(viewUrl, () => HttpResponse.json(body)));
}

function renderScreen() {
  render(<AppProviders runtime={createAppRuntime({ initialPath: path })} />);
}

describe("보완 요청 확인·재제출 화면", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  test("로딩 중에는 샘플 대신 진행 상태만 알린다", async () => {
    server.use(http.get(viewUrl, () => new Promise(() => {})));
    renderScreen();

    expect(await screen.findByText(/보완 요청을 불러오는 중/)).toHaveAttribute(
      "role",
      "status",
    );
    expect(screen.queryByRole("button", { name: "재제출" })).not.toBeInTheDocument();
  });

  test("보완 사유와 기한을 품목 옆에 붙인다", async () => {
    serve();
    renderScreen();

    const card = await screen.findByRole("region", { name: /음향 장비 대여 보완/ });
    expect(within(card).getByText("견적 근거가 없습니다.")).toBeInTheDocument();
    // 기한은 안내다. 지나도 막지 않는다고 함께 말한다.
    expect(within(card).getByText(/지나도 다시 낼 수 있습니다/)).toBeInTheDocument();
  });

  test("나머지 품목은 읽기 전용으로 보여준다", async () => {
    serve();
    renderScreen();

    const others = await screen.findByRole("region", { name: "나머지 품목" });
    expect(within(others).getByText("행사 현수막 (5m)")).toBeInTheDocument();
    expect(within(others).queryByRole("textbox")).not.toBeInTheDocument();
  });

  test("보완할 것이 없으면 재제출할 것이 없다고 알린다", async () => {
    serve(view({ revisionItems: [] }));
    renderScreen();

    expect(await screen.findByText(/보완을 요청받은 품목이 없습니다/)).toHaveAttribute(
      "role",
      "status",
    );
    expect(screen.queryByRole("button", { name: "재제출" })).not.toBeInTheDocument();
  });

  test("필수 입력이 비면 재제출을 막고 무엇이 필요한지 알린다", async () => {
    const user = userEvent.setup();
    serve();
    renderScreen();

    const name = await screen.findByRole("textbox", { name: /품목명/ });
    await user.clear(name);

    expect(screen.getByRole("button", { name: "재제출" })).toBeDisabled();
    expect(await screen.findByText(/필수 입력을 모두 채워/)).toHaveAttribute(
      "role",
      "status",
    );
  });

  test("재제출하면 같은 멱등성 키를 붙여 보낸다", async () => {
    const user = userEvent.setup();
    const keys: string[] = [];
    serve();
    server.use(
      http.post(submitUrl, ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key") ?? "");
        return HttpResponse.json(view({ revisionItems: [] }));
      }),
    );
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "재제출" }));

    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toBe("");
  });

  test("재정부가 그 사이 재검토를 끝냈으면 덮어쓰지 않는다", async () => {
    const user = userEvent.setup();
    serve();
    server.use(
      http.post(submitUrl, () =>
        problem(409, "PURCHASE_REQUEST_STATE_CONFLICT", "상태가 바뀌었습니다."),
      ),
    );
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "재제출" }));

    expect(
      await screen.findAllByText("그 사이 검토가 진행됐습니다."),
    ).not.toHaveLength(0);
  });

  test("일시 장애에는 저장됐다고 말하지 않는다", async () => {
    const user = userEvent.setup();
    serve();
    server.use(
      http.post(submitUrl, () =>
        problem(503, "PURCHASE_REQUEST_PERSISTENCE_UNAVAILABLE", "일시 장애"),
      ),
    );
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "재제출" }));

    expect(
      await screen.findAllByText("보완 요청을 일시적으로 불러오지 못했습니다."),
    ).not.toHaveLength(0);
  });

  test("구매 유형별 상세를 작성 화면과 같은 폼으로 고친다", async () => {
    // §7은 보완 품목의 모든 입력값을 고칠 수 있다고 정한다. 유형별 상세가
    // 없으면 대여처나 반납 일시를 고칠 수 없어 그 요구를 못 지킨다.
    const user = userEvent.setup();
    serve(
      view({
        revisionItems: [
          {
            ...view().revisionItems[0],
            content: {
              ...view().revisionItems[0].content,
              purchaseType: "rental",
              details: { provider: "예시사운드" },
            },
          },
        ],
      }),
    );
    renderScreen();

    const card = await screen.findByRole("region", { name: /음향 장비 대여 보완/ });
    expect(within(card).getByRole("combobox", { name: /구매 유형/ })).toBeInTheDocument();
    expect(within(card).getByRole("textbox", { name: /업체 또는 제공자/ })).toHaveValue(
      "예시사운드",
    );

    // 유형을 바꾸면 이전 유형의 상세를 남기지 않는다. 작성 화면과 같은 판정이다.
    await user.click(within(card).getByRole("combobox", { name: /구매 유형/ }));
    await user.click(await screen.findByRole("option", { name: "일반 구매" }));
    expect(within(card).queryByRole("textbox", { name: /업체 또는 제공자/ })).not.toBeInTheDocument();
  });

  test("권한 없음은 다른 조직 데이터의 존재를 드러내지 않는다", async () => {
    server.use(
      http.get(viewUrl, () =>
        problem(403, "PURCHASE_REQUEST_ACTION_FORBIDDEN", "권한이 없습니다."),
      ),
    );
    renderScreen();

    expect(
      await screen.findAllByText("이 요청을 다시 낼 수 없습니다."),
    ).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: "재제출" })).not.toBeInTheDocument();
  });

  test("인증이 필요하면 과거 값을 대신 보여주지 않는다", async () => {
    server.use(
      http.get(viewUrl, () => problem(401, "http_unauthenticated", "인증 필요")),
    );
    renderScreen();

    expect(await screen.findAllByText("다시 인증해야 합니다.")).not.toHaveLength(0);
    expect(screen.queryByRole("textbox", { name: /품목명/ })).not.toBeInTheDocument();
  });
});
