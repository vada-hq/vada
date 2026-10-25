import { useEffect } from 'react'
import {
  appPath,
  menuPath,
  parentOf,
  type AppLocation,
  type AppMenu,
  type AppQuery,
} from '@vada/contracts'
import { navigate, rewriteAddress, useHere } from './app-location'
import { recalledQuery, rememberQuery } from './menu-memory'

const NONE: AppQuery = {}

// 메뉴 첫 화면 주소의 쿼리(탭, 거르기, 배치)를 읽고 바꾼다. 화면의 탭·거르기는 주소가 원문이라 새로고침해도 같다.
// 모르는 값은 기본값으로 읽히고, 그 주소는 읽은 꼴로 고쳐 쓴다(replace). 값을 바꾸는 것도 기록을 쌓지 않고 바꿔 쓴다.
// 이 메뉴 주소가 아닐 때(행사 안의 업무 탭처럼 다른 화면이 품은 경우)는 읽지도 쓰지도 않는다.
// 이 메뉴의 기록 주소(상세가 열린 동안)에서는 마지막으로 보던 쿼리를 읽는다. 기록 종류가 정한 탭(지출 상세는 지출 탭)이 먼저다.
function detailQuery(location: AppLocation | null, menu: AppMenu, councilId: string) {
  if (location?.type !== 'record') return NONE
  const parent = parentOf(location)
  if (parent.type !== 'menu' || parent.menu !== menu || parent.councilId !== councilId) return NONE
  const seen = recalledQuery(menu, councilId)
  if (Object.keys(parent.query).length === 0) return seen ?? NONE
  return { ...seen, ...parent.query }
}

// 주소의 값이 허용 목록에 있으면 그 값, 아니면 기본값이다.
export const pickQuery = <T extends string>(
  values: readonly T[],
  value: string | undefined,
  fallback: T,
): T => values.find(item => item === value) ?? fallback

export function useMenuQuery(menu: AppMenu, councilId: string) {
  const here = useHere()
  const location =
    here.location?.type === 'menu' && here.location.menu === menu ? here.location : null
  const canonical = location ? appPath(location) : null
  if (location) rememberQuery(menu, councilId, location.query)
  const query = location?.query ?? detailQuery(here.location, menu, councilId)
  useEffect(() => {
    if (canonical !== null && canonical !== here.path) rewriteAddress(canonical)
  }, [canonical, here.path])
  return {
    active: location !== null,
    query,
    // null이면 그 키를 뺀다. 기본값은 주소를 만들 때 저절로 빠진다.
    set: (patch: Record<string, string | null>) => {
      const next: Record<string, string> = { ...(location?.query ?? NONE) }
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) delete next[key]
        else next[key] = value
      }
      const path = menuPath(menu, councilId, next)
      if (path !== here.path) navigate(path, { replace: true })
    },
  }
}
