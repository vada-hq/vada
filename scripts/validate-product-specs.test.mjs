import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  validateDomainDocument,
  validateFlowDocument,
  validateProductDocuments,
  validateProductRepository,
  validateSolutionDocument,
} from "./validate-product-specs.mjs";

const observedAt = "2026-08-03T01:00:00+09:00";

function sourceEvidence() {
  return [
    {
      id: "SRC-001",
      title: "제품 책임자 설명",
      kind: "conversation",
      locator: {
        kind: "conversation_ref",
        value: "example-product-session",
      },
      observedAt,
      sourceVersion: null,
      note: "제품 책임자가 설명한 예시 입력",
    },
  ];
}

function extractedOrigin() {
  return {
    kind: "source_extracted",
    sourceRefs: ["SRC-001"],
    itemRefs: [],
  };
}

function projectedOrigin(itemRefs) {
  return {
    kind: "spec_projection",
    sourceRefs: [],
    itemRefs,
  };
}

function validDomain(overrides = {}) {
  return {
    $schema: "../../schemas/v1/domain.schema.json",
    schemaVersion: 1,
    kind: "domain",
    id: "DOMAIN-BOARD",
    title: "게시판",
    revision: 0,
    status: "draft",
    supersedes: null,
    changeSummary: "최초 초안",
    approval: null,
    sourceEvidence: sourceEvidence(),
    spec: {
      purpose: {
        id: "PURPOSE-001",
        text: "구성원이 공지와 게시글을 한곳에서 관리합니다.",
        origin: extractedOrigin(),
      },
      boundaries: {
        inScope: [
          {
            id: "BOUNDARY-IN-001",
            text: "공지와 일반 게시글 작성 및 조회",
            origin: extractedOrigin(),
          },
        ],
        outOfScope: [],
      },
      actors: [
        {
          id: "ACTOR-MEMBER",
          name: "구성원",
          description: "게시판을 이용하는 동아리 구성원",
          origin: extractedOrigin(),
        },
      ],
      concepts: [
        {
          id: "CONCEPT-POST",
          name: "게시글",
          definition: "구성원이 게시판에 작성하고 저장하는 글",
          origin: extractedOrigin(),
        },
      ],
      authorization: {
        defaultPolicy: "deny_unlisted",
        capabilities: [
          {
            id: "CAPABILITY-POST-CREATE",
            name: "게시글 작성",
            description: "새 게시글을 작성해 저장합니다.",
            grantedActorRefs: ["ACTOR-MEMBER"],
            ruleRefs: ["DOMAIN-RULE-POST-AUTHOR"],
            origin: extractedOrigin(),
          },
        ],
      },
      rules: [
        {
          id: "DOMAIN-RULE-POST-AUTHOR",
          category: "authorization",
          text: "구성원은 자신의 이름으로 게시글을 작성합니다.",
          origin: extractedOrigin(),
        },
      ],
    },
    review: {
      openQuestions: [],
      candidateChanges: [],
    },
    ...overrides,
  };
}

