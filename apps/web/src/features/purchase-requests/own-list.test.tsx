import { http, HttpResponse } from "msw";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";

import { AppProviders, createAppRuntime } from "../../app/runtime";
import {
  detailViewExample,
  ownListExample,
  sampleEventId,
} from "../../mocks/purchase-request-fixtures";
import { server } from "../../mocks/server";

const eventId = sampleEventId;
const ownListPath = `/events/${eventId}/purchase-requests/mine`;
const ownListUrl = `*${ownListPath}`;

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
  const table = await screen.findByRole("table", { name: "본인 구매 요청" });
  return within(table).getAllByRole("row").slice(1);
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

    // 명세 R3는 로딩과 빈 결과를 모두 status로 전달하도록 요구한다.
    const empty = await screen.findByText("아직 제출한 구매 요청이 없습니다.");
    expect(empty).toHaveAttribute("role", "status");
    expect(screen.queryByRole("table", { name: "본인 구매 요청" })).not.toBeInTheDocument();
  });

  test("생성 시각 내림차순으로 요청 식별자·상태·총액·예산 초과·생성 시각을 표시한다", async () => {
    server.use(http.get(ownListUrl, () => HttpResponse.json(ownListExample)));

    renderOwnList();

    const items = await listItems();
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("가을 축제 운영 물품");
    expect(items[1]).toHaveTextContent("여름 행사 준비 물품");

    const [newest, oldest] = items;
    // 명세 R3의 OWN-LIST-CONTENT는 각 행에 요청 식별자를 요구한다.
    expect(within(newest).getByText("request-001")).toBeInTheDocument();
    expect(within(newest).getByText("검토 대기")).toBeInTheDocument();
    expect(within(newest).getByText("390,000원")).toBeInTheDocument();
    expect(within(newest).getByText("2026-08-03")).toBeInTheDocument();
    expect(within(newest).queryByText("예산 초과")).not.toBeInTheDocument();

    expect(within(oldest).getByText("request-000")).toBeInTheDocument();
    expect(within(oldest).getByText("예산 초과")).toBeInTheDocument();
  });

  test("와이어프레임 위계대로 열 머리글을 가진 표로 표시한다", async () => {
    server.use(http.get(ownListUrl, () => HttpResponse.json(ownListExample)));

    renderOwnList();

    const table = await screen.findByRole("table", { name: "본인 구매 요청" });
    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual([
      "요청 번호",
      "요청 제목",
      "요청액",
      "요청일",
      "상태",
    ]);

    // 목록 계약에 없는 열은 두지 않는다.
    expect(within(table).queryByText("품목 수")).not.toBeInTheDocument();
    expect(within(table).queryByText("필요한 날짜")).not.toBeInTheDocument();
  });

  test("머리말에 범위 설명과 새 구매 요청 행동 자리를 둔다", async () => {
    server.use(http.get(ownListUrl, () => HttpResponse.json(ownListExample)));

    renderOwnList();

    expect(
      await screen.findByRole("heading", { name: "내 구매 요청" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("이 행사에서 내가 제출한 구매 요청"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "행사 재정으로 돌아가기" }),
    ).toBeInTheDocument();
  });

  test("계약에 없는 상태를 전제하는 요약 통계 카드를 두지 않는다", async () => {
    server.use(http.get(ownListUrl, () => HttpResponse.json(ownListExample)));

    renderOwnList();

    await listItems();
    for (const label of ["보완 필요", "승인 완료", "구매 진행", "처리 완료"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  test("각 요청을 키보드로 선택해 상세 경로로 이동한다", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(ownListUrl, () => HttpResponse.json(ownListExample)),
      http.get(`*/events/${eventId}/purchase-requests/request-001`, () =>
        HttpResponse.json(detailViewExample),
      ),
    );

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
      await screen.findByRole("heading", { name: "가을 축제 운영 물품" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2026 가을 축제")).toBeInTheDocument();
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
    const retryResult = await screen.findByText("목록을 다시 불러왔습니다.");
    expect(retryResult).toHaveAttribute("role", "status");
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
    // 인증 필요 상태에도 복귀 행동을 키보드로 제공해야 한다. 머리말 링크가 유지된다.
    expect(
      screen.getByRole("link", { name: "행사 재정으로 돌아가기" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "본인 구매 요청" })).not.toBeInTheDocument();
    expect(screen.queryByText("가을 축제 운영 물품")).not.toBeInTheDocument();
  });
});
