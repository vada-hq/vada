import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react'

// 머리글 경로 줄의 칸 하나. 넘치면 말줄임하는 칸(학생회 이름, 행사명)만 truncate다(DEC-96).
export type Crumb = { label: string; truncate: boolean }
// 화면이 머리글에 넘기는 제목과, 메뉴 칸 뒤에 붙일 더 깊은 칸(행사 화면의 행사명과 탭).
export type PageTrail = { title: string; crumbs: Crumb[] }

const PageTrailSlot = createContext<((trail: PageTrail | null) => void) | null>(null)

export const PageTrailProvider = PageTrailSlot.Provider

// 페이지 제목을 공통 머리글로 보낸다(페이지 행동 PageActions와 같은 방식). 머리글이 없는 곳(시험, 부품 확인 화면)에서는
// 그 자리에 children(제목)을 그린다. 같은 값으로 다시 그려도 다시 넘기지 않게 글로 비교한다(넘기면 머리글이 다시 그려진다).
// 칠하기 전(layout effect)에 넘기고 비운다. 비동기 응답 뒤 화면을 옮기면 일반 effect로는 낡은 경로가 한 프레임 보인다.
export default function PageHeading({
  trail,
  children,
}: {
  trail: PageTrail
  children: ReactNode
}) {
  const send = useContext(PageTrailSlot)
  const key = JSON.stringify(trail)
  useLayoutEffect(() => {
    if (!send) return
    send(JSON.parse(key) as PageTrail)
    return () => send(null)
  }, [send, key])
  return send ? null : children
}
