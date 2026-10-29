import type { PurchaseItemBrief, PurchaseRequestSummary } from '@vada/contracts'
import type { PurchaseList } from '@/finance/usePurchases'
import type { Tone } from '@/finance/purchase-view'

// 품목 현황 칸반의 열(와이어프레임 PUR-00·EVT-FIN-01). 동의 대기·주문 완료·수령·이행 완료는 아직 그 기록이 없어 늘 빈 열이다.
export const BOARD_COLUMNS = [
  'attention',
  'review',
  'consent',
  'ready',
  'ordered',
  'progress',
  'received',
  'done',
] as const
export type BoardColumn = (typeof BOARD_COLUMNS)[number]

export const COLUMN_TEXT: Record<BoardColumn, { label: string; hint: string }> = {
  attention: { label: '확인 필요', hint: '보완·반려·취소·구매 불가' },
  review: { label: '검토 중', hint: '재정부 검토' },
  consent: { label: '동의 대기', hint: '요청자 선진행 동의 필요' },
  ready: { label: '구매 준비', hint: '승인 후 주문 준비' },
  ordered: { label: '주문 완료', hint: '주문·발주 완료' },
  progress: { label: '진행 중', hint: '배송·수령 또는 대여·용역 이행' },
  received: { label: '수령·이행 완료', hint: '실제 완료 · 영수증 대조 대기' },
  done: { label: '처리 완료', hint: '실제 지출 반영' },
}

export type BoardCard = { item: PurchaseItemBrief; request: PurchaseRequestSummary }

// 결제 기록이 있으면 실제 지출이 반영된 것이고, 송장이 있으면 배송 중이다. 요청을 취소하면 결재 전 품목도 확인 필요로 간다.
export function columnOf({ item, request }: BoardCard): BoardColumn {
  if (item.status === 'rejected' || item.status === 'cancelled') return 'attention'
  if (item.status === 'pending') return request.status === 'cancelled' ? 'attention' : 'review'
  if (item.paid) return 'done'
  return item.shipped ? 'progress' : 'ready'
}

export function cardsOf(requests: readonly PurchaseRequestSummary[]): BoardCard[] {
  return requests.flatMap(request => (request.itemBriefs ?? []).map(item => ({ item, request })))
}

export function cardsIn(cards: readonly BoardCard[], column: BoardColumn) {
  return cards.filter(card => columnOf(card) === column)
}

export function countsOf(cards: readonly BoardCard[]) {
  const counts = Object.fromEntries(BOARD_COLUMNS.map(column => [column, 0])) as Record<
    BoardColumn,
    number
  >
  for (const card of cards) counts[columnOf(card)] += 1
  return counts
}

// 같은 열에 같은 요청의 품목이 여럿이면 한 묶음으로 겹쳐 보인다(와이어프레임의 📦 N).
export function stacksOf(cards: readonly BoardCard[]) {
  const stacks: BoardCard[][] = []
  for (const card of cards) {
    const stack = stacks.find(each => each[0]?.request.id === card.request.id)
    if (stack) stack.push(card)
    else stacks.push([card])
  }
  return stacks
}

export function cardChipOf(card: BoardCard): { label: string; tone: Tone } {
  const column = columnOf(card)
  if (column === 'attention')
    return { label: card.item.status === 'rejected' ? '반려' : '취소', tone: 'danger' }
  if (column === 'review') return { label: '검토 중', tone: 'neutral' }
  if (column === 'progress') return { label: '배송 중', tone: 'info' }
  if (column === 'done') return { label: '처리 완료', tone: 'success' }
  return { label: '구매 준비', tone: 'info' }
}

// 카드의 금액: 결재 뒤에는 승인 금액, 그 전에는 예상 가격이다.
export const cardAmountOf = (item: PurchaseItemBrief) => item.amount ?? item.estimate

// 요청 한 건의 지금 상태(내 구매 요청·요청 기록 표).
export const REQUEST_STATES = ['pending', 'revise', 'approved', 'buying', 'done', 'closed'] as const
export type RequestState = (typeof REQUEST_STATES)[number]
export const REQUEST_STATE_TEXT: Record<RequestState, { label: string; tone: Tone }> = {
  pending: { label: '검토 대기', tone: 'info' },
  revise: { label: '보완 필요', tone: 'warning' },
  approved: { label: '승인 완료', tone: 'success' },
  buying: { label: '구매 진행', tone: 'info' },
  done: { label: '처리 완료', tone: 'success' },
  closed: { label: '반려·취소', tone: 'danger' },
}

export function requestStateOf(request: PurchaseRequestSummary): RequestState {
  if (request.status === 'rejected' || request.status === 'cancelled') return 'closed'
  if (request.status === 'pending') return 'pending'
  if (request.progress?.paid) return 'done'
  if (request.progress?.hasShipment || request.progress?.partlyPaid) return 'buying'
  return 'approved'
}

export const requestStateLabel = (request: PurchaseRequestSummary) => {
  const state = requestStateOf(request)
  if (state !== 'closed') return REQUEST_STATE_TEXT[state]
  return { label: request.status === 'rejected' ? '반려' : '취소', tone: 'danger' as Tone }
}

// 처리 단계는 최근 목록(상한 100)에 결재 대기 목록(상한 300, 필요한 때 순)을 더해 읽는다. 오래된 대기 요청이 최근 목록 밖으로
// 밀려나도 검토 대기 칸에서 빠지지 않게 한다. 둘 중 하나라도 못 읽었으면 칸을 비워 보이지 않고 그 상태를 그대로 보인다.
export function mergedList(main: PurchaseList, pending: PurchaseList | null): PurchaseList {
  if (!pending) return main
  const reload = async () => {
    await Promise.all([main.reload(), pending.reload()])
  }
  if (main.state.kind !== 'ready') return { state: main.state, reload }
  if (pending.state.kind !== 'ready') return { state: pending.state, reload }
  const seen = new Set(main.state.requests.map(request => request.id))
  const extra = pending.state.requests.filter(request => !seen.has(request.id))
  return {
    state: {
      ...main.state,
      requests: [...main.state.requests, ...extra],
      truncated: main.state.truncated || pending.state.truncated,
    },
    reload,
  }
}
