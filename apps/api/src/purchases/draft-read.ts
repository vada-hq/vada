import type { Db } from '../db/client.ts'
import { dayOf } from '../finance/labels.ts'
import { NotFound } from '../errors.ts'
import {
  departmentOfMember,
  eventExists,
  itemsOf,
  requestOf,
  type ItemRow,
} from './rows.ts'
import type { DraftItem, PurchaseDraft, Requester } from './draft-types.ts'

/** 아직 아무것도 적히지 않은 품목 한 줄. 견적 상태의 처음 값은 명세가 정했다(initialValue). */
const BLANK_ITEM: DraftItem = {
  itemName: '',
  itemCategory: '',
  budgetItem: '',
  purchaseType: '',
  unit: '',
  quoteStatus: 'none',
}

/**
 * 표의 품목을 화면이 채우는 칸으로.
 *
 * **아직 안 적은 수는 내지 않는다** — 빈 글로 주면 같은 조각이 때로 수, 때로 글이 된다(명세).
 * 없는 글 칸(판매처·URL·옵션·배송 요청)도 내지 않는다. 값은 코드 그대로다 — `supplies`를
 * '소모품'으로 풀어 주는 것은 화면의 일이다.
 */
function draftItemOf(item: ItemRow): DraftItem {
  return {
    itemName: item.name,
    itemCategory: item.category ?? '',
    budgetItem: item.budgetItemId ?? '',
    purchaseType: item.purchaseType ?? '',
    ...(item.quantity === null ? {} : { quantity: item.quantity }),
    unit: item.unit ?? '',
    ...(item.unitPrice === null ? {} : { unitPrice: item.unitPrice }),
    ...(item.vendor === null ? {} : { vendor: item.vendor }),
    ...(item.productUrl === null ? {} : { productUrl: item.productUrl }),
    ...(item.option === null ? {} : { option: item.option }),
    ...(item.deliveryNote === null ? {} : { deliveryNote: item.deliveryNote }),
    quoteStatus: item.quoteStatus,
  }
}

/**
 * 작성하거나 고치는 요청 한 건(`finance.purchaseRequestDraft`).
 *
 * **requestId가 비면 새로 쓰는 것이다.** 그때도 서버가 이미 아는 것 — 작성자의 소속 부서 — 은
 * 채워져 오고, 품목 한 줄이 비어 있는 채로 온다(list.minItems가 1이다).
 */
export async function purchaseRequestDraft(
  db: Db,
  orgId: string,
  who: Requester,
  eventId: string,
  requestId: string,
): Promise<PurchaseDraft> {
  if (!(await eventExists(db, orgId, eventId))) throw new NotFound('그 행사를 찾지 못했습니다')
  if (requestId === '') {
    const department = await departmentOfMember(db, orgId, who.memberId)
    return {
      title: '',
      department: department.name ?? '',
      neededOn: '',
      priority: '',
      purpose: '',
      items: [BLANK_ITEM],
    }
  }
  const row = await requestOf(db, orgId, requestId)
  // 다른 행사의 요청을 이 행사로 열면 그 행사의 것이 아니다.
  if (row === null || row.eventId !== eventId) throw new NotFound('그 구매 요청을 찾지 못했습니다')
  const items = await itemsOf(db, orgId, row.id)
  return {
    title: row.title,
    department: row.departmentName ?? '',
    neededOn: dayOf(row.neededOn) ?? '',
    priority: row.priority ?? '',
    purpose: row.purpose ?? '',
    items: items.map(draftItemOf),
  }
}
