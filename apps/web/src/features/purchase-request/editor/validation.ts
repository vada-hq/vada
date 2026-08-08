import type { PurchaseRequestDraftContent } from "@vada/api-client";

import type { FieldError } from "../../../shared/screen/states";

/** 오늘을 KST 기준 `YYYY-MM-DD`로 준다. 저장은 UTC지만 사람이 고르는 날은 KST다. */
export function todayInSeoul(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * 서버가 최종 판정한다. 이 검증은 빈 요청을 서버로 보내지 않기 위한 사전 확인이며
 * 계약과 흐름 정본에 없는 규칙을 새로 만들지 않는다.
 *
 * 규칙이 계약에만 있는 것이 아니다. `FLOW-FIN-001` STEP-02가 "오늘 이전 필요일을
 * 허용하지 않는다"를 갖는데, 계약과 화면 정본만 읽던 때는 그것이 빠져 있었다.
 */
export function validateEditorInput(
  content: PurchaseRequestDraftContent,
  today: string = todayInSeoul(),
): FieldError[] {
  const errors: FieldError[] = [];

  if (!content.title?.trim()) {
    errors.push({
      controlId: "request-title",
      label: "요청 제목",
      message: "요청 제목을 입력해 주세요.",
    });
  }

  if (!content.neededDate) {
    errors.push({
      controlId: "request-needed-date",
      label: "필요한 날짜",
      message: "필요한 날짜를 선택해 주세요.",
    });
  } else if (content.neededDate < today) {
    errors.push({
      controlId: "request-needed-date",
      label: "필요한 날짜",
      message: "지난 날짜는 고를 수 없습니다. 오늘 이후로 골라 주세요.",
    });
  }

  if (!content.purpose?.trim()) {
    errors.push({
      controlId: "request-purpose",
      label: "구매 목적",
      message: "구매 목적을 입력해 주세요.",
    });
  }

  const items = content.items ?? [];
  if (!items.length) {
    errors.push({
      controlId: "item-0-name",
      label: "품목",
      message: "최소 한 개 품목이 필요합니다.",
    });
  }

  items.forEach((item, index) => {
    const at = (field: string, label: string, message: string) =>
      errors.push({
        controlId: `item-${index}-${field}`,
        label: `${index + 1}번 품목 ${label}`,
        message,
      });

    if (!item.name?.trim()) at("name", "품목명", "품목명을 입력해 주세요.");
    // 화면이 별표로 필수라고 말한다. 말한 것을 확인하지 않으면 서버까지 가서 막힌다.
    if (!item.category?.trim()) {
      at("category", "품목 카테고리", "품목 카테고리를 골라 주세요.");
    }
    if (!item.budgetItem?.trim()) {
      at("budget-item", "예산 항목", "예산 항목을 골라 주세요.");
    }
    if (!item.quantity || item.quantity <= 0) {
      at("quantity", "수량", "수량을 입력해 주세요.");
    }
    if (!item.unit?.trim()) at("unit", "단위", "단위를 입력해 주세요.");
    if (!item.estimatedUnitPrice || item.estimatedUnitPrice <= 0) {
      at("price", "예상 단가", "예상 단가를 입력해 주세요.");
    }
  });

  return errors;
}
