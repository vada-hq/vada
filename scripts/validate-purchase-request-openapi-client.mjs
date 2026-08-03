import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./validate-contract-bundles.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const OPENAPI_PATH = "contracts/openapi/CB-FIN-001/R1.json";
const BUNDLE_PATH = "contracts/bundles/CB-FIN-001/R1.json";
const FIXTURE_PATH = "contracts/fixtures/CB-FIN-001/R1.json";
const SOLUTION_PATH = "product-specs/solutions/SOLUTION-FIN-001/R1.json";
const FLOW_PATH = "product-specs/flows/FLOW-FIN-001/R2.json";
const DELIVERY_WORK_PATH = "delivery-units/DU-001/delivery-work/R1.json";
const CLIENT_PACKAGE_PATH = "packages/api-client/package.json";
const CLIENT_CONFIG_PATH = "packages/api-client/openapi-ts.config.ts";
const GENERATED_DIRECTORY = "packages/api-client/src/generated";
const GENERATED_MANIFEST_PATH = "packages/api-client/generated-manifest.json";
const WORK_ITEM_ID = "WORK:purchase-request-openapi-client-baseline@R1";
const EVIDENCE_ID = "EVID-012";
const GENERATOR_PACKAGE = "@hey-api/openapi-ts";
const GENERATOR_VERSION = "0.95.0";

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
  ["API:purchase_request.get_detail@R1", ["AC-07"]],
]);

const API_CONTRACT_IDS = [...OPERATION_AC_IDS.keys()];
const WORK_CONTRACT_IDS = ["DATA:http.problem_details@R1", ...API_CONTRACT_IDS];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return structuredClone(value);
}

function sorted(values) {
  return [...values].sort();
}

function equalSets(left, right) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

function equalJson(left, right) {
  return (
    JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right))
  );
}

function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizePath(path) {
  return path.split(sep).join("/");
}

async function readJson(root, path) {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}

async function readJsonIfPresent(root, path) {
  try {
    return await readJson(root, path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function contractMap(bundle) {
  return new Map(
    (bundle.contracts ?? []).map((contract) => [contract.id, contract]),
  );
}

function qualifyAcId(flow, acId) {
  return `${flow.id}@R${flow.revision}/${acId}`;
}

function rewriteSchema(value, componentName, schemaIdToComponent) {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      rewriteSchema(entry, componentName, schemaIdToComponent),
    );
  }
  if (!isObject(value)) return value;

  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "$schema" || key === "$id") continue;
    if (key === "$ref" && typeof child === "string") {
      if (child.startsWith("#/$defs/")) {
        result[key] = `#/components/schemas/${componentName}/${child.slice(2)}`;
      } else if (schemaIdToComponent.has(child)) {
        result[key] = `#/components/schemas/${schemaIdToComponent.get(child)}`;
      } else {
        result[key] = child;
      }
      continue;
    }
    result[key] = rewriteSchema(child, componentName, schemaIdToComponent);
  }
  return result;
}

function buildSchemas(bundle) {
  const contracts = contractMap(bundle);
  const schemaIdToComponent = new Map();
  for (const [contractId, componentName] of DATA_COMPONENTS) {
    const schemaId = contracts.get(contractId)?.specification?.json_schema?.$id;
    if (schemaId) schemaIdToComponent.set(schemaId, componentName);
  }

  const schemas = {};
  for (const [contractId, componentName] of DATA_COMPONENTS) {
    const schema = contracts.get(contractId)?.specification?.json_schema;
    if (!isObject(schema))
      throw new Error(`${contractId}: JSON Schema가 없습니다.`);
    schemas[componentName] = rewriteSchema(
      schema,
      componentName,
      schemaIdToComponent,
    );
  }
  return schemas;
}

function schemaReference(contractId) {
  const componentName = DATA_COMPONENTS.get(contractId);
  if (!componentName)
    throw new Error(`${contractId}: OpenAPI component 이름이 없습니다.`);
  return { $ref: `#/components/schemas/${componentName}` };
}

function unique(values) {
  return [...new Set(values)];
}

