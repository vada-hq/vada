import {
  PURCHASE_AREAS,
  PURCHASE_BOARDS,
  type AppQuery,
  type CouncilView,
  type PurchaseView,
} from '@vada/contracts'
import { pickQuery } from '@/lib/use-menu-query'
import type { WorkView } from './PurchaseWork'

// 주소에서 구매 보드 상태를 읽는다. 보드는 모두에게 열려 있고(읽기는 권한으로 가리지 않는다), 기본값만 다르다:
// 재정부(결재 권한)는 처리 단계, 그 밖의 사람과 '내 요청'을 고른 주소는 품목 현황이다(와이어프레임 PUR-00).
// 처리 단계·요청 기록·내 구매 요청은 범위 안의 요청을 모두 읽고, 품목 현황은 '전체 요청 / 내 요청'으로 거른다.
export function usePurchaseBoardQuery(view: CouncilView, query: AppQuery) {
  const canProcess = view.permissions.includes('purchase.approve')
  const workView: WorkView = query['view'] === 'mine' ? 'mine' : 'all'
  const fallback = canProcess && workView === 'all' ? 'process' : 'items'
  const board = pickQuery(PURCHASE_BOARDS, query['board'], fallback)
  const page = query['page'] === 'mine' ? 'mine' : null
  const fetchView: PurchaseView =
    page === 'mine' || (board === 'items' && workView === 'mine') ? 'mine' : 'all'
  return {
    board,
    area: pickQuery(PURCHASE_AREAS, query['area'], 'review'),
    view: workView,
    page,
    fetchView,
  }
}

// 내 구매 요청 머리의 '이름 · 부서'
export const whoOf = (view: CouncilView) =>
  [view.me.name, ...view.me.departments.map(department => department.name)].join(' · ')
