import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";

import { checkWireframeSync, countScreens, sha256 } from "./check-wireframe-sync.mjs";

const APP = `const SCREENS = [
  { id: "MY-REQ-01", label: "내 구매 요청", group: "재정" },
  { id: "FIN-REQ-01B", label: "구매 요청 작성", group: "재정" },
];
`;

async function fixture({ app = APP, record = {} } = {}) {
  const root = await mkdtemp(resolve(tmpdir(), "vada-sync-"));
  await mkdir(resolve(root, "prototypes/wireframe/src/app"), { recursive: true });
  await writeFile(resolve(root, "prototypes/wireframe/src/app/App.tsx"), app, "utf8");
  await writeFile(
    resolve(root, "prototypes/wireframe/.sync.json"),
    JSON.stringify({
      imported_at: "2026-08-06",
      app_tsx_sha256: sha256(APP),
      screen_count: 2,
      ...record,
    }),
    "utf8",
  );
  return root;
}

async function shareFixture(app) {
  const share = await mkdtemp(resolve(tmpdir(), "vada-share-"));
  await mkdir(resolve(share, "src/app"), { recursive: true });
  await writeFile(resolve(share, "src/app/App.tsx"), app, "utf8");
  return share;
}

test("화면 수를 센다", () => {
  assert.equal(countScreens(APP), 2);
});

test("공유본이 기준선과 같으면 통과한다", async () => {
  const root = await fixture();
  const share = await shareFixture(APP);

  const { errors } = await checkWireframeSync(root, share);

  assert.deepEqual(errors, []);
});

test("반입하지 않은 새 공유본이 있으면 거부한다", async () => {
  const root = await fixture();
  const share = await shareFixture(
    `${APP}  { id: "NEW-01", label: "새 화면", group: "재정" },\n`,
  );

  const { errors } = await checkWireframeSync(root, share);

  assert.equal(errors.length, 1);
  assert.match(errors[0], /반입하지 않은 새 와이어프레임/);
});

test("공유본 경로가 없으면 확인하지 못했다고 알리고 통과시키지 않는다", async () => {
  const root = await fixture();

  const { errors, warnings } = await checkWireframeSync(root, null);

  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /최신 여부는 확인되지 않았습니다/);
});

test("화면이 조용히 사라지면 거부한다", async () => {
  const root = await fixture({ record: { screen_count: 3 } });

  const { errors } = await checkWireframeSync(root, null);

  assert.equal(errors.length, 1);
  assert.match(errors[0], /화면 수가 기준선과 다릅니다/);
});

test("저장소 전용 변경을 기록 없이 두면 거부한다", async () => {
  const root = await fixture({ app: `${APP}// 저장소에서만 고친 부분\n` });

  const { errors } = await checkWireframeSync(root, null);

  assert.equal(errors.length, 1);
  assert.match(errors[0], /local_changes가 비어 있습니다/);
});

test("저장소 전용 변경이 기록돼 있으면 통과하고 목록을 보여준다", async () => {
  const root = await fixture({
    app: `${APP}// 저장소에서만 고친 부분\n`,
    record: { local_changes: [{ commit: "5d04e28", summary: "작성 화면을 팝업으로" }] },
  });

  const { errors, notes } = await checkWireframeSync(root, null);

  assert.deepEqual(errors, []);
  assert.ok(notes.some((note) => note.includes("작성 화면을 팝업으로")));
});

test("기록 파일이 없으면 거부한다", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "vada-sync-none-"));

  const { errors } = await checkWireframeSync(root, null);

  assert.equal(errors.length, 1);
  assert.match(errors[0], /\.sync\.json를 읽을 수 없습니다/);
});
