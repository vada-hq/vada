import { expect, test, type Page } from "@playwright/test";

/**
 * 화면 전부를 진짜 브라우저에서 한 번씩 연다.
 *
 * 여기 있는 검사는 화면마다 다르지 않다. **jsdom이 원리적으로 볼 수 없는 것**
 * 셋만 본다. 화면별 세부는 각자 spec이 갖는다.
 *
 *   1. 화면이 실제로 그려지는가 — 목이 꺼져 있으면 오류 없이 비기만 한다
 *   2. 본문이 가로로 넘치지 않는가 — jsdom은 폭을 계산하지 않는다
 *   3. 드롭다운이 눌리는가 — jsdom은 히트 테스트가 없어 가려져도 클릭이 성공한다
 *
 * 이 표가 `just validate-screens`가 요구하는 화면 목록과 짝을 이룬다. 화면
 * 정본을 새로 쓰면 여기 한 줄이 늘어야 검증이 통과한다.
 */

const EVENT = "event-001";
const REQUEST = "request-001";

const SCREENS = [
  { id: "ORG04B", path: "/organization/roles", landmark: "역할 및 권한 관리" },
  { id: "EVTFIN01", path: `/events/${EVENT}/finance`, landmark: "행사 재정" },
  {
    id: "MYREQ01",
    path: `/events/${EVENT}/purchase-requests/mine`,
    landmark: "내 구매 요청",
  },
  {
    id: "FINREQ01",
    path: `/events/${EVENT}/purchase-requests/new`,
    landmark: "구매 요청서 작성",
  },
  {
    id: "FINREQ02",
    path: `/events/${EVENT}/purchase-requests/${REQUEST}`,
    landmark: "가을 축제 운영 물품",
  },
  {
    id: "FINREV01",
    path: `/events/${EVENT}/purchase-requests/${REQUEST}/review`,
    landmark: "가을 축제 운영 물품",
  },
  {
    id: "FINSUP01",
    path: `/events/${EVENT}/purchase-requests/${REQUEST}/revision`,
    landmark: "보완 요청 확인·재제출",
  },
] as const;

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
}

for (const screen of SCREENS) {
  test.describe(`${screen.id}`, () => {
    test("열리고, 가로로 넘치지 않고, 드롭다운이 눌린다", async ({ page }) => {
      await page.goto(screen.path);

      // 1. 그려진다. 목이 꺼지면 오류 없이 비기만 하므로 이것부터 본다.
      await expect(
        page.getByText(screen.landmark, { exact: false }).first(),
      ).toBeVisible({ timeout: 15_000 });

      // 2. 본문이 가로로 넘치지 않는다. 데스크탑 우선이라도 넘치면 안 된다.
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

      // 3. 드롭다운이 있으면 눌려야 한다. 열리는 것과 눌리는 것은 다르다 —
      //    실제로 팝업 대화상자가 목록의 클릭을 가로채고 있던 화면이 있었다.
      const combobox = page.getByRole("combobox").first();
      if ((await combobox.count()) === 0) return;

      await combobox.click();
      const list = page.getByRole("listbox");
      await expect(list).toBeVisible();

      const option = list.getByRole("option").first();
      await option.click();
      await expect(list).toBeHidden();
    });
  });
}
