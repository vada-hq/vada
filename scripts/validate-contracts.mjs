import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import Ajv2020 from "ajv/dist/2020.js";

const defaultRoot = resolve(import.meta.dirname, "..");
const supportFiles = new Set(["notion.json", "openapi.json", "vocabulary.json"]);
const readyStatuses = new Set(["ready", "in_progress", "done"]);

const sliceSchema = JSON.parse(
  await readFile(resolve(defaultRoot, "contracts/schemas/slice.schema.json"), "utf8"),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateSliceSchema = ajv.compile(sliceSchema);

function formatSchemaError(error) {
  const location = error.instancePath || "/";
  if (error.keyword === "additionalProperties") {
    return `${location}: 허용되지 않는 필드 ${error.params.additionalProperty}`;
  }
  if (error.keyword === "required") {
    return `${location}: 필수 필드 ${error.params.missingProperty}가 없습니다.`;
  }
  return `${location}: ${error.message}`;
}

export function validateSliceDocument(slice) {
  if (validateSliceSchema(slice)) return [];
  return (validateSliceSchema.errors ?? []).map(formatSchemaError);
}

function contractId(contract) {
  return `${contract.kind}:${contract.key}@R${contract.revision}`;
}

function detectRelationCycles(slicesById, field, errors) {
  const visited = new Set();
  const visiting = new Set();
  const stack = [];
  const reported = new Set();

  function visit(sliceId) {
    if (visited.has(sliceId)) return;
    if (visiting.has(sliceId)) {
      const cycleStart = stack.indexOf(sliceId);
      const cycle = [...stack.slice(cycleStart), sliceId];
      const signature = cycle.join(" -> ");
      if (!reported.has(signature)) {
        errors.push(`${field}: 순환 관계 ${signature}`);
        reported.add(signature);
      }
      return;
    }

    const slice = slicesById.get(sliceId);
    if (!slice) return;
    visiting.add(sliceId);
    stack.push(sliceId);
    for (const reference of slice[field]) {
      if (slicesById.has(reference)) visit(reference);
    }
    stack.pop();
    visiting.delete(sliceId);
    visited.add(sliceId);
  }

  for (const sliceId of slicesById.keys()) visit(sliceId);
}

export async function validateRepository(root = defaultRoot) {
  const errors = [];
  const warnings = [];

  function requireValue(condition, message) {
    if (!condition) errors.push(message);
  }

  async function readJson(relativePath) {
    try {
      return JSON.parse(await readFile(resolve(root, relativePath), "utf8"));
    } catch (error) {
      errors.push(`${relativePath}: ${error.message}`);
      return null;
    }
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

  const sources = {
    vocabulary: "contracts/vocabulary.json",
    api: "contracts/openapi.json",
    notion: "contracts/notion.json",
  };
  const revisionPaths = (await listJsonFiles("contracts")).filter(
    (relativePath) => !supportFiles.has(relativePath.split("/").at(-1)),
  );
  const slicePaths = await listJsonFiles("contracts/slices");

  const [loadedEntries, revisionDocuments, sliceDocuments] = await Promise.all([
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
  requireValue(sliceDocuments.length > 0, "contracts/slices/: 슬라이스 실행 명세가 없습니다.");
  revisionDocuments.forEach((document, index) => {
    requireValue(
      Array.isArray(document?.revisions),
      `${revisionPaths[index]}: revisions 배열이 없습니다.`,
    );
  });

  if (errors.length > 0) return { errors, warnings };

  const validSlices = [];
  sliceDocuments.forEach((slice, index) => {
    const structureErrors = validateSliceDocument(slice);
    if (structureErrors.length > 0) {
      structureErrors.forEach((error) => errors.push(`${slicePaths[index]}${error}`));
      return;
    }
    validSlices.push(slice);
  });

  const contracts = revisionDocuments.flatMap((document) => document.revisions);
  const contractsById = new Map();
  const currentByKey = new Map();

  for (const contract of contracts) {
    const expectedId = contractId(contract);
    requireValue(contract.id === expectedId, `${contract.id}: ID 형식은 ${expectedId}여야 합니다.`);
    requireValue(!contractsById.has(contract.id), `${contract.id}: 중복 리비전 ID입니다.`);
    requireValue(
      Array.isArray(contract.owners) && contract.owners.length > 0,
      `${contract.id}: 소유자가 없습니다.`,
    );
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

  for (const contract of contracts.filter(
    (candidate) => candidate.status === "superseded",
  )) {
    const replacement = contractsById.get(contract.supersededBy);
    requireValue(
      Boolean(replacement),
      `${contract.id}: 대체 리비전 ${contract.supersededBy}가 존재하지 않습니다.`,
    );
    if (!replacement) continue;
    requireValue(
      replacement.kind === contract.kind && replacement.key === contract.key,
      `${contract.id}: 대체 리비전은 같은 안정 키를 사용해야 합니다.`,
    );
    requireValue(
      replacement.revision > contract.revision,
      `${contract.id}: 대체 리비전 번호는 현재 리비전보다 커야 합니다.`,
    );
  }

  const subjectIds = new Set(loaded.vocabulary.authorizationSubjects.map((subject) => subject.id));
  for (const permission of contracts.filter((contract) => contract.kind === "AUTH")) {
    for (const subjectId of permission.grants ?? []) {
      requireValue(subjectIds.has(subjectId), `${permission.id}: 정의되지 않은 권한 주체 ${subjectId}입니다.`);
    }
  }

  const slicesById = new Map();
  for (const slice of validSlices) {
    requireValue(!slicesById.has(slice.id), `${slice.id}: 중복 슬라이스 ID입니다.`);
    slicesById.set(slice.id, slice);
  }
  const acIds = new Set();

  for (const slice of validSlices) {
    const baseline = new Set(slice.contractBaseline);
    const consumedContracts = new Set();

    for (const dependency of slice.dependsOn) {
      const dependencySlice = slicesById.get(dependency);
      requireValue(Boolean(dependencySlice), `${slice.id}: 존재하지 않는 선행 슬라이스 ${dependency}를 참조합니다.`);
      requireValue(dependency !== slice.id, `${slice.id}: 자기 자신을 선행 슬라이스로 참조합니다.`);
      if (readyStatuses.has(slice.status) && dependencySlice) {
        requireValue(
          dependencySlice.status === "done",
          `${slice.id}: 착수하려면 선행 슬라이스 ${dependency}가 완료 상태여야 합니다.`,
        );
      }
    }

    for (const changedSliceId of slice.changes) {
      const changedSlice = slicesById.get(changedSliceId);
      requireValue(Boolean(changedSlice), `${slice.id}: 존재하지 않는 변경 대상 ${changedSliceId}를 참조합니다.`);
      requireValue(changedSliceId !== slice.id, `${slice.id}: 자기 자신을 변경 대상으로 참조합니다.`);
      if (readyStatuses.has(slice.status) && changedSlice) {
        requireValue(
          changedSlice.status === "done",
          `${slice.id}: 후속 변경 착수 전 ${changedSliceId}가 완료 상태여야 합니다.`,
        );
      }
    }

    for (const reference of baseline) {
      const contract = contractsById.get(reference);
      requireValue(Boolean(contract), `${slice.id}: 존재하지 않는 계약 ${reference}를 참조합니다.`);
      if (contract && contract.status !== "active") {
        const message = `${slice.id}: ${reference}가 ${contract.status} 상태입니다.`;
        if (["ready", "in_progress"].includes(slice.status)) {
          errors.push(`${message} 착수·진행 기준선은 활성 리비전만 사용할 수 있습니다.`);
        } else if (
          slice.status === "done" &&
          ["draft", "review"].includes(contract.status)
        ) {
          errors.push(`${message} 완료 기준선에는 미확정 리비전을 사용할 수 없습니다.`);
        } else if (slice.status === "planned") {
          warnings.push(`${message} 준비됨 전 활성 리비전으로 갱신해야 합니다.`);
        }
      }
    }

    requireValue(
      slice.contractBaseline.some((reference) => reference.startsWith("QUALITY:DoD@")),
      `${slice.id}: 완료 게이트 QUALITY:DoD 리비전이 기준선에 없습니다.`,
    );

    for (const criterion of slice.acceptanceCriteria) {
      requireValue(
        criterion.id.startsWith(`${slice.id}/AC-`),
        `${criterion.id}: 슬라이스 ID를 접두사로 사용해야 합니다.`,
      );
      requireValue(!acIds.has(criterion.id), `${criterion.id}: 중복 AC ID입니다.`);
      for (const reference of criterion.contractRefs) {
        requireValue(baseline.has(reference), `${criterion.id}: 기준선에 없는 계약 ${reference}를 참조합니다.`);
        consumedContracts.add(reference);
      }
      acIds.add(criterion.id);
    }

    for (const reference of baseline) {
      const contract = contractsById.get(reference);
      if (contract && !["QUALITY", "PROCESS"].includes(contract.kind)) {
        requireValue(
          consumedContracts.has(reference),
          `${slice.id}: 기준선 계약 ${reference}를 어떤 AC도 소비하지 않습니다.`,
        );
      }
    }

    for (const exclusion of slice.outOfScope) {
      if (!exclusion.trackedBy) continue;
      if (exclusion.trackedBy.startsWith("SL-")) {
        requireValue(
          slicesById.has(exclusion.trackedBy),
          `${slice.id}: 범위 밖 추적 대상 ${exclusion.trackedBy}가 존재하지 않습니다.`,
        );
      } else {
        requireValue(
          contractsById.has(exclusion.trackedBy),
          `${slice.id}: 범위 밖 추적 계약 ${exclusion.trackedBy}가 존재하지 않습니다.`,
        );
      }
    }
  }

  detectRelationCycles(slicesById, "dependsOn", errors);
  detectRelationCycles(slicesById, "changes", errors);

  for (const contract of contracts) {
    requireValue(
      Boolean(loaded.notion.revisionPages[contract.id]),
      `${contract.id}: Notion 리비전 페이지 매핑이 없습니다.`,
    );
  }
  for (const mappedId of Object.keys(loaded.notion.revisionPages)) {
    requireValue(contractsById.has(mappedId), `${mappedId}: 로컬에 없는 계약이 Notion 매핑에 남아 있습니다.`);
  }
  for (const slice of validSlices) {
    const notionProjection = loaded.notion.slicePages[slice.id];
    requireValue(
      Boolean(notionProjection),
      `${slice.id}: Notion 슬라이스 페이지 매핑이 없습니다.`,
    );
    if (notionProjection) {
      requireValue(
        typeof notionProjection.url === "string" && notionProjection.url.length > 0,
        `${slice.id}: Notion 슬라이스 URL이 없습니다.`,
      );
      requireValue(
        notionProjection.specRevision === slice.specRevision,
        `${slice.id}: Notion 투영 명세 리비전 ${notionProjection.specRevision}과 실행 명세 ${slice.specRevision}이 다릅니다.`,
      );
    }
  }
  for (const mappedId of Object.keys(loaded.notion.slicePages)) {
    requireValue(slicesById.has(mappedId), `${mappedId}: 로컬에 없는 슬라이스가 Notion 매핑에 남아 있습니다.`);
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
        const contract = contractsById.get(reference);
        requireValue(Boolean(contract), `${location}: 존재하지 않는 계약 ${reference}를 참조합니다.`);
        if (contract) {
          requireValue(
            !["superseded", "deprecated"].includes(contract.status),
            `${location}: ${reference}는 ${contract.status} 상태라 현재 API 계약으로 사용할 수 없습니다.`,
          );
        }
      }
      for (const acId of operationAcIds) {
        requireValue(acIds.has(acId), `${location}: 존재하지 않는 AC ${acId}를 참조합니다.`);
      }
    }
  }

  function resolveLocalReference(reference) {
    if (!reference.startsWith("#/")) return true;
    return resolveLocalReferenceValue(reference) !== undefined;
  }

  function resolveLocalReferenceValue(reference) {
    if (!reference.startsWith("#/")) return undefined;
    return reference
      .slice(2)
      .split("/")
      .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"))
      .reduce((value, segment) => value?.[segment], loaded.api);
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

  for (const contract of contracts) {
    const schemaReference = contract.contract?.schemaRef;
    if (!schemaReference) continue;
    const schema = resolveLocalReferenceValue(schemaReference);
    requireValue(
      Boolean(schema),
      `${contract.id}: API 스키마 ${schemaReference}를 찾을 수 없습니다.`,
    );
    if (!schema) continue;

    const contractFields = new Set(contract.contract.fields ?? []);
    const schemaFields = new Set(Object.keys(schema.properties ?? {}));
    for (const field of contractFields) {
      requireValue(
        schemaFields.has(field),
        `${contract.id}: API 스키마 ${schemaReference}에 계약 필드 ${field}가 없습니다.`,
      );
    }
    for (const field of schemaFields) {
      requireValue(
        contractFields.has(field),
        `${contract.id}: API 스키마 ${schemaReference}의 필드 ${field}가 계약에 없습니다.`,
      );
    }
  }

  return { errors, warnings };
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const { errors, warnings } = await validateRepository();
  for (const warning of warnings) console.warn(`WARN ${warning}`);
  if (errors.length > 0) {
    for (const error of errors) console.error(`ERROR ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`계약 검증 통과: 오류 0, 경고 ${warnings.length}`);
  }
}