function validFlow(overrides = {}) {
  return {
    $schema: "../../schemas/v1/flow.schema.json",
    schemaVersion: 1,
    kind: "flow",
    id: "FLOW-BOARD-001",
    title: "게시글 작성",
    revision: 0,
    status: "draft",
    supersedes: null,
    changeSummary: "최초 초안",
    approval: null,
    sourceEvidence: sourceEvidence(),
    domainRef: {
      id: "DOMAIN-BOARD",
      revision: 0,
    },
    spec: {
      outcome: {
        id: "OUTCOME-001",
        actorRefs: ["ACTOR-MEMBER"],
        trigger: "구성원이 새 글을 공유하려고 합니다.",
        result: "게시글이 저장되고 다시 열어도 같은 내용이 보입니다.",
        origin: extractedOrigin(),
      },
      preconditions: [],
      rules: [
        {
          id: "FLOW-RULE-TITLE-REQUIRED",
          category: "validation",
          text: "제목이 비어 있으면 게시글을 저장하지 않습니다.",
          origin: extractedOrigin(),
        },
      ],
      steps: [
        {
          id: "STEP-01",
          actorRefs: ["ACTOR-MEMBER"],
          action: "제목과 본문을 입력하고 저장합니다.",
          systemResponse: "게시글을 한 번 저장하고 상세 화면을 보여줍니다.",
          domainRuleRefs: ["DOMAIN-RULE-POST-AUTHOR"],
          flowRuleRefs: ["FLOW-RULE-TITLE-REQUIRED"],
          designSourceRefs: [],
          origin: extractedOrigin(),
        },
      ],
      branches: [
        {
          id: "BRANCH-01",
          condition: "제목이 비어 있습니다.",
          behavior: "저장을 거부합니다.",
          userVisibleResult: "제목 입력이 필요하다는 안내를 확인합니다.",
          domainRuleRefs: [],
          flowRuleRefs: ["FLOW-RULE-TITLE-REQUIRED"],
          origin: extractedOrigin(),
        },
      ],
      completionScenarios: [
        {
          id: "AC-01",
          name: "게시글 저장과 영속성",
          given: ["게시글 작성 권한이 있는 구성원입니다."],
          when: ["유효한 제목과 본문을 입력해 저장합니다."],
          then: ["게시글이 한 번 생성되고 다시 열어도 같은 내용이 보입니다."],
          coversRefs: ["OUTCOME-001", "STEP-01"],
          origin: projectedOrigin(["OUTCOME-001", "STEP-01"]),
        },
      ],
      boundaries: {
        inScope: [
          {
            id: "BOUNDARY-IN-001",
            text: "새 게시글 작성과 저장 결과 확인",
            origin: extractedOrigin(),
          },
        ],
        outOfScope: [],
        relatedFlowRefs: [],
      },
    },
    review: {
      openQuestions: [],
      candidateChanges: [],
    },
    ...overrides,
  };
}

function asV2(document) {
  const copy = structuredClone(document);
  copy.$schema = `../../schemas/v2/${copy.kind}.schema.json`;
  copy.schemaVersion = 2;
  copy.sourceEvidence = copy.sourceEvidence.map((source) => ({
    ...source,
    authority: source.kind === "conversation" ? "direct_decision" : "notion_document",
    approvalState: source.kind === "conversation" ? "approved" : "current",
    conflictsWith: [],
  }));
  copy.review.resolvedConflicts = [];
  return copy;
}

function approvedV2Domain() {
  return asV2(
    validDomain({
      revision: 1,
      status: "approved",
      approval: {
        approvedBy: "제품 책임자",
        approvedAt: observedAt,
      },
    }),
  );
}

function approvedV2Flow() {
  return asV2(
    validFlow({
      revision: 1,
      status: "approved",
      approval: {
        approvedBy: "제품 책임자",
        approvedAt: observedAt,
      },
      domainRef: {
        id: "DOMAIN-BOARD",
        revision: 1,
      },
    }),
  );
}

