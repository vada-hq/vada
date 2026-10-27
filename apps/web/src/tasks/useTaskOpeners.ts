import { openRecord } from '@/lib/go-to'

// 연 업무와 행사는 주소로 연다(닫으면 들어온 곳으로 돌아간다). 행사의 업무 탭에서 연 업무도 업무 주소라 닫으면 그 행사의 탭이다.
// 행사의 업무 탭은 이미 그 행사 안이라 행사 이름으로 가는 길이 없다.
export function useTaskOpeners(councilId: string, inEvent: boolean) {
  const openTask = (taskId: string) => openRecord('tasks', councilId, taskId)
  if (inEvent) return { openTask, openEvent: undefined, openEventFromTask: undefined }
  return {
    openTask,
    openEvent: (eventId: string) => openRecord('events', councilId, eventId),
    // 업무 상세 창에서 가면 그 상세 위에 쌓아, 행사에서 뒤로가 그 업무 상세다.
    openEventFromTask: (eventId: string) =>
      openRecord('events', councilId, eventId, { overRecord: true }),
  }
}
