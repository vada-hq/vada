import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { MyCouncil, MyCouncilsResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { getJson } from '@/lib/api'
import type { CouncilEntry } from '../workspace/pages'
import JoinCouncil from './JoinCouncil'
import NoCouncilFlow, { type CardFrame } from './NoCouncilFlow'

type Props = {
  entry: CouncilEntry
  councils: MyCouncil[]
  userName: string
  card: (content: ReactNode, frame?: CardFrame) => ReactNode
  onEntered: (council: MyCouncil) => void
  onClose: () => void
}

// 둘째 학생회 진입은 주소를 바꾸지 않는 카드다(020 정한 것 11b). 성공한 응답을 목록에 더한 뒤 홈으로 간다.
export default function AdditionalCouncilFlow({
  entry,
  councils,
  userName,
  card,
  onEntered,
  onClose,
}: Props) {
  const [startCreating, setStartCreating] = useState(entry === 'create')
  const [code, setCode] = useState<string | null>(null)
  const [missing, setMissing] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const pending = useRef<AbortController | null>(null)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      pending.current?.abort()
    }
  }, [])
  const finish = (council: MyCouncil) => {
    if (active.current) onEntered(council)
  }
  async function entered(id: string) {
    const known = councils.find(council => council.id === id)
    if (known) return finish(known)
    // 다른 창에서 이미 들어왔으면 초대 확인만으로 참여가 끝난다. 새 목록을 확인해 그 줄을 받는다.
    setMissing(id)
    setLoading(true)
    const controller = new AbortController()
    pending.current = controller
    const result = await getJson<MyCouncilsResponse>('/api/me/councils', controller.signal)
    if (controller.signal.aborted) return
    const found = result.ok && result.data.councils.find(council => council.id === id)
    setLoading(false)
    if (found) finish(found)
    else setFailed(true)
  }
  if (missing)
    return card(
      <div className="flex flex-col gap-4">
        <StateMessage kind={failed ? 'error' : 'loading'}>
          {failed ? '학생회를 확인하지 못했어요.' : '학생회 확인 중…'}
        </StateMessage>
        {failed && (
          <Button touch busy={loading} onClick={() => void entered(missing)}>
            다시 확인
          </Button>
        )}
        <Button touch variant="outline" onClick={onClose}>
          닫기
        </Button>
      </div>,
      'compact',
    )
  if (code)
    return card(
      <div className="flex flex-col gap-4">
        <JoinCouncil
          code={code}
          googleName={userName}
          leaveLabel="다시 입력"
          onJoined={id => void entered(id)}
          onJoinedCouncil={finish}
          onLeave={() => setCode(null)}
        />
        <Button touch variant="outline" onClick={onClose}>
          닫기
        </Button>
      </div>,
      'compact',
    )
  return (
    <NoCouncilFlow
      card={card}
      userName={userName}
      initialCreating={startCreating}
      onEnterCode={value => {
        setStartCreating(false)
        setCode(value)
      }}
      onCreated={finish}
      onClose={onClose}
    />
  )
}
