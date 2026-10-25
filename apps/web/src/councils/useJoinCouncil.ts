import { useEffect, useState } from 'react'
import {
  statusOf,
  type InvitePreviewResponse,
  type JoinCouncilRequest,
  type JoinCouncilResponse,
} from '@vada/contracts'
import { getJson, postJson } from '@/lib/api'
import { JOIN_COUNCIL_ERRORS, JOIN_COUNCIL_FAILED } from '@/lib/messages'
import { readMyName } from '@/lib/my-name'
import { useLatest } from '@/lib/use-latest'

// ready의 myName은 로그인에 이어진 운영진의 이름이다. null이면(읽지 못했을 때도) 화면이 이름을 묻는다(DEC-87).
export type JoinView =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'failed' }
  | { kind: 'ready'; council: InvitePreviewResponse['council']; myName: string | null }

// 초대를 확인하고 내 이름을 읽는다. 이미 들어온 학생회면 이름이 필요 없어 읽지 않고 그 학생회 번호를 돌려준다.
async function readInvite(
  code: string,
  signal: AbortSignal,
): Promise<JoinView | { kind: 'joined'; councilId: string }> {
  const invite = await getJson<InvitePreviewResponse>(
    `/api/invites/${encodeURIComponent(code)}`,
    signal,
  )
  if (!invite.ok) return { kind: invite.status === statusOf('NOT_FOUND') ? 'invalid' : 'failed' }
  if (invite.data.joined) return { kind: 'joined', councilId: invite.data.council.id }
  return { kind: 'ready', council: invite.data.council, myName: await readMyName(signal) }
}

// 초대 링크 화면의 상태와 서버 부르기: 초대 확인, 들어가기. 이미 들어왔으면 묻지 않고 그 학생회를 연다.
export function useJoinCouncil(code: string, onJoined: (councilId: string) => void) {
  const [view, setView] = useState<JoinView>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const joined = useLatest(onJoined)
  useEffect(() => {
    const controller = new AbortController()
    setView({ kind: 'loading' })
    void readInvite(code, controller.signal).then(next => {
      if (controller.signal.aborted) return
      if (next.kind === 'joined') joined.current(next.councilId)
      else setView(next)
    })
    return () => controller.abort()
  }, [code, attempt, joined])

  // 내 이름은 처음 이어질 때만 보낸다(이미 이어졌으면 서버도 무시한다).
  async function join(memberName?: string) {
    setJoining(true)
    setError('')
    const body: JoinCouncilRequest = memberName === undefined ? { code } : { code, memberName }
    const result = await postJson<JoinCouncilResponse>('/api/organizations/join', body)
    if (result.ok) return onJoined(result.data.council.id)
    setJoining(false)
    if (result.status === statusOf('NOT_FOUND')) setView({ kind: 'invalid' })
    else setError(JOIN_COUNCIL_ERRORS[result.code] ?? JOIN_COUNCIL_FAILED)
  }
  return { view, joining, error, join, retry: () => setAttempt(value => value + 1) }
}
