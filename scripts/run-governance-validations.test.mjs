import assert from "node:assert/strict";
import test from "node:test";

import {
  governanceValidations,
  runGovernanceValidationCli,
} from "./run-governance-validations.mjs";

test("집계 검증 실패를 종료 코드로 전파하고 실패 검증기를 식별한다", async () => {
  const stdout = [];
  const stderr = [];
  const exitCode = await runGovernanceValidationCli({
    root: "unused",
    validations: [
      {
        id: "passing-validator",
        label: "통과 검증기",
        run: async () => ({ errors: [], warnings: [] }),
      },
      {
        id: "failing-validator",
        label: "실패 검증기",
        run: async () => ({ errors: ["의도한 실패"], warnings: [] }),
      },
    ],
    writeOut: (line) => stdout.push(line),
    writeError: (line) => stderr.push(line),
  });

  assert.equal(exitCode, 1);
  assert.match(stderr.join("\n"), /ERROR \[failing-validator\] 의도한 실패/);
  assert.doesNotMatch(stderr.join("\n"), /passing-validator/);
});

test("검증기 예외도 해당 검증기 실패로 전파하고 후속 검증을 계속한다", async () => {
  let laterValidatorRan = false;
  const stderr = [];
  const exitCode = await runGovernanceValidationCli({
    root: "unused",
    validations: [
      {
        id: "throwing-validator",
        label: "예외 검증기",
        run: async () => {
          throw new Error("예외 실패");
        },
      },
      {
        id: "later-validator",
        label: "후속 검증기",
        run: async () => {
          laterValidatorRan = true;
          return { errors: [], warnings: [] };
        },
      },
    ],
    writeOut: () => {},
    writeError: (line) => stderr.push(line),
  });

  assert.equal(exitCode, 1);
  assert.equal(laterValidatorRan, true);
  assert.match(stderr.join("\n"), /ERROR \[throwing-validator\] 실행 실패: 예외 실패/);
});

test("기존 거버넌스 검증 항목을 빠짐없이 보존한다", () => {
  assert.deepEqual(
    governanceValidations.map((validation) => validation.id),
    [
      "workflow-policy",
      "contracts",
      "contract-bundles",
      "contract-fixtures",
      "purchase-request-openapi-client",
      "product-specs",
      "implementation-architecture",
      "delivery-work",
      "screen-specs",
      "execution-plan",
      "execution-runtime",
      "delivery-status",
    ],
  );
});