function validSolution(overrides = {}) {
  const area = (name, elementRefs) => ({
    area: name,
    status: "covered",
    elementRefs,
    rationale: "승인된 흐름을 실현하는 목표 동작으로 다룹니다.",
  });
  return {
    $schema: "../../schemas/v2/solution.schema.json",
    schemaVersion: 2,
    kind: "solution",
    id: "SOLUTION-BOARD-001",
    title: "게시글 작성 목표 동작 설계",
    revision: 0,
    status: "review",
    supersedes: null,
    changeSummary: "최초 목표 동작 설계",
    approval: null,
    sourceEvidence: [
      {
        id: "SRC-001",
        title: "현재 구현 상태 확인",
        kind: "repository_file",
        authority: "other_reference",
        approvalState: "current",
        conflictsWith: [],
        locator: {
          kind: "repository_path",
          value: "apps/web/src/App.tsx",
        },
        observedAt,
        sourceVersion: null,
        note: "기존 게시글 구현이 없어 신규 구현 대상으로 분류합니다.",
      },
    ],
    domainRef: {
      id: "DOMAIN-BOARD",
      revision: 1,
    },
    flowRef: {
      id: "FLOW-BOARD-001",
      revision: 1,
    },
    implementationContext: {
      mode: "greenfield",
      rationale: "관련 제품 구현이 아직 없습니다.",
      sourceRefs: ["SRC-001"],
    },
    designAreas: [
      area("interaction", ["DESIGN-INTERACTION-001"]),
      area("domain", ["DESIGN-SYSTEM-001"]),
      area("data", ["DESIGN-SYSTEM-001"]),
      area("authorization", ["DESIGN-QUALITY-001"]),
      area("interface", ["DESIGN-SYSTEM-001"]),
      area("validation", ["DESIGN-SYSTEM-001"]),
      area("security_privacy", ["DESIGN-QUALITY-001"]),
      area("accessibility", ["DESIGN-QUALITY-001"]),
      area("operations", ["DESIGN-QUALITY-001"]),
      area("verification", ["DESIGN-VERIFY-001"]),
    ],
    designElements: [
      {
        id: "DESIGN-INTERACTION-001",
        kind: "interaction_step",
        title: "게시글 저장 요청",
        description: "구성원이 유효한 글을 저장하고 결과를 확인합니다.",
        domainItemRefs: [],
        flowItemRefs: ["STEP-01"],
        sourceRefs: [],
      },
      {
        id: "DESIGN-SYSTEM-001",
        kind: "system_responsibility",
        title: "게시글 검증과 저장",
        description: "제목을 검증하고 성공한 게시글을 한 번 저장해 다시 조회할 수 있게 합니다.",
        domainItemRefs: ["DOMAIN-RULE-POST-AUTHOR"],
        flowItemRefs: ["OUTCOME-001", "FLOW-RULE-TITLE-REQUIRED", "BRANCH-01"],
        sourceRefs: [],
      },
      {
        id: "DESIGN-QUALITY-001",
        kind: "quality_control",
        title: "권한과 사용자 피드백",
        description: "서버 권한 판정과 접근 가능한 오류 피드백을 제공합니다.",
        domainItemRefs: ["DOMAIN-RULE-POST-AUTHOR"],
        flowItemRefs: ["BRANCH-01"],
        sourceRefs: [],
      },
      {
        id: "DESIGN-VERIFY-001",
        kind: "verification_intent",
        title: "저장과 영속성 검증",
        description: "승인된 완료 시나리오를 사용자 관점에서 검증합니다.",
        domainItemRefs: [],
        flowItemRefs: ["AC-01"],
        sourceRefs: [],
      },
    ],
    relationships: [
      {
        id: "REL-001",
        kind: "precedes",
        fromDesignRef: "DESIGN-INTERACTION-001",
        toDesignRef: "DESIGN-SYSTEM-001",
        rationale: "저장 요청 이후 시스템 검증과 저장이 수행됩니다.",
      },
      {
        id: "REL-002",
        kind: "verifies",
        fromDesignRef: "DESIGN-VERIFY-001",
        toDesignRef: "DESIGN-SYSTEM-001",
        rationale: "검증 의도가 저장 책임을 증명합니다.",
      },
    ],
    review: {
      openQuestions: [],
      candidateChanges: [],
      resolvedConflicts: [],
    },
    ...overrides,
  };
}

test("승인된 제품 흐름에서 추적 가능한 목표 동작 설계를 허용한다", () => {
  const domain = approvedV2Domain();
  const flow = approvedV2Flow();
  const solution = validSolution();

  assert.deepEqual(validateSolutionDocument(solution), []);
  assert.deepEqual(
    validateProductDocuments({ domains: [domain], flows: [flow], solutions: [solution] }),
    [],
  );
});

test("목표 동작 설계가 미승인 플로우를 기준선으로 사용하지 못하게 한다", () => {
  const domain = approvedV2Domain();
  const flow = asV2(
    validFlow({
      domainRef: {
        id: "DOMAIN-BOARD",
        revision: 1,
      },
    }),
  );
  const solution = validSolution();
  solution.flowRef.revision = 0;
  const errors = validateProductDocuments({
    domains: [domain],
    flows: [flow],
    solutions: [solution],
  }).join("\n");

  assert.match(errors, /승인된 플로우만 기준선/);
});

test("목표 동작 설계가 완료 시나리오의 검증 추적을 누락하지 못하게 한다", () => {
  const solution = validSolution();
  solution.designElements.find((element) => element.id === "DESIGN-VERIFY-001").flowItemRefs = [
    "STEP-01",
  ];
  const errors = validateProductDocuments({
    domains: [approvedV2Domain()],
    flows: [approvedV2Flow()],
    solutions: [solution],
  }).join("\n");

  assert.match(errors, /검증 의도에 연결되지 않은 완료 시나리오.*AC-01/);
});

test("일반적인 도메인과 플로우 초안을 허용한다", () => {
  assert.deepEqual(validateDomainDocument(validDomain()), []);
  assert.deepEqual(validateFlowDocument(validFlow()), []);
  assert.deepEqual(
    validateProductDocuments({ domains: [validDomain()], flows: [validFlow()] }),
    [],
  );
});

