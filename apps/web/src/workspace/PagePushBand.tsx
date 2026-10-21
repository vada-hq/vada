import PushOffBand from '../push/PushOffBand'
import { TASK_PUSH_OFF } from '@/lib/messages'
import type { Page } from './pages'

// 알림이 꺼져 있다는 띠. 알림이 오는 화면(대화, 업무)에만 보이고 문구는 화면에 맞춘다.
export default function PagePushBand({ page }: { page: Page }) {
  return (
    <PushOffBand
      visible={page === 'chat' || page === 'tasks'}
      message={page === 'tasks' ? TASK_PUSH_OFF : undefined}
    />
  )
}
