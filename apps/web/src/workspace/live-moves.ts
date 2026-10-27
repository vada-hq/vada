import type { AddressMove } from '@vada/contracts'

// 화면이 새 자리를 그린 메뉴 v7 옮기기(contracts moved-paths.ts). 새 자리를 그리는 조각이 여기에 켠다:
// S1 purchases, S4 tasks, S5 chat, S6a ledger, S6b settings, S7 calendar. 켜기 전에는 옛 주소가 지금 화면을 그대로 연다.
export const LIVE_MOVES: readonly AddressMove[] = []
