import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * 구매 요청 작성 팝업을 진짜 브라우저에서 본다.
 *
 * 여기 있는 검사는 전부 jsdom이 볼 수 없는 것들이다. 사람이 브라우저를 열고
 * 처음 찾아낸 결함이 넷이었고, 그때 화면 단위 테스트 스물몇 건은 전부 초록이었다.
 */

const EDITOR = "/events/event-001/purchase-requests/new";

async function openEditor(page: Page) {
  await page.goto(EDITOR);
  await expect(page.getByRole("dialog", { name: "구매 요청서 작성" })).toBeVisible();
}

function field(page: Page, label: string | RegExp): Locator {
  return page.getByRole("textbox", { name: label });
}

test.describe("드롭다운", () => {
  test("팝업 안에서도 열리고 고를 수 있다", async ({ page }) => {
    // jsdom에는 z-index도 히트 테스트도 없어 클릭이 항상 성공한다. 팝업 위에
    // 팝업을 띄우는 이 자리는 브라우저에서만 사실이 갈린다.
    await openEditor(page);

    const priority = page.getByRole("combobox", { name: /우선순위/ });
    await priority.click();

    const list = page.getByRole("listbox");
    await expect(list).toBeVisible();
    await list.getByRole("option", { name: "긴급" }).click();

    await expect(priority).toHaveText(/긴급/);
  });

  test("품목의 드롭다운도 골라진다", async ({ page }) => {
    // 보이는 것과 눌리는 것은 다르다. 처음 이 검사는 보이는 것만 봐서 통과했다.
    await openEditor(page);

    const category = page.getByRole("combobox", { name: /품목 카테고리/ }).first();
    await category.click();
    await page.getByRole("listbox").getByRole("option", { name: "인쇄물" }).click();

    await expect(category).toHaveText(/인쇄물/);
  });
});

test.describe("필요한 날짜", () => {
  test("오늘 이전은 제출되지 않는다", async ({ page }) => {
    // 흐름 정본 FLOW-FIN-001 STEP-02: 오늘 이전 필요일을 허용하지 않는다.
    await openEditor(page);

    await field(page, /요청 제목/).fill("과거 날짜 확인");
    await page.getByLabel(/필요한 날짜/).fill("2023-02-02");
    await field(page, /구매 목적/).fill("확인용");

    await page.getByRole("button", { name: "구매 요청 제출" }).click();

    await expect(page.getByText(/지난 날짜|오늘 이후|이전 날짜/)).toBeVisible();
  });

  test("입력칸 자체가 과거를 막는다", async ({ page }) => {
    // 제출까지 가서야 알려주면 다 채운 뒤에 되돌아온다. 브라우저가 먼저 막게 한다.
    await openEditor(page);

    const neededDate = page.getByLabel(/필요한 날짜/);
    await expect(neededDate).toHaveAttribute("min", /^\d{4}-\d{2}-\d{2}$/);
  });
});

test.describe("숫자 입력칸", () => {
  test("수량에 문자를 넣어도 값이 조용히 사라지지 않는다", async ({ page }) => {
    // type=number는 e·E·+·-를 타이핑은 허용하고 value는 빈 문자열로 준다.
    // 그래서 사람은 글자가 보이는데 화면은 "입력해 주세요"라고 말한다.
    await openEditor(page);

    const quantity = page.getByRole("textbox", { name: /수량/ }).first();
    await quantity.fill("12e3");

    await expect(quantity).toHaveValue("123");
  });

  test("예상 단가도 숫자만 남는다", async ({ page }) => {
    await openEditor(page);

    const price = page.getByRole("textbox", { name: /예상 단가/ }).first();
    await price.fill("1e2abc0");

    await expect(price).toHaveValue("120");
  });
});

test.describe("나란한 입력칸", () => {
  test("한쪽에 설명문이 붙어도 높이가 어긋나지 않는다", async ({ page }) => {
    // 요청 부서에만 설명문이 있다. 그 때문에 옆 칸의 높이가 달라지면 안 된다.
    await openEditor(page);

    const title = field(page, /요청 제목/);
    const department = page.getByRole("textbox", { name: /요청 부서/ });

    const titleBox = await title.boundingBox();
    const departmentBox = await department.boundingBox();
    expect(titleBox).not.toBeNull();
    expect(departmentBox).not.toBeNull();

    expect(Math.abs(titleBox!.height - departmentBox!.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(titleBox!.y - departmentBox!.y)).toBeLessThanOrEqual(1);
  });
});
