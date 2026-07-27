import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const errors = [];
const warnings = [];
const supportFiles = new Set(["notion.json", "openapi.json", "vocabulary.json"]);

const sources = {
  vocabulary: "contracts/vocabulary.json",
  api: "contracts/openapi.json",
  notion: "contracts/notion.json",
};

async function readJson(relativePath) {
  try {
    return JSON.parse(await readFile(resolve(root, relativePath), "utf8"));
  } catch (error) {
    errors.push(`${relativePath}: ${error.message}`);
    return null;
  }
}

function requireValue(condition, message) {
  if (!condition) errors.push(message);
}

function contractId(contract) {
  return `${contract.kind}:${contract.key}@R${contract.revision}`;
}

async function listJsonFiles(relativeDirectory) {
  try {
    return (await readdir(resolve(root, relativeDirectory), { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => `${relativeDirectory}/${entry.name}`)
      .sort();
  } catch (error) {
    errors.push(`${relativeDirectory}: ${error.message}`);
    return [];
  }
}

const revisionPaths = (await listJsonFiles("contracts")).filter(
  (relativePath) => !supportFiles.has(relativePath.split("/").at(-1)),
);
const slicePaths = await listJsonFiles("contracts/slices");

const [loadedEntries, revisionDocuments, slices] = await Promise.all([
  Promise.all(
    Object.entries(sources).map(async ([name, relativePath]) => [
      name,
      await readJson(relativePath),
    ]),
  ),
  Promise.all(revisionPaths.map(readJson)),
  Promise.all(slicePaths.map(readJson)),
]);
const loaded = Object.fromEntries(loadedEntries);

requireValue(revisionDocuments.length > 0, "contracts/: 리비전 계약 파일이 없습니다.");
requireValue(slices.length > 0, "contracts/slices/: 슬라이스 계약 파일이 없습니다.");
revisionDocuments.forEach((document, index) => {
  requireValue(
    Array.isArray(document?.revisions),
    `${revisionPaths[index]}: revisions 배열이 없습니다.`,
  );
});

if (errors.length === 0) {
  const contracts = revisionDocuments.flatMap((document) => document.revisions);
  const contractsById = new Map();
  const currentByKey = new Map();

  for (const contract of contracts) {
    const expectedId = contractId(contract);
    requireValue(contract.id === expectedId, `${contract.id}: ID 형식은 ${expectedId}여야 합니다.`);
    requireValue(!contractsById.has(contract.id), `${contract.id}: 중복 리비전 ID입니다.`);
    requireValue(Array.isArray(contract.owners) && contract.owners.length > 0, `${contract.id}: 소유자가 없습니다.`);
    requireValue(
      ["draft", "review", "active", "superseded", "deprecated"].includes(contract.status),
      `${contract.id}: 알 수 없는 상태 ${contract.status}입니다.`,
    );
    requireValue(
      ["initial", "editorial", "additive", "breaking"].includes(contract.changeClass),
      `${contract.id}: 알 수 없는 변경 등급 ${contract.changeClass}입니다.`,
    );
    if (contract.status === "active") {
      requireValue(Boolean(contract.effectiveOn), `${contract.id}: 활성 리비전에는 적용일이 필요합니다.`);
      const logicalId = `${contract.kind}:${contract.key}`;
      requireValue(!currentByKey.has(logicalId), `${logicalId}: 활성 리비전이 둘 이상입니다.`);
      currentByKey.set(logicalId, contract.id);
    }
    if (contract.status === "superseded") {
      requireValue(Boolean(contract.supersededBy), `${contract.id}: 대체 리비전이 없습니다.`);
    }
    contractsById.set(contract.id, contract);
  }

  const subjectIds = new Set(loaded.vocabulary.authorizationSubjects.map((subject) => subject.id));
  for (const permission of contracts.filter((contract) => contract.kind === "AUTH")) {
    for (const subjectId of permission.grants ?? []) {
      requireValue(subjectIds.has(subjectId), `${permission.id}: 정의되지 않은 권한 주체 ${subjectId}입니다.`);
    }
  }

  const sliceIds = new Set(slices.map((slice) => slice.id));
  const acIds = new Set();

  for (const slice of slices) {
    const baseline = new Set(slice.contractBaseline);
    requireValue(
      baseline.size === slice.contractBaseline.length,
      `${slice.id}: 계약 기준선에 중복 리비전이 있습니다.`,
    );
    requireValue(/^SL-[A-Z]+-\d{3}$/.test(slice.id), `${slice.id}: 안정 슬라이스 ID 형식이 아닙니다.`);
    for (const dependency of slice.dependsOn ?? []) {
      requireValue(sliceIds.has(dependency), `${slice.id}: 존재하지 않는 선행 슬라이스 ${dependency}를 참조합니다.`);
      requireValue(dependency !== slice.id, `${slice.id}: 자기 자신을 선행 슬라이스로 참조합니다.`);
    }
    for (const reference of baseline) {
      const contract = contractsById.get(reference);
      requireValue(Boolean(contract), `${slice.id}: 존재하지 않는 계약 ${reference}를 참조합니다.`);
      if (contract && contract.status !== "active") {
        const message = `${slice.id}: ${reference}가 ${contract.status} 상태라 착수 준비가 끝나지 않았습니다.`;
        if (["ready", "in_progress", "done"].includes(slice.status)) errors.push(message);
        else warnings.push(message);
      }
    }

    for (const criterion of slice.acceptanceCriteria) {
      requireValue(
        criterion.id.startsWith(`${slice.id}/AC-`),
        `${criterion.id}: 슬라이스 ID를 접두사로 사용해야 합니다.`,
      );
      requireValue(!acIds.has(criterion.id), `${criterion.id}: 중복 AC ID입니다.`);
      requireValue(Boolean(criterion.observableOutcome), `${criterion.id}: 관찰 가능한 결과가 없습니다.`);
      for (const reference of criterion.contractRefs) {
        requireValue(baseline.has(reference), `${criterion.id}: 기준선에 없는 계약 ${reference}를 참조합니다.`);
      }
      acIds.add(criterion.id);
    }
  }

  for (const contract of contracts) {
    requireValue(
      Boolean(loaded.notion.revisionPages[contract.id]),
      `${contract.id}: Notion 리비전 페이지 매핑이 없습니다.`,
    );
  }
  for (const mappedId of Object.keys(loaded.notion.revisionPages)) {
    requireValue(contractsById.has(mappedId), `${mappedId}: 로컬에 없는 계약이 Notion 매핑에 남아 있습니다.`);
  }
  for (const slice of slices) {
    requireValue(
      Boolean(loaded.notion.slicePages[slice.id]),
      `${slice.id}: Notion 슬라이스 페이지 매핑이 없습니다.`,
    );
  }

  requireValue(loaded.api.openapi === "3.1.0", "contracts/openapi.json: OpenAPI 3.1.0을 사용해야 합니다.");

  const operationIds = new Set();
  const paths = loaded.api.paths ?? {};
  for (const [path, pathItem] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
      const location = `${method.toUpperCase()} ${path}`;
      requireValue(Boolean(operation.operationId), `${location}: operationId가 없습니다.`);
      requireValue(!operationIds.has(operation.operationId), `${location}: operationId가 중복됩니다.`);
      operationIds.add(operation.operationId);
      const permissionKey = operation["x-vada-permission"];
      const references = operation["x-vada-contracts"] ?? [];
      const operationAcIds = operation["x-vada-acceptance-criteria"] ?? [];
      requireValue(Boolean(permissionKey), `${location}: x-vada-permission이 없습니다.`);
      requireValue(
        contracts.some(
          (contract) =>
            contract.kind === "AUTH" &&
            contract.key === permissionKey &&
            contract.status === "active",
        ),
        `${location}: 활성 권한 계약 ${permissionKey}가 없습니다.`,
      );
      for (const reference of references) {
        requireValue(contractsById.has(reference), `${location}: 존재하지 않는 계약 ${reference}를 참조합니다.`);
      }
      for (const acId of operationAcIds) {
        requireValue(acIds.has(acId), `${location}: 존재하지 않는 AC ${acId}를 참조합니다.`);
      }
    }
  }

  function resolveLocalReference(reference) {
    if (!reference.startsWith("#/")) return true;
    return reference
      .slice(2)
      .split("/")
      .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"))
      .reduce((value, segment) => value?.[segment], loaded.api) !== undefined;
  }

  function inspectReferences(value, location = "contracts/openapi.json") {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => inspectReferences(entry, `${location}[${index}]`));
      return;
    }
    if (!value || typeof value !== "object") return;
    if (typeof value.$ref === "string") {
      requireValue(resolveLocalReference(value.$ref), `${location}: 해석할 수 없는 $ref ${value.$ref}입니다.`);
    }
    for (const [key, child] of Object.entries(value)) {
      if (key !== "$ref") inspectReferences(child, `${location}.${key}`);
    }
  }
  inspectReferences(loaded.api);
}

for (const warning of warnings) console.warn(`WARN ${warning}`);
if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exitCode = 1;
} else {
  console.log(`계약 검증 통과: 오류 0, 경고 ${warnings.length}`);
}
