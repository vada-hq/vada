import { isAbsolute } from "node:path";

export function normalizeRelativePath(rawPath, label) {
  if (typeof rawPath !== "string" || !rawPath || isAbsolute(rawPath)) {
    throw new Error(`${label} 경로는 프로젝트 상대 경로여야 합니다.`);
  }
  const segments = rawPath.split(/[\\/]+/);
  if (segments.includes("..")) {
    throw new Error(`${label} 경로에 상위 이동을 사용할 수 없습니다.`);
  }
  return segments.filter((segment) => segment !== ".").join("/");
}

export function validateSatisfiedPrerequisiteEvidence(
  item,
  evidenceLedger,
  expectedWorkPlan,
) {
  const errors = [];
  let locator;
  try {
    const hashIndex = item.evidence_locator?.lastIndexOf("#") ?? -1;
    if (hashIndex <= 0 || hashIndex === item.evidence_locator.length - 1) {
      throw new Error("경로와 증거 ID를 #으로 구분해야 합니다.");
    }
    const path = normalizeRelativePath(
      item.evidence_locator.slice(0, hashIndex),
      "완료 증거",
    );
    locator = `${path}#${item.evidence_locator.slice(hashIndex + 1)}`;
  } catch (error) {
    return [`완료 증거 locator가 유효하지 않습니다: ${error.message}`];
  }

  const record = evidenceLedger.get(locator);
  if (!record) return [`완료 증거 locator를 찾을 수 없습니다: ${locator}`];
  if (record.work_item_ref !== item.work_item_ref) {
    errors.push(
      `완료 증거의 작업 ID가 충족 선행 작업 ${item.work_item_ref}과 일치하지 않습니다.`,
    );
  }
  if (
    expectedWorkPlan &&
    (record.work_plan_path !== expectedWorkPlan.path ||
      record.work_plan_id !== expectedWorkPlan.plan_id ||
      record.work_plan_revision !== expectedWorkPlan.plan_revision ||
      record.work_plan_sha256 !== expectedWorkPlan.canonical_sha256)
  ) {
    errors.push("완료 증거의 작업 그래프 계보가 충족 선행 작업의 고정 원본과 일치하지 않습니다.");
  }
  if (!(record.required_requirement_refs ?? []).includes(record.requirement_ref)) {
    errors.push("완료 증거의 완료 요구사항 ID가 고정 작업 정의와 일치하지 않습니다.");
  }
  if (record.verification_status !== "verified") {
    errors.push("완료 증거의 검증 상태가 verified가 아닙니다.");
  }
  if (!record.evidence_kind_matches) {
    errors.push("완료 증거의 종류가 완료 요구사항과 일치하지 않습니다.");
  }
  if (!record.verifier_valid || !record.verification_time_present) {
    errors.push("완료 증거가 독립 검증자와 검증 시각을 갖추지 않았습니다.");
  }
  if (record.run_status !== "done") {
    errors.push("완료 증거가 속한 작업 실행 상태가 done이 아닙니다.");
  }
  if (!record.all_requirements_verified) {
    errors.push("작업의 모든 완료 요구사항에 검증된 증거가 없습니다.");
  }
  return errors;
}
