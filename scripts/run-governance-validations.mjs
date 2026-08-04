import { performance } from "node:perf_hooks";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { deriveAllDeliveryStatuses } from "./derive-delivery-status.mjs";
import { validateContractBundleRepository } from "./validate-contract-bundles.mjs";
import { validateContractFixtureRepository } from "./validate-contract-fixtures.mjs";
import { validateRepository as validateContractRepository } from "./validate-contracts.mjs";
import { validateDeliveryWorkPlanRepository } from "./validate-delivery-work-plan.mjs";
import { validateExecutionPlanRepository } from "./validate-execution-plan.mjs";
import { validateExecutionRuntimeRepository } from "./validate-execution-runtime.mjs";
import { validateArchitectureRepository } from "./validate-implementation-architecture.mjs";
import { validateProductRepository } from "./validate-product-specs.mjs";
import {
  validateGeneratedClientRepository,
  validatePurchaseRequestOpenApiRepository,
} from "./validate-purchase-request-openapi-client.mjs";
import { validateScreenSpecRepository } from "./validate-screen-specs.mjs";
import { validateWorkflowPolicyRepository } from "./validate-workflow-policy.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function mergeValidationResults(...results) {
  return {
    errors: results.flatMap((result) => result.errors ?? []),
    warnings: results.flatMap((result) => result.warnings ?? []),
  };
}

export const governanceValidations = Object.freeze([
  {
    id: "workflow-policy",
    label: "워크플로 정책",
    run: async (root) => ({
      errors: await validateWorkflowPolicyRepository(root),
      warnings: [],
    }),
  },
  {
    id: "contracts",
    label: "계약",
    run: validateContractRepository,
  },
  {
    id: "contract-bundles",
    label: "실행 계약 묶음",
    run: validateContractBundleRepository,
  },
  {
    id: "contract-fixtures",
    label: "계약 픽스처",
    run: validateContractFixtureRepository,
  },
  {
    id: "purchase-request-openapi-client",
    label: "구매 요청 OpenAPI·생성 클라이언트",
    run: async (root) =>
      mergeValidationResults(
        await validatePurchaseRequestOpenApiRepository(root),
        await validateGeneratedClientRepository(root),
      ),
  },
  {
    id: "product-specs",
    label: "제품 명세",
    run: validateProductRepository,
  },
  {
    id: "implementation-architecture",
    label: "구현 아키텍처",
    run: validateArchitectureRepository,
  },
  {
    id: "delivery-work",
    label: "전달 작업 그래프",
    run: validateDeliveryWorkPlanRepository,
  },
  {
    id: "screen-specs",
    label: "화면 명세",
    run: validateScreenSpecRepository,
  },
  {
    id: "execution-plan",
    label: "실행 계획",
    run: validateExecutionPlanRepository,
  },
  {
    id: "execution-runtime",
    label: "실행 런타임",
    run: validateExecutionRuntimeRepository,
  },
  {
    id: "delivery-status",
    label: "전달 상태 파생",
    run: deriveAllDeliveryStatuses,
  },
]);

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export async function runGovernanceValidations({
  root = repositoryRoot,
  validations = governanceValidations,
} = {}) {
  const results = [];
  for (const validation of validations) {
    const started = performance.now();
    try {
      const result = await validation.run(root);
      results.push({
        id: validation.id,
        label: validation.label,
        errors: result.errors ?? [],
        warnings: result.warnings ?? [],
        durationMs: performance.now() - started,
      });
    } catch (error) {
      results.push({
        id: validation.id,
        label: validation.label,
        errors: [`실행 실패: ${errorMessage(error)}`],
        warnings: [],
        durationMs: performance.now() - started,
      });
    }
  }
  return {
    results,
    failures: results.filter((result) => result.errors.length > 0),
  };
}

export async function runGovernanceValidationCli({
  root = repositoryRoot,
  validations = governanceValidations,
  writeOut = console.log,
  writeError = console.error,
} = {}) {
  const report = await runGovernanceValidations({ root, validations });
  for (const result of report.results) {
    for (const warning of result.warnings) {
      writeError(`WARN [${result.id}] ${warning}`);
    }
    for (const error of result.errors) {
      writeError(`ERROR [${result.id}] ${error}`);
    }
    if (result.errors.length === 0) {
      writeOut(`PASS [${result.id}] ${result.label} (${Math.round(result.durationMs)}ms)`);
    }
  }
  if (report.failures.length > 0) {
    writeError(`거버넌스 검증 실패: ${report.failures.length}/${report.results.length}개`);
    return 1;
  }
  writeOut(`거버넌스 검증 통과: ${report.results.length}개`);
  return 0;
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exitCode = await runGovernanceValidationCli();
