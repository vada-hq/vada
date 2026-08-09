/**
 * 승인된 구매 요청 계약 묶음(CB-FIN-001@R2)의 OpenAPI 입력과 생성 클라이언트.
 *
 * **이 파일에 남은 것은 이 묶음에만 있는 것들이다** — 승인 기록(solution·flow·
 * delivery-work), 추적 ID, 그리고 계약을 OpenAPI component 이름에 붙이는 대응표.
 * 다른 계약 묶음에는 이런 기록이 아예 없다.
 *
 * 묶음에 무관한 셋은 나갔다:
 *   scripts/contract-openapi/json.mjs             문서 도우미
 *   scripts/contract-openapi/render.mjs           계약 → OpenAPI 변환
 *   scripts/contract-openapi/generated-client.mjs 생성 결과의 결정성
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  snapshotFreshGeneration,
  validateGeneratedClient,
  writeGeneratedManifest as writeManifest,
  GENERATED_MANIFEST_PATH,
} from "./contract-openapi/generated-client.mjs";
import {
  equalJson,
  equalSets,
  isObject,
  readJson,
  readJsonIfPresent,
  serializeJson,
} from "./contract-openapi/json.mjs";
import { renderOpenApi } from "./contract-openapi/render.mjs";
import {
  canonicalSha256,
  resolveEffectiveContracts,
} from "./validate-contract-bundles.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const OPENAPI_PATH = "contracts/openapi/CB-FIN-001/R2.json";
const BUNDLE_PATH = "contracts/bundles/CB-FIN-001/R2.json";
const FIXTURE_PATH = "contracts/fixtures/CB-FIN-001/R2.json";
const SOLUTION_PATH = "product-specs/solutions/SOLUTION-FIN-001/R1.json";
const FLOW_PATH = "product-specs/flows/FLOW-FIN-001/R2.json";
const DELIVERY_WORK_PATH = "delivery-units/DU-001/delivery-work/R2.json";
const WORK_ITEM_ID = "WORK:purchase-request-openapi-client-baseline@R2";
const EVIDENCE_ID = "EVID-027";

const DATA_COMPONENTS = new Map([
  ["DATA:purchase_request.input@R1", "PurchaseRequestInput"],
  ["DATA:purchase_request.draft_content@R1", "PurchaseRequestDraftContent"],
  [
    "DATA:purchase_request.draft_save_command@R1",
    "PurchaseRequestDraftSaveCommand",
  ],
  ["DATA:purchase_request.draft@R1", "PurchaseRequestDraft"],
  ["DATA:purchase_request.editor_state@R1", "PurchaseRequestEditorState"],
  ["DATA:purchase_request.submit_command@R1", "PurchaseRequestSubmitCommand"],
  ["DATA:purchase_request.record@R1", "PurchaseRequestRecord"],
  ["DATA:purchase_request.detail_view@R1", "PurchaseRequestDetailView"],
  ["DATA:purchase_request.own_list@R1", "PurchaseRequestOwnList"],
  ["DATA:http.empty_body@R1", "EmptyBody"],
  ["DATA:http.problem_details@R1", "ProblemDetails"],
]);

// API별 AC는 승인 solution의 interaction 단계와 FLOW-FIN-001@R2
// completion scenario가 공유하는 사용자 행동을 기준으로 고정한다.
const OPERATION_AC_IDS = new Map([
  ["API:purchase_request.get_editor_state@R1", ["AC-04", "AC-05"]],
  ["API:purchase_request.save_draft@R1", ["AC-05", "AC-08"]],
  ["API:purchase_request.delete_draft@R1", ["AC-05"]],
  [
    "API:purchase_request.submit@R1",
    ["AC-01", "AC-02", "AC-03", "AC-04", "AC-06"],
  ],
  ["API:purchase_request.list_own@R1", ["AC-01", "AC-02", "AC-07"]],
  ["API:purchase_request.get_detail@R2", ["AC-07"]],
]);

const API_CONTRACT_IDS = [...OPERATION_AC_IDS.keys()];
const WORK_CONTRACT_IDS = [
  "DATA:http.problem_details@R1",
  "DATA:purchase_request.detail_view@R1",
  ...API_CONTRACT_IDS,
];

function qualifyAcId(flow, acId) {
  return `${flow.id}@R${flow.revision}/${acId}`;
}

function assertGenerationBaseline(baseline) {
  const { bundle, fixture, flow, solution, workItem } = baseline;
  if (bundle.bundle_status !== "approved") {
    throw new Error("승인 계약 묶음만 OpenAPI 입력으로 렌더링할 수 있습니다.");
  }
  if (solution.status !== "approved" || flow.status !== "approved") {
    throw new Error(
      "승인 solution과 flow만 OpenAPI 입력으로 렌더링할 수 있습니다.",
    );
  }
  if (
    workItem.status !== "ratified" ||
    !equalSets(workItem.contract_refs ?? [], WORK_CONTRACT_IDS)
  ) {
    throw new Error(`${WORK_ITEM_ID}: ratified contract_refs 범위가 다릅니다.`);
  }
  const evidence = workItem.completion_evidence?.find(
    (item) => item.id === EVIDENCE_ID,
  );
  if (
    !evidence ||
    !equalSets(evidence.contract_refs ?? [], WORK_CONTRACT_IDS) ||
    !evidence.design_refs?.includes("DESIGN-INTERFACE-001")
  ) {
    throw new Error(`${WORK_ITEM_ID}: ${EVIDENCE_ID} 승인 범위가 다릅니다.`);
  }
  if (
    fixture.contract_bundle_ref?.canonical_sha256 !== canonicalSha256(bundle)
  ) {
    throw new Error("계약 픽스처가 승인 계약 묶음 해시에 고정되지 않았습니다.");
  }
  const knownAcIds = new Set(
    flow.spec?.completionScenarios?.map((criterion) => criterion.id),
  );
  const tracedAcIds = new Set([...OPERATION_AC_IDS.values()].flat());
  if (!equalSets(knownAcIds, tracedAcIds)) {
    throw new Error("API별 추적이 FLOW-FIN-001@R2의 AC-01~AC-08과 다릅니다.");
  }
}

/** 이 묶음이 변환기에 넘기는 것 전부. 다른 묶음은 다른 profile을 갖는다. */
const PURCHASE_REQUEST_PROFILE = {
  apiContractIds: API_CONTRACT_IDS,
  dataComponents: DATA_COMPONENTS,
  tagsFor: () => ["Purchase Requests"],
  fixtureFor: (_apiContract, baseline) => baseline.fixture,
  assertBaseline: assertGenerationBaseline,
  info: ({ bundle }) => ({
    title: "VADA Purchase Request API",
    version: `CB-FIN-001-R${bundle.bundle_revision}`,
    description:
      "승인된 행사 구매 요청 HTTP 계약의 생성 클라이언트 입력입니다.",
  }),
  documentExtensions: ({ bundle, workItem }) => ({
    "x-vada-contract-bundle": {
      id: bundle.bundle_id,
      revision: bundle.bundle_revision,
      canonicalSha256: canonicalSha256(bundle),
    },
    "x-vada-delivery-work": workItem.id,
    "x-vada-completion-evidence": EVIDENCE_ID,
  }),
  operationExtensions: (apiContract, { flow }) => ({
    "x-vada-acceptance-criteria": OPERATION_AC_IDS.get(apiContract.id).map(
      (acId) => qualifyAcId(flow, acId),
    ),
  }),
};

