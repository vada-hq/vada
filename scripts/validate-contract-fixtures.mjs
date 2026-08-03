import { readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

import { canonicalSha256 } from "./validate-contract-bundles.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function sorted(values) {
  return [...values].sort();
}

function formatSchemaErrors(schemaErrors) {
  return (schemaErrors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.message} (${error.keyword})`)
    .join(", ");
}

function buildDataValidators(bundle, errors) {
  const ajv = new Ajv2020({ strict: true, allErrors: true, allowUnionTypes: true });
  const validators = new Map();
  const dataContracts = bundle.contracts.filter((contract) => contract.kind === "DATA");

  for (const contract of dataContracts) {
    const schema = contract.specification?.json_schema;
    if (!isObject(schema) || typeof schema.$id !== "string") {
      errors.push(`${contract.id}: 검증 가능한 JSON Schema가 없습니다.`);
      continue;
    }
    try {
      if (!ajv.getSchema(schema.$id)) ajv.addSchema(schema, schema.$id);
    } catch (error) {
      errors.push(`${contract.id}: JSON Schema 등록 실패: ${error.message}`);
    }
  }

  for (const contract of dataContracts) {
    const schemaId = contract.specification?.json_schema?.$id;
    if (!schemaId) continue;
    try {
      const validator = ajv.getSchema(schemaId);
      if (validator) validators.set(contract.id, validator);
      else errors.push(`${contract.id}: JSON Schema 검증기를 만들 수 없습니다.`);
    } catch (error) {
      errors.push(`${contract.id}: JSON Schema 컴파일 실패: ${error.message}`);
    }
  }

  return { ajv, validators };
}

function isUtcTimestamp(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function validateRecordSemantics(value, location, errors) {
  if (!isObject(value) || !isObject(value.content) || !Array.isArray(value.content.items)) return;
  if (!Array.isArray(value.itemResults)) return;

  if (value.itemResults.length !== value.content.items.length) {
    errors.push(`${location}: itemResults는 content.items와 같은 수의 품목을 가져야 합니다.`);
    return;
  }

  let total = 0;
  value.itemResults.forEach((result, index) => {
    const item = value.content.items[index];
    const expectedAmount = item.quantity * item.estimatedUnitPrice;
    total += expectedAmount;
    if (result.itemPosition !== index) {
      errors.push(`${location}/itemResults/${index}: itemPosition은 ${index}이어야 합니다.`);
    }
    if (result.estimatedAmount !== expectedAmount) {
      errors.push(`${location}/itemResults/${index}: 수량과 예상 단가로 계산한 금액과 다릅니다.`);
    }
  });
  if (value.estimatedTotal !== total) {
    errors.push(`${location}/estimatedTotal: 품목 계산 금액 합계와 다릅니다.`);
  }
  if (!isUtcTimestamp(value.createdAt)) {
    errors.push(`${location}/createdAt: UTC 시각이어야 합니다.`);
  }
}

function validateDataSemantics(contractRef, value, location, errors) {
  if (contractRef === "DATA:purchase_request.record@R1") {
    validateRecordSemantics(value, location, errors);
  } else if (contractRef === "DATA:purchase_request.draft@R1") {
    if (isObject(value) && !isUtcTimestamp(value.savedAt)) {
      errors.push(`${location}/savedAt: UTC 시각이어야 합니다.`);
    }
  } else if (contractRef === "DATA:purchase_request.editor_state@R1") {
    if (isObject(value?.draft) && !isUtcTimestamp(value.draft.savedAt)) {
      errors.push(`${location}/draft/savedAt: UTC 시각이어야 합니다.`);
    }
  } else if (contractRef === "DATA:purchase_request.own_list@R1") {
    if (!Array.isArray(value?.items)) return;
    let previousTimestamp = Number.POSITIVE_INFINITY;
    value.items.forEach((item, index) => {
      if (!isUtcTimestamp(item.createdAt)) {
        errors.push(`${location}/items/${index}/createdAt: UTC 시각이어야 합니다.`);
        return;
      }
      const timestamp = Date.parse(item.createdAt);
      if (timestamp > previousTimestamp) {
        errors.push(`${location}/items: createdAt 내림차순이어야 합니다.`);
      }
      previousTimestamp = timestamp;
    });
  } else if (contractRef === "DATA:purchase_request.submitted_event@R1") {
    if (isObject(value) && !isUtcTimestamp(value.submittedAt)) {
      errors.push(`${location}/submittedAt: UTC 시각이어야 합니다.`);
    }
  }
}

function findHeader(headers, name) {
  if (!isObject(headers)) return undefined;
  const target = name.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === target);
  return entry?.[1];
}

function validateParameter(parameter, request, ajv, location, errors) {
  let value;
  if (parameter.in === "path") value = request.path_parameters?.[parameter.name];
  else if (parameter.in === "query") value = request.query_parameters?.[parameter.name];
  else if (parameter.in === "header") value = findHeader(request.headers, parameter.name);

  if (parameter.required && value === undefined) {
    errors.push(`${location}: 필수 ${parameter.in} 매개변수 ${parameter.name}가 없습니다.`);
    return;
  }
  if (value === undefined) return;

  try {
    const validate = ajv.compile(parameter.schema);
    if (!validate(value)) {
      errors.push(`${location}: ${parameter.name} 값이 계약과 다릅니다: ${formatSchemaErrors(validate.errors)}`);
    }
  } catch (error) {
    errors.push(`${location}: ${parameter.name} 스키마 검증 실패: ${error.message}`);
  }
}

function validateDataValue(contractRef, value, expectedValid, expectedKeywords, validators, location, errors) {
  const validate = validators.get(contractRef);
  if (!validate) {
    errors.push(`${location}: DATA 계약 검증기 ${contractRef}를 찾을 수 없습니다.`);
    return;
  }

  const actualValid = validate(value);
  if (actualValid !== expectedValid) {
    errors.push(
      `${location}: ${contractRef} 검증 결과가 expected_valid=${expectedValid}와 다릅니다: ${formatSchemaErrors(validate.errors)}`,
    );
    return;
  }

  if (!actualValid) {
    const actualKeywords = new Set((validate.errors ?? []).map((error) => error.keyword));
    for (const keyword of expectedKeywords ?? []) {
      if (!actualKeywords.has(keyword)) {
        errors.push(`${location}: 의도한 실패 키워드 ${keyword}가 발생하지 않았습니다.`);
      }
    }
  } else {
    validateDataSemantics(contractRef, value, location, errors);
  }
}

export function validateContractFixtureDocument(fixture, bundle, { workItem } = {}) {
  const errors = [];
  if (!isObject(fixture)) return ["계약 픽스처는 JSON 객체여야 합니다."];
  if (!isObject(bundle)) return ["승인 계약 묶음은 JSON 객체여야 합니다."];

  if (fixture.schema_version !== "0.1.0") errors.push("지원하는 픽스처 schema_version은 0.1.0입니다.");
  if (fixture.fixture_set_id !== "CF-FIN-001" || fixture.fixture_set_revision !== 1) {
    errors.push("구매 요청 픽스처 안정 ID와 리비전이 올바르지 않습니다.");
  }
  if (bundle.bundle_status !== "approved") errors.push("승인되지 않은 계약 묶음은 픽스처 기준선이 될 수 없습니다.");

  const bundleRef = fixture.contract_bundle_ref;
  if (!isObject(bundleRef)) {
    errors.push("contract_bundle_ref가 필요합니다.");
  } else {
    if (bundleRef.bundle_id !== bundle.bundle_id || bundleRef.bundle_revision !== bundle.bundle_revision) {
      errors.push("계약 묶음 ID 또는 리비전이 다릅니다.");
    }
    if (bundleRef.canonical_sha256 !== canonicalSha256(bundle)) {
      errors.push("계약 묶음 해시가 승인 기준선과 다릅니다.");
    }
  }

  const contracts = new Map((bundle.contracts ?? []).map((contract) => [contract.id, contract]));
  const contractRefs = Array.isArray(fixture.contract_refs) ? fixture.contract_refs : [];
  if (!Array.isArray(fixture.contract_refs) || fixture.contract_refs.length === 0) {
    errors.push("검증할 contract_refs가 필요합니다.");
  }
  for (const duplicate of duplicateValues(contractRefs)) errors.push(`중복 계약 참조 ${duplicate}입니다.`);
  for (const contractRef of contractRefs) {
    const contract = contracts.get(contractRef);
    if (!contract || contract.status !== "ratified") {
      errors.push(`확정 계약 ${contractRef}를 승인 묶음에서 찾을 수 없습니다.`);
    }
  }
  if (workItem && JSON.stringify(sorted(contractRefs)) !== JSON.stringify(sorted(workItem.contract_refs ?? []))) {
    errors.push(`${workItem.id}: 픽스처 계약 범위가 승인 작업의 contract_refs와 다릅니다.`);
  }

  const validatorErrors = [];
  const { ajv, validators } = buildDataValidators(bundle, validatorErrors);
  errors.push(...validatorErrors);

  const dataExamples = Array.isArray(fixture.data_examples) ? fixture.data_examples : [];
  const errorExamples = Array.isArray(fixture.error_examples) ? fixture.error_examples : [];
  const apiMocks = Array.isArray(fixture.api_mocks) ? fixture.api_mocks : [];
  if (dataExamples.length === 0) errors.push("data_examples가 필요합니다.");
  if (errorExamples.length === 0) errors.push("error_examples가 필요합니다.");
  if (apiMocks.length === 0) errors.push("api_mocks가 필요합니다.");

  for (const duplicate of duplicateValues(dataExamples.map((example) => example.id))) {
    errors.push(`중복 데이터 예제 ID ${duplicate}입니다.`);
  }
  for (const duplicate of duplicateValues(errorExamples.map((example) => example.id))) {
    errors.push(`중복 오류 예제 ID ${duplicate}입니다.`);
  }
  for (const duplicate of duplicateValues(apiMocks.map((example) => example.id))) {
    errors.push(`중복 API 모의 ID ${duplicate}입니다.`);
  }

  const dataExampleById = new Map(dataExamples.map((example) => [example.id, example]));
  const errorExampleById = new Map(errorExamples.map((example) => [example.id, example]));
  const dataCoverage = new Set();
  const errorCoverage = new Set();
  const apiSuccessCounts = new Map();

  dataExamples.forEach((example, exampleIndex) => {
    const expectations = Array.isArray(example.expectations) ? example.expectations : [];
    if (expectations.length === 0) errors.push(`/data_examples/${exampleIndex}: expectations가 필요합니다.`);
    expectations.forEach((expectation, expectationIndex) => {
      const location = `/data_examples/${exampleIndex}/expectations/${expectationIndex}`;
      const contract = contracts.get(expectation.contract_ref);
      if (contract?.kind !== "DATA") {
        errors.push(`${location}: DATA 계약 ${expectation.contract_ref}를 찾을 수 없습니다.`);
        return;
      }
      if (typeof expectation.expected_valid !== "boolean") {
        errors.push(`${location}: expected_valid는 boolean이어야 합니다.`);
        return;
      }
      dataCoverage.add(expectation.contract_ref);
      validateDataValue(
        expectation.contract_ref,
        example.value,
        expectation.expected_valid,
        expectation.expected_error_keywords,
        validators,
        location,
        errors,
      );
    });
  });

  errorExamples.forEach((example, exampleIndex) => {
    const location = `/error_examples/${exampleIndex}`;
    const errorContract = contracts.get(example.contract_ref);
    if (errorContract?.kind !== "ERROR") {
      errors.push(`${location}: ERROR 계약 ${example.contract_ref}를 찾을 수 없습니다.`);
      return;
    }
    errorCoverage.add(example.contract_ref);
    const specification = errorContract.specification;
    const detailsRef = specification.details_schema_ref;
    dataCoverage.add(detailsRef);
    validateDataValue(detailsRef, example.body, true, [], validators, `${location}/body`, errors);
    if (example.body?.status !== specification.http_status) {
      errors.push(`${location}: 오류 HTTP 상태가 계약과 다릅니다.`);
    }
    if (example.body?.code !== specification.code) {
      errors.push(`${location}: 안정 오류 코드가 계약과 다릅니다.`);
    }
    if (example.body?.type !== specification.problem_type_uri) {
      errors.push(`${location}: Problem Details type이 계약과 다릅니다.`);
    }
    if (example.body?.title !== specification.title_ko) {
      errors.push(`${location}: Problem Details title이 계약과 다릅니다.`);
    }
  });

  apiMocks.forEach((example, exampleIndex) => {
    const location = `/api_mocks/${exampleIndex}`;
    const apiContract = contracts.get(example.contract_ref);
    if (apiContract?.kind !== "API") {
      errors.push(`${location}: API 계약 ${example.contract_ref}를 찾을 수 없습니다.`);
      return;
    }
    const specification = apiContract.specification;
    const request = example.request ?? {};
    const response = example.response ?? {};
    if (request.method !== specification.method) errors.push(`${location}: 요청 method가 API 계약과 다릅니다.`);
    if (request.path !== specification.path) errors.push(`${location}: 요청 path가 API 계약과 다릅니다.`);
    for (const parameter of specification.request.parameters ?? []) {
      validateParameter(parameter, request, ajv, `${location}/request`, errors);
    }

    const requestBodyExample = dataExampleById.get(request.body_example_ref);
    if (!requestBodyExample) {
      errors.push(`${location}: 요청 본문 예제 ${request.body_example_ref}를 찾을 수 없습니다.`);
    } else {
      const requestBodyRef = specification.request.body_contract_ref;
      const expectedValid = example.request_body_valid !== false;
      dataCoverage.add(requestBodyRef);
      validateDataValue(
        requestBodyRef,
        requestBodyExample.value,
        expectedValid,
        example.expected_request_error_keywords,
        validators,
        `${location}/request/body_example_ref`,
        errors,
      );
    }

    if (example.scenario === "success") {
      apiSuccessCounts.set(example.contract_ref, (apiSuccessCounts.get(example.contract_ref) ?? 0) + 1);
      if (response.status !== specification.success.http_status) {
        errors.push(`${location}: API 성공 상태가 승인 계약과 다릅니다.`);
      }
      const responseBodyRef = specification.success.body_contract_ref;
      const responseBodyExample = dataExampleById.get(response.body_example_ref);
      if (!responseBodyExample) {
        errors.push(`${location}: 성공 응답 본문 예제 ${response.body_example_ref}를 찾을 수 없습니다.`);
      } else {
        dataCoverage.add(responseBodyRef);
        validateDataValue(
          responseBodyRef,
          responseBodyExample.value,
          true,
          [],
          validators,
          `${location}/response/body_example_ref`,
          errors,
        );
      }
      const expectedContentType = response.status === 204 ? null : "application/json";
      if (response.content_type !== expectedContentType) {
        errors.push(`${location}: 성공 응답 Content-Type이 계약 예제 규칙과 다릅니다.`);
      }
    } else if (example.scenario === "error") {
      const errorContract = contracts.get(example.error_contract_ref);
      if (errorContract?.kind !== "ERROR" || !specification.error_refs.includes(example.error_contract_ref)) {
        errors.push(`${location}: API가 선언하지 않은 오류 ${example.error_contract_ref}입니다.`);
        return;
      }
      if (example.request_body_valid === false && example.error_contract_ref !== "ERROR:purchase_request.validation_failed@R1") {
        errors.push(`${location}: 검증 실패 외의 오류 모의는 유효한 요청 본문을 사용해야 합니다.`);
      }
      const errorBodyExample = errorExampleById.get(response.body_example_ref);
      if (!errorBodyExample || errorBodyExample.contract_ref !== example.error_contract_ref) {
        errors.push(`${location}: 오류 응답 본문 예제가 error_contract_ref와 다릅니다.`);
      }
      if (response.status !== errorContract.specification.http_status) {
        errors.push(`${location}: 오류 응답 상태가 계약과 다릅니다.`);
      }
      if (response.content_type !== "application/problem+json") {
        errors.push(`${location}: 오류 응답 Content-Type은 application/problem+json이어야 합니다.`);
      }
    } else {
      errors.push(`${location}: scenario는 success 또는 error여야 합니다.`);
    }
  });

  for (const contractRef of contractRefs) {
    const kind = contracts.get(contractRef)?.kind;
    if (kind === "DATA" && !dataCoverage.has(contractRef)) {
      errors.push(`${contractRef}: 검증 예제에서 사용되지 않았습니다.`);
    } else if (kind === "ERROR" && !errorCoverage.has(contractRef)) {
      errors.push(`${contractRef}: Problem Details 예제가 없습니다.`);
    } else if (kind === "API" && apiSuccessCounts.get(contractRef) !== 1) {
      errors.push(`${contractRef}: 성공 API 모의 요청·응답이 정확히 하나 필요합니다.`);
    }
  }

  return errors;
}

function assertProjectRelative(root, path) {
  const absolute = resolve(root, path);
  const relativePath = relative(root, absolute);
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || relativePath.startsWith(sep)) {
    throw new Error(`프로젝트 밖 경로는 참조할 수 없습니다: ${path}`);
  }
  return absolute;
}

async function listJsonFiles(directory) {
  const result = [];
  async function visit(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.endsWith(".json")) result.push(path);
    }
  }
  await visit(directory);
  return result.sort();
}

export async function validateContractFixtureRepository(root = repositoryRoot) {
  const errors = [];
  const warnings = [];
  const fixturePaths = await listJsonFiles(resolve(root, "contracts/fixtures"));
  if (fixturePaths.length === 0) {
    return { errors: ["계약 픽스처 JSON 기준선이 없습니다."], warnings };
  }

  for (const fixturePath of fixturePaths) {
    const label = relative(root, fixturePath).replaceAll("\\", "/");
    try {
      const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
      const bundlePath = assertProjectRelative(root, fixture.contract_bundle_ref?.path);
      const deliveryWorkPath = assertProjectRelative(root, fixture.delivery_work_ref?.path);
      const [bundle, deliveryWork] = await Promise.all([
        readFile(bundlePath, "utf8").then(JSON.parse),
        readFile(deliveryWorkPath, "utf8").then(JSON.parse),
      ]);
      const workItem = deliveryWork.work_items?.find(
        (candidate) => candidate.id === fixture.delivery_work_ref?.work_item_id,
      );
      if (!workItem || workItem.status !== "ratified") {
        errors.push(`${label}: 승인 작업 ${fixture.delivery_work_ref?.work_item_id}을 찾을 수 없습니다.`);
        continue;
      }
      const documentErrors = validateContractFixtureDocument(fixture, bundle, { workItem });
      errors.push(...documentErrors.map((error) => `${label}: ${error}`));
    } catch (error) {
      errors.push(`${label}: ${error.message}`);
    }
  }

  return { errors, warnings };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { errors, warnings } = await validateContractFixtureRepository();
  for (const warning of warnings) console.warn(`WARN ${warning}`);
  if (errors.length > 0) {
    for (const error of errors) console.error(`ERROR ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`계약 픽스처 검증 통과: 오류 0, 경고 ${warnings.length}`);
  }
}
