import { createContext, useContext } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

// 머리의 [1:1]과 칸을 잇는 이름. 닫으면 연 자리가 사라졌을 때 [1:1]로 초점을 돌려준다.
export const DIRECT_PANEL_ID = 'direct-panel'
export const DIRECT_PANEL_TOGGLE_ID = 'direct-panel-toggle'

// PC 오른쪽 칸만 닫기를 준다. 휴대폰 1:1은 전체 화면이라 뒤로 가기로 나간다.
export const SidePanelClose = createContext<(() => void) | null>(null)

// 칸 머리의 [닫기]. 목록 머리와 방 머리가 같이 쓴다(상품 정보 패널과 같은 모양).
export function SidePanelCloseButton() {
  const close = useContext(SidePanelClose)
  if (!close) return null
  return (
    <Button variant="ghost" size="icon" touch aria-label="닫기" onClick={close}>
      <X aria-hidden />
    </Button>
  )
}
