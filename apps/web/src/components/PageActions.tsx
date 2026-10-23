import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// 머리글 오른쪽의 페이지 행동 자리. 페이지마다 머리글을 따로 그리지 않고 공통 머리글에 버튼만 보낸다.
const PageActionsSlot = createContext<HTMLElement | null>(null)

export const PageActionsProvider = PageActionsSlot.Provider

// 페이지 전체의 행동(만들기 등)은 머리글 제목 줄 오른쪽에 둔다(Shopify Polaris, Atlassian·Primer PageHeader).
// 머리글이 없는 곳(시험, 부품 확인 화면)에서는 그 자리에 그린다.
export default function PageActions({ children }: { children: ReactNode }) {
  const slot = useContext(PageActionsSlot)
  if (slot) return createPortal(children, slot)
  return <div className="flex flex-wrap items-center gap-3">{children}</div>
}
