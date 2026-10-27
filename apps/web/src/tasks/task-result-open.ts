import type { TaskResult } from '@vada/contracts'
import { openMessageRoom, openRecord } from '@/lib/go-to'

// 업무 상세의 결과물 줄을 누르면 그 기록으로 간다. 업무 상세 위에 쌓아 뒤로 가면 그 업무다(openRecord의 overRecord).
// 요청은 구매 요청 화면, 행사는 그 행사, 신청 양식은 그 행사의 인원 관리 탭, 공지는 올린 방이다.
// 열 곳을 서버가 주지 않았으면(지운 공지, 볼 수 없는 공지) null이고 줄은 누를 수 없다.
export const resultOpener =
  (councilId: string) =>
  (result: TaskResult): (() => void) | null => {
    const over = { overRecord: true }
    switch (result.kind) {
      case 'request':
        return () => openRecord('purchases', councilId, result.id, over)
      case 'event':
        return () => openRecord('events', councilId, result.id, over)
      case 'registration_form': {
        const eventId = result.eventId
        if (eventId === null) return null
        return () => openRecord('events', councilId, eventId, { ...over, tab: 'registrations' })
      }
      case 'message': {
        const roomId = result.roomId
        if (roomId === null) return null
        return () => openMessageRoom(councilId, roomId, result.eventId, over)
      }
    }
  }
