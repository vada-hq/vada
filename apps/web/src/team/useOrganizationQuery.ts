import { useEffect } from 'react'
import { PEOPLE_TABS, type PeopleTab } from '@vada/contracts'
import { pickQuery, useMenuQuery } from '@/lib/use-menu-query'

export function useOrganizationControls(councilId: string, showFees: boolean) {
  const url = useMenuQuery('people', councilId)
  const asked = pickQuery(PEOPLE_TABS, url.query['tab'], 'people')
  const tab = asked === 'fees' && !showFees ? 'people' : asked
  // 열린 뒤 읽기 권한이 바뀌어도 권한 없는 탭 주소를 남기지 않는다.
  useEffect(() => {
    if (url.active && asked !== tab) url.set({ tab: null })
  })
  return {
    tab,
    setTab: (next: PeopleTab) => url.set({ tab: next === 'people' ? null : next }),
  }
}
