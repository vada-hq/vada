import type { CouncilView } from '@vada/contracts'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { HOME_LOAD_FAILED } from '@/lib/messages'
import type { Page } from '../workspace/pages'
import MineSection from './MineSection'
import { useHome } from './useHome'

type Props = {
  view: CouncilView
  // 줄을 눌러 업무 화면에서 그 업무의 상세를 연다.
  onOpenTask: (taskId: string) => void
  onOpenPage: (page: Page) => void
  // 권한이 바뀌었을 때(403) 학생회를 다시 읽게 한다.
  onForbidden: () => void
}

// 옆 메뉴 '홈': 그 사람의 부분을 한 번 읽어 보인다. 읽기만 하고, 줄은 원래 기록의 화면으로 간다.
export default function HomePage({ view, onOpenTask, onOpenPage, onForbidden }: Props) {
  const { state, reload } = useHome(view.council.id, onForbidden)
  if (state.kind === 'loading') return <StateMessage kind="loading">홈 불러오는 중…</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col gap-3">
        <StateMessage kind="error">{HOME_LOAD_FAILED}</StateMessage>
        <Button variant="outline" className="self-start" onClick={() => void reload()}>
          다시 불러오기
        </Button>
      </div>
    )
  return (
    <PageColumn>
      <MineSection
        mine={state.home.mine}
        onOpenTask={onOpenTask}
        onSeeAll={() => onOpenPage('tasks')}
      />
    </PageColumn>
  )
}
