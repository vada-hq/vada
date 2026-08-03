import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { basename, dirname, resolve } from "node:path";

import Ajv2020 from "ajv/dist/2020.js";

const defaultRoot = resolve(import.meta.dirname, "..");

const schemaVersions = [1, 2];
const validatorsByVersion = new Map();

for (const version of schemaVersions) {
  const schemaRoot = resolve(defaultRoot, `product-specs/schemas/v${version}`);
  const schemaFiles = ["common.schema.json", "domain.schema.json", "flow.schema.json"];
  if (version >= 2) schemaFiles.push("solution.schema.json");
  const [commonSchema, domainSchema, flowSchema, solutionSchema] = await Promise.all(
    schemaFiles.map(async (fileName) =>
      JSON.parse(await readFile(resolve(schemaRoot, fileName), "utf8")),
    ),
  );
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addSchema(commonSchema);
  validatorsByVersion.set(version, {
    domain: ajv.compile(domainSchema),
    flow: ajv.compile(flowSchema),
    solution: solutionSchema ? ajv.compile(solutionSchema) : null,
  });
}

const sourcePolicy = JSON.parse(
  await readFile(resolve(defaultRoot, "product-specs/source-policy.json"), "utf8"),
);
const authorityRank = new Map(
  sourcePolicy.authorityPriority.map((authority, index) => [authority, index]),
);
const normativeApprovalStates = new Set(sourcePolicy.normativeApprovalStates);

function formatSchemaError(error) {
  const location = error.instancePath || "/";
  if (error.keyword === "additionalProperties") {
    return `${location}: 허용되지 않는 필드 ${error.params.additionalProperty}`;
  }
  if (error.keyword === "required") {
    return `${location}: 필수 필드 ${error.params.missingProperty}가 없습니다.`;
  }
  const value = error.data === undefined ? "" : ` (${JSON.stringify(error.data)})`;
  return `${location}: ${error.message}${value}`;
}

function schemaErrors(validate, document) {
  if (validate(document)) return [];
  return (validate.errors ?? []).map(formatSchemaError);
}

export function validateDomainDocument(document) {
  const validate = validatorsByVersion.get(document.schemaVersion)?.domain;
  return validate
    ? schemaErrors(validate, document)
    : [`/schemaVersion: 지원하지 않는 제품 명세 구조 버전입니다. (${JSON.stringify(document.schemaVersion)})`];
}

export function validateFlowDocument(document) {
  const validate = validatorsByVersion.get(document.schemaVersion)?.flow;
  return validate
    ? schemaErrors(validate, document)
    : [`/schemaVersion: 지원하지 않는 제품 명세 구조 버전입니다. (${JSON.stringify(document.schemaVersion)})`];
}

export function validateSolutionDocument(document) {
  const validate = validatorsByVersion.get(document.schemaVersion)?.solution;
  return validate
    ? schemaErrors(validate, document)
    : [`/schemaVersion: 지원하지 않는 목표 동작 설계 구조 버전입니다. (${JSON.stringify(document.schemaVersion)})`];
}

function sourceIds(document) {
  return new Set(document.sourceEvidence.map((source) => source.id));
}

function domainSpecItems(domain) {
  return [
    domain.spec.purpose,
    ...domain.spec.boundaries.inScope,
    ...domain.spec.boundaries.outOfScope,
    ...domain.spec.actors,
    ...domain.spec.concepts,
    ...domain.spec.authorization.capabilities,
    ...domain.spec.rules,
  ];
}

function flowSpecItems(flow) {
  return [
    flow.spec.outcome,
    ...flow.spec.preconditions,
    ...flow.spec.rules,
    ...flow.spec.steps,
    ...flow.spec.branches,
    ...flow.spec.completionScenarios,
    ...flow.spec.boundaries.inScope,
    ...flow.spec.boundaries.outOfScope,
  ];
}

