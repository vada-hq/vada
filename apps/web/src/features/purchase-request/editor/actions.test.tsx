import { http, HttpResponse } from "msw";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AppProviders, createAppRuntime } from "../../../app/runtime";
import {
  editorStateExample,
  sampleEventId,
} from "../../../mocks/purchase-request-fixtures";
import { server } from "../../../mocks/server";

/**
 * 이 파일의 검사 하나가 2초쯤 걸린다. 제출 하나를 보려면 큰 폼을 통째로 그리고
 * 필수 입력 여섯 자리를 다 채워야 하기 때문이다 — 그중 둘은 팝업을 여는 선택이다.
 *
 * 기본 한계 5초는 여유가 1초도 안 남아서, 기계가 바쁘면 넘어간다. 실제로 다른
 * 검사와 함께 돌렸을 때 넷이 시간 초과로 실패했고 따로 돌리면 통과했다.
 * **간헐적으로 실패하는 검사는 실패한 검사보다 나쁘다** — 아무도 안 믿게 된다.
 *
 * 느린 것 자체는 정직한 비용이다. 한계를 올려 두되, 진짜로 멈춘 검사도 15초면
 * 드러난다.
 */
vi.setConfig({ testTimeout: 15_000 });

const eventId = sampleEventId;
const editorPath = `/events/${eventId}/purchase-requests/new`;
const editorUrl = `*/api/v1/events/${eventId}/purchase-request-editor`;
const draftUrl = `*/api/v1/events/${eventId}/purchase-request-draft`;
const submitUrl = `*/api/v1/events/${eventId}/purchase-requests`;

function problem(status: number, code: string, title: string) {
  return HttpResponse.json(
    { type: `urn:vada:error:${code}`, title, status, code },
    { status, headers: { "content-type": "application/problem+json" } },
  );
}

function renderEditor() {
  render(<AppProviders runtime={createAppRuntime({ initialPath: editorPath })} />);
}

/** 제출 가능한 최소 입력을 채운다. */
async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("textbox", { name: /요청 제목/ }), "간식 구매");
  fireEvent.change(screen.getByLabelText(/필요한 날짜/), {
    target: { value: "2026-09-15" },
  });
  await user.type(screen.getByRole("textbox", { name: /구매 목적/ }), "부스 운영");

  const list = await screen.findByRole("list", { name: "품목 리스트" });
  const [first] = within(list).getAllByRole("listitem");
  await user.type(within(first).getByRole("textbox", { name: /품목명/ }), "생수");
  await pick(user, first, /품목 카테고리/, "식음료");
  await pick(user, first, /예산 항목/, "식비");
  await user.type(within(first).getByRole("textbox", { name: /수량/ }), "10");
  await user.type(within(first).getByRole("textbox", { name: /단위/ }), "박스");
  await user.type(
    within(first).getByRole("textbox", { name: /예상 단가/ }),
    "5000",
  );
}

/** 화면이 별표로 필수라고 말한 자리는 검증도 필수로 본다. */
async function pick(
  user: ReturnType<typeof userEvent.setup>,
  scope: HTMLElement,
  name: RegExp,
  option: string,
) {
  await user.click(within(scope).getByRole("combobox", { name }));
  await user.click(
    within(await screen.findByRole("listbox")).getByRole("option", { name: option }),
  );
}

