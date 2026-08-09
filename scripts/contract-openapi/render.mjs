/**
 * 계약 묶음을 OpenAPI 문서로 옮긴다. **이 파일은 어느 묶음인지 모른다.**
 *
 * 묶음마다 다른 것은 전부 `profile`로 받는다 — 어떤 계약을 낼지, 스키마를 어떤
 * 이름의 component로 부를지, 문서와 operation에 무슨 추적 정보를 붙일지.
 *
 * 전에는 이 변환이 승인 기록 검증·생성 결과 검증과 한 파일에 있었고, 그래서
 * "구매 요청 계약 하나 전용"으로 보였다. 실제로는 셋 중 **변환만** 묶음에
 * 무관하다. 다른 묶음에는 `delivery-units`도 `solutions`도 아예 없어서 나머지
 * 둘은 적용될 자리조차 없다.
 */
import { clone, isObject, unique } from "./json.mjs";

const EMPTY_BODY = "DATA:http.empty_body@R1";
const PROBLEM_DETAILS = "DATA:http.problem_details@R1";

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

export function buildSchemas(contracts, dataComponents) {
  const schemaIdToComponent = new Map();
  for (const [contractId, componentName] of dataComponents) {
    const schemaId = contracts.get(contractId)?.specification?.json_schema?.$id;
    if (schemaId) schemaIdToComponent.set(schemaId, componentName);
  }

  const schemas = {};
  for (const [contractId, componentName] of dataComponents) {
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

function schemaReference(contractId, dataComponents) {
  const componentName = dataComponents.get(contractId);
  if (!componentName)
    throw new Error(`${contractId}: OpenAPI component 이름이 없습니다.`);
  return { $ref: `#/components/schemas/${componentName}` };
}

function requireExample(examples, exampleId, location) {
  if (!examples.has(exampleId)) {
    throw new Error(`${location}: 승인 예제 ${exampleId}를 찾을 수 없습니다.`);
  }
  return clone(examples.get(exampleId));
}

export function buildOperation(apiContract, baseline, profile) {
  const { contracts, fixture } = baseline;
  const { dataComponents, tags, operationExtensions } = profile;
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
    PROBLEM_DETAILS,
  ]);

  const operation = {
    summary: apiContract.summary_ko,
    operationId: specification.operation_id,
    tags,
    "x-vada-permission": authorization.key,
    "x-vada-contracts": traceContracts,
    ...operationExtensions(apiContract, baseline),
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

  if (specification.request.body_contract_ref !== EMPTY_BODY) {
    operation.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: schemaReference(
            specification.request.body_contract_ref,
            dataComponents,
          ),
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
  if (specification.success.body_contract_ref !== EMPTY_BODY) {
    successResponse.content = {
      "application/json": {
        schema: schemaReference(
          specification.success.body_contract_ref,
          dataComponents,
        ),
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
          schema: schemaReference(PROBLEM_DETAILS, dataComponents),
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

/**
 * 승인 계약 묶음 하나를 OpenAPI 문서로 만든다.
 *
 * `profile.assertBaseline`이 먼저 돈다. 승인되지 않은 것으로 문서를 만들면
 * 그 문서에서 생성된 클라이언트가 승인 밖의 계약을 화면에 실어 나른다.
 */
export function renderOpenApi(baseline, profile) {
  const { contracts } = baseline;
  const { apiContractIds, dataComponents, info, documentExtensions } = profile;

  profile.assertBaseline(baseline);

  const paths = {};
  for (const apiContractId of apiContractIds) {
    const apiContract = contracts.get(apiContractId);
    if (!apiContract)
      throw new Error(`${apiContractId}: 승인 API 계약이 없습니다.`);
    const path = apiContract.specification.path;
    const method = apiContract.specification.method.toLowerCase();
    paths[path] ??= {};
    paths[path][method] = buildOperation(apiContract, baseline, profile);
  }

  return {
    openapi: "3.1.1",
    jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
    info: info(baseline),
    ...documentExtensions(baseline),
    paths,
    components: {
      schemas: buildSchemas(contracts, dataComponents),
    },
  };
}