function isValidTimestamp(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;
  const [year, month, day, hour, minute, second, offsetHour, offsetMinute] = [
    match[1],
    match[2],
    match[3],
    match[4],
    match[5],
    match[6],
    match[8] ?? "0",
    match[9] ?? "0",
  ].map(Number);
  if (year === 0 || hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) {
    return false;
  }
  const calendar = new Date(0);
  calendar.setUTCHours(0, 0, 0, 0);
  calendar.setUTCFullYear(year, month - 1, day);
  calendar.setUTCHours(hour, minute, second, 0);
  if (
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day ||
    calendar.getUTCHours() !== hour ||
    calendar.getUTCMinutes() !== minute ||
    calendar.getUTCSeconds() !== second
  ) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}

function validateTimestamp(value, location, errors) {
  if (!isValidTimestamp(value)) errors.push(`${location}: 유효한 RFC 3339 시각이 아닙니다.`);
}

function validateDocumentSemantics(document, specItems, errors) {
  const knownSources = sourceIds(document);
  const sourcesById = new Map(document.sourceEvidence.map((source) => [source.id, source]));
  const knownItems = new Set();
  const knownSpecItems = new Set(specItems.map((item) => item.id));
  const items = [
    ...specItems,
    ...document.review.openQuestions,
    ...document.review.candidateChanges,
  ];

  for (const source of document.sourceEvidence) {
    if (knownSources.size !== document.sourceEvidence.length) {
      errors.push(`${document.id}: sourceEvidence에 중복 ID가 있습니다.`);
      break;
    }
    validateTimestamp(source.observedAt, `${document.id}/${source.id}/observedAt`, errors);
    if (source.sourceVersion?.kind === "last_edited_at") {
      validateTimestamp(
        source.sourceVersion.value,
        `${document.id}/${source.id}/sourceVersion`,
        errors,
      );
    }
    for (const reference of source.conflictsWith ?? []) {
      if (!knownSources.has(reference)) {
        errors.push(`${document.id}/${source.id}: 존재하지 않는 충돌 근거 ${reference}를 참조합니다.`);
      } else if (reference === source.id) {
        errors.push(`${document.id}/${source.id}: 자기 자신과 충돌한다고 표시할 수 없습니다.`);
      }
    }
  }
  if (document.approval) {
    validateTimestamp(document.approval.approvedAt, `${document.id}/approval/approvedAt`, errors);
  }

  for (const item of items) {
    if (knownItems.has(item.id)) errors.push(`${document.id}: ${item.id} 안정 ID가 중복됩니다.`);
    knownItems.add(item.id);
  }

  for (const item of items) {
    const origin = item.origin;
    if (origin) {
      for (const reference of origin.sourceRefs) {
        if (!knownSources.has(reference)) {
          errors.push(`${document.id}/${item.id}: 존재하지 않는 근거 ${reference}를 참조합니다.`);
        }
      }
      for (const reference of origin.itemRefs) {
        if (!knownSpecItems.has(reference)) {
          errors.push(`${document.id}/${item.id}: 존재하지 않는 명세 항목 ${reference}를 참조합니다.`);
        } else if (reference === item.id) {
          errors.push(`${document.id}/${item.id}: 자기 자신을 투영 근거로 참조할 수 없습니다.`);
        }
      }
      if (document.schemaVersion >= 2 && origin.kind === "owner_stated") {
        const hasDirectDecision = origin.sourceRefs.some(
          (reference) => sourcesById.get(reference)?.authority === "direct_decision",
        );
        if (!hasDirectDecision) {
          errors.push(`${document.id}/${item.id}: owner_stated 직접 진술은 direct_decision 직접 결정 근거를 참조해야 합니다.`);
        }
      }
    }
    for (const reference of item.evidenceRefs ?? []) {
      if (!knownSources.has(reference)) {
        errors.push(`${document.id}/${item.id}: 존재하지 않는 근거 ${reference}를 참조합니다.`);
      }
    }
  }

  if (document.schemaVersion >= 2 && document.status === "approved") {
    for (const item of specItems) {
      for (const reference of item.origin?.sourceRefs ?? []) {
        const source = sourcesById.get(reference);
        if (source?.approvalState && !normativeApprovalStates.has(source.approvalState)) {
          errors.push(`${document.id}/${item.id}: ${source.approvalState} 대기·비정본 근거 ${reference}를 승인 제품 규칙의 근거로 사용할 수 없습니다.`);
        }
      }
    }
  }

  const questionsById = new Map(
    document.review.openQuestions.map((question) => [question.id, question]),
  );
  for (const question of document.review.openQuestions) {
    for (const reference of question.affectedItemRefs) {
      if (!knownSpecItems.has(reference)) {
        errors.push(`${document.id}/${question.id}: 존재하지 않는 명세 항목 ${reference}에 영향을 준다고 표시했습니다.`);
      }
    }
  }
  for (const candidate of document.review.candidateChanges) {
    const question = questionsById.get(candidate.questionRef);
    if (!question) {
      errors.push(`${document.id}/${candidate.id}: 존재하지 않는 질문 ${candidate.questionRef}의 후보입니다.`);
    }
    for (const reference of candidate.affectedItemRefs) {
      if (!knownSpecItems.has(reference)) {
        errors.push(`${document.id}/${candidate.id}: 존재하지 않는 명세 항목 ${reference}에 영향을 준다고 표시했습니다.`);
      } else if (question && !question.affectedItemRefs.includes(reference)) {
        errors.push(`${document.id}/${candidate.id}: ${reference}는 질문 ${candidate.questionRef}의 영향 범위를 벗어납니다.`);
      }
    }
  }

  const declaredConflictPairs = new Set();
  const pairKey = (left, right) => [left, right].sort().join("::");
  for (const source of document.sourceEvidence) {
    for (const reference of source.conflictsWith ?? []) {
      if (knownSources.has(reference) && reference !== source.id) {
        declaredConflictPairs.add(pairKey(source.id, reference));
      }
    }
  }

  const resolvedConflictPairs = new Set();
  const conflictIds = new Set();
  for (const conflict of document.schemaVersion >= 2 ? document.review.resolvedConflicts : []) {
    if (conflictIds.has(conflict.id)) {
      errors.push(`${document.id}: ${conflict.id} 충돌 해결 ID가 중복됩니다.`);
    }
    conflictIds.add(conflict.id);

    const winning = conflict.winningSourceRefs
      .map((reference) => sourcesById.get(reference))
      .filter(Boolean);
    const overridden = conflict.overriddenSourceRefs
      .map((reference) => sourcesById.get(reference))
      .filter(Boolean);
    for (const reference of [...conflict.winningSourceRefs, ...conflict.overriddenSourceRefs]) {
      if (!knownSources.has(reference)) {
        errors.push(`${document.id}/${conflict.id}: 존재하지 않는 근거 ${reference}를 참조합니다.`);
      }
    }
    for (const reference of conflict.affectedItemRefs) {
      if (!knownSpecItems.has(reference)) {
        errors.push(`${document.id}/${conflict.id}: 존재하지 않는 명세 항목 ${reference}에 영향을 준다고 표시했습니다.`);
      }
    }
    for (const winner of winning) {
      if (!normativeApprovalStates.has(winner.approvalState)) {
        errors.push(`${document.id}/${conflict.id}: 채택 근거 ${winner.id}는 current 또는 approved 상태여야 합니다.`);
      }
      for (const loser of overridden) {
        resolvedConflictPairs.add(pairKey(winner.id, loser.id));
        if (winner.id === loser.id) {
          errors.push(`${document.id}/${conflict.id}: 같은 근거 ${winner.id}를 채택과 대체 양쪽에 둘 수 없습니다.`);
          continue;
        }
        if (authorityRank.get(winner.authority) > authorityRank.get(loser.authority)) {
          errors.push(`${document.id}/${conflict.id}: 낮은 우선순위 근거 ${winner.id}가 높은 우선순위 근거 ${loser.id}를 덮을 수 없습니다.`);
        }
      }
    }
  }

  if (document.schemaVersion >= 2 && document.status === "approved") {
    for (const pair of declaredConflictPairs) {
      if (!resolvedConflictPairs.has(pair)) {
        const [left, right] = pair.split("::");
        errors.push(`${document.id}: 충돌 근거 ${left}·${right}의 해결 기록이 없습니다.`);
      }
    }
  }

  return { knownSources, knownItems, knownSpecItems };
}

