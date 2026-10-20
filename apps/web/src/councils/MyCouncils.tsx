import { useCallback, useState, type ReactNode } from 'react'
import Workspace from '../workspace/Workspace'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import NoCouncilFlow from './NoCouncilFlow'
import { useMyCouncils } from './useMyCouncils'

type Props = {
  user: { name: string }
  // 방금 들어온 학생회. 있으면 그 학생회를 먼저 연다.
  initialCouncilId?: string | undefined
  // 가운데 카드 화면(로그인한 사람의 이름, 휴대폰 알림, 로그아웃이 함께 있다). App이 그린다.
  card: (content: ReactNode) => ReactNode
  onEnterCode: (code: string) => void
  logoutBusy: boolean
  onLogout: () => void
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <StateMessage kind="error">
        학생회를 확인하지 못했어요. 서버 연결을 확인해 주세요.
      </StateMessage>
      <Button variant="outline" onClick={onRetry}>
        다시 확인
      </Button>
    </div>
  )
}

// 로그인한 뒤의 첫 화면: 학생회가 없으면 안내(초대 코드, 만들기), 있으면 작업 공간이다.
export default function MyCouncils({ user, initialCouncilId, card, ...rest }: Props) {
  const { state, reload, add, remove } = useMyCouncils()
  const [opened, setOpened] = useState(initialCouncilId)
  // 403으로 운영진이 아니게 된 학생회: 목록을 다시 읽다 실패해도 떠나도록 먼저 목록에서 빼고, 서버의 목록을 다시 읽는다.
  const lost = useCallback(
    (councilId: string) => {
      remove(councilId)
      reload()
    },
    [remove, reload],
  )
  if (state.kind === 'loading')
    return card(<StateMessage kind="loading">학생회 확인 중…</StateMessage>)
  if (state.kind === 'failed') return card(<LoadFailed onRetry={reload} />)
  if (!state.councils.length)
    return card(
      <NoCouncilFlow
        onEnterCode={rest.onEnterCode}
        onCreated={council => {
          setOpened(council.id)
          add(council)
        }}
      />,
    )
  return (
    <Workspace
      key={opened ?? ''}
      councils={state.councils}
      initialCouncilId={opened}
      user={user}
      logoutBusy={rest.logoutBusy}
      onLogout={rest.onLogout}
      onCouncilsChanged={reload}
      onCouncilLost={lost}
    />
  )
}
