import { useEffect } from 'react'
import { parseAppPath, type HomeResponse } from '@vada/contracts'
import { useHere, type Here } from '@/lib/app-location'
import { openMenu } from '@/lib/go-to'
import HomeViewButtons from './HomeViewButtons'

const homeLocation = (here: Here) =>
  here.behind?.page === 'home' ? parseAppPath(here.from ?? '') : here.location

// 겸직 보기만 주소에 남긴다. replace라 뒤로 가기 기록을 늘리지 않는다(DEC-78·95).
export function useFinanceView(home: HomeResponse, councilId: string) {
  const location = homeLocation(useHere())
  const requested =
    location?.type === 'menu' && location.menu === 'home' && location.query['view'] === 'finance'
  const allowed = home.kind === 'council' && home.financeView
  useEffect(() => {
    if (requested && !allowed) openMenu('home', councilId, {}, { replace: true })
  }, [requested, allowed, councilId])
  const finance = home.kind === 'finance' || (allowed && requested)
  const switcher = allowed && (
    <HomeViewButtons
      finance={finance}
      onChange={value =>
        openMenu('home', councilId, value ? { view: 'finance' } : {}, { replace: true })
      }
    />
  )
  return { finance, switcher }
}