function requireExample(examples, exampleId, location) {
  if (!examples.has(exampleId)) {
    throw new Error(`${location}: 승인 예제 ${exampleId}를 찾을 수 없습니다.`);
  }
  return clone(examples.get(exampleId));
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

function buildOperation(apiContract, baseline) {
  const { bundle, fixture, flow } = baseline;
  const contracts = contractMap(bundle);
  const specification = apiContract.specification;
  const authorization = contracts.get(specification.authorization_ref);
  if (!authorization) {
    throw new Error(
      `${apiContract.id}: 권한 계약 ${specification.authorization_ref}가 없습니다.`,
    );
  }

  const successMock = fixture.api_mocks.find(
    (mock) =>
      mock.contract_ref === apiContract.id && mock.scenario === "success",
  );
  if (!successMock) throw new Error(`${apiContract.id}: 성공 예제가 없습니다.`);
  const dataExamples = new Map(
    fixture.data_examples.map((example) => [example.id, example.value]),
  );
  const errorExamples = new Map(
    fixture.error_examples.map((example) => [
      example.contract_ref,
      example.body,
    ]),
  );

  const traceContracts = unique([
    apiContract.id,
    specification.authorization_ref,
    specification.request.body_contract_ref,
    specification.success.body_contract_ref,
    ...specification.error_refs,
    "DATA:http.problem_details@R1",
  ]);

  const operation = {
    summary: apiContract.summary_ko,
    operationId: specification.operation_id,
    tags: ["Purchase Requests"],
    "x-vada-permission": authorization.key,
    "x-vada-contracts": traceContracts,
    "x-vada-acceptance-criteria": OPERATION_AC_IDS.get(apiContract.id).map(
      (acId) => qualifyAcId(flow, acId),
    ),
  };

  if (specification.request.parameters.length > 0) {
    operation.parameters = specification.request.parameters.map((parameter) => {
      const rendered = clone(parameter);
      if (parameter.in === "path") {
        rendered.example =
          successMock.request.path_parameters?.[parameter.name];
      } else if (parameter.in === "query") {
        rendered.example =
          successMock.request.query_parameters?.[parameter.name];
      } else if (parameter.in === "header") {
        const header = Object.entries(successMock.request.headers ?? {}).find(
          ([name]) => name.toLowerCase() === parameter.name.toLowerCase(),
        );
        rendered.example = header?.[1];
      }
      return rendered;
    });
  }

  if (specification.request.body_contract_ref !== "DATA:http.empty_body@R1") {
    operation.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: schemaReference(specification.request.body_contract_ref),
          example: requireExample(
            dataExamples,
            successMock.request.body_example_ref,
            `${apiContract.id} request`,
          ),
        },
      },
    };
  }

  const successStatus = String(specification.success.http_status);
  const successResponse = { description: "성공" };
  if (specification.success.body_contract_ref !== "DATA:http.empty_body@R1") {
    successResponse.content = {
      "application/json": {
        schema: schemaReference(specification.success.body_contract_ref),
        example: requireExample(
          dataExamples,
          successMock.response.body_example_ref,
          `${apiContract.id} response`,
        ),
      },
    };
  }
  operation.responses = { [successStatus]: successResponse };

  for (const errorRef of specification.error_refs) {
    const errorContract = contracts.get(errorRef);
    if (!errorContract)
      throw new Error(`${apiContract.id}: 오류 계약 ${errorRef}가 없습니다.`);
    operation.responses[String(errorContract.specification.http_status)] = {
      description: errorContract.summary_ko,
      "x-vada-contract": errorRef,
      content: {
        "application/problem+json": {
          schema: schemaReference("DATA:http.problem_details@R1"),
          example: requireExample(
            errorExamples,
            errorRef,
            `${apiContract.id} error response`,
          ),
        },
      },
    };
  }

  return operation;
}

export function buildPurchaseRequestOpenApi(baseline) {
  const { bundle, fixture, flow, workItem } = baseline;
  assertGenerationBaseline(baseline);
  const contracts = contractMap(bundle);
  const paths = {};

  for (const apiContractId of API_CONTRACT_IDS) {
    const apiContract = contracts.get(apiContractId);
    if (!apiContract)
      throw new Error(`${apiContractId}: 승인 API 계약이 없습니다.`);
    const path = apiContract.specification.path;
    const method = apiContract.specification.method.toLowerCase();
    paths[path] ??= {};
    paths[path][method] = buildOperation(apiContract, baseline);
  }

  return {
    openapi: "3.1.1",
    jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
    info: {
      title: "VADA Purchase Request API",
      version: `CB-FIN-001-R${bundle.bundle_revision}`,
      description:
        "승인된 행사 구매 요청 HTTP 계약의 생성 클라이언트 입력입니다.",
    },
    "x-vada-contract-bundle": {
      id: bundle.bundle_id,
      revision: bundle.bundle_revision,
      canonicalSha256: canonicalSha256(bundle),
    },
    "x-vada-delivery-work": workItem.id,
    "x-vada-completion-evidence": EVIDENCE_ID,
    paths,
    components: {
      schemas: buildSchemas(bundle),
    },
  };
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
  const workItem = deliveryWork.work_items?.find(
    (item) => item.id === WORK_ITEM_ID,
  );
  if (!workItem)
    throw new Error(`${WORK_ITEM_ID}: 승인 작업을 찾을 수 없습니다.`);
  return { openApi, bundle, fixture, solution, flow, deliveryWork, workItem };
}