export function buildPurchaseRequestOpenApi(baseline) {
  return renderOpenApi(baseline, PURCHASE_REQUEST_PROFILE);
}

export async function loadPurchaseRequestOpenApiBaseline(
  root = repositoryRoot,
) {
  const [openApi, bundle, fixture, solution, flow, deliveryWork] =
    await Promise.all([
      readJsonIfPresent(root, OPENAPI_PATH),
      readJson(root, BUNDLE_PATH),
      readJson(root, FIXTURE_PATH),
      readJson(root, SOLUTION_PATH),
      readJson(root, FLOW_PATH),
      readJson(root, DELIVERY_WORK_PATH),
    ]);
  const effective = await resolveEffectiveContracts(root, bundle, {
    bundlePath: resolve(root, BUNDLE_PATH),
  });
  if (effective.errors.length > 0) {
    throw new Error(
      `승인 계약 묶음의 유효 계약을 해석할 수 없습니다: ${effective.errors.join("; ")}`,
    );
  }
  const workItem = deliveryWork.work_items?.find(
    (item) => item.id === WORK_ITEM_ID,
  );
  if (!workItem)
    throw new Error(`${WORK_ITEM_ID}: 승인 작업을 찾을 수 없습니다.`);
  return {
    openApi,
    bundle,
    contracts: effective.contracts,
    fixture,
    solution,
    flow,
    deliveryWork,
    workItem,
  };
}

