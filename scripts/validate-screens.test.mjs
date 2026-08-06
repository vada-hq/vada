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
  await writeFile(resolve(root, "prototypes/wireframe/src/app/App.tsx"), "", "utf8");

  for (const [name, body] of Object.entries(screens)) {
    await writeFile(resolve(root, "screens", name), body, "utf8");
  }

  return root;
}

const validScreen = `---
id: MYREQ01
title: 내 구매 요청
wireframe: prototypes/wireframe/src/app/App.tsx:10889
route: /events/$eventId/purchase-requests/mine
contracts:
  - API:purchase_request.list_own@R1
status: done
---

## 화면 구조
표로 표시한다.
`;

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
      "prototypes/wireframe/src/app/App.tsx:10889",
      "prototypes/wireframe/src/app/Missing.tsx:1",
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
