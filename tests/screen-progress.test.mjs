import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readProgress } from "../apps/spec-service/src/list-figma-screens.mjs";

// 진도를 재는 눈금이 거짓말한 적이 있다. 폴더가 있으면 명세된 것으로 세다가,
// 프레임을 미리 다 받아 둔 날 85개 중 84개가 끝난 것처럼 보였다.
//
// **눈금은 손이 아니라 검사가 지킨다.** 이 파일이 없어서 그 거짓말이 살아 있었다.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WIREFRAME = join(ROOT, "specs", "figma", "vada-wireframe");

test("원본을 받은 것과 명세를 쓴 것을 가른다", async () => {
  const { fetched, specified } = await readProgress(WIREFRAME);

  assert.ok(fetched.size > 0, "받은 화면이 하나도 없습니다.");
  assert.ok(
    specified.size < fetched.size,
    "명세한 것이 받은 것과 같습니다. 미리 받아 둔 화면이 명세된 것으로 세어지고 있습니다."
  );

  // 명세로 센 것은 전부 실제로 screen.json이 있어야 한다.
  for (const screenId of specified) {
    const byFolder = join(WIREFRAME, "screens", screenId, "screen.json");
    // 폴더 이름과 screenId가 갈린 화면이 하나 있다(TASK-01). 그때는 폴더를 훑는다.
    if (existsSync(byFolder)) {
      continue;
    }
    const found = [...fetched].some((folder) =>
      existsSync(join(WIREFRAME, "screens", folder, "screen.json"))
    );
    assert.ok(found, `${screenId}를 명세로 셌는데 screen.json이 없습니다.`);
  }
});

test("받아만 둔 화면은 명세로 세지 않는다", async () => {
  const { fetched, specified } = await readProgress(WIREFRAME);

  const onlyFetched = [...fetched].filter(
    (folder) => !existsSync(join(WIREFRAME, "screens", folder, "screen.json"))
  );

  assert.ok(
    onlyFetched.length > 0,
    "받아만 둔 화면이 없습니다. 이 검사가 무엇을 지키는지 확인하세요."
  );
  for (const folder of onlyFetched) {
    assert.ok(!specified.has(folder), `${folder}는 명세가 없는데 명세로 세었습니다.`);
  }
});