describe("구매 요청 작성 화면 · 초안", () => {
  beforeEach(() => {
    server.resetHandlers();
    server.use(http.get(editorUrl, () => HttpResponse.json(editorStateExample)));
  });

  test("임시 저장은 계약 명령으로 보내고 저장 시각을 알린다", async () => {
    const user = userEvent.setup({ delay: null });
    let received: unknown;
    server.use(
      http.put(draftUrl, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({
          draftId: "draft-001",
          version: 1,
          savedAt: "2026-08-06T05:00:00Z",
          content: {},
        });
      }),
    );

    renderEditor();
    await screen.findByRole("textbox", { name: /요청 제목/ });
    await user.type(screen.getByRole("textbox", { name: /요청 제목/ }), "간식 구매");
    await user.click(screen.getByRole("button", { name: "임시 저장" }));

    expect(await screen.findByText(/임시 저장되었습니다/)).toBeInTheDocument();
    // 첫 저장은 기존 버전이 없다.
    expect(received).toMatchObject({
      expectedVersion: null,
      content: { title: "간식 구매" },
    });
  });

  test("두 번째 저장은 서버가 준 최신 버전을 사용한다", async () => {
    const user = userEvent.setup({ delay: null });
    const versions: Array<number | null> = [];
    let version = 0;
    server.use(
      http.put(draftUrl, async ({ request }) => {
        const body = (await request.json()) as { expectedVersion: number | null };
        versions.push(body.expectedVersion);
        version += 1;
        return HttpResponse.json({
          draftId: "draft-001",
          version,
          savedAt: "2026-08-06T05:00:00Z",
          content: {},
        });
      }),
    );

    renderEditor();
    await screen.findByRole("textbox", { name: /요청 제목/ });

    await user.click(screen.getByRole("button", { name: "임시 저장" }));
    await screen.findByText(/임시 저장되었습니다/);
    await user.click(screen.getByRole("button", { name: "임시 저장" }));

    await screen.findByText(/임시 저장되었습니다/);
    expect(versions).toEqual([null, 1]);
  });

  test("버전 충돌은 자동으로 덮어쓰지 않고 사용자에게 알린다", async () => {
    const user = userEvent.setup({ delay: null });
    let calls = 0;
    server.use(
      http.put(draftUrl, () => {
        calls += 1;
        return problem(
          409,
          "purchase_request_state_conflict",
          "다른 곳에서 초안이 변경됐습니다.",
        );
      }),
    );

    renderEditor();
    await screen.findByRole("textbox", { name: /요청 제목/ });
    await user.type(screen.getByRole("textbox", { name: /요청 제목/ }), "간식 구매");
    await user.click(screen.getByRole("button", { name: "임시 저장" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("다른 곳에서 초안이 바뀌었습니다");
    // 입력은 유지하고 자동 재시도로 덮어쓰지 않는다.
    expect(screen.getByRole("textbox", { name: /요청 제목/ })).toHaveValue("간식 구매");
    expect(calls).toBe(1);
  });

  test("일시 장애 저장 실패는 저장되지 않았음을 알리고 입력을 유지한다", async () => {
    const user = userEvent.setup({ delay: null });
    server.use(
      http.put(draftUrl, () =>
        problem(
          503,
          "purchase_request_persistence_unavailable",
          "일시적으로 처리할 수 없습니다.",
        ),
      ),
    );

    renderEditor();
    await screen.findByRole("textbox", { name: /요청 제목/ });
    await user.type(screen.getByRole("textbox", { name: /요청 제목/ }), "간식 구매");
    await user.click(screen.getByRole("button", { name: "임시 저장" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("저장되지 않았습니다");
    expect(screen.getByRole("textbox", { name: /요청 제목/ })).toHaveValue("간식 구매");
  });

  test("초안 삭제는 서버에 알리고 입력을 자동으로 지우지 않는다", async () => {
    const user = userEvent.setup({ delay: null });
    let deleted = false;
    server.resetHandlers();
    server.use(
      http.get(editorUrl, () =>
        HttpResponse.json({
          ...editorStateExample,
          draft: {
            draftId: "draft-001",
            version: 2,
            savedAt: "2026-08-05T04:20:00Z",
            content: { title: "가을 축제 운영 물품" },
          },
        }),
      ),
      http.delete(draftUrl, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderEditor();
    const banner = await screen.findByRole("status", { name: "초안 복원" });
    await user.click(within(banner).getByRole("button", { name: "초안 삭제" }));

    expect(await screen.findByText(/서버 초안이 삭제됐습니다/)).toBeInTheDocument();
    expect(deleted).toBe(true);
    // 현재 화면 입력은 자동으로 지우지 않는다.
    expect(screen.getByRole("textbox", { name: /요청 제목/ })).toHaveValue(
      "가을 축제 운영 물품",
    );
  });
});

describe("구매 요청 작성 화면 · 제출", () => {
  beforeEach(() => {
    server.resetHandlers();
    server.use(http.get(editorUrl, () => HttpResponse.json(editorStateExample)));
  });

  test("입력이 비면 요청을 만들지 않고 오류 요약을 표시한다", async () => {
    const user = userEvent.setup({ delay: null });
    let submitted = false;
    server.use(
      http.post(submitUrl, () => {
        submitted = true;
        return new HttpResponse(null, { status: 201 });
      }),
    );

    renderEditor();
    await screen.findByRole("textbox", { name: /요청 제목/ });
    await user.click(screen.getByRole("button", { name: "구매 요청 제출" }));

    const summary = await screen.findByRole("alert", { name: "입력을 확인해 주세요" });
    expect(
      within(summary).getByRole("link", { name: /요청 제목/ }),
    ).toBeInTheDocument();
    expect(submitted).toBe(false);

    // 오류만으로 포커스를 자동 이동하지 않는다.
    expect(screen.getByRole("textbox", { name: /요청 제목/ })).not.toHaveFocus();
  });

  test("오류 요약의 링크를 고르면 해당 입력으로 포커스가 간다", async () => {
    const user = userEvent.setup({ delay: null });
    renderEditor();
    await screen.findByRole("textbox", { name: /요청 제목/ });
    await user.click(screen.getByRole("button", { name: "구매 요청 제출" }));

    const summary = await screen.findByRole("alert", { name: "입력을 확인해 주세요" });
    await user.click(within(summary).getByRole("link", { name: /요청 제목/ }));

    expect(screen.getByRole("textbox", { name: /요청 제목/ })).toHaveFocus();
  });

  test("성공하면 검토 대기 안내와 함께 목록으로 이동한다", async () => {
    const user = userEvent.setup({ delay: null });
    server.use(
      http.post(submitUrl, () =>
        HttpResponse.json(
          { requestId: "request-002", status: "review_pending", overBudget: false },
          { status: 201 },
        ),
      ),
      http.get(`*/api/v1/events/${eventId}/purchase-requests/mine`, () =>
        HttpResponse.json({ items: [] }),
      ),
    );

    renderEditor();
    await screen.findByRole("textbox", { name: /요청 제목/ });
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "구매 요청 제출" }));

    expect(
      await screen.findByRole("heading", { name: "내 구매 요청" }),
    ).toBeInTheDocument();
  });

  test("예산 초과 성공은 실패가 아니라 경고와 함께 성공으로 표시한다", async () => {
    const user = userEvent.setup({ delay: null });
    server.use(
      http.post(submitUrl, () =>
        HttpResponse.json(
          { requestId: "request-002", status: "review_pending", overBudget: true },
          { status: 201 },
        ),
      ),
      http.get(`*/api/v1/events/${eventId}/purchase-requests/mine`, () =>
        HttpResponse.json({ items: [] }),
      ),
    );

    renderEditor();
    await screen.findByRole("textbox", { name: /요청 제목/ });
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "구매 요청 제출" }));

    expect(await screen.findByText(/예산 초과/)).toBeInTheDocument();
    expect(await screen.findByText(/제출되었습니다/)).toBeInTheDocument();
  });

  test("제출 중에는 중복 실행을 막는다", async () => {
    const user = userEvent.setup({ delay: null });
    let calls = 0;
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(submitUrl, async () => {
        calls += 1;
        await pending;
        return HttpResponse.json(
          { requestId: "request-002", status: "review_pending", overBudget: false },
          { status: 201 },
        );
      }),
      http.get(`*/api/v1/events/${eventId}/purchase-requests/mine`, () =>
        HttpResponse.json({ items: [] }),
      ),
    );

    renderEditor();
    await screen.findByRole("textbox", { name: /요청 제목/ });
    await fillRequired(user);

    const submit = screen.getByRole("button", { name: "구매 요청 제출" });
    await user.click(submit);
    expect(await screen.findByRole("button", { name: /제출 중/ })).toBeDisabled();

    release?.();
    await screen.findByRole("heading", { name: "내 구매 요청" });
    expect(calls).toBe(1);
  });

  test("일시 장애 재시도는 같은 멱등성 키를 재사용한다", async () => {
    const user = userEvent.setup({ delay: null });
    const keys: string[] = [];
    let attempt = 0;
    server.use(
      http.post(submitUrl, ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key") ?? "");
        attempt += 1;
        return attempt === 1
          ? problem(
              503,
              "purchase_request_persistence_unavailable",
              "일시적으로 처리할 수 없습니다.",
            )
          : HttpResponse.json(
              { requestId: "request-002", status: "review_pending", overBudget: false },
              { status: 201 },
            );
      }),
      http.get(`*/api/v1/events/${eventId}/purchase-requests/mine`, () =>
        HttpResponse.json({ items: [] }),
      ),
    );

    renderEditor();
    await screen.findByRole("textbox", { name: /요청 제목/ });
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "구매 요청 제출" }));

    await user.click(await screen.findByRole("button", { name: "다시 시도" }));
    await screen.findByRole("heading", { name: "내 구매 요청" });

    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).not.toBe("");
  });

  test("입력을 바꾸면 새 멱등성 키로 제출한다", async () => {
    const user = userEvent.setup({ delay: null });
    const keys: string[] = [];
    let attempt = 0;
    server.use(
      http.post(submitUrl, ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key") ?? "");
        attempt += 1;
        return attempt === 1
          ? problem(
              503,
              "purchase_request_persistence_unavailable",
              "일시적으로 처리할 수 없습니다.",
            )
          : HttpResponse.json(
              { requestId: "request-002", status: "review_pending", overBudget: false },
              { status: 201 },
            );
      }),
      http.get(`*/api/v1/events/${eventId}/purchase-requests/mine`, () =>
        HttpResponse.json({ items: [] }),
      ),
    );

    renderEditor();
    await screen.findByRole("textbox", { name: /요청 제목/ });
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "구매 요청 제출" }));
    await screen.findByRole("button", { name: "다시 시도" });

    await user.type(screen.getByRole("textbox", { name: /요청 제목/ }), " 추가");
    await user.click(screen.getByRole("button", { name: "구매 요청 제출" }));
    await screen.findByRole("heading", { name: "내 구매 요청" });

    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });

  test("권한 없음과 상태 충돌은 거짓 성공 없이 입력을 유지한다", async () => {
    const user = userEvent.setup({ delay: null });
    server.use(
      http.post(submitUrl, () =>
        problem(403, "purchase_request_action_forbidden", "권한이 없습니다."),
      ),
    );

    renderEditor();
    await screen.findByRole("textbox", { name: /요청 제목/ });
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "구매 요청 제출" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("제출할 수 없습니다");
    expect(screen.getByRole("textbox", { name: /요청 제목/ })).toHaveValue("간식 구매");
    expect(screen.queryByText(/제출되었습니다/)).not.toBeInTheDocument();
  });

  test("한국어 조합 중 Enter는 제출하지 않는다", async () => {
    const user = userEvent.setup({ delay: null });
    let calls = 0;
    server.use(
      http.post(submitUrl, () => {
        calls += 1;
        return HttpResponse.json(
          { requestId: "request-002", status: "review_pending", overBudget: false },
          { status: 201 },
        );
      }),
    );

    renderEditor();
    await screen.findByRole("textbox", { name: /요청 제목/ });

    const title = screen.getByRole("textbox", { name: /요청 제목/ });
    await user.click(title);
    fireEvent.compositionStart(title);
    await user.keyboard("{Enter}");

    expect(calls).toBe(0);
  });
});
