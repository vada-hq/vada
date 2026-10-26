import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ChatMessage, MadeRecord } from '@vada/contracts'

// 상품 정보 패널에 연 링크와 그 메시지(022 정한 것 20). 패널의 [구매 요청 만들기]는 그 메시지를 근거로 낸다.
// onMade: 패널에서 낸 요청을 그 메시지가 있는 방 흐름의 메시지 아래 기록에 바로 더한다.
export type ProductTarget = {
  url: string
  message: ChatMessage
  onMade?: ((made: MadeRecord) => void) | undefined
  // 행사 방의 메시지면 그 행사. 패널에서 연 구매 요청이 그 행사를 고른 채로 시작한다(022 정한 것 29).
  eventId?: string | null | undefined
}

// 작업 공간이 주는 상품 정보 열기. 열 수 없는 곳(작업 공간 밖의 부품 확인 화면·시험)에서는 null이라 링크는 새 탭으로 열린다.
export const ProductOpenContext = createContext<((target: ProductTarget) => void) | null>(null)

export const useProductOpener = () => useContext(ProductOpenContext)

// 행사 방 안의 링크로 연 상품 정보에 그 행사를 싣는다. 행사 방이 아니면 받은 열기 그대로다.
export function useEventProductOpener(eventId: string | null) {
  const open = useProductOpener()
  return useMemo(
    () => (open && eventId ? (target: ProductTarget) => open({ ...target, eventId }) : open),
    [open, eventId],
  )
}

// 오른쪽 패널 자리는 하나다. 상품 정보는 열려 있는 1:1 패널 위에 덮이고, 닫으면 그 1:1로 돌아간다(와이어프레임 P-15).
export function useProductPanel() {
  const [target, setTarget] = useState<ProductTarget | null>(null)
  const close = useCallback(() => setTarget(null), [])
  return { target, open: setTarget, close }
}
