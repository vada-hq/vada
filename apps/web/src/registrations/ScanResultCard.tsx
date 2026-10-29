import {
  CheckCircle2,
  CircleAlert,
  CircleMinus,
  Wallet,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { dayTimeLabel } from '@/lib/korean-date-text'
import { Alert } from '@/components/ui/alert'
import { won } from '@/public/registration-text'
import type { ScanOutcome } from './check-in'
import { latePaymentOf, verdictOf, type Verdict } from './scan-verdict'

type Tone = 'success' | 'warning' | 'danger' | 'info'
type Look = { tone: Tone; icon: LucideIcon; title: string }

// 빨강은 들이면 안 될 때(입장 불가, 확인 실패)만, 노랑은 돈을 받아야 할 때만 쓴다.
function lookOf(verdict: Verdict): Look {
  switch (verdict.kind) {
    case 'enter':
      return { tone: 'success', icon: CheckCircle2, title: '입장 가능' }
    case 'collect':
      return { tone: 'warning', icon: Wallet, title: `참가비 받기 · ${won(verdict.fee)}` }
    case 'unpaid':
      return {
        tone: 'warning',
        icon: CircleAlert,
        title: verdict.fee === undefined ? '참가비 확인 필요' : `참가비 미납 · ${won(verdict.fee)}`,
      }
    case 'turned-away':
      return { tone: 'info', icon: CircleMinus, title: '입장 안 함 · 출석 취소' }
    case 'already':
      return { tone: 'danger', icon: XCircle, title: '입장 불가 · 이미 출석' }
    case 'missing':
      return { tone: 'danger', icon: XCircle, title: '입장 불가 · 신청 없음' }
    case 'failed':
      return { tone: 'danger', icon: CircleAlert, title: '확인 실패' }
  }
}

type Person = Extract<ScanOutcome, { applicant: unknown }>

// 이미 출석한 사람: 처음 출석한 시각과 참가비 상태(받기 버튼은 ScanActions가 둔다).
function alreadyDetails(outcome: Extract<ScanOutcome, { kind: 'already' }>) {
  const late = latePaymentOf(outcome)
  return [
    outcome.checkedInAt ? `처음 출석 ${dayTimeLabel(outcome.checkedInAt)}` : null,
    late?.kind === 'unpaid' ? '참가비 미납 · 재정부 확인 필요' : null,
    outcome.appliedFee ? paidLine(outcome) : null,
  ]
}

const paidLine = ({ applicant }: Person) =>
  applicant.deposit.status === 'confirmed' && applicant.deposit.amount !== null
    ? `입금 확인 ${won(applicant.deposit.amount)}`
    : null

// 판정 아래 줄: 왜 그 판정인지, 다음에 무엇을 하는지.
function detailsOf(outcome: ScanOutcome, verdict: Verdict): (string | null)[] {
  if (outcome.kind === 'missing') return ['명단에서 이름으로 찾아 주세요.']
  if (outcome.kind === 'failed') return [outcome.message]
  if (outcome.kind === 'already') return alreadyDetails(outcome)
  if (verdict.kind !== 'enter') return []
  return [outcome.appliedFee === 0 ? '무료' : paidLine(outcome)]
}

// 찍은 결과: 판정을 맨 위에 색으로, 그 아래 누구인지(이름·학번)를 크게 보인다. 버튼은 children이 정한다.
// 카메라 화면을 숨긴 자리에 놓여 작은 휴대폰에서도 잘리지 않는다(창이 스크롤된다).
export function ScanResultCard({
  outcome,
  children,
}: {
  outcome: ScanOutcome
  children?: ReactNode
}) {
  const verdict = verdictOf(outcome)
  const look = lookOf(verdict)
  const Icon = look.icon
  const details = detailsOf(outcome, verdict).filter(line => line !== null)
  const who = 'applicant' in outcome ? outcome : null
  // 결과가 바뀌면 보조기술이 읽는다(status).
  return (
    <section role="status" aria-label="찍은 결과" className="flex flex-col gap-4">
      <Alert tone={look.tone} className="flex items-center gap-2 p-4 text-lg font-bold">
        <Icon aria-hidden className="size-6 shrink-0" />
        <p>{look.title}</p>
      </Alert>
      {(who || details.length > 0) && (
        <div className="flex flex-col gap-1">
          {who && (
            <>
              <p className="text-lg font-semibold break-keep text-fg wrap-anywhere">{who.name}</p>
              {who.studentId && <p className="text-sm text-fg-tertiary">학번 {who.studentId}</p>}
            </>
          )}
          {details.map(line => (
            <p key={line} className="text-sm break-keep text-fg-tertiary wrap-anywhere">
              {line}
            </p>
          ))}
        </div>
      )}
      {children}
    </section>
  )
}
