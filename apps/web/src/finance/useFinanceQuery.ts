import { useEffect } from 'react'
import {
  FINANCE_TABS,
  PURCHASE_VIEWS,
  parentOf,
  type FinanceTab,
  type PurchaseView,
} from '@vada/contracts'
import { useHere } from '@/lib/app-location'
import { pickQuery, useMenuQuery } from '@/lib/use-menu-query'

// 요청·지출·수입 상세가 열린 동안 뒤의 탭은 그 기록의 탭이다. 그 전에 보던 다른 탭의 기억을 따르지 않는다.
function detailTab(here: ReturnType<typeof useHere>) {
  const location = here.location
  return location?.type === 'record' ? (parentOf(location).query['tab'] ?? 'requests') : undefined
}

type TabAccess = { fees: boolean }

// 재정 화면의 탭과 구매 요청 거르기. 재정 메뉴에서는 주소의 쿼리가 원문이라 새로고침해도 같고 바꿔도 기록을 쌓지 않는다.
// 탭을 고르지 않았으면 모든 운영진에게 개요다(DEC-92). 볼 권한이 없는 탭(납부자 명단)의 주소는 첫 화면(개요)으로 바꿔 쓴다.
export function useFinanceControls(councilId: string, access: TabAccess) {
  const url = useMenuQuery('finance', councilId)
  const pinned = detailTab(useHere())
  const asked = pickQuery<FinanceTab>(FINANCE_TABS, pinned ?? url.query['tab'], 'overview')
  const tab = asked === 'fees' && !access.fees ? 'overview' : asked
  // 권한은 화면이 열린 뒤에도 바뀌므로 매번 본다. 주소가 이 메뉴 첫 화면일 때만 바꿔 쓴다.
  useEffect(() => {
    if (url.active && asked !== tab) url.set({ tab: null })
  })
  return {
    tab,
    filter: pickQuery<PurchaseView>(PURCHASE_VIEWS, url.query['view'], 'mine'),
    setTab: (next: FinanceTab) => url.set({ tab: next }),
    setFilter: (view: PurchaseView) => url.set({ view }),
  }
}

// 수입 탭과 결산 탭이 같이 쓰는 회계 기간. 고르지 않았으면 null이고 기본 기간은 각 탭이 정한다.
export function usePeriodChoice(councilId: string) {
  const url = useMenuQuery('finance', councilId)
  return {
    chosenId: url.query['period'] ?? null,
    choose: (periodId: string) => url.set({ period: periodId }),
  }
}
