import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validateRepository, validateSliceDocument } from "./validate-contracts.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function validSlice(overrides = {}) {
  return {
    $schema: "../schemas/slice.schema.json",
    schemaVersion: 1,
    specRevision: 1,
    id: "SL-EVT-999",
    title: "검증용 슬라이스",
    subsystem: "event",
    releaseScope: "pilot",
    status: "planned",
    outcome: "권한 보유자가 검증용 결과를 한 번의 흐름으로 완료합니다.",
    screenRefs: ["EVT-99"],
    dependsOn: [],
    changes: [],
    contractBaseline: ["AUTH:event.read@R1", "QUALITY:DoD@R1"],
    acceptanceCriteria: [
      {
        id: "SL-EVT-999/AC-01",
        name: "관찰 가능한 결과",
        contractRefs: ["AUTH:event.read@R1"],
        observableOutcome: "권한 보유자는 결과를 보고 미보유자의 요청은 거부됩니다.",
      },
    ],
    outOfScope: [
      {
        item: "검증 범위 밖의 후속 행동",
        trackedBy: "SL-EVT-001",
      },
    ],
    ...overrides,
  };
}

test("완전한 슬라이스 실행 명세를 허용한다", () => {
  assert.deepEqual(validateSliceDocument(validSlice()), []);
});

test("화면 인벤토리의 복합 화면 ID를 허용한다", () => {
  const slice = validSlice({
    screenRefs: ["EVT-DOC-01", "OPS-MEET-06A"],
  });

  assert.deepEqual(validateSliceDocument(slice), []);
});

test("사용자 결과가 없는 슬라이스를 거부한다", () => {
  const slice = validSlice();
  delete slice.outcome;

  assert.match(validateSliceDocument(slice).join("\n"), /outcome/);
});

test("담당자와 일정 같은 운영 필드를 실행 명세에 넣지 못하게 한다", () => {
  const slice = validSlice({ assignee: "agent-1", dueDate: "2026-08-01" });

  assert.match(validateSliceDocument(slice).join("\n"), /assignee|dueDate/);
});

test("완료 행동을 확장하는 후속 슬라이스 관계를 표현할 수 있다", () => {
  const slice = validSlice({
    id: "SL-EVT-998",
    changes: ["SL-EVT-001"],
    acceptanceCriteria: [
      {
        id: "SL-EVT-998/AC-01",
        name: "후속 행동",
        contractRefs: ["AUTH:event.read@R1"],
        observableOutcome: "기존 행동을 보존하면서 선택 기능을 추가합니다.",
      },
    ],
  });

  assert.deepEqual(validateSliceDocument(slice), []);
});

