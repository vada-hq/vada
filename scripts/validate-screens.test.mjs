import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { parseFrontMatter, validateScreens } from "./validate-screens.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function fixtureRoot(screens) {
  const root = await mkdtemp(resolve(tmpdir(), "vada-screens-"));
  await mkdir(resolve(root, "screens"), { recursive: true });
  await cp(
    resolve(repositoryRoot, "contracts/bundles"),
    resolve(root, "contracts/bundles"),
    { recursive: true },
  );
  await mkdir(resolve(root, "prototypes/wireframe/src/app"), { recursive: true });
  await writeFile(
    resolve(root, "prototypes/wireframe/src/app/App.tsx"),
    `const SCREENS = [\n  { id: "MY-REQ-01", label: "내 구매 요청", group: "재정" },\n];\n`,
    "utf8",
  );

  for (const [name, body] of Object.entries(screens)) {
    await writeFile(resolve(root, "screens", name), body, "utf8");
  }

  return root;
}

const validScreen = `---
id: MYREQ01
title: 내 구매 요청
wireframe: prototypes/wireframe/src/app/App.tsx
wireframe_screen: MY-REQ-01
route: /events/$eventId/purchase-requests/mine
contracts:
  - API:purchase_request.list_own@R1
status: done
---

## 화면 구조
표로 표시한다.
`;

// 나머지 검사가 전부 errors.some()이라 새 규칙이 늘어도 조용히 통과했다.
// 정상 픽스처에 오류가 하나도 없어야 한다는 것을 여기서 못 박는다.
test("유효한 화면 정본에는 오류가 하나도 없다", async () => {
  const root = await fixtureRoot({ "MYREQ01.md": validScreen });

  const { errors } = await validateScreens(root);

  assert.deepEqual(errors, []);
});

test("wireframe에 줄 번호를 쓰면 거부한다", async () => {
  const root = await fixtureRoot({
    "MYREQ01.md": validScreen.replace(
      "wireframe: prototypes/wireframe/src/app/App.tsx\n",
      "wireframe: prototypes/wireframe/src/app/App.tsx:10889\n",
    ),
  });

  const { errors } = await validateScreens(root);

  assert.ok(errors.some((error) => error.includes("줄 번호를 쓰지 않습니다")));
});

test("와이어프레임에 없는 화면 ID를 거부한다", async () => {
  const root = await fixtureRoot({
    "MYREQ01.md": validScreen.replace("MY-REQ-01", "MY-REQ-99"),
  });

  const { errors } = await validateScreens(root);

  assert.ok(errors.some((error) => error.includes("그런 화면이 없습니다")));
});

test("프런트매터의 목록과 주석을 읽는다", () => {
  const front = parseFrontMatter(validScreen);

  assert.equal(front.id, "MYREQ01");
  assert.equal(front.status, "done");
  assert.deepEqual(front.contracts, ["API:purchase_request.list_own@R1"]);
});

test("저장소의 실제 화면 정본이 유효하다", async () => {
  const { errors, files } = await validateScreens(repositoryRoot);

  assert.deepEqual(errors, []);
  assert.ok(files.length > 0);
});

test("계약에 없는 참조를 거부한다", async () => {
  const root = await fixtureRoot({
    "MYREQ01.md": validScreen.replace(
      "API:purchase_request.list_own@R1",
      "API:purchase_request.invented@R9",
    ),
  });

  const { errors } = await validateScreens(root);

  assert.ok(errors.some((error) => error.includes("계약을 찾을 수 없습니다")));
});

test("없는 와이어프레임 경로를 거부한다", async () => {
  const root = await fixtureRoot({
    "MYREQ01.md": validScreen.replace(
      "prototypes/wireframe/src/app/App.tsx",
      "prototypes/wireframe/src/app/Missing.tsx",
    ),
  });

  const { errors } = await validateScreens(root);

  assert.ok(errors.some((error) => error.includes("와이어프레임 경로가 없습니다")));
});

test("파일 이름과 다른 id를 거부한다", async () => {
  const root = await fixtureRoot({
    "MYREQ01.md": validScreen.replace("id: MYREQ01", "id: OTHER01"),
  });

  const { errors } = await validateScreens(root);

  assert.ok(errors.some((error) => error.includes("파일 이름이 id와 다릅니다")));
});

test("정의되지 않은 상태 값을 거부한다", async () => {
  const root = await fixtureRoot({
    "MYREQ01.md": validScreen.replace("status: done", "status: 완료"),
  });

  const { errors } = await validateScreens(root);

  assert.ok(errors.some((error) => error.includes("status는")));
});

test("필수 항목이 빠지면 거부한다", async () => {
  const root = await fixtureRoot({
    "MYREQ01.md": validScreen.replace(
      "route: /events/$eventId/purchase-requests/mine\n",
      "",
    ),
  });

  const { errors } = await validateScreens(root);

  assert.ok(errors.some((error) => error.includes("필수 항목이 없습니다: route")));
});
