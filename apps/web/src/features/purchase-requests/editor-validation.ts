import type { PurchaseRequestDraftContent } from "@vada/api-client";

export interface FieldError {
  /** 오류 요약 링크가 포커스를 옮길 입력의 id다. */
  controlId: string;
  label: string;
  message: string;
}

/**
 * 서버가 최종 판정한다. 이 검증은 빈 요청을 서버로 보내지 않기 위한 사전 확인이며
 * 계약에 없는 규칙을 새로 만들지 않는다.
 */
export function validateEditorInput(
  content: PurchaseRequestDraftContent,
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
