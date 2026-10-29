import { Check, TriangleAlert, X } from 'lucide-react'
import type { EventApplicant } from '@vada/contracts'
import { won } from '@/public/registration-text'
import { DEPOSIT_LABEL, EVENT_APPLICANTS } from '@/lib/registration-messages'
import { listType } from './list-look'

// 명단의 상태 칸: 점 + 글(면 없음). 기본값(신청함·입금 안 함·불참)은 회색이라 바뀐 칸만 눈에 든다.
// 같은 상태는 어디서나 같은 색이다(Shopify 배지 tone): 입금 확인 초록, 환불 대기 주황, 참석 파랑, 나머지 중립. 색만으로 말하지 않게 글이 늘 붙는다.

type Tone = 'quiet' | 'ring' | 'success' | 'pending' | 'primary'

const DOT: Record<Tone, string> = {
  quiet: 'bg-fg-faint',
  ring: 'ring-1 ring-fg-subtle ring-inset',
  success: 'bg-success-mark',
  pending: 'bg-pending-mark',
  primary: 'bg-primary-mark',
}
const TEXT: Record<Tone, string> = {
  quiet: 'text-fg-muted',
  ring: 'text-fg-secondary',
  success: 'text-fg-body',
  pending: 'text-pending',
  primary: 'text-fg-body',
}

function Dot({ tone, word, amount }: { tone: Tone; word: string; amount?: string | null }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${listType.small} ${TEXT[tone]}`}>
      <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${DOT[tone]}`} />
      <span className="whitespace-nowrap">
        {word}
        {amount && <span className={`ml-1 ${listType.num}`}>{amount}</span>}
      </span>
    </span>
  )
}

const DEPOSIT_TONE: Record<EventApplicant['deposit']['status'], Tone> = {
  none: 'ring',
  confirmed: 'success',
  refund_pending: 'pending',
  refunded: 'quiet',
}

// 입금 안 함 줄에도 받을 금액(서버가 준 적용 참가비)을 회색으로 붙인다: 은행 내역과 이 열에서 바로 맞댄다.
// 받은 금액(입금 확인)은 진한 글, 받을 금액은 회색 + 가운뎃점이라 섞여 읽히지 않는다. 한 사람 보기는 참가비 줄이 따로 있어 due={false}.
export function DepositMark({ row, due = true }: { row: EventApplicant; due?: boolean }) {
  const { status, amount } = row.deposit
  const free = status === 'none' && row.appliedFee === 0
  const owed = due && status === 'none' && row.appliedFee > 0
  return (
    <span className="inline-flex flex-wrap items-center">
      <Dot
        tone={free ? 'quiet' : DEPOSIT_TONE[status]}
        word={free ? EVENT_APPLICANTS.free : DEPOSIT_LABEL[status]}
        amount={amount === null ? null : won(amount)}
      />
      {owed && (
        <span className={`${listType.small} ${listType.num} whitespace-nowrap text-fg-muted`}>
          <span aria-hidden="true" className="px-1">
            ·
          </span>
          <span className="sr-only">{EVENT_APPLICANTS.due} </span>
          {won(row.appliedFee)}
        </span>
      )}
    </span>
  )
}

export function RegistrationMark({ row }: { row: EventApplicant }) {
  return (
    <Dot tone="quiet" word={row.cancelled ? EVENT_APPLICANTS.cancelled : EVENT_APPLICANTS.active} />
  )
}

// 참석: 행사 전이고 출석 기록이 없으면 '—'(아직 모름). 서버에는 '불참' 상태가 없고 출석 기록의 있고 없음뿐이라,
// 행사 전 기록 없음을 비워 두는 것이 사실과 같다. 행사 첫날부터 기록 없음을 '불참'이라 한다.
export function AttendanceMark({ row, started }: { row: EventApplicant; started: boolean }) {
  if (!row.attended && !started)
    return (
      <span className={`${listType.small} text-fg-muted`}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">{EVENT_APPLICANTS.noRecord}</span>
      </span>
    )
  return (
    <Dot
      tone={row.attended ? 'primary' : 'quiet'}
      word={row.attended ? EVENT_APPLICANTS.attended : EVENT_APPLICANTS.notAttended}
    />
  )
}

// 확인 필요: 이름 곁 ⚠ 아이콘(이름 '확인 필요') + 까닭 글. 지시자는 대상 바로 곁에, 사용자 행동 없이 보인다(NN/g indicators).
export function AttentionMark({ reason }: { reason: string | null }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <TriangleAlert
        role="img"
        aria-label={EVENT_APPLICANTS.attention}
        className="size-3.5 shrink-0 text-attention-icon"
      />
      {reason && (
        <span className={`${listType.small} font-medium text-attention wrap-anywhere`}>
          {reason}
        </span>
      )}
    </span>
  )
}

// 일괄 처리 뒤 그 줄의 결과: '✓ 처리' 또는 '✕ 실패 · 까닭'.
export function ResultMark({ failure }: { failure: string | null }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${listType.small} font-medium ${failure === null ? 'text-success' : 'text-danger'}`}
    >
      {failure === null ? (
        <Check aria-hidden className="size-3.5 shrink-0" />
      ) : (
        <X aria-hidden className="size-3.5 shrink-0" />
      )}
      <span className="wrap-anywhere">
        {failure === null
          ? EVENT_APPLICANTS.resultDone
          : `${EVENT_APPLICANTS.resultFailed} · ${failure}`}
      </span>
    </span>
  )
}