export function validatePurchaseRequestOpenApiDocument(openApi, baseline) {
  const errors = [];
  const { bundle, flow, solution, workItem } = baseline;
  const contracts = contractMap(bundle);
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
    errors.push(`${WORK_ITEM_ID}: contract_refs가 EVID-012 범위와 다릅니다.`);
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

async function snapshotDirectory(directory) {
  const files = [];
  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries.sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    )) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) {
        const contents = await readFile(path);
        files.push({
          path: normalizePath(relative(directory, path)),
          sha256: sha256(contents),
        });
      }
    }
  }
  await visit(directory);
  return files;
}

async function expectedGeneratedManifest(root) {
  const [input, config, packageDocument, files] = await Promise.all([
    readFile(resolve(root, OPENAPI_PATH)),
    readFile(resolve(root, CLIENT_CONFIG_PATH)),
    readJson(root, CLIENT_PACKAGE_PATH),
    snapshotDirectory(resolve(root, GENERATED_DIRECTORY)),
  ]);
  return {
    schema_version: "1.0.0",
    generator: {
      package: GENERATOR_PACKAGE,
      version: packageDocument.devDependencies?.[GENERATOR_PACKAGE],
    },
    input: { path: OPENAPI_PATH, sha256: sha256(input) },
    config: { path: CLIENT_CONFIG_PATH, sha256: sha256(config) },
    files,
  };
}

export async function validateGeneratedClientRepository(root = repositoryRoot) {
  const errors = [];
  const warnings = [];
  try {
    const [manifest, expected] = await Promise.all([
      readJson(root, GENERATED_MANIFEST_PATH),
      expectedGeneratedManifest(root),
    ]);
    if (expected.generator.version !== GENERATOR_VERSION) {
      errors.push(
        `${GENERATOR_PACKAGE}는 정확히 ${GENERATOR_VERSION}으로 고정해야 합니다.`,
      );
    }
    if (manifest.input?.sha256 !== expected.input.sha256) {
      errors.push("OpenAPI 입력 드리프트를 생성 manifest가 탐지했습니다.");
    }
    if (manifest.config?.sha256 !== expected.config.sha256) {
      errors.push("Hey API 설정 드리프트를 생성 manifest가 탐지했습니다.");
    }
    if (!equalJson(manifest.files, expected.files)) {
      errors.push("생성 클라이언트 드리프트를 탐지했습니다.");
    }
    if (!equalJson(manifest, expected)) {
      errors.push("생성 manifest가 현재 입력·설정·파일과 다릅니다.");
    }
  } catch (error) {
    errors.push(`${GENERATED_MANIFEST_PATH}: ${error.message}`);
  }
  return { errors, warnings };
}

export async function generateClientSnapshot(root = repositoryRoot) {
  const temporaryDirectory = await mkdtemp(
    resolve(tmpdir(), "vada-api-client-generate-"),
  );
  try {
    const cliPath = resolve(
      root,
      "packages/api-client/node_modules/@hey-api/openapi-ts/bin/run.js",
    );
    await execFileAsync(
      process.execPath,
      [
        cliPath,
        "--file",
        resolve(root, CLIENT_CONFIG_PATH),
        "--output",
        temporaryDirectory,
        "--silent",
        "--no-log-file",
      ],
      {
        cwd: resolve(root, "packages/api-client"),
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    return await snapshotDirectory(temporaryDirectory);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function writeOpenApi(root) {
  const baseline = await loadPurchaseRequestOpenApiBaseline(root);
  const openApi = buildPurchaseRequestOpenApi(baseline);
  const outputPath = resolve(root, OPENAPI_PATH);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serializeJson(openApi));
}

async function writeGeneratedManifest(root) {
  const manifest = await expectedGeneratedManifest(root);
  const outputPath = resolve(root, GENERATED_MANIFEST_PATH);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serializeJson(manifest));
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes("--write-openapi")) {
    await writeOpenApi(repositoryRoot);
    console.log(`${OPENAPI_PATH} 생성 완료`);
  } else if (process.argv.includes("--write-manifest")) {
    await writeGeneratedManifest(repositoryRoot);
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
