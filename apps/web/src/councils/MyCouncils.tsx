import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { menuPath, type MyCouncil } from '@vada/contracts'
import { layerDirectRecord, navigate, startAt, useHere } from '@/lib/app-location'
import { openMenu } from '@/lib/go-to'
import { ADDRESS_LOST, ADDRESS_LOST_BACK } from '@/lib/messages'
import { targetOf } from '../workspace/address'
import { startPathOf, useRememberAddress } from '../workspace/useLastAddress'
import { useNotificationOpen } from '../workspace/useNotificationOpen'
import Workspace from '../workspace/Workspace'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import NoCouncilFlow from './NoCouncilFlow'
import { useMyCouncils } from './useMyCouncils'

type Props = {
  user: { name: string }
  // 마지막에 본 주소를 사람마다 기억하는 열쇠.
  userId: string
  // 방금 들어온 학생회. 있으면 그 학생회 홈으로 연다(DEC-69: 운영진 화면은 막 만든 사람만).
  initialCouncilId?: string | undefined
  // 가운데 카드 화면(로그인한 사람의 이름, 휴대폰 알림, 로그아웃이 함께 있다). App이 그린다.
  card: (content: ReactNode) => ReactNode
  onEnterCode: (code: string) => void
  logoutBusy: boolean
  onLogout: () => void
}

const NONE: MyCouncil[] = []

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

// 모르는 학생회, 없는 주소. 있는지 없는지를 가르지 않고 상위 목록으로 가는 길을 준다.
function NotFound({ fallback }: { fallback: string }) {
  return (
    <div className="flex flex-col gap-3">
      <StateMessage kind="notice">{ADDRESS_LOST}</StateMessage>
      <Button variant="outline" onClick={() => navigate(fallback, { replace: true })}>
        {ADDRESS_LOST_BACK}
      </Button>
    </div>
  )
}

// 로그인한 뒤의 첫 화면: 학생회가 없으면 안내(초대 코드, 만들기), 있으면 주소가 가리키는 작업 공간이다.
export default function MyCouncils({ user, userId, initialCouncilId, card, ...rest }: Props) {
  const { state, reload, add, remove } = useMyCouncils()
  const here = useHere()
  const councils = state.kind === 'ready' ? state.councils : NONE
  // lost는 안정된 함수여야 한다(바뀌면 잃은 학생회마다 다시 불려 목록 읽기가 끝없이 되풀이된다). 그래서 목록은 ref로 읽는다.
  const latest = useRef(councils)
  useEffect(() => {
    latest.current = councils
  })
  useNotificationOpen(councils, state.kind === 'ready')
  // 링크로 바로 들어온 기록 주소는 그 아래에 상위 목록 칸을 깐다.
  useLayoutEffect(layerDirectRecord, [])
  // 방금 들어온 학생회는 홈으로 연다.
  useEffect(() => {
    if (initialCouncilId) openMenu('home', initialCouncilId, {}, { replace: true })
  }, [initialCouncilId])
  useRememberAddress(userId, here, councils)
  // '/'로 열렸으면(홈 화면 앱 시작) 마지막에 본 주소, 없으면 첫 학생회 홈 주소로 바꿔 쓴다. 같은 때 받아 둔 알림이 먼저 주소를 쌓았을 수 있어 지금 주소로 다시 본다.
  const start = startPathOf(userId, councils)
  useEffect(() => {
    if (start && here.path === '/' && window.location.pathname + window.location.search === '/')
      startAt(start)
  }, [start, here.path])
  // 403으로 운영진이 아니게 된 학생회: 목록을 다시 읽다 실패해도 떠나도록 먼저 목록에서 빼고 남은 첫 학생회 홈으로 간다. 서버의 목록은 다시 읽는다.
  const lost = useCallback(
    (councilId: string) => {
      const next = latest.current.find(item => item.id !== councilId)
      if (next) navigate(menuPath('home', next.id), { replace: true, force: true })
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
          navigate(menuPath('people', council.id))
          add(council)
        }}
      />,
    )
  const target = targetOf(here, state.councils, start)
  if (target.kind === 'notFound') return card(<NotFound fallback={target.fallback} />)
  return (
    <Workspace
      councils={state.councils}
      target={target}
      user={user}
      logoutBusy={rest.logoutBusy}
      onLogout={rest.onLogout}
      onCouncilsChanged={reload}
      onCouncilLost={lost}
    />
  )
}