function sameMembers(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function artifactKey(document) {
  return `${document.id}@R${document.revision}`;
}

const targetDesignAreas = [
  "interaction",
  "domain",
  "data",
  "authorization",
  "interface",
  "validation",
  "security_privacy",
  "accessibility",
  "operations",
  "verification",
];

function hasDirectedCycle(nodes, edges) {
  const adjacency = new Map([...nodes].map((node) => [node, []]));
  for (const [from, to] of edges) {
    if (adjacency.has(from) && adjacency.has(to)) adjacency.get(from).push(to);
  }
  const visiting = new Set();
  const visited = new Set();

  function visit(node) {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of adjacency.get(node)) {
      if (visit(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  }

  return [...nodes].some(visit);
}

function requiredFlowDesignItems(flow) {
  return [
    flow.spec.outcome,
    ...flow.spec.preconditions,
    ...flow.spec.rules,
    ...flow.spec.steps,
    ...flow.spec.branches,
    ...flow.spec.completionScenarios,
  ];
}

function validateSolutionSemantics(solution, domainContext, flowContext, errors) {
  const solutionItems = solution.designElements;
  const context = validateDocumentSemantics(solution, solutionItems, errors);
  const domainKey = `${solution.domainRef.id}@R${solution.domainRef.revision}`;
  const flowKey = `${solution.flowRef.id}@R${solution.flowRef.revision}`;
  const referencedDomain = domainContext.get(domainKey);
  const referencedFlow = flowContext.get(flowKey);

  if (!referencedDomain) {
    errors.push(`${solution.id}: 기준 도메인 ${domainKey}가 존재하지 않습니다.`);
  } else if (referencedDomain.domain.status !== "approved") {
    errors.push(`${solution.id}: 목표 동작 설계는 승인된 도메인만 기준선으로 사용할 수 있습니다.`);
  }
  if (!referencedFlow) {
    errors.push(`${solution.id}: 기준 플로우 ${flowKey}가 존재하지 않습니다.`);
  } else {
    if (referencedFlow.flow.status !== "approved") {
      errors.push(`${solution.id}: 목표 동작 설계는 승인된 플로우만 기준선으로 사용할 수 있습니다.`);
    }
    if (
      referencedFlow.flow.domainRef.id !== solution.domainRef.id ||
      referencedFlow.flow.domainRef.revision !== solution.domainRef.revision
    ) {
      errors.push(`${solution.id}: 기준 플로우와 목표 동작 설계의 도메인 기준선이 다릅니다.`);
    }
  }

  for (const sourceRef of solution.implementationContext.sourceRefs) {
    if (!context.knownSources.has(sourceRef)) {
      errors.push(`${solution.id}/implementationContext: 존재하지 않는 근거 ${sourceRef}를 참조합니다.`);
    }
  }
  if (["review", "approved"].includes(solution.status) && solution.implementationContext.mode === "undetermined") {
    errors.push(`${solution.id}: 검토·승인 설계는 구현 맥락을 확정해야 합니다.`);
  }

  const elementIds = new Set(solution.designElements.map((element) => element.id));
  const domainItemIds = referencedDomain?.knownSpecItems ?? new Set();
  const flowItems = referencedFlow ? requiredFlowDesignItems(referencedFlow.flow) : [];
  const flowItemIds = new Set(flowItems.map((item) => item.id));
  const tracedFlowItems = new Set();
  const verificationTraces = new Set();

  for (const element of solution.designElements) {
    if (
      element.domainItemRefs.length === 0 &&
      element.flowItemRefs.length === 0 &&
      element.sourceRefs.length === 0
    ) {
      errors.push(`${solution.id}/${element.id}: 설계 요소는 승인 항목 또는 로컬 근거를 하나 이상 참조해야 합니다.`);
    }
    for (const reference of element.domainItemRefs) {
      if (!domainItemIds.has(reference)) {
        errors.push(`${solution.id}/${element.id}: 존재하지 않는 도메인 항목 ${reference}를 참조합니다.`);
      }
    }
    for (const reference of element.flowItemRefs) {
      if (!flowItemIds.has(reference)) {
        errors.push(`${solution.id}/${element.id}: 존재하지 않는 플로우 항목 ${reference}를 참조합니다.`);
      } else {
        tracedFlowItems.add(reference);
        if (element.kind === "verification_intent" && reference.startsWith("AC-")) {
          verificationTraces.add(reference);
        }
      }
    }
    for (const reference of element.sourceRefs) {
      if (!context.knownSources.has(reference)) {
        errors.push(`${solution.id}/${element.id}: 존재하지 않는 근거 ${reference}를 참조합니다.`);
      }
    }
  }

  const areaCounts = new Map();
  const areaReferencedElements = new Set();
  for (const area of solution.designAreas) {
    areaCounts.set(area.area, (areaCounts.get(area.area) ?? 0) + 1);
    for (const reference of area.elementRefs) {
      if (!elementIds.has(reference)) {
        errors.push(`${solution.id}/${area.area}: 존재하지 않는 설계 요소 ${reference}를 참조합니다.`);
      } else {
        areaReferencedElements.add(reference);
      }
    }
    if (area.status === "covered" && area.elementRefs.length === 0) {
      errors.push(`${solution.id}/${area.area}: covered 영역은 설계 요소를 하나 이상 참조해야 합니다.`);
    }
    if (area.status === "not_applicable" && area.elementRefs.length > 0) {
      errors.push(`${solution.id}/${area.area}: not_applicable 영역은 설계 요소를 참조할 수 없습니다.`);
    }
    if (["review", "approved"].includes(solution.status) && area.status === "unresolved") {
      errors.push(`${solution.id}/${area.area}: 검토·승인 설계에는 미해결 영역을 남길 수 없습니다.`);
    }
  }
  for (const area of targetDesignAreas) {
    if (areaCounts.get(area) !== 1) {
      errors.push(`${solution.id}: 설계 영역 ${area}를 정확히 한 번 포함해야 합니다.`);
    }
  }
  for (const element of solution.designElements) {
    if (!areaReferencedElements.has(element.id)) {
      errors.push(`${solution.id}/${element.id}: 어떤 설계 영역에도 연결되지 않은 고아 요소입니다.`);
    }
  }

  const relationshipIds = new Set();
  const dependencyEdges = [];
  for (const relationship of solution.relationships) {
    if (relationshipIds.has(relationship.id)) {
      errors.push(`${solution.id}: 관계 ID ${relationship.id}가 중복됩니다.`);
    }
    relationshipIds.add(relationship.id);
    if (!elementIds.has(relationship.fromDesignRef)) {
      errors.push(`${solution.id}/${relationship.id}: 시작 설계 요소 ${relationship.fromDesignRef}가 존재하지 않습니다.`);
    }
    if (!elementIds.has(relationship.toDesignRef)) {
      errors.push(`${solution.id}/${relationship.id}: 대상 설계 요소 ${relationship.toDesignRef}가 존재하지 않습니다.`);
    }
    if (relationship.fromDesignRef === relationship.toDesignRef) {
      errors.push(`${solution.id}/${relationship.id}: 자기 자신을 연결할 수 없습니다.`);
    }
    if (["precedes", "depends_on"].includes(relationship.kind)) {
      dependencyEdges.push([relationship.fromDesignRef, relationship.toDesignRef]);
    }
  }
  if (hasDirectedCycle(elementIds, dependencyEdges)) {
    errors.push(`${solution.id}: 설계 선행·의존 관계에 순환이 있습니다.`);
  }

  if (["review", "approved"].includes(solution.status) && referencedFlow) {
    const missingTraces = flowItems
      .map((item) => item.id)
      .filter((reference) => !tracedFlowItems.has(reference));
    if (missingTraces.length > 0) {
      errors.push(`${solution.id}: 추적되지 않은 플로우 항목이 있습니다: ${missingTraces.join(", ")}`);
    }
    const missingVerification = referencedFlow.flow.spec.completionScenarios
      .map((scenario) => scenario.id)
      .filter((reference) => !verificationTraces.has(reference));
    if (missingVerification.length > 0) {
      errors.push(`${solution.id}: 검증 의도에 연결되지 않은 완료 시나리오가 있습니다: ${missingVerification.join(", ")}`);
    }
    const kinds = new Set(solution.designElements.map((element) => element.kind));
    for (const requiredKind of ["interaction_step", "system_responsibility", "verification_intent"]) {
      if (!kinds.has(requiredKind)) {
        errors.push(`${solution.id}: 검토·승인 설계에는 ${requiredKind} 요소가 필요합니다.`);
      }
    }
    if (solution.review.openQuestions.some((question) => question.blocking)) {
      errors.push(`${solution.id}: 검토·승인 설계에는 차단 질문을 남길 수 없습니다.`);
    }
  }
}

export function validateProductDocuments({ domains, flows, solutions = [] }) {
  const errors = [];
  const structurallyValidDomains = [];
  const structurallyValidFlows = [];
  const structurallyValidSolutions = [];

  for (const domain of domains) {
    const structureErrors = validateDomainDocument(domain);
    if (structureErrors.length > 0) {
      structureErrors.forEach((error) => errors.push(`${domain.id ?? "domain"}${error}`));
    } else {
      structurallyValidDomains.push(domain);
    }
  }
  for (const flow of flows) {
    const structureErrors = validateFlowDocument(flow);
    if (structureErrors.length > 0) {
      structureErrors.forEach((error) => errors.push(`${flow.id ?? "flow"}${error}`));
    } else {
      structurallyValidFlows.push(flow);
    }
  }
  for (const solution of solutions) {
    const structureErrors = validateSolutionDocument(solution);
    if (structureErrors.length > 0) {
      structureErrors.forEach((error) => errors.push(`${solution.id ?? "solution"}${error}`));
    } else {
      structurallyValidSolutions.push(solution);
    }
  }

  const allArtifacts = [
    ...structurallyValidDomains,
    ...structurallyValidFlows,
    ...structurallyValidSolutions,
  ];
  const artifactsByKey = new Map();
  for (const artifact of allArtifacts) {
    const key = artifactKey(artifact);
    if (artifactsByKey.has(key)) errors.push(`${key}: 같은 리비전이 둘 이상입니다.`);
    artifactsByKey.set(key, artifact);
  }

  const domainContext = new Map();
  for (const domain of structurallyValidDomains) {
    const context = validateDocumentSemantics(domain, domainSpecItems(domain), errors);
    const actorIds = new Set(domain.spec.actors.map((actor) => actor.id));
    const ruleIds = new Set(domain.spec.rules.map((rule) => rule.id));
    for (const capability of domain.spec.authorization.capabilities) {
      for (const reference of capability.grantedActorRefs) {
        if (!actorIds.has(reference)) {
          errors.push(`${domain.id}/${capability.id}: 존재하지 않는 행위자 ${reference}를 부여 대상으로 참조합니다.`);
        }
      }
      for (const reference of capability.ruleRefs) {
        if (!ruleIds.has(reference)) {
          errors.push(`${domain.id}/${capability.id}: 존재하지 않는 도메인 규칙 ${reference}를 참조합니다.`);
        }
      }
    }
    domainContext.set(artifactKey(domain), { domain, ...context, actorIds, ruleIds });
  }

  const flowContext = new Map();
  for (const flow of structurallyValidFlows) {
    const context = validateDocumentSemantics(flow, flowSpecItems(flow), errors);
    const flowRuleIds = new Set(flow.spec.rules.map((rule) => rule.id));
    const domainKey = `${flow.domainRef.id}@R${flow.domainRef.revision}`;
    const referencedDomain = domainContext.get(domainKey);
    if (!referencedDomain) {
      errors.push(`${flow.id}: 기준 도메인 ${domainKey}가 존재하지 않습니다.`);
      continue;
    }
    if (flow.status === "approved" && referencedDomain.domain.status !== "approved") {
      errors.push(`${flow.id}: 승인 플로우는 승인된 도메인만 기준선으로 사용할 수 있습니다.`);
    }

    for (const reference of flow.spec.boundaries.relatedFlowRefs) {
      const relatedKey = `${reference.id}@R${reference.revision}`;
      const related = artifactsByKey.get(relatedKey);
      if (!related || related.kind !== "flow") {
        errors.push(`${flow.id}: 관련 플로우 ${relatedKey}가 존재하지 않습니다.`);
      } else if (related.id === flow.id) {
        errors.push(`${flow.id}: 자기 자신을 관련 플로우로 참조할 수 없습니다.`);
      } else if (flow.status === "approved" && related.status !== "approved") {
        errors.push(`${flow.id}: 승인 플로우는 승인된 관련 플로우만 참조할 수 있습니다.`);
      }
    }

    for (const reference of flow.spec.outcome.actorRefs) {
      if (!referencedDomain.actorIds.has(reference)) {
        errors.push(`${flow.id}/OUTCOME-001: 존재하지 않는 도메인 행위자 ${reference}를 참조합니다.`);
      }
    }

    const behaviorItems = [
      ...flow.spec.preconditions,
      ...flow.spec.steps,
      ...flow.spec.branches,
    ];
    for (const item of behaviorItems) {
      for (const actorRef of item.actorRefs ?? []) {
        if (actorRef !== "SYSTEM" && !referencedDomain.actorIds.has(actorRef)) {
          errors.push(`${flow.id}/${item.id}: 존재하지 않는 도메인 행위자 ${actorRef}를 참조합니다.`);
        }
      }
      for (const reference of item.domainRuleRefs) {
        if (!referencedDomain.ruleIds.has(reference)) {
          errors.push(`${flow.id}/${item.id}: 존재하지 않는 도메인 규칙 ${reference}를 참조합니다.`);
        }
      }
      for (const reference of item.flowRuleRefs) {
        if (!flowRuleIds.has(reference)) {
          errors.push(`${flow.id}/${item.id}: 존재하지 않는 플로우 규칙 ${reference}를 참조합니다.`);
        }
      }
      for (const reference of item.designSourceRefs ?? []) {
        const source = flow.sourceEvidence.find((candidate) => candidate.id === reference);
        if (!source) {
          errors.push(`${flow.id}/${item.id}: 존재하지 않는 디자인 근거 ${reference}를 참조합니다.`);
        } else if (source.kind !== "figma_frame") {
          errors.push(`${flow.id}/${item.id}: ${reference}는 Figma 프레임 근거가 아닙니다.`);
        }
      }
    }

    const completionTargetIds = new Set([
      flow.spec.outcome.id,
      ...flow.spec.preconditions.map((item) => item.id),
      ...flow.spec.rules.map((item) => item.id),
      ...flow.spec.steps.map((item) => item.id),
      ...flow.spec.branches.map((item) => item.id),
    ]);
    for (const scenario of flow.spec.completionScenarios) {
      if (scenario.origin.kind !== "spec_projection") {
        errors.push(`${flow.id}/${scenario.id}: 완료 시나리오는 명세 항목의 투영이어야 합니다.`);
      }
      for (const reference of scenario.coversRefs) {
        if (!completionTargetIds.has(reference)) {
          errors.push(`${flow.id}/${scenario.id}: 존재하지 않는 완료 대상 ${reference}를 참조합니다.`);
        }
      }
      const covered = new Set(scenario.coversRefs);
      const projected = new Set(scenario.origin.itemRefs);
      if (!sameMembers(covered, projected)) {
        errors.push(`${flow.id}/${scenario.id}: 완료 대상(coversRefs)과 근거(origin.itemRefs)가 정확히 일치해야 합니다.`);
      }
    }
    flowContext.set(artifactKey(flow), { flow, ...context, flowRuleIds });
  }

  for (const solution of structurallyValidSolutions) {
    validateSolutionSemantics(solution, domainContext, flowContext, errors);
  }

  for (const artifact of allArtifacts) {
    if (!artifact.supersedes) {
      if (artifact.status === "approved" && artifact.revision > 1) {
        errors.push(`${artifact.id}@R${artifact.revision}: 이전 리비전 참조가 필요합니다.`);
      }
      continue;
    }
    if (artifact.supersedes.id !== artifact.id) {
      errors.push(`${artifact.id}: 같은 안정 ID의 이전 리비전만 대체할 수 있습니다.`);
      continue;
    }
    const predecessor = artifactsByKey.get(
      `${artifact.supersedes.id}@R${artifact.supersedes.revision}`,
    );
    if (!predecessor || predecessor.status !== "approved") {
      errors.push(`${artifact.id}: 대체 대상은 존재하는 승인 리비전이어야 합니다.`);
    }
    if (artifact.status === "approved" && artifact.supersedes.revision !== artifact.revision - 1) {
      errors.push(`${artifact.id}@R${artifact.revision}: 바로 이전 리비전을 대체해야 합니다.`);
    }
  }

  return errors;
}

async function listJsonFiles(directory) {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => resolve(directory, entry.name))
      .sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function readDocuments(root, kind) {
  const directoryByKind = {
    domain: "domains",
    flow: "flows",
    solution: "solutions",
  };
  const parent = resolve(root, "product-specs", directoryByKind[kind]);
  let directories = [];
  try {
    directories = (await readdir(parent, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => resolve(parent, entry.name));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const paths = (await Promise.all(directories.map(listJsonFiles))).flat();
  return Promise.all(
    paths.map(async (path) => ({
      path,
      document: JSON.parse(await readFile(path, "utf8")),
    })),
  );
}

export async function validateProductRepository(root = defaultRoot) {
  const errors = [];
  const warnings = [];
  let domainEntries;
  let flowEntries;
  let solutionEntries;
  try {
    [domainEntries, flowEntries, solutionEntries] = await Promise.all([
      readDocuments(root, "domain"),
      readDocuments(root, "flow"),
      readDocuments(root, "solution"),
    ]);
  } catch (error) {
    return { errors: [`product-specs: ${error.message}`], warnings };
  }

  if (domainEntries.length === 0) errors.push("product-specs/domains: 도메인 명세가 없습니다.");
  if (flowEntries.length === 0) errors.push("product-specs/flows: 플로우 명세가 없습니다.");

  for (const { path, document } of [...domainEntries, ...flowEntries, ...solutionEntries]) {
    const fileName = basename(path);
    const directoryName = basename(dirname(path));
    if (directoryName !== document.id) {
      errors.push(`${path}: 폴더 ${directoryName}와 문서 안정 ID ${document.id}가 일치해야 합니다.`);
    }
    if (["draft", "review"].includes(document.status) && fileName !== "draft.json") {
      errors.push(`${path}: 초안·검토 문서는 draft.json이어야 합니다.`);
    }
    if (document.status === "approved" && fileName !== `R${document.revision}.json`) {
      errors.push(`${path}: 승인 문서는 R${document.revision}.json이어야 합니다.`);
    }
  }

  errors.push(
    ...validateProductDocuments({
      domains: domainEntries.map((entry) => entry.document),
      flows: flowEntries.map((entry) => entry.document),
      solutions: solutionEntries.map((entry) => entry.document),
    }),
  );
  return { errors, warnings };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const { errors, warnings } = await validateProductRepository();
  for (const warning of warnings) console.warn(`WARN ${warning}`);
  if (errors.length > 0) {
    for (const error of errors) console.error(`ERROR ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`제품 명세 검증 통과: 오류 0, 경고 ${warnings.length}`);
  }
}
