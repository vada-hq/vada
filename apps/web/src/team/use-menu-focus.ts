import { useRef } from 'react'

// ⋯ 메뉴 항목으로 연 대화상자나 제자리 편집을 닫으면 포커스를 그 줄의 ⋯ 버튼으로 돌려준다.
// Radix는 Trigger로 연 대화상자만 포커스를 돌려주는데, 메뉴 항목으로 열면 연 순간 포커스가 body라 어디로도 돌아가지 못한다.
export function useMenuFocus() {
  const triggers = useRef(new Map<string, HTMLElement>())
  const opener = useRef<string[]>([])
  // 연 줄의 ⋯ 버튼이 아직 화면에 있으면 그것으로 옮기고 true. 없으면 다음 후보, 다 없어졌으면(내보냄) false.
  const restore = () => {
    const trigger = opener.current
      .map(id => triggers.current.get(id))
      .find(element => element?.isConnected)
    if (!trigger) return false
    trigger.focus()
    return true
  }
  return {
    // 줄의 ⋯ 버튼에 단다: ref={menuFocus.triggerRef(줄 번호)}
    triggerRef: (id: string) => (element: HTMLElement | null) => {
      if (element) triggers.current.set(id, element)
      else triggers.current.delete(id)
    },
    // 메뉴 항목으로 대화상자를 열 때 어느 줄에서 열었는지 기억한다. 뒤의 키는 그 버튼이 사라졌을 때의 대신이다
    // (부장을 정하면 [부장 지정]이 사라지고 그 사람 카드가 생긴다).
    remember: (...ids: string[]) => {
      opener.current = ids
    },
    // 제자리 편집을 닫은 뒤에 부른다.
    restore,
    // 대화상자의 onCloseAutoFocus에 넘긴다. 줄이 없어졌으면 기본 동작에 맡긴다.
    onCloseAutoFocus: (event: Event) => {
      if (restore()) event.preventDefault()
    },
  }
}
