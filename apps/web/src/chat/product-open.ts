import { createContext, useCallback, useContext, useState } from 'react'
import type { ChatMessage } from '@vada/contracts'

// 상품 정보 패널에 연 링크와 그 메시지(022 정한 것 20). 패널의 [구매 요청 만들기]는 그 메시지를 근거로 낸다.
export type ProductTarget = {
  url: string
  message: ChatMessage
}

// 작업 공간이 주는 상품 정보 열기. 열 수 없는 곳(작업 공간 밖의 부품 확인 화면·시험)에서는 null이라 링크는 새 탭으로 열린다.
export const ProductOpenContext = createContext<((target: ProductTarget) => void) | null>(null)

export const useProductOpener = () => useContext(ProductOpenContext)

// 대화 화면의 상품 정보 패널. 현재 방의 입력칸은 그대로 두고 상품만 따로 연다.
export function useProductPanel() {
  const [target, setTarget] = useState<ProductTarget | null>(null)
  const close = useCallback(() => setTarget(null), [])
  return { target, open: setTarget, close }
}
