import { http, HttpResponse } from "msw";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";

import { AppProviders, createAppRuntime } from "../../../app/runtime";
import { server } from "../../../mocks/server";
import type { MemberRoleRow, MemberRoles } from "./query";

const path = "/organization/roles";
const listUrl = "*/organization/member-roles";
const changeUrl = "*/organization/memberships/:membershipId/role";

function problem(status: number, code: string, title: string) {
  return HttpResponse.json(
    { type: `urn:vada:error:${code}`, title, status, code },
    { status, headers: { "content-type": "application/problem+json" } },
  );
}

function row(overrides: Partial<MemberRoleRow> = {}): MemberRoleRow {
  return {
    membershipId: "membership-president",
    displayName: "박해랑",
    departments: ["기획부"],
    role: "president",
    ...overrides,
  };
}

function serve(members: MemberRoleRow[]) {
  const body: MemberRoles = { members };
  server.use(http.get(listUrl, () => HttpResponse.json(body)));
}

function renderScreen() {
  render(<AppProviders runtime={createAppRuntime({ initialPath: path })} />);
}

async function tableRows() {
  const table = await screen.findByRole("table", { name: "구성원 기본 역할" });
  return within(table).getAllByRole("row").slice(1);
}

describe("역할 및 권한 관리 화면", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  test("로딩 중에는 샘플 명단 대신 진행 상태만 알린다", async () => {
    server.use(http.get(listUrl, () => new Promise(() => {})));
    renderScreen();

    expect(await screen.findByText(/구성원 명단을 불러오는 중/)).toHaveAttribute(
      "role",
      "status",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  test("구성원과 기본 역할을 서버 순서대로 표시한다", async () => {
    serve([row(), row({ membershipId: "membership-a", displayName: "김도윤", role: "member" })]);
    renderScreen();

    const rows = await tableRows();
    expect(within(rows[0]).getByText("박해랑")).toBeInTheDocument();
    // 배지와 드롭다운 둘 다 역할을 말한다. 지금 값은 드롭다운이 갖는다.
    expect(within(rows[0]).getByRole("combobox", { name: /박해랑 기본 역할/ })).toHaveTextContent(
      "회장단",
    );
  });

  test("부서가 없는 구성원을 빈 칸이 아니라 미배정으로 적는다", async () => {
    // 빈 칸으로 두면 빠진 것처럼 보인다. 미배정도 조직의 구성원이다.
    serve([row({ membershipId: "membership-b", displayName: "이서준", departments: [], role: "member" })]);
    renderScreen();

    const [only] = await tableRows();
    expect(within(only).getByText("미배정")).toBeInTheDocument();
  });

  test("역할을 바꾸면 화면이 본 현재 값을 함께 보낸다", async () => {
    // 낙관적 잠금이다. 서버가 그 값으로 덮어쓸지 말지 정한다.
    const user = userEvent.setup();
    const sent: unknown[] = [];
    serve([row({ membershipId: "membership-a", displayName: "김도윤", role: "member" })]);
    server.use(
      http.put(changeUrl, async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json({ members: [] });
      }),
    );
    renderScreen();

    await user.click(await screen.findByRole("combobox", { name: /김도윤 기본 역할/ }));
    const list = await screen.findByRole("listbox");
    await user.click(within(list).getByRole("option", { name: "부서장" }));

    expect(sent).toEqual([{ role: "department_head", expectedCurrentRole: "member" }]);
  });

  test("마지막 회장단 보호와 경합을 같은 안내로 알린다", async () => {
    // 요청자가 할 일은 둘 다 다시 읽는 것으로 같다.
    const user = userEvent.setup();
    serve([row()]);
    server.use(
      http.put(changeUrl, () =>
        problem(409, "ORGANIZATION_LAST_PRESIDENT_PROTECTED", "마지막 회장단입니다."),
      ),
    );
    renderScreen();

    await user.click(await screen.findByRole("combobox", { name: /박해랑 기본 역할/ }));
    const list = await screen.findByRole("listbox");
    await user.click(within(list).getByRole("option", { name: "부원" }));

    expect(await screen.findAllByText("그 사이 역할이 바뀌었습니다.")).not.toHaveLength(0);
  });

  test("권한이 없으면 다른 조직 데이터의 존재를 드러내지 않는다", async () => {
    server.use(
      http.get(listUrl, () =>
        problem(403, "ORGANIZATION_ACTION_FORBIDDEN", "권한이 없습니다."),
      ),
    );
    renderScreen();

    expect(
      await screen.findAllByText("구성원 명단을 볼 수 없습니다."),
    ).not.toHaveLength(0);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  test("일시 장애에는 명단을 지어내지 않는다", async () => {
    server.use(
      http.get(listUrl, () =>
        problem(503, "ORGANIZATION_PERSISTENCE_UNAVAILABLE", "일시 장애"),
      ),
    );
    renderScreen();

    expect(
      await screen.findAllByText("구성원 명단을 일시적으로 불러오지 못했습니다."),
    ).not.toHaveLength(0);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  test("구성원이 없으면 빈 결과를 알린다", async () => {
    serve([]);
    renderScreen();

    expect(await screen.findByText(/아직 이 학생회에 구성원이 없습니다/)).toHaveAttribute(
      "role",
      "status",
    );
  });
});
