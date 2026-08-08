import type { PurchaseRequestDraftContent } from "@vada/api-client";

import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { FormField } from "../../../components/ui/form-field";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { formatAmount } from "../shared/display";
import {
  PriceEvidence,
  TypeDetails,
  purchaseTypes,
  type PurchaseType,
} from "../shared/item-details";

export type DraftItem = NonNullable<PurchaseRequestDraftContent["items"]>[number];
export type { PurchaseType };
export { purchaseTypes };

const categories = [
  "운영 물품",
  "제작·굿즈",
  "식음료",
  "인쇄물",
  "대여",
  "용역",
  "기타",
].map((value) => ({ value, label: value }));

const budgetItems = [
  "행사 운영비",
  "홍보비",
  "식비",
  "시설·장비비",
  "예비비",
].map((value) => ({ value, label: value }));

export function createEmptyItem(): DraftItem {
  return { purchaseType: "general", details: {}, priceEvidence: [] };
}

/** 서버가 금액을 계산한다. 화면 합계는 입력 확인용 미리보기다. */
export function itemPreviewAmount(item: DraftItem) {
  return (item.quantity ?? 0) * (item.estimatedUnitPrice ?? 0);
}

export function totalPreviewAmount(items: DraftItem[]) {
  return items.reduce((sum, item) => sum + itemPreviewAmount(item), 0);
}

interface ItemCardProps {
  index: number;
  item: DraftItem;
  onChange: (patch: Partial<DraftItem>) => void;
  onRemove: () => void;
  removable: boolean;
}

function toNumber(value: string) {
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function ItemCard({
  index,
  item,
  onChange,
  onRemove,
  removable,
}: ItemCardProps) {
  const prefix = `item-${index}`;
  const type = item.purchaseType ?? "general";

  const setDetail = (patch: DraftItem["details"]) =>
    onChange({ details: { ...item.details, ...patch } });

  return (
    <li>
      <Card className="flex flex-col gap-loose">
        <div className="flex items-center justify-between gap-base">
          <span className="flex items-center gap-snug">
            <span className="flex size-5 items-center justify-center rounded-full bg-muted text-body">
              {index + 1}
            </span>
            <span className="text-body-lg font-medium">{item.name || "새 품목"}</span>
          </span>
          <Button
            aria-label={`품목 ${index + 1} 삭제`}
            disabled={!removable}
            onClick={onRemove}
            type="button"
            variant="secondary"
          >
            삭제
          </Button>
        </div>

        <div className="grid gap-loose sm:grid-cols-3">
          <FormField id={`${prefix}-name`} label="품목명" required>
            <Input
              onChange={(event) => onChange({ name: event.target.value })}
              placeholder="예: 박스테이프"
              value={item.name ?? ""}
            />
          </FormField>
          <FormField id={`${prefix}-category`} label="품목 카테고리" required>
            <Select
              onValueChange={(value) => onChange({ category: value })}
              options={categories}
              value={item.category ?? ""}
            />
          </FormField>
          <FormField id={`${prefix}-budget`} label="예산 항목" required>
            <Select
              onValueChange={(value) => onChange({ budgetItem: value })}
              options={budgetItems}
              value={item.budgetItem ?? ""}
            />
          </FormField>
        </div>

        <div className="grid gap-loose sm:grid-cols-4">
          <FormField id={`${prefix}-type`} label="구매 유형" required>
            <Select
              onValueChange={(value) =>
                // 유형을 바꾸면 이전 유형의 상세를 남기지 않는다.
                onChange({
                  purchaseType: value as PurchaseType,
                  details: {},
                  priceEvidence: [],
                })
              }
              options={purchaseTypes}
              value={type}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-snug">
            <FormField id={`${prefix}-quantity`} label="수량" required>
              <Input
                min={1}
                onChange={(event) =>
                  onChange({ quantity: toNumber(event.target.value) })
                }
                type="number"
                value={item.quantity ?? ""}
              />
            </FormField>
            <FormField id={`${prefix}-unit`} label="단위" required>
              <Input
                onChange={(event) => onChange({ unit: event.target.value })}
                placeholder="개"
                value={item.unit ?? ""}
              />
            </FormField>
          </div>
          <FormField id={`${prefix}-price`} label="예상 단가" required>
            <Input
              min={0}
              onChange={(event) =>
                onChange({ estimatedUnitPrice: toNumber(event.target.value) })
              }
              type="number"
              value={item.estimatedUnitPrice ?? ""}
            />
          </FormField>
          <div className="flex flex-col justify-end">
            <p className="text-body text-muted-foreground">품목 총액</p>
            <p className="text-body-lg font-semibold tabular-nums">
              {formatAmount(itemPreviewAmount(item))}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-loose rounded-md border border-border bg-muted/40 p-base">
          <p className="text-body font-medium text-muted-foreground">
            유형별 상세 정보
          </p>
          <TypeDetails
            details={item.details ?? {}}
            onChange={setDetail}
            prefix={prefix}
            type={type}
          />
          <PriceEvidence
            details={item.details ?? {}}
            onChange={setDetail}
            prefix={prefix}
            type={type}
          />
        </div>
      </Card>
    </li>
  );
}

