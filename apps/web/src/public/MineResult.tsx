import { useId } from 'react'
import { Check, Copy as CopyIcon } from 'lucide-react'
import type { MyRegistration } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CopyFailed, type Copy } from './copy-toast'
import { focusRing, radius, type } from './public-look'
import { won } from './registration-text'

// 완료(Result 꼴, 토스 송금 완료): 파란 체크 원 → 큰 굵은 두 줄 '신청 완료 / 참가비 5,000원' → 회색 행사명 · 이름.
// 행사 당일에는 입장 QR이 h1이라 완료 제목은 h2이고 체크 원이 없다.
// 운영진 완료 안내 문구(DEC-93)는 서버에 칸이 없어 아직 싣지 않는다.
export function Result({ mine, compact }: { mine: MyRegistration; compact: boolean }) {
  const Title = compact ? 'h2' : 'h1'
  return (
    <section aria-label="신청 완료" className="flex flex-col items-center gap-3 text-center">
      {!compact && (
        <span className="flex size-16 items-center justify-center rounded-full bg-primary-emphasis text-white">
          <Check aria-hidden="true" className="size-9" strokeWidth={3} />
        </span>
      )}
      <div className={cn('flex flex-col', !compact && 'mt-2')}>
        <Title className={`${type.title} text-fg`}>신청 완료</Title>
        <p className={`${type.title} text-fg tabular-nums`}>참가비 {won(mine.appliedFee)}</p>
      </div>
      <p className={`${type.label} text-fg-muted wrap-anywhere`}>
        {mine.event.name} · {mine.mine.name}
      </p>
    </section>
  )
}

// 행사 당일에 낼 돈이 남지 않았으면(입금 확인됨·무료) 완료와 계좌를 두 줄로 접는다. 지난 입금 안내와 계좌는 싣지 않는다.
export function DayResult({ mine }: { mine: MyRegistration }) {
  return (
    <section aria-label="신청 완료" className="flex flex-col items-center gap-1 text-center">
      <h2 className={`${type.body} font-bold text-fg`}>신청 완료</h2>
      <p className={`${type.label} text-fg-secondary tabular-nums`}>
        참가비 {won(mine.appliedFee)}
        {mine.appliedFee > 0 && (
          <>
            <span aria-hidden="true"> · </span>
            <span className="inline-flex items-center gap-1 font-semibold text-success">
              <Check aria-hidden="true" className="size-4 self-center" strokeWidth={3} />
              입금 확인됨
            </span>
          </>
        )}
      </p>
    </section>
  )
}

// 입금 상태는 서버의 입금 확인 값이다. 운영진이 아직 확인하지 않았다는 뜻이지 보내지 않았다는 뜻이 아니라 '입금 확인 전'이다(DEC-93).
// 이미 보낸 학생이 '입금 전'을 보고 다시 보내지 않게 한다. 확인을 기다리는 상태라 주황으로 보인다.
function DepositPill({ confirmed }: { confirmed: boolean }) {
  return (
    <span
      className={cn(
        `inline-flex items-center gap-1 self-start rounded-full px-2.5 py-1 ${type.small} font-semibold`,
        confirmed ? 'bg-success-surface text-success' : 'bg-pending-surface text-pending',
      )}
    >
      {confirmed && <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />}
      {confirmed ? '입금 확인됨' : '입금 확인 전'}
    </span>
  )
}

// 계좌 줄 전체가 [계좌번호 복사] 한 버튼이다(누르는 면을 크게). 은행·번호·예금주는 버튼 설명으로 읽힌다.
function AccountButton({
  account,
  copy,
}: {
  account: NonNullable<MyRegistration['account']>
  copy: Copy
}) {
  const id = useId()
  return (
    <Button
      variant="ghost"
      touch={false}
      aria-label="계좌번호 복사"
      aria-describedby={id}
      onClick={() => copy.copy('account', account.accountNumber, '계좌번호를 복사했어요')}
      className={cn(
        '-m-2 h-auto justify-start gap-3 rounded-xl border-0 p-2 text-left font-normal whitespace-normal text-fg hover:bg-muted-strong active:bg-muted-strong',
        focusRing,
      )}
    >
      <span id={id} className="flex min-w-0 flex-1 flex-col">
        <span className={`${type.label} text-fg-tertiary`}>{account.bank}</span>
        <span className={`${type.body} font-bold tabular-nums wrap-anywhere`}>
          {account.accountNumber}
        </span>
        <span className={`${type.label} text-fg-tertiary wrap-anywhere`}>{account.holder}</span>
      </span>
      <span
        className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-white px-3.5 ${type.label} font-semibold text-fg-secondary`}
      >
        <CopyIcon aria-hidden="true" className="size-4" />
        복사
      </span>
    </Button>
  )
}

// 참가비·계좌: 회색 채운 면 하나. 위에 입금 상태, 아래는 계좌 버튼. 무료면 면이 없다.
export function AccountPanel({ mine, copy }: { mine: MyRegistration; copy: Copy }) {
  if (mine.appliedFee === 0) return null
  const account = mine.account
  return (
    <section
      aria-label="입금 계좌"
      className={`flex flex-col gap-3 ${radius.panel} bg-surface-muted p-5`}
    >
      <DepositPill confirmed={mine.depositConfirmed} />
      {account && <AccountButton account={account} copy={copy} />}
      {account && copy.failed === 'account' && <CopyFailed value={account.accountNumber} />}
    </section>
  )
}
