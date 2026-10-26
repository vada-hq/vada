import { createContext } from 'react'

// 홈 틀의 알림 꺼짐 띠 자리(DEC-95: '부서 배정 전' 띠 아래). 작업 공간이 띠 하나를 두고(그 띠가 이 기기의 구독도 서버에 맞춘다),
// 새 홈이 이 함수로 자리를 알리면 띠를 그 자리에 그린다. 띠를 둘 두면 구독 맞추기가 두 번 돈다.
// 자리를 알리지 않는 화면(지금 홈, 다른 메뉴)에서는 띠가 머리 아래 제자리에 있다.
export const PushBandSlot = createContext<((slot: HTMLElement | null) => void) | null>(null)