async function withRepositoryCopy(mutator) {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "vada-contracts-"));
  await cp(join(repositoryRoot, "contracts"), join(temporaryRoot, "contracts"), {
    recursive: true,
  });
  try {
    await mutator(temporaryRoot);
    return await validateRepository(temporaryRoot);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function updateSlice(root, sliceId, update) {
  const path = join(root, "contracts", "slices", `${sliceId}.json`);
  const slice = JSON.parse(await readFile(path, "utf8"));
  update(slice);
  await writeFile(path, `${JSON.stringify(slice, null, 2)}\n`);
}

async function updateContractFile(root, fileName, update) {
  const path = join(root, "contracts", fileName);
  const document = JSON.parse(await readFile(path, "utf8"));
  update(document);
  await writeFile(path, `${JSON.stringify(document, null, 2)}\n`);
}

async function updateJsonFile(root, relativePath, update) {
  const path = join(root, relativePath);
  const document = JSON.parse(await readFile(path, "utf8"));
  update(document);
  await writeFile(path, `${JSON.stringify(document, null, 2)}\n`);
}

test("선행 슬라이스 순환을 거부한다", async () => {
  const result = await withRepositoryCopy(async (root) => {
    await updateSlice(root, "SL-EVT-001", (slice) => {
      slice.dependsOn = ["SL-EVT-002"];
    });
  });

  assert.match(result.errors.join("\n"), /dependsOn: 순환 관계/);
});

test("검토 중 계약을 가진 슬라이스의 준비됨 전환을 거부한다", async () => {
  const result = await withRepositoryCopy(async (root) => {
    await updateSlice(root, "SL-EVT-001", (slice) => {
      slice.status = "ready";
    });
    await updateContractFile(root, "events.json", (document) => {
      const policy = document.revisions.find(
        (revision) => revision.id === "POLICY:event.creation_handoff@R1",
      );
      policy.status = "review";
      delete policy.effectiveOn;
    });
  });

  assert.match(result.errors.join("\n"), /POLICY:event\.creation_handoff@R1.*review/);
});

test("완료 슬라이스가 고정한 대체 전 계약 리비전을 역사로 보존한다", async () => {
  const result = await withRepositoryCopy(async (root) => {
    await updateSlice(root, "SL-EVT-001", (slice) => {
      slice.status = "done";
    });
    await updateContractFile(root, "permissions.json", (document) => {
      const previous = document.revisions.find(
        (revision) => revision.id === "AUTH:event.read@R1",
      );
      previous.status = "superseded";
      previous.supersededBy = "AUTH:event.read@R2";
      document.revisions.push({
        ...previous,
        id: "AUTH:event.read@R2",
        revision: 2,
        status: "active",
        changeClass: "breaking",
        effectiveOn: "2026-07-27",
      });
      delete document.revisions.at(-1).supersededBy;
    });
    await updateContractFile(root, "notion.json", (document) => {
      document.revisionPages["AUTH:event.read@R2"] =
        "https://app.notion.com/p/test-auth-event-read-r2";
    });
    await updateJsonFile(root, "contracts/openapi.json", (document) => {
      for (const pathItem of Object.values(document.paths)) {
        for (const operation of Object.values(pathItem)) {
          if (!Array.isArray(operation["x-vada-contracts"])) continue;
          operation["x-vada-contracts"] = operation["x-vada-contracts"].map(
            (reference) =>
              reference === "AUTH:event.read@R1"
                ? "AUTH:event.read@R2"
                : reference,
          );
        }
      }
    });
  });

  assert.deepEqual(result.errors, []);
});

test("현재 OpenAPI가 대체된 계약 리비전을 참조하면 거부한다", async () => {
  const result = await withRepositoryCopy(async (root) => {
    await updateContractFile(root, "permissions.json", (document) => {
      const previous = document.revisions.find(
        (revision) => revision.id === "AUTH:event.read@R1",
      );
      previous.status = "superseded";
      previous.supersededBy = "AUTH:event.read@R2";
      document.revisions.push({
        ...previous,
        id: "AUTH:event.read@R2",
        revision: 2,
        status: "active",
        changeClass: "breaking",
        effectiveOn: "2026-07-27",
      });
      delete document.revisions.at(-1).supersededBy;
    });
    await updateContractFile(root, "notion.json", (document) => {
      document.revisionPages["AUTH:event.read@R2"] =
        "https://app.notion.com/p/test-auth-event-read-r2";
    });
  });

  assert.match(
    result.errors.join("\n"),
    /GET \/events.*AUTH:event\.read@R1.*현재 API 계약으로 사용할 수 없습니다/,
  );
});

test("데이터 계약의 API 스키마 필드가 어긋나면 거부한다", async () => {
  const result = await withRepositoryCopy(async (root) => {
    await updateContractFile(root, "events.json", (document) => {
      const contract = document.revisions.find(
        (revision) => revision.id === "DATA:event.basic_info@R1",
      );
      contract.contract.schemaRef =
        "#/components/schemas/EventBasicInfo";
    });
    await updateJsonFile(root, "contracts/openapi.json", (document) => {
      delete document.components.schemas.EventBasicInfo.properties.venueName;
    });
  });

  assert.match(
    result.errors.join("\n"),
    /DATA:event\.basic_info@R1.*EventBasicInfo.*venueName/,
  );
});

test("대체 리비전은 같은 안정 계약의 더 높은 리비전을 가리켜야 한다", async () => {
  const result = await withRepositoryCopy(async (root) => {
    await updateContractFile(root, "governance.json", (document) => {
      const previous = document.revisions.find(
        (revision) => revision.id === "PROCESS:DoR@R1",
      );
      previous.supersededBy = "PROCESS:documentation@R2";
    });
  });

  assert.match(result.errors.join("\n"), /PROCESS:DoR@R1.*같은 안정 키/);
});

test("존재하지 않는 후속 변경 대상을 거부한다", async () => {
  const result = await withRepositoryCopy(async (root) => {
    await updateSlice(root, "SL-EVT-001", (slice) => {
      slice.changes = ["SL-EVT-999"];
    });
  });

  assert.match(result.errors.join("\n"), /존재하지 않는 변경 대상 SL-EVT-999/);
});

test("Notion 투영과 실행 명세의 리비전 불일치를 거부한다", async () => {
  const result = await withRepositoryCopy(async (root) => {
    await updateSlice(root, "SL-EVT-001", (slice) => {
      slice.specRevision += 1;
    });
  });

  assert.match(result.errors.join("\n"), /Notion.*명세 리비전/);
});
