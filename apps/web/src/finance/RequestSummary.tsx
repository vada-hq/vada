import type { RequestValues } from './request-form'
import { neededByLabel, wonLabel } from './purchase-view'
import { purchaseEstimatesOf } from '@vada/contracts'
import { requestOf } from './request-form'

export function RequestSummary({ values }: { values: RequestValues }) {
  const estimate = purchaseEstimatesOf(requestOf(values).items)
  return (
    <>
      <h2 className="text-base font-semibold">요청 요약</h2>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <dt className="text-gray-500">품목 수</dt>
        <dd>{values.items.length}개</dd>
        <dt className="text-gray-500">총 수량</dt>
        <dd>{values.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)}개</dd>
        <dt className="text-gray-500">필요한 때</dt>
        <dd>{neededByLabel(values.neededBy || null)}</dd>
        <dt className="font-medium">예상 금액</dt>
        <dd className="font-semibold tabular-nums">
          {estimate.total != null ? wonLabel(estimate.total) : '미확인'}
        </dd>
      </dl>
      {estimate.total == null && estimate.subtotal != null && (
        <p className="text-xs text-gray-500">
          상품 합계 {wonLabel(estimate.subtotal)} · 배송비 미확인
        </p>
      )}
      <p className="text-xs text-gray-500">
        불러온 가격은 조회 시점의 참고 가격이며 최종 금액은 결재할 때 정해요.
      </p>
    </>
  )
}
