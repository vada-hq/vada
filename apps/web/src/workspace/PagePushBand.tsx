import PushOffBand from '../push/PushOffBand'
import { FINANCE_PUSH_OFF, TASK_PUSH_OFF } from '@/lib/messages'
import type { PushEnvironment } from '../push/usePush'
import type { Page } from './pages'

// 알림이 꺼져 있다는 띠. 알림이 오는 화면(홈, 대화, 업무, 재정)에만 보이고 문구는 화면에 맞춘다.
const MESSAGE: Partial<Record<Page, string>> = {
  tasks: TASK_PUSH_OFF,
  finance: FINANCE_PUSH_OFF,
}

// 홈은 홈 틀이 띠 자리를 알리면(homeSlot) 그 자리에 그린다(DEC-95 '부서 배정 전' 띠 아래).
export default function PagePushBand({
  page,
  environment,
  homeSlot,
}: {
  page: Page
  environment?: PushEnvironment | undefined
  homeSlot?: HTMLElement | null | undefined
}) {
  return (
    <PushOffBand
      environment={environment}
      slot={page === 'home' ? homeSlot : null}
      visible={page === 'home' || page === 'chat' || page === 'tasks' || page === 'finance'}
      message={MESSAGE[page]}
    />
  )
}
