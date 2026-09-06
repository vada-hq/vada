import type { Db } from '../db/client.ts'
import {
  dayOf,
  joinParts,
  orNote,
  quantityNote,
  requestedAmount,
  statusOf,
  won,
} from './labels.ts'
import { budgetAvailable, itemRows, requestRow, totalRequested } from './requests.ts'
import { ITEM_CATEGORIES, PURCHASE_TYPES, labelOf } from '../purchases/options.ts'

// 구매 요청 검토(FIN-REV-01).
//
// **재정부가 보는 쪽이다.** 같은 요청을 요청자도 보지만(FIN-REQ-02) 출처가 다르다 —
// 예산 사용 가능액처럼 요청자에게 보이지 않는 값이 여기에만 온다.
//
// **판정의 단위가 품목이다.** 그래서 머리와 품목이 두 자리로 갈려 있다.

export interface ReviewSummary {
  code: string
  status: string
  statusTone: string
  amountNote: string
  budgetAvailableNote: string
  eventName: string
  department: string
  requester: string
  neededOn: string
  requestedAt: string
  purpose: string
}

export async function reviewSummary(
  db: Db,
  orgId: string,
  requestId: string,
): Promise<ReviewSummary | null> {
  const row = await requestRow(db, orgId, requestId)
  if (row === null) return null

  const items = await itemRows(db, orgId, row.id)
  const available = await budgetAvailable(db, orgId, row.eventId)
  const status = statusOf(row.stage, row.supplementRequestedAt)

  return {
    // 요청 번호는 서버가 만드는 값인데 만드는 흐름이 아직 없다. 없으면 그 사실을 말한다.
    code: orNote(row.code, '번호 미정'),
    status: status.label,
    statusTone: status.tone,
    amountNote: won(totalRequested(items)),
    // **예산이 없으면 수가 아니라 그 사실이 온다.** 0원은 다른 사실이다.
    budgetAvailableNote: available === null ? '예산 미정' : won(available),
    // 행사에 딸리지 않은 요청은 학생회의 상시 지출이다(`db/schema.ts`).
    eventName: orNote(row.eventName, '상시 지출'),
    department: orNote(row.departmentName, '부서 미정'),
    requester: orNote(row.requesterName, '요청자 미정'),
    neededOn: orNote(dayOf(row.neededOn), '필요한 날짜 미정'),
    requestedAt: orNote(dayOf(row.submittedAt), '미제출'),
    purpose: orNote(row.purpose, '구매 목적이 적혀 있지 않습니다'),
  }
}

export interface ReviewItem {
  id: string
  name: string
  categoryNote: string
  purchaseType: string
  quantityNote: string
  amountNote: string
  approvedAmount: string
  result: string
  /** 앞서 적어 둔 보완 사유. 적은 적이 없으면 오지 않는다. */
  reviewNote?: string
}

/**
 * 검토할 품목들.
 *
 * **승인액은 요청액에서 시작한다.** 명세가 '승인액의 처음 값'이라 적었고 '재정부가
 * 깎을 수 있으므로 요청액과 따로 온다'고 덧붙였다 — 깎으려면 깎을 것이 칸에
 * 들어 있어야 한다. 자릿점을 붙이지 않는 까닭도 명세가 적었다: 사람이 고치는 값이다.
 *
 * **판정은 앞서 고른 것이 함께 온다.** 검토는 한 번에 끝나지 않는다.
 */
export async function reviewItems(
  db: Db,
  orgId: string,
  requestId: string,
): Promise<ReviewItem[] | null> {
  const row = await requestRow(db, orgId, requestId)
  if (row === null) return null

  return (await itemRows(db, orgId, row.id)).map((item) => {
    const asked = requestedAmount(item.quantity, item.unitPrice)
    const approved = item.approvedAmount ?? asked
    return {
      id: item.id,
      name: item.name,
      // 분류와 예산 항목이 한 줄로 온다.
      //
      // **표에 담긴 것은 코드다**(`supplies`). 사람이 읽는 말은 명세에만 있으므로
      // 여기서 펴서 준다 — 한동안 코드가 그대로 화면에 나왔다(보완 요청 화면은
      // 처음부터 펴고 있었고, 이 자리만 빠져 있었다).
      categoryNote: orNote(
        joinParts([labelOf(ITEM_CATEGORIES, item.category), item.budgetItemName]),
        '분류 미정',
      ),
      // 구매 유형도 코드다(`online`·`contract`). 같은 까닭으로 펴서 준다.
      purchaseType: orNote(labelOf(PURCHASE_TYPES, item.purchaseType), '유형 미정'),
      quantityNote: quantityNote(item.quantity, item.unit),
      amountNote: asked === null ? '금액 미정' : won(asked),
      approvedAmount: approved === null ? '' : String(approved),
      // 아직 판정하지 않았으면 빈 값이다. **값은 글이 아니다** — 표에 담기는 것이다.
      result: item.reviewResult ?? '',
      // **앞서 적어 둔 보완 사유가 칸으로 되돌아온다.** 검토는 한 번에 끝나지 않으므로
      // 다시 열었을 때 적었던 글이 사라지면 사람은 그것을 다시 쓴다(`result`와 같은 까닭).
      // 적은 적이 없으면 조각이 오지 않는다 — 계약이 optional로 적었다.
      ...(item.reviewNote === null ? {} : { reviewNote: item.reviewNote }),
    }
  })
}
