import type { PurchaseRequestDraftContent } from "@vada/api-client";

import { FormField } from "../../../components/ui/form-field";
import { Input } from "../../../components/ui/input";

/**
 * 구매 유형별 상세와 가격 근거 입력이다. 작성 화면과 보완 재제출 화면이 같은
 * 폼을 써야 한다 — VADA_FINANCE_SPEC.md §7이 보완 대상 품목의 모든 입력값을
 * 고칠 수 있다고 정하기 때문이다.
 *
 * DraftItem이 아니라 details만 받는다. 재제출은 초안이 아니라 제출본이라
 * 담는 그릇이 다르고, 이 폼이 알아야 하는 것은 상세 값뿐이다.
 */
export type ItemDetails = NonNullable<
  NonNullable<PurchaseRequestDraftContent["items"]>[number]["details"]
>;

export type PurchaseType = NonNullable<
  NonNullable<PurchaseRequestDraftContent["items"]>[number]["purchaseType"]
>;

export const purchaseTypes: Array<{ value: PurchaseType; label: string }> = [
  { value: "general", label: "일반 구매" },
  { value: "manufacturing_printing", label: "제작·인쇄" },
  { value: "rental", label: "대여" },
  { value: "service", label: "용역" },
];

export function TypeDetails({
  details,
  onChange,
  prefix,
  type,
}: {
  details: ItemDetails;
  onChange: (patch: ItemDetails) => void;
  prefix: string;
  type: PurchaseType;
}) {

  if (type === "manufacturing_printing") {
    return (
      <div className="grid gap-loose sm:grid-cols-3">
        <FormField id={`${prefix}-kind`} label="제작물 종류">
          <Input
            onChange={(event) => onChange({ itemKind: event.target.value })}
            placeholder="예: 현수막, 굿즈"
            value={details.itemKind ?? ""}
          />
        </FormField>
        <FormField id={`${prefix}-spec`} label="사이즈 또는 규격">
          <Input
            onChange={(event) => onChange({ specification: event.target.value })}
            placeholder="예: 500x90cm"
            value={details.specification ?? ""}
          />
        </FormField>
        <FormField id={`${prefix}-color`} label="색상">
          <Input
            onChange={(event) => onChange({ color: event.target.value })}
            value={details.color ?? ""}
          />
        </FormField>
      </div>
    );
  }

  if (type === "rental" || type === "service") {
    return (
      <div className="grid gap-loose sm:grid-cols-2">
        <FormField id={`${prefix}-provider`} label="업체 또는 제공자">
          <Input
            onChange={(event) => onChange({ provider: event.target.value })}
            value={details.provider ?? ""}
          />
        </FormField>
        <FormField id={`${prefix}-location`} label="수행 장소">
          <Input
            onChange={(event) => onChange({ location: event.target.value })}
            value={details.location ?? ""}
          />
        </FormField>
        <FormField id={`${prefix}-start`} label="시작 일시">
          <Input
            onChange={(event) => onChange({ startDate: event.target.value })}
            type="datetime-local"
            value={details.startDate ?? ""}
          />
        </FormField>
        <FormField id={`${prefix}-end`} label="종료 일시">
          <Input
            onChange={(event) => onChange({ endDate: event.target.value })}
            type="datetime-local"
            value={details.endDate ?? ""}
          />
        </FormField>
      </div>
    );
  }

  return (
    <div className="grid gap-loose sm:grid-cols-2">
      <FormField id={`${prefix}-vendor`} label="판매처 또는 쇼핑몰">
        <Input
          onChange={(event) => onChange({ vendor: event.target.value })}
          placeholder="예: 쿠팡, 네이버쇼핑"
          value={details.vendor ?? ""}
        />
      </FormField>
      <FormField id={`${prefix}-url`} label="상품 URL">
        <Input
          onChange={(event) => onChange({ productUrl: event.target.value })}
          placeholder="https://..."
          value={details.productUrl ?? ""}
        />
      </FormField>
      <FormField id={`${prefix}-options`} label="상품 옵션 또는 규격">
        <Input
          onChange={(event) => onChange({ options: event.target.value })}
          value={details.options ?? ""}
        />
      </FormField>
    </div>
  );
}

/**
 * 계약은 일반 구매에 상품 URL·판매처·가격 화면 중 하나를, 그 밖의 유형에는
 * 업체 견적 근거를 요구한다. 파일 업로드 계약이 없어 지금은 비파일 근거만 받는다.
 */
export function PriceEvidence({
  details,
  onChange,
  prefix,
  type,
}: {
  details: ItemDetails;
  onChange: (patch: ItemDetails) => void;
  prefix: string;
  type: PurchaseType;
}) {
  if (type === "general") return null;

  return (
    <FormField
      description="파일 첨부는 아직 제공하지 않습니다. 업체와 금액을 글로 남겨 주세요."
      id={`${prefix}-quote`}
      label="견적 메모"
    >
      <Input
        onChange={(event) =>
          onChange({ requestNote: event.target.value })
        }
        placeholder="예: 예시사운드 음향 운영 360,000원"
        value={details.requestNote ?? ""}
      />
    </FormField>
  );
}
