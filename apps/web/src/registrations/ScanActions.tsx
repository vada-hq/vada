import { useEffect, useRef, useState, type RefObject } from 'react'
import { statusOf, type ApplicantChange, type ApplicantChangeResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { ATTENDANCE_CHANGED } from '@/lib/registration-messages'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { won } from '@/public/registration-text'
import type { ScanOutcome } from './check-in'
import { DepositActions } from './DepositActions'
import { registrationPath } from './registration-api'
import { latePaymentOf, verdictOf } from './scan-verdict'
import { useStaffPost } from './useStaffPost'

type Props = EventDialogHandlers & {
  councilId: string
  outcome: ScanOutcome
  // 부모가 보내는 중이다(입금 확인 취소 창). [다음 사람]을 막는다.
  busy: boolean
  // 이 찍기에서 방금 입금을 받았다. 부품 확인 화면이 그 모습을 보인다.
  paid?: boolean
  onNext: () => void
  onChange: (change: ApplicantChange) => void
  // 신청이 없어졌다(404). 이유는 useStaffPost가 부모에게 알린다.
  onGone: () => void
  onSaving: (saving: boolean) => void
  onReload?: () => void
}

type Person = Extract<ScanOutcome, { applicant: unknown }>
type Next = { busy: boolean; onNext: () => void }
type CollectProps = Omit<Props, 'outcome' | 'busy' | 'paid' | 'onNext'> & {
  outcome: Person
  fee: number
  primary: RefObject<HTMLButtonElement | null>
  onPaid: () => void
  next: Next
  // 이미 출석한 사람에게 받는다. 그 출석은 이번 찍기가 남긴 것이 아니라 [입장 안 함] 대신 [다음 사람]을 둔다.
  late: boolean
}

// [입장 안 함]이 보낸 출석이 더는 지금 출석이 아니다(그사이 다른 운영진이 취소·재출석). 남의 출석을 건드리지 않았으니 넘어간다.
// [새로 읽기]는 두지 않는다: 같은 QR로 출석을 다시 보내 출석이 없으면 새로 남기기 때문이다.
function Changed({ primary, next }: Pick<CollectProps, 'primary' | 'next'>) {
  useEffect(() => primary.current?.focus(), [primary])
  return (
    <div className="flex flex-col gap-2">
      <StateMessage kind="error">{ATTENDANCE_CHANGED}</StateMessage>
      <Button ref={primary} className="min-h-11 w-full" busy={next.busy} onClick={next.onNext}>
        다음 사람
      </Button>
    </div>
  )
}

// 참가비 받기: [받고 입장]은 적용 참가비를 그대로 기록하고, [입장 안 함]은 이번 찍기가 남긴 출석만 취소한다(출석 취소와 같은 길에 출석 번호).
// 다른 금액은 문 앞에서 드물어 명단의 [입금 확인]에서 받는다. 오류는 버튼 아래에 남고 다시 누를 수 있다.
function Collect({ councilId, outcome, fee, primary, onPaid, next, late, ...props }: CollectProps) {
  const { onChange, onGone, onSaving, onReload, ...handlers } = props
  const { applicant } = outcome
  const post = useStaffPost(handlers, onSaving, applicant.actions)
  const [changed, setChanged] = useState(false)
  async function send(tail: string, body: { amount: number } | { attendanceId: string }) {
    const result = await post.send<ApplicantChangeResponse>(
      `${registrationPath(councilId, applicant.id)}/${tail}`,
      body,
    )
    if (result.ok) {
      if ('amount' in body) onPaid()
      onChange(result.data.applicant)
    } else if (result.status === statusOf('NOT_FOUND')) onGone()
    else if (result.code === 'ATTENDANCE_CHANGED') setChanged(true)
  }
  if (changed) return <Changed primary={primary} next={next} />
  return (
    <div className="flex flex-col gap-2">
      <Button
        ref={primary}
        className="min-h-11 w-full"
        busy={post.busy}
        onClick={() => void send('deposit', { amount: fee })}
      >
        {won(fee)} {late ? '받기' : '받고 입장'}
      </Button>
      {late && (
        <Button
          variant="outline"
          className="min-h-11 w-full"
          busy={post.busy || next.busy}
          onClick={next.onNext}
        >
          다음 사람
        </Button>
      )}
      {!late && applicant.actions.includes('registration.cancel_check_in') && (
        <Button
          variant="outline"
          className="min-h-11 w-full"
          busy={post.busy}
          onClick={() => void send('attendance/cancel', { attendanceId: outcome.attendanceId })}
        >
          입장 안 함
        </Button>
      )}
      {post.problem && <StateMessage kind="error">{post.problem}</StateMessage>}
      {post.problem && onReload && (
        <Button variant="outline" className="min-h-11 w-full" busy={post.busy} onClick={onReload}>
          새로 읽기
        </Button>
      )}
    </div>
  )
}

// 판정마다 주 버튼은 하나다. 받기 판정은 [받고 입장], 확인 실패는 [다시 찍기], 나머지는 [다음 사람]이다.
// 초점을 옮길 때를 가르는 단계: 판정이 바뀌거나, 같은 판정(이미 출석)에서 입금이 바뀌었다.
const stageOf = (outcome: ScanOutcome) =>
  `${verdictOf(outcome).kind}:${'applicant' in outcome ? outcome.applicant.deposit.status : ''}`

// 받을 참가비: 이번 찍기의 참가비 받기 판정이거나, 이미 출석한 사람의 남은 참가비(late)다.
function collectOf(outcome: ScanOutcome) {
  const verdict = verdictOf(outcome)
  if (verdict.kind === 'collect') return { fee: verdict.fee, late: false }
  const late = latePaymentOf(outcome)
  return late?.kind === 'collect' ? { fee: late.fee, late: true } : null
}

type NextProps = Omit<Props, 'paid'> & {
  primary: RefObject<HTMLButtonElement | null>
  paidHere: boolean
}

// 받을 것이 없는 판정: 주 버튼 하나와, 이 찍기에서 방금 받았으면 [확인 취소].
function NextActions({ outcome, busy, onNext, primary, paidHere, ...props }: NextProps) {
  const person = 'applicant' in outcome ? outcome : null
  return (
    <div className="flex flex-col gap-2">
      <Button ref={primary} className="min-h-11 w-full" busy={busy} onClick={onNext}>
        {outcome.kind === 'failed' ? '다시 찍기' : '다음 사람'}
      </Button>
      {paidHere && person && person.appliedFee !== undefined && (
        <DepositActions
          {...props}
          applicant={{ ...person.applicant, name: person.name, appliedFee: person.appliedFee }}
          touch
        />
      )}
    </div>
  )
}

export function ScanActions({ paid = false, ...props }: Props) {
  const { outcome, busy, onNext } = props
  const stage = stageOf(outcome)
  const primary = useRef<HTMLButtonElement>(null)
  const previous = useRef(stage)
  // 잘못 누른 받기를 그 자리에서 되돌리도록 이 찍기에서 받은 뒤에만 [확인 취소]를 둔다.
  const [paidHere, setPaidHere] = useState(paid)
  useEffect(() => {
    // 누른 버튼이 판정과 함께 사라진다. 초점을 새 판정의 주 버튼으로 옮긴다.
    if (previous.current !== stage) primary.current?.focus()
    previous.current = stage
  }, [stage])
  const collect = collectOf(outcome)
  if (collect && 'applicant' in outcome) {
    const { busy: _busy, onNext: _next, ...rest } = props
    return (
      <Collect
        {...rest}
        outcome={outcome}
        fee={collect.fee}
        primary={primary}
        onPaid={() => setPaidHere(true)}
        next={{ busy, onNext }}
        late={collect.late}
      />
    )
  }
  return <NextActions {...props} primary={primary} paidHere={paidHere} />
}
