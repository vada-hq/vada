import { http, HttpResponse } from "msw";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";

import { AppProviders, createAppRuntime } from "../../../app/runtime";
import {
  editorStateExample,
  sampleEventId,
} from "../../../mocks/purchase-request-fixtures";
import { server } from "../../../mocks/server";

const eventId = sampleEventId;
const editorPath = `/events/${eventId}/purchase-requests/new`;
const editorUrl = `*/events/${eventId}/purchase-request-editor`;

function problem(status: number, code: string, title: string) {
  return HttpResponse.json(
    { type: `urn:vada:error:${code}`, title, status, code },
    { status, headers: { "content-type": "application/problem+json" } },
  );
}

function renderEditor() {
  render(<AppProviders runtime={createAppRuntime({ initialPath: editorPath })} />);
}

describe("구매 요청 작성 화면 · 진입과 골격", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  test("로딩 중에는 빈 입력 대신 진행 상태만 알린다", async () => {
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(editorUrl, async () => {
        await pending;
        return HttpResponse.json(editorStateExample);
      }),
    );

    renderEditor();

    expect(await screen.findByRole("status")).toHaveTextContent("불러오는 중");
    // 서버 응답 전 샘플 값을 실제 입력처럼 채우지 않는다.
    expect(screen.queryByRole("textbox", { name: /요청 제목/ })).not.toBeInTheDocument();

    release?.();
    expect(
      await screen.findByRole("heading", { name: "구매 요청서 작성" }),
    ).toBeInTheDocument();
  });

  test("서버가 준 작성 맥락을 표시하고 사용자가 고르지 않게 한다", async () => {
    server.use(http.get(editorUrl, () => HttpResponse.json(editorStateExample)));

    renderEditor();

    await screen.findByRole("heading", { name: "구매 요청서 작성" });

    // 요청 부서는 서버 값으로 고정한다.
    const department = screen.getByRole("textbox", { name: /요청 부서/ });
    expect(department).toHaveValue("운영부");
    expect(department).toBeDisabled();

    // 식별자를 화면에 노출하지 않는다.
    expect(screen.queryByText("user-001")).not.toBeInTheDocument();
    expect(screen.queryByText("department-001")).not.toBeInTheDocument();
  });

  test("기본 요청 정보 입력을 접근 가능하게 제공한다", async () => {
    server.use(http.get(editorUrl, () => HttpResponse.json(editorStateExample)));

    renderEditor();

    await screen.findByRole("heading", { name: "구매 요청서 작성" });

    expect(screen.getByRole("textbox", { name: /요청 제목/ })).toBeRequired();
    expect(screen.getByLabelText(/필요한 날짜/)).toBeRequired();
    expect(screen.getByRole("textbox", { name: /구매 목적/ })).toBeRequired();
    expect(screen.getByRole("combobox", { name: /우선순위/ })).toBeInTheDocument();
  });

  test("요약 패널에 전체 예상 금액과 요약 항목을 표시한다", async () => {
    server.use(http.get(editorUrl, () => HttpResponse.json(editorStateExample)));

    renderEditor();

    const summary = await screen.findByRole("complementary", { name: "요청 요약" });
    expect(within(summary).getByText("전체 예상 금액")).toBeInTheDocument();
    // 품목이 없으면 합계는 0원이다.
    expect(within(summary).getByText("0원")).toBeInTheDocument();
    expect(within(summary).getByText("총 품목 수")).toBeInTheDocument();
    expect(within(summary).getByText("우선순위")).toBeInTheDocument();
    expect(within(summary).getByText("희망 기한")).toBeInTheDocument();

    expect(
      within(summary).getByRole("button", { name: "구매 요청 제출" }),
    ).toBeInTheDocument();
    expect(
      within(summary).getByRole("button", { name: "임시 저장" }),
    ).toBeInTheDocument();
    expect(within(summary).getByRole("link", { name: "취소" })).toHaveAttribute(
      "href",
      `/events/${eventId}/purchase-requests/mine`,
    );
  });

  test("서버 초안이 있으면 복원 사실과 저장 시각을 알린다", async () => {
    server.use(
      http.get(editorUrl, () =>
        HttpResponse.json({
          ...editorStateExample,
          draft: {
            draftId: "draft-001",
            version: 3,
            savedAt: "2026-08-05T04:20:00Z",
            content: { title: "가을 축제 운영 물품" },
          },
        }),
      ),
    );

    renderEditor();

    const banner = await screen.findByRole("status", { name: "초안 복원" });
    expect(banner).toHaveTextContent("임시 저장한 구매 요청을 이어서 작성");
    expect(banner).toHaveTextContent("2026-08-05");
    expect(banner).toHaveTextContent("제출 전에는 재정부 검토 목록에 표시되지 않습니다");
    expect(
      within(banner).getByRole("button", { name: "초안 삭제" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("textbox", { name: /요청 제목/ })).toHaveValue(
      "가을 축제 운영 물품",
    );
  });

  test("초안이 없으면 복원 배너를 표시하지 않는다", async () => {
    server.use(http.get(editorUrl, () => HttpResponse.json(editorStateExample)));

    renderEditor();

    await screen.findByRole("heading", { name: "구매 요청서 작성" });
    expect(screen.queryByRole("status", { name: "초안 복원" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /요청 제목/ })).toHaveValue("");
  });

  test("권한 없음은 작성 폼을 제공하지 않고 안전한 복귀만 준다", async () => {
    server.use(
      http.get(editorUrl, () =>
        problem(403, "purchase_request_action_forbidden", "권한이 없습니다."),
      ),
    );

    renderEditor();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAccessibleName("작성 권한이 없습니다.");
    // 역할 목록이나 다른 사용자의 관계를 공개하지 않는다.
    expect(alert).not.toHaveTextContent("부서장");
    expect(alert).not.toHaveTextContent("재정부");

    expect(screen.queryByRole("textbox", { name: /요청 제목/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "구매 요청 제출" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "내 구매 요청 목록으로" }),
    ).toBeInTheDocument();
  });

  test("찾을 수 없음과 일시 장애를 구분하고 일시 장애에만 재시도를 준다", async () => {
    server.use(
      http.get(editorUrl, () =>
        problem(404, "http_resource_not_found", "찾을 수 없습니다."),
      ),
    );

    renderEditor();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAccessibleName("행사를 찾을 수 없습니다.");
    expect(screen.queryByRole("button", { name: "다시 시도" })).not.toBeInTheDocument();
    // 서버 맥락을 확인하지 못한 상태에서 폼을 열지 않는다.
    expect(screen.queryByRole("textbox", { name: /요청 제목/ })).not.toBeInTheDocument();
  });

  test("일시 장애는 재시도를 제공하고 성공하면 작성 폼을 연다", async () => {
    let attempt = 0;
    server.use(
      http.get(editorUrl, () => {
        attempt += 1;
        return attempt === 1
          ? problem(
              503,
              "purchase_request_persistence_unavailable",
              "일시적으로 처리할 수 없습니다.",
            )
          : HttpResponse.json(editorStateExample);
      }),
    );

    renderEditor();

    const retry = await screen.findByRole("button", { name: "다시 시도" });
    retry.click();

    expect(
      await screen.findByRole("heading", { name: "구매 요청서 작성" }),
    ).toBeInTheDocument();
  });

  test("인증이 끊기면 작성 폼을 열지 않고 재인증 안내만 표시한다", async () => {
    server.use(
      http.get(editorUrl, () =>
        problem(401, "http_unauthenticated", "다시 인증해야 합니다."),
      ),
    );

    renderEditor();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAccessibleName("다시 인증해야 합니다.");
    expect(screen.queryByRole("textbox", { name: /요청 제목/ })).not.toBeInTheDocument();
  });
});