test("출처 정책과 v2 스키마의 권위·상태 어휘가 함께 변경된다", async () => {
  const [policy, commonSchema] = await Promise.all([
    readFile(new URL("../product-specs/source-policy.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../product-specs/schemas/v2/common.schema.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  const sourceProperties = commonSchema.$defs.sourceEvidence.properties;
  assert.deepEqual(
    [...sourceProperties.authority.enum].sort(),
    [...policy.authorityPriority].sort(),
  );
  assert.deepEqual(
    [...sourceProperties.approvalState.enum].sort(),
    [...policy.normativeApprovalStates, ...policy.nonNormativeApprovalStates].sort(),
  );
  assert.equal(
    policy.normativeApprovalStates.some((state) => policy.nonNormativeApprovalStates.includes(state)),
    false,
  );
});

test("스키마에 없는 필드와 하위 작업 역참조를 거부한다", () => {
  const domain = validDomain({ taskRefs: ["TSK-1"] });
  assert.match(validateDomainDocument(domain).join("\n"), /taskRefs/);
});

test("AI가 추정한 제품 사실을 출처로 허용하지 않는다", () => {
  const domain = validDomain();
  domain.spec.rules[0].origin.kind = "ai_inferred";
  assert.match(validateDomainDocument(domain).join("\n"), /ai_inferred|kind/);
});

test("승인본에 차단 질문이나 후보 변경을 남기지 않는다", () => {
  const domain = validDomain({
    revision: 1,
    status: "approved",
    approval: {
      approvedBy: "product-owner",
      approvedAt: observedAt,
    },
    review: {
      openQuestions: [
        {
          id: "QUESTION-001",
          question: "누가 공지를 작성할 수 있습니까?",
          classification: "decision_pending",
          blocking: true,
          ownerRole: "product_owner",
          affectedItemRefs: ["CAPABILITY-POST-CREATE"],
          implementationPolicy: "block_approval",
          evidenceRefs: ["SRC-001"],
        },
      ],
      candidateChanges: [],
    },
  });
  assert.match(validateDomainDocument(domain).join("\n"), /blocking|openQuestions|승인/);
});

test("존재하지 않는 근거와 중복 안정 ID를 거부한다", () => {
  const domain = validDomain();
  domain.spec.rules[0].origin.sourceRefs = ["SRC-999"];
  domain.spec.concepts.push({ ...domain.spec.concepts[0] });
  const errors = validateProductDocuments({ domains: [domain], flows: [] }).join("\n");
  assert.match(errors, /SRC-999/);
  assert.match(errors, /CONCEPT-POST.*중복/);
});

test("승인 플로우가 초안 도메인을 기준선으로 사용할 수 없다", () => {
  const domain = validDomain();
  const flow = validFlow({
    revision: 1,
    status: "approved",
    approval: {
      approvedBy: "product-owner",
      approvedAt: observedAt,
    },
  });
  const errors = validateProductDocuments({ domains: [domain], flows: [flow] }).join("\n");
  assert.match(errors, /승인.*도메인|도메인.*승인/);
});

test("검토 후보는 존재하는 질문과 명세 항목만 가리켜야 한다", () => {
  const domain = validDomain();
  domain.review.openQuestions.push({
    id: "QUESTION-001",
    question: "누가 게시글을 작성할 수 있습니까?",
    classification: "decision_pending",
    blocking: true,
    ownerRole: "product_owner",
    affectedItemRefs: ["CAPABILITY-NOT-FOUND"],
    implementationPolicy: "block_approval",
    evidenceRefs: ["SRC-001"],
  });
  domain.review.candidateChanges.push({
    id: "CANDIDATE-001",
    questionRef: "QUESTION-999",
    proposal: "모든 구성원에게 게시글 작성 권한을 부여합니다.",
    affectedItemRefs: ["CAPABILITY-POST-CREATE"],
    origin: extractedOrigin(),
  });

  const errors = validateProductDocuments({ domains: [domain], flows: [] }).join("\n");
  assert.match(errors, /CAPABILITY-NOT-FOUND/);
  assert.match(errors, /QUESTION-999/);
});

test("완료 시나리오의 근거와 완료 대상은 정확히 일치해야 한다", () => {
  const flow = validFlow();
  flow.spec.completionScenarios[0].origin.itemRefs = ["STEP-01"];

  const errors = validateProductDocuments({
    domains: [validDomain()],
    flows: [flow],
  }).join("\n");
  assert.match(errors, /완료 대상.*근거|근거.*완료 대상/);
});

test("도메인 규칙만으로 충분한 플로우에 억지 전용 규칙을 요구하지 않는다", () => {
  const flow = validFlow();
  flow.spec.rules = [];
  flow.spec.steps[0].flowRuleRefs = [];
  flow.spec.branches = [];

  assert.deepEqual(validateFlowDocument(flow), []);
  assert.deepEqual(
    validateProductDocuments({ domains: [validDomain()], flows: [flow] }),
    [],
  );
});

test("같은 흐름 단계를 수행할 수 있는 행위자를 복수로 표현한다", () => {
  const flow = validFlow();
  delete flow.spec.steps[0].actorRef;
  flow.spec.steps[0].actorRefs = ["ACTOR-MEMBER", "ACTOR-EDITOR"];

  assert.deepEqual(validateFlowDocument(flow), []);
});

test("제품 책임자 직접 진술도 대화 근거를 반드시 연결한다", () => {
  const domain = validDomain();
  domain.spec.purpose.origin = {
    kind: "owner_stated",
    sourceRefs: [],
    itemRefs: [],
  };

  assert.match(validateDomainDocument(domain).join("\n"), /sourceRefs|fewer than 1/);
});

test("승인 명세는 대기 중인 입력을 제품 규칙의 근거로 사용할 수 없다", () => {
  const domain = asV2(validDomain({
    revision: 1,
    status: "approved",
    approval: {
      approvedBy: "product-owner",
      approvedAt: observedAt,
    },
  }));
  domain.sourceEvidence[0].approvalState = "pending";

  const errors = validateProductDocuments({ domains: [domain], flows: [] }).join("\n");
  assert.match(errors, /pending.*승인.*근거|대기.*승인.*근거/);
});

test("제품 책임자 직접 진술은 직접 결정 권위를 가진 근거를 참조해야 한다", () => {
  const domain = asV2(validDomain());
  domain.spec.purpose.origin.kind = "owner_stated";
  domain.sourceEvidence[0].authority = "notion_document";

  const errors = validateProductDocuments({ domains: [domain], flows: [] }).join("\n");
  assert.match(errors, /owner_stated.*direct_decision|직접 진술.*직접 결정/);
});

test("서로 충돌한다고 표시한 근거는 승인 전에 해결 기록이 있어야 한다", () => {
  const domain = asV2(validDomain({
    revision: 1,
    status: "approved",
    approval: {
      approvedBy: "product-owner",
      approvedAt: observedAt,
    },
  }));
  domain.sourceEvidence.push({
    ...domain.sourceEvidence[0],
    id: "SRC-002",
    title: "현재 화면",
    authority: "current_wireframe_screen",
    conflictsWith: ["SRC-001"],
  });
  domain.sourceEvidence[0].conflictsWith = ["SRC-002"];

  const errors = validateProductDocuments({ domains: [domain], flows: [] }).join("\n");
  assert.match(errors, /SRC-001.*SRC-002.*해결|충돌.*해결/);
});

test("충돌 해결은 낮은 우선순위 근거가 높은 우선순위 근거를 덮을 수 없다", () => {
  const domain = asV2(validDomain());
  domain.sourceEvidence[0].authority = "notion_document";
  domain.sourceEvidence.push({
    ...domain.sourceEvidence[0],
    id: "SRC-002",
    title: "현재 화면",
    authority: "current_wireframe_screen",
    conflictsWith: ["SRC-001"],
  });
  domain.sourceEvidence[0].conflictsWith = ["SRC-002"];
  domain.review.resolvedConflicts.push({
    id: "CONFLICT-001",
    issue: "작성 권한이 서로 다릅니다.",
    winningSourceRefs: ["SRC-001"],
    overriddenSourceRefs: ["SRC-002"],
    affectedItemRefs: ["CAPABILITY-POST-CREATE"],
    resolution: "낮은 우선순위의 노션 문서를 채택합니다.",
  });

  const errors = validateProductDocuments({ domains: [domain], flows: [] }).join("\n");
  assert.match(errors, /우선순위.*낮|낮은 우선순위/);
});

test("승인본은 비차단 유보 질문은 허용하지만 검토 후보는 허용하지 않는다", () => {
  const deferredQuestion = {
    id: "QUESTION-001",
    question: "외부 보존 기준은 언제 확보됩니까?",
    classification: "external_dependency",
    blocking: false,
    ownerRole: "external_owner",
    affectedItemRefs: ["BOUNDARY-IN-001"],
    implementationPolicy: "prohibit_affected_behavior",
    evidenceRefs: ["SRC-001"],
  };
  const approved = validDomain({
    revision: 1,
    status: "approved",
    approval: {
      approvedBy: "product-owner",
      approvedAt: observedAt,
    },
    review: {
      openQuestions: [deferredQuestion],
      candidateChanges: [],
    },
  });
  assert.deepEqual(validateDomainDocument(approved), []);

  approved.review.candidateChanges.push({
    id: "CANDIDATE-001",
    questionRef: "QUESTION-001",
    proposal: "보존 기간을 임시로 5년으로 둡니다.",
    affectedItemRefs: ["BOUNDARY-IN-001"],
    origin: extractedOrigin(),
  });
  assert.match(validateDomainDocument(approved).join("\n"), /candidateChanges|more than 0/);
});

test("실제 재정 도메인과 플로우 초안이 저장소 단위 검증을 통과한다", async () => {
  const result = await validateProductRepository();
  assert.deepEqual(result.errors, []);
});

test("문서 안정 ID와 폴더 이름이 다르면 거부한다", async () => {
  const root = await mkdtemp(join(tmpdir(), "vada-product-spec-"));
  try {
    const domainDirectory = join(root, "product-specs", "domains", "DOMAIN-WRONG");
    const flowDirectory = join(root, "product-specs", "flows", "FLOW-BOARD-001");
    await mkdir(domainDirectory, { recursive: true });
    await mkdir(flowDirectory, { recursive: true });
    await Promise.all([
      writeFile(join(domainDirectory, "draft.json"), JSON.stringify(validDomain()), "utf8"),
      writeFile(join(flowDirectory, "draft.json"), JSON.stringify(validFlow()), "utf8"),
    ]);

    const result = await validateProductRepository(root);
    assert.match(result.errors.join("\n"), /DOMAIN-WRONG.*DOMAIN-BOARD|DOMAIN-BOARD.*DOMAIN-WRONG/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("달력에 존재하지 않는 관찰 날짜를 거부한다", () => {
  const domain = validDomain();
  domain.sourceEvidence[0].observedAt = "2026-02-31T01:00:00+09:00";

  const errors = validateProductDocuments({ domains: [domain], flows: [] }).join("\n");
  assert.match(errors, /RFC 3339|관찰.*시각/);
});

test("비차단 질문에 승인 차단 정책을 붙일 수 없다", () => {
  const domain = validDomain();
  domain.review.openQuestions.push({
    id: "QUESTION-001",
    question: "외부 보존 기준은 언제 확보됩니까?",
    classification: "external_dependency",
    blocking: false,
    ownerRole: "external_owner",
    affectedItemRefs: ["BOUNDARY-IN-001"],
    implementationPolicy: "block_approval",
    evidenceRefs: ["SRC-001"],
  });

  assert.match(validateDomainDocument(domain).join("\n"), /implementationPolicy|block_approval/);
});

test("검토 후보의 영향 범위는 연결된 질문의 영향 범위를 벗어날 수 없다", () => {
  const domain = validDomain();
  domain.review.openQuestions.push({
    id: "QUESTION-001",
    question: "누가 게시글을 작성할 수 있습니까?",
    classification: "decision_pending",
    blocking: true,
    ownerRole: "product_owner",
    affectedItemRefs: ["CAPABILITY-POST-CREATE"],
    implementationPolicy: "block_approval",
    evidenceRefs: ["SRC-001"],
  });
  domain.review.candidateChanges.push({
    id: "CANDIDATE-001",
    questionRef: "QUESTION-001",
    proposal: "게시글 작성자 규칙도 함께 바꿉니다.",
    affectedItemRefs: ["DOMAIN-RULE-POST-AUTHOR"],
    origin: extractedOrigin(),
  });

  const errors = validateProductDocuments({ domains: [domain], flows: [] }).join("\n");
  assert.match(errors, /QUESTION-001.*영향 범위|영향 범위.*QUESTION-001/);
});

test("관련 플로우는 존재하는 정확한 리비전만 참조한다", () => {
  const flow = validFlow();
  flow.spec.boundaries.relatedFlowRefs = [
    {
      id: "FLOW-BOARD-999",
      revision: 0,
    },
  ];

  const errors = validateProductDocuments({
    domains: [validDomain()],
    flows: [flow],
  }).join("\n");
  assert.match(errors, /FLOW-BOARD-999@R0/);
});
