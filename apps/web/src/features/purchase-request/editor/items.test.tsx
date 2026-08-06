import { http, HttpResponse } from "msw";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

function renderEditor() {
  render(<AppProviders runtime={createAppRuntime({ initialPath: editorPath })} />);
}

async function itemCards() {
  // 작성 폼이 열린 뒤에야 품목 목록이 있다.
  await screen.findByRole("heading", { name: "구매 요청서 작성" });
  const list = await screen.findByRole("list", { name: "품목 리스트" });
  return within(list).getAllByRole("listitem");
}

describe("구매 요청 작성 화면 · 품목", () => {
  beforeEach(() => {
    server.resetHandlers();
    server.use(http.get(editorUrl, () => HttpResponse.json(editorStateExample)));
  });

  test("빈 상태에서 품목 하나로 시작한다", async () => {
    renderEditor();

    const items = await itemCards();
    expect(items).toHaveLength(1);
    expect(screen.getByText("총 1개 품목")).toBeInTheDocument();
  });

  test("품목을 추가하고 삭제할 수 있다", async () => {
    const user = userEvent.setup();
    renderEditor();

    await itemCards();
    await user.click(screen.getByRole("button", { name: "품목 추가" }));
    expect(await itemCards()).toHaveLength(2);
    expect(screen.getByText("총 2개 품목")).toBeInTheDocument();

    const second = (await itemCards())[1];
    await user.click(within(second).getByRole("button", { name: "품목 2 삭제" }));
    expect(await itemCards()).toHaveLength(1);
  });

  test("품목이 하나뿐이면 삭제할 수 없다", async () => {
    renderEditor();

    const [only] = await itemCards();
    expect(within(only).getByRole("button", { name: "품목 1 삭제" })).toBeDisabled();
  });

  test("계약의 네 구매 유형을 모두 제공한다", async () => {
    const user = userEvent.setup();
    renderEditor();

    const [first] = await itemCards();
    const type = within(first).getByRole("combobox", { name: /구매 유형/ });

    await user.click(type);
    const listbox = await screen.findByRole("listbox");
    // 선택 표시가 이름에 붙으므로 항목별로 확인한다.
    expect(within(listbox).getAllByRole("option")).toHaveLength(4);
    for (const label of ["일반 구매", "제작·인쇄", "대여", "용역"]) {
      expect(
        within(listbox).getByRole("option", { name: new RegExp(label) }),
      ).toBeInTheDocument();
    }
  });

  test("수량과 단가에서 품목 총액과 전체 예상 금액을 계산한다", async () => {
    const user = userEvent.setup();
    renderEditor();

    const [first] = await itemCards();
    await user.type(within(first).getByRole("spinbutton", { name: /수량/ }), "2");
    await user.type(
      within(first).getByRole("spinbutton", { name: /예상 단가/ }),
      "15000",
    );

    expect(within(first).getByText("30,000원")).toBeInTheDocument();

    const summary = screen.getByRole("complementary", { name: "요청 요약" });
    expect(within(summary).getByText("30,000원")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "품목 추가" }));
    const second = (await itemCards())[1];
    await user.type(within(second).getByRole("spinbutton", { name: /수량/ }), "1");
    await user.type(
      within(second).getByRole("spinbutton", { name: /예상 단가/ }),
      "360000",
    );

    expect(within(summary).getByText("390,000원")).toBeInTheDocument();
    expect(within(summary).getByText("2개")).toBeInTheDocument();
  });

  test("일반 구매는 상품 URL과 판매처를 가격 근거로 요구한다", async () => {
    renderEditor();

    const [first] = await itemCards();
    // 기본 유형은 일반 구매다.
    expect(within(first).getByRole("textbox", { name: /상품 URL/ })).toBeInTheDocument();
    expect(
      within(first).getByRole("textbox", { name: /판매처 또는 쇼핑몰/ }),
    ).toBeInTheDocument();
    expect(
      within(first).queryByRole("textbox", { name: /견적 메모/ }),
    ).not.toBeInTheDocument();
  });

  test("제작·인쇄를 고르면 제작 상세 입력으로 바뀐다", async () => {
    const user = userEvent.setup();
    renderEditor();

    const [first] = await itemCards();
    await user.click(within(first).getByRole("combobox", { name: /구매 유형/ }));
    await user.click(await screen.findByRole("option", { name: "제작·인쇄" }));

    expect(
      within(first).getByRole("textbox", { name: /제작물 종류/ }),
    ).toBeInTheDocument();
    expect(
      within(first).getByRole("textbox", { name: /사이즈 또는 규격/ }),
    ).toBeInTheDocument();
    // 일반 구매 전용 입력은 사라진다.
    expect(
      within(first).queryByRole("textbox", { name: /상품 URL/ }),
    ).not.toBeInTheDocument();
    // 일반 구매가 아닌 유형은 업체 견적 근거를 요구한다.
    expect(within(first).getByRole("textbox", { name: /견적 메모/ })).toBeInTheDocument();
  });

  test("대여와 용역은 기간과 장소 상세를 제공한다", async () => {
    const user = userEvent.setup();
    renderEditor();

    const [first] = await itemCards();
    await user.click(within(first).getByRole("combobox", { name: /구매 유형/ }));
    await user.click(await screen.findByRole("option", { name: "대여" }));

    expect(
      within(first).getByRole("textbox", { name: /업체 또는 제공자/ }),
    ).toBeInTheDocument();
    expect(within(first).getByLabelText(/시작 일시/)).toBeInTheDocument();
    expect(within(first).getByLabelText(/종료 일시/)).toBeInTheDocument();
  });

  test("구매 유형을 바꾸면 이전 유형의 상세 입력을 남기지 않는다", async () => {
    const user = userEvent.setup();
    renderEditor();

    const [first] = await itemCards();
    await user.type(
      within(first).getByRole("textbox", { name: /상품 URL/ }),
      "https://vendor.example/item",
    );

    await user.click(within(first).getByRole("combobox", { name: /구매 유형/ }));
    await user.click(await screen.findByRole("option", { name: "용역" }));
    await user.click(within(first).getByRole("combobox", { name: /구매 유형/ }));
    await user.click(await screen.findByRole("option", { name: "일반 구매" }));

    expect(within(first).getByRole("textbox", { name: /상품 URL/ })).toHaveValue("");
  });

  test("계약에 없는 견적서 확보 상태를 제공하지 않는다", async () => {
    renderEditor();

    await itemCards();
    for (const label of ["미요청", "요청 중", "수령 완료"]) {
      expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
    }
  });

  test("서버 초안의 품목을 복원한다", async () => {
    server.resetHandlers();
    server.use(
      http.get(editorUrl, () =>
        HttpResponse.json({
          ...editorStateExample,
          draft: {
            draftId: "draft-001",
            version: 2,
            savedAt: "2026-08-05T04:20:00Z",
            content: {
              items: [
                {
                  name: "명찰 케이스",
                  purchaseType: "general",
                  quantity: 2,
                  unit: "세트",
                  estimatedUnitPrice: 15000,
                },
              ],
            },
          },
        }),
      ),
    );

    renderEditor();

    const [first] = await itemCards();
    expect(within(first).getByRole("textbox", { name: /품목명/ })).toHaveValue(
      "명찰 케이스",
    );
    expect(within(first).getByText("30,000원")).toBeInTheDocument();
  });
});
