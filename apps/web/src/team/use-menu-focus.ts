import { useRef } from 'react'

// ⋯ 메뉴 항목으로 연 대화상자를 닫으면 포커스를 그 줄의 ⋯ 버튼으로 돌려준다.
// Radix는 Trigger로 연 대화상자만 포커스를 돌려주는데, 메뉴 항목으로 열면 연 순간 포커스가 body라 어디로도 돌아가지 못한다.
export function useMenuFocus() {
  const triggers = useRef(new Map<string, HTMLElement>())
  const opener = useRef<string | null>(null)
  return {
    // 줄의 ⋯ 버튼에 단다: ref={menuFocus.triggerRef(줄 번호)}
    triggerRef: (id: string) => (element: HTMLElement | null) => {
      if (element) triggers.current.set(id, element)
      else triggers.current.delete(id)
    },
    // 메뉴 항목으로 대화상자를 열 때 어느 줄에서 열었는지 기억한다.
    remember: (id: string) => { opener.current = id },
    // 대화상자의 onCloseAutoFocus에 넘긴다. 줄이 없어졌으면(내보냄) 기본 동작에 맡긴다.
    onCloseAutoFocus: (event: Event) => {
      const trigger = opener.current === null ? undefined : triggers.current.get(opener.current)
      if (!trigger?.isConnected) return
      event.preventDefault()
      trigger.focus()
    },
  }
}