export function validatePurchaseRequestOpenApiDocument(openApi, baseline) {
  const errors = [];
  const { bundle, contracts, flow, solution, workItem } = baseline;
  const expected = buildPurchaseRequestOpenApi(baseline);
  const flowAcIds = new Set(
    flow.spec?.completionScenarios?.map((criterion) => criterion.id),
  );
  const tracedAcIds = new Set();

  if (!isObject(openApi)) return ["OpenAPI 입력은 JSON 객체여야 합니다."];
  if (openApi.openapi !== "3.1.1")
    errors.push("OpenAPI 3.1.1을 사용해야 합니다.");
  if (bundle.bundle_status !== "approved")
    errors.push("승인 계약 묶음만 렌더링할 수 있습니다.");
  if (solution.status !== "approved")
    errors.push("승인 목표 동작 설계만 사용할 수 있습니다.");
  if (flow.status !== "approved")
    errors.push("승인 사용자 흐름만 사용할 수 있습니다.");
  if (workItem.status !== "ratified")
    errors.push(`${WORK_ITEM_ID}: ratified 작업이어야 합니다.`);
  if (!equalSets(workItem.contract_refs ?? [], WORK_CONTRACT_IDS)) {
    errors.push(
      `${WORK_ITEM_ID}: contract_refs가 ${EVIDENCE_ID} 범위와 다릅니다.`,
    );
  }

  const bundleTrace = openApi["x-vada-contract-bundle"];
  if (
    bundleTrace?.id !== bundle.bundle_id ||
    bundleTrace?.revision !== bundle.bundle_revision ||
    bundleTrace?.canonicalSha256 !== canonicalSha256(bundle)
  ) {
    errors.push("x-vada-contract-bundle이 승인 묶음 리비전·해시와 다릅니다.");
  }

  for (const apiContractId of API_CONTRACT_IDS) {
    const apiContract = contracts.get(apiContractId);
    if (!apiContract) {
      errors.push(`${apiContractId}: 승인 API 계약이 없습니다.`);
      continue;
    }
    const {
      path,
      method,
      authorization_ref: authorizationRef,
    } = apiContract.specification;
    const location = `${method} ${path}`;
    const operation = openApi.paths?.[path]?.[method.toLowerCase()];
    if (!isObject(operation)) {
      errors.push(`${location}: OpenAPI operation이 없습니다.`);
      continue;
    }

    if (!Object.hasOwn(operation, "x-vada-permission")) {
      errors.push(`${location}: x-vada-permission이 없습니다.`);
    } else if (
      operation["x-vada-permission"] !== contracts.get(authorizationRef)?.key
    ) {
      errors.push(`${location}: x-vada-permission이 권한 계약과 다릅니다.`);
    }

    if (!Object.hasOwn(operation, "x-vada-contracts")) {
      errors.push(`${location}: x-vada-contracts가 없습니다.`);
    } else if (!Array.isArray(operation["x-vada-contracts"])) {
      errors.push(`${location}: x-vada-contracts는 배열이어야 합니다.`);
    } else {
      for (const contractRef of operation["x-vada-contracts"]) {
        const contract = contracts.get(contractRef);
        if (!contract || contract.status !== "ratified") {
          errors.push(
            `${location}: ratified 계약 ${contractRef}를 찾을 수 없습니다.`,
          );
        }
      }
      if (!operation["x-vada-contracts"].includes(apiContractId)) {
        errors.push(
          `${location}: API 계약 리비전 ${apiContractId}가 누락됐습니다.`,
        );
      }
    }

    if (!Object.hasOwn(operation, "x-vada-acceptance-criteria")) {
      errors.push(`${location}: x-vada-acceptance-criteria가 없습니다.`);
    } else if (!Array.isArray(operation["x-vada-acceptance-criteria"])) {
      errors.push(
        `${location}: x-vada-acceptance-criteria는 배열이어야 합니다.`,
      );
    } else {
      for (const qualifiedAcId of operation["x-vada-acceptance-criteria"]) {
        const prefix = `${flow.id}@R${flow.revision}/`;
        const acId = qualifiedAcId.startsWith(prefix)
          ? qualifiedAcId.slice(prefix.length)
          : null;
        if (!acId || !flowAcIds.has(acId)) {
          errors.push(
            `${location}: 승인 흐름에 없는 AC ${qualifiedAcId}입니다.`,
          );
        } else {
          tracedAcIds.add(acId);
        }
      }
    }

    for (const errorRef of apiContract.specification.error_refs) {
      const errorContract = contracts.get(errorRef);
      const status = String(errorContract?.specification?.http_status);
      const response = operation.responses?.[status];
      if (!response?.content?.["application/problem+json"]) {
        errors.push(
          `${location} ${status}: application/problem+json 응답이 없습니다.`,
        );
      }
    }
  }

  if (!equalSets(tracedAcIds, flowAcIds)) {
    errors.push(
      "여섯 OpenAPI operation이 FLOW-FIN-001@R2의 AC-01~AC-08을 모두 추적해야 합니다.",
    );
  }
  if (
    !equalJson(
      openApi.components?.schemas?.ProblemDetails,
      expected.components.schemas.ProblemDetails,
    )
  ) {
    errors.push(
      "ProblemDetails schema가 DATA:http.problem_details@R1과 다릅니다.",
    );
  }
  if (!equalJson(openApi, expected)) {
    errors.push("OpenAPI 입력이 승인 계약·픽스처 렌더링과 드리프트했습니다.");
  }

  return errors;
}

