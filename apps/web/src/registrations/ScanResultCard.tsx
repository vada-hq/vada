import { CheckCircle2, Info, XCircle, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useEffect, useRef, type ReactNode } from 'react'
import type { ScanOutcome } from './check-in'

type Look = { icon: LucideIcon; color: string; title: string; description?: string }

function lookOf(outcome: ScanOutcome): Look {
  switch (outcome.kind) {
    case 'checked':
      return { icon: CheckCircle2, color: 'text-green-600', title: '출석을 확인했어요' }
    case 'already':
      return { icon: Info, color: 'text-blue-600', title: '이미 출석했어요' }
    case 'missing':
      return {
        icon: XCircle,
        color: 'text-red-600',
        title: '이 행사 신청에서 찾을 수 없어요',
        description: '다른 행사의 QR이거나 취소한 신청일 수 있어요. 목록에서 이름으로 찾아 주세요.',
      }
    case 'failed':
      return {
        icon: XCircle,
        color: 'text-red-600',
        title: '출석을 확인하지 못했어요',
        description: outcome.message,
      }
  }
}

// 찍은 결과: 누구인지(이름·학번)를 크게 보인다. 보이는 동안 판독이 멈추고, [다음]을 누르면 다시 읽는다.
export function ScanResultCard({
  outcome,
  onNext,
  busy = false,
  children,
}: {
  outcome: ScanOutcome
  onNext: () => void
  busy?: boolean
  children?: ReactNode
}) {
  const look = lookOf(outcome)
  const Icon = look.icon
  const who = outcome.kind === 'checked' || outcome.kind === 'already' ? outcome : null
  const next = useRef<HTMLButtonElement>(null)
  const payment = who
    ? `${who.applicant.id}:${who.applicant.deposit.status}:${who.applicant.deposit.amount}`
    : null
  const previous = useRef(payment)
  useEffect(() => {
    // 성공하면 누른 입금 버튼이 사라진다. 초점을 논리적인 다음 동작에 남긴다.
    if (previous.current !== payment && previous.current !== null) next.current?.focus()
    previous.current = payment
  }, [payment])
  // 결과가 바뀌면 보조기술이 읽는다(status). 카드가 카메라 화면보다 크면 카드 안에서 스크롤한다.
  return (
    <section
      role="status"
      aria-label="찍은 결과"
      className="flex max-h-full flex-col gap-3 overflow-y-auto rounded-md border bg-white p-4 shadow-lg"
    >
      <div className="flex items-center gap-2">
        <Icon aria-hidden className={cn('size-5 shrink-0', look.color)} />
        <p className="text-sm font-semibold text-gray-900">{look.title}</p>
      </div>
      {look.description && (
        <p className="text-sm text-gray-600 wrap-anywhere">{look.description}</p>
      )}
      {who && (
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold text-gray-900 wrap-anywhere">{who.name}</p>
          {who.studentId && <p className="text-sm text-gray-600">학번 {who.studentId}</p>}
        </div>
      )}
      {children}
      <div className="flex justify-end">
        <Button ref={next} className="min-h-11" busy={busy} onClick={onNext}>
          다음
        </Button>
      </div>
    </section>
  )
}
