import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import test from "node:test";

import { validateWorkflowPolicyDocument } from "./validate-workflow-policy.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function validPolicy() {
  return {
    schema_version: "0.1.0",
    policy_id: "WORKFLOW-POLICY-VADA",
    policy_revision: 1,
    status: "approved",
    updated_at: "2026-08-04T00:00:00Z",
    approval_basis: {
      type: "user_statement",
      captured_at: "2026-08-04T00:00:00Z",
      content_ko: "검증용 승인 근거",
    },
    people: [
      {
        id: "HUMAN:yun-jongun",
        display_name_ko: "윤종운",
        capabilities: ["product_planning", "experience_design"],
      },
      {
        id: "HUMAN:hwang-seonguk",
        display_name_ko: "황성욱",
        capabilities: ["development", "accountability"],
      },
    ],
    responsibility_defaults: {
      product_planning: "HUMAN:yun-jongun",
      experience_design: "HUMAN:yun-jongun",
      development: "HUMAN:hwang-seonguk",
      accountable_owner: "HUMAN:hwang-seonguk",
      default_assignee: "HUMAN:hwang-seonguk",
    },
    assurance_profiles: {
      mechanical: {
        separate_verifier_required: false,
        human_approval_required: false,
        coordinator_review_required: true,
        required_checks: ["scoped"],
      },
      standard: {
        separate_verifier_required: true,
        human_approval_required: false,
        coordinator_review_required: true,
        required_checks: ["scoped"],
      },
      high_assurance: {
        separate_verifier_required: true,
        human_approval_required: true,
        coordinator_review_required: true,
        required_checks: ["scoped", "full_integration"],
      },
    },
    risk_routes: [
      "product_policy",
      "authorization",
      "tenant_isolation",
      "financial_atomicity",
      "database_migration",
      "breaking_contract",
      "workflow_governance",
      "external_deployment",
      "destructive_operation",
    ].map((trigger) => ({ trigger, assurance_profile: "high_assurance" })),
  };
}

test("책임 기본값과 보증 등급이 연결된 정책을 허용한다", () => {
  assert.deepEqual(validateWorkflowPolicyDocument(validPolicy()), []);
});

test("등록되지 않은 사람을 책임 기본값으로 지정하면 거부한다", () => {
  const policy = validPolicy();
  policy.responsibility_defaults.development = "HUMAN:unknown";

  assert.match(validateWorkflowPolicyDocument(policy).join("\n"), /등록되지 않은 사람/);
});

test("고위험 변경을 낮은 보증 등급으로 우회하면 거부한다", () => {
  const policy = validPolicy();
  policy.risk_routes.find((item) => item.trigger === "authorization").assurance_profile =
    "standard";

  assert.match(validateWorkflowPolicyDocument(policy).join("\n"), /authorization.*high_assurance/);
});

test("보증 정책 자체의 변경을 고위험 검증에서 제외하면 거부한다", () => {
  const policy = validPolicy();
  policy.risk_routes = policy.risk_routes.filter(
    (item) => item.trigger !== "workflow_governance",
  );

  assert.match(
    validateWorkflowPolicyDocument(policy).join("\n"),
    /workflow_governance.*high_assurance/,
  );
});

test("저장소 정책은 현재 사람 책임 분담을 한 곳에서 고정한다", async () => {
  const policy = JSON.parse(
    await readFile(resolve(repositoryRoot, ".vada/workflow-policy.json"), "utf8"),
  );

  assert.deepEqual(validateWorkflowPolicyDocument(policy), []);
  assert.equal(policy.responsibility_defaults.product_planning, "HUMAN:yun-jongun");
  assert.equal(policy.responsibility_defaults.experience_design, "HUMAN:yun-jongun");
  assert.equal(policy.responsibility_defaults.development, "HUMAN:hwang-seonguk");
  assert.equal(policy.responsibility_defaults.accountable_owner, "HUMAN:hwang-seonguk");
  assert.equal(policy.responsibility_defaults.default_assignee, "HUMAN:hwang-seonguk");
});
