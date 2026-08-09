import { expect, test } from "@playwright/test";

/**
 * 셸이 보여 주는 "나"를 진짜 브라우저에서 본다.
 *
 * jsdom은 이것을 볼 수 없다. DOM에 글자가 있다는 것과 **사람 눈에 보인다**는
 * 것은 다른 사실이다 — 사이드바 폭이 좁아 잘리거나, 너비 넘침으로 화면 밖으로
 * 밀려나 있어도 jsdom은 통과시킨다.
 *
 * 걷는 뼈대의 완료 기준이 바로 이 줄이다: 사람이 배포된 주소에서 자기 이름을 본다.
 */

// 목의 값이다(apps/web/src/mocks/session-fixtures.ts). 실제 데이터베이스의
// 재정부 구성원과 같은 값으로 둔다.
const NAME = "최유나";
const ORGANIZATION = "소프트웨어융합대학 학생회";

test.describe("앱 셸의 내 정보", () => {
  test("이름과 조직이 사이드바에 실제로 보인다", async ({ page }) => {
    await page.goto("/organization/roles");

    const sidebar = page.getByRole("complementary").or(page.locator("aside"));

    await expect(sidebar.getByText(NAME)).toBeVisible();
    await expect(sidebar.getByText(ORGANIZATION)).toBeVisible();
  });

  // 넘치면 `truncate`가 말줄임으로 감춘다. 감춰진 글자는 보이는 것이 아닌데
  // jsdom은 폭을 계산하지 않아 그대로 통과시킨다.
  //
  // 조직 이름이 진짜 시험대다. 사이드바는 224px이고 "소프트웨어융합대학 학생회"는
  // 짧지 않다. 이름 세 글자만 보면 이 검사는 공짜로 통과한다.
  for (const [what, text] of [
    ["이름", NAME],
    ["조직 이름", ORGANIZATION],
  ] as const) {
    test(`${what}이 사이드바 안에서 잘리지 않는다`, async ({ page }) => {
      await page.goto("/organization/roles");

      const target = page.locator("aside").getByText(text);
      await expect(target).toBeVisible();

      const clipped = await target.evaluate(
        (element) => element.scrollWidth > element.clientWidth + 1,
      );
      expect(clipped).toBe(false);
    });
  }

  // 계약 DATA:session.viewer@R1은 역할 이름을 내려보내지 않는다.
  // 없어야 하는 것은 목록이 있어야 보인다.
  test("직급을 적지 않는다", async ({ page }) => {
    await page.goto("/organization/roles");
    await expect(page.locator("aside").getByText(NAME)).toBeVisible();

    for (const label of ["회장단", "부서장", "부원"]) {
      await expect(page.locator("aside").getByText(label)).toHaveCount(0);
    }
  });
});