export async function validatePurchaseRequestOpenApiRepository(
  root = repositoryRoot,
) {
  const warnings = [];
  try {
    const baseline = await loadPurchaseRequestOpenApiBaseline(root);
    if (!baseline.openApi) {
      return {
        errors: [`${OPENAPI_PATH}: OpenAPI 입력이 없습니다.`],
        warnings,
      };
    }
    const errors = validatePurchaseRequestOpenApiDocument(
      baseline.openApi,
      baseline,
    );
    const expectedText = serializeJson(buildPurchaseRequestOpenApi(baseline));
    const actualText = await readFile(resolve(root, OPENAPI_PATH), "utf8");
    if (actualText !== expectedText) {
      errors.push(`${OPENAPI_PATH}: 결정적 재렌더링 결과와 바이트가 다릅니다.`);
    }
    return { errors, warnings };
  } catch (error) {
    return { errors: [error.message], warnings };
  }
}

export async function validateGeneratedClientRepository(root = repositoryRoot) {
  return validateGeneratedClient(root, OPENAPI_PATH);
}

export async function generateClientSnapshot(root = repositoryRoot) {
  return snapshotFreshGeneration(root);
}

async function writeOpenApi(root) {
  const baseline = await loadPurchaseRequestOpenApiBaseline(root);
  const openApi = buildPurchaseRequestOpenApi(baseline);
  const outputPath = resolve(root, OPENAPI_PATH);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serializeJson(openApi));
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes("--write-openapi")) {
    await writeOpenApi(repositoryRoot);
    console.log(`${OPENAPI_PATH} 생성 완료`);
  } else if (process.argv.includes("--write-manifest")) {
    await writeManifest(repositoryRoot, OPENAPI_PATH);
    console.log(`${GENERATED_MANIFEST_PATH} 생성 완료`);
  } else {
    const [openApiResult, generatedResult] = await Promise.all([
      validatePurchaseRequestOpenApiRepository(repositoryRoot),
      validateGeneratedClientRepository(repositoryRoot),
    ]);
    const errors = [...openApiResult.errors, ...generatedResult.errors];
    if (errors.length > 0) {
      for (const error of errors) console.error(`ERROR ${error}`);
      process.exitCode = 1;
    } else {
      console.log("구매 요청 OpenAPI·생성 클라이언트 검증 통과: 오류 0");
    }
  }
}
