import { useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { inquiryText } from '../../registration-text'
import type { FormDeposit, FormSample } from '../form-data'
import type { FormProps } from '../form-props'
import { EntryQrHero, EntryQrRow } from './entry-qr'
import { Band, Page, QuietButton } from './parts'
import { Toast, useCopy } from './toast'
import { radius, size, type } from './tokens'

// 완료(Result 꼴): 가운데 파란 체크 원 → 큰 굵은 두 줄 '신청 완료 / 참가비 10,000원' → 회색 행사명 · 이름 → 운영진 안내.
function Result({ data, compact }: { data: FormSample; compact: boolean }) {
  // 당일에는 입장 QR이 h1이라 완료 제목은 h2다.
  const Title = compact ? 'h2' : 'h1'
  return (
    <section aria-label="신청 완료" className="flex flex-col items-center gap-3 text-center">
      {!compact && (
        <span
          className={`flex ${size.resultIcon} items-center justify-center rounded-full bg-primary-emphasis text-white`}
        >
          <Check aria-hidden="true" className="size-9" strokeWidth={3} />
        </span>
      )}
      <Title className={`${type.title} ${compact ? '' : 'mt-2'}`}>
        <span className="block" data-k="done-title">
          신청 완료
        </span>
        <span className="block" data-k="fee-amount">
          참가비 {data.text.appliedFee}
        </span>
      </Title>
      <p className={`${type.label} text-fg-muted wrap-anywhere`}>
        {data.text.event} · {data.mine.mine.name}
      </p>
      {data.doneNotice && (
        <p className={`${type.label} whitespace-pre-wrap text-fg-secondary`}>{data.doneNotice}</p>
      )}
    </section>
  )
}

const DEPOSIT_PILL: Record<Exclude<FormDeposit, null>, string> = {
  '입금 전': 'bg-pending-surface text-pending',
  '입금 확인됨': 'bg-success-surface text-success',
}

function DepositPill({ deposit }: { deposit: FormDeposit }) {
  if (!deposit) return null
  return (
    <span
      className={`inline-flex items-center gap-1 self-start rounded-full px-2.5 py-1 ${type.small} font-semibold ${DEPOSIT_PILL[deposit]}`}
    >
      {deposit === '입금 확인됨' && <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />}
      {deposit}
    </span>
  )
}

// 참가비·계좌: 회색 채운 면 하나. 면 위에 입금 상태 알약, 아래는 면 전체가 [계좌번호 복사].
function AccountPanel({ data, copy }: { data: FormSample; copy: ReturnType<typeof useCopy>['copy'] }) {
  const account = data.mine.account
  if (!account) return null
  return (
    <section aria-label="입금 계좌" className={`flex flex-col gap-3 ${radius.panel} bg-surface-muted p-5`}>
      <DepositPill deposit={data.deposit} />
      <button
        type="button"
        aria-label={`계좌번호 복사 ${account.bank} ${account.accountNumber}`}
        onClick={() => copy('account', account.accountNumber, '계좌번호를 복사했어요')}
        className="-m-2 flex cursor-pointer items-center gap-3 rounded-xl p-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-emphasis active:bg-muted-strong"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={`${type.label} text-fg-tertiary`}>{account.bank}</span>
          <span className={`${type.body} font-bold tabular-nums wrap-anywhere`}>{account.accountNumber}</span>
          <span className={`${type.label} text-fg-tertiary wrap-anywhere`}>{account.holder}</span>
        </span>
        <span
          className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-white px-3.5 ${type.label} font-semibold text-fg-secondary`}
        >
          <Copy aria-hidden="true" className="size-4" />
          복사
        </span>
      </button>
    </section>
  )
}

// 행사 당일에 입금이 끝났으면(확인됨·무료) 완료·계좌를 한 덩이로 접는다: '신청 완료' + '참가비 10,000원 · 입금 확인됨'.
// 지난 입금 안내 문구와 계좌는 싣지 않는다(당일 주인공은 입장 QR).
function DayResult({ data }: { data: FormSample }) {
  return (
    <section aria-label="신청 완료" className="flex flex-col items-center gap-1 text-center">
      <h2 className={`${type.body} font-bold`} data-k="done-title">
        신청 완료
      </h2>
      <p className={`${type.label} text-fg-secondary`} data-k="fee-amount">
        참가비 {data.text.appliedFee}
        {data.deposit && (
          <>
            <span aria-hidden="true"> · </span>
            <span className="inline-flex items-center gap-1 font-semibold text-success">
              <Check aria-hidden="true" className="size-4 self-center" strokeWidth={3} />
              {data.deposit}
            </span>
          </>
        )}
      </p>
    </section>
  )
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4">
      <dt className={`w-10 shrink-0 ${type.label} text-fg-muted`}>{label}</dt>
      <dd className={`min-w-0 flex-1 ${type.label} text-fg-body wrap-anywhere`}>{children}</dd>
    </div>
  )
}

// 행사 정보(늘 최신)·다시 열기·취소·지우는 날: 띠 아래 회색 작은 줄들.
function Footer({ props, copy }: { props: FormProps; copy: ReturnType<typeof useCopy>['copy'] }) {
  const { data } = props
  const [asking, setAsking] = useState(false)
  return (
    <div className="flex flex-col gap-6 pt-6 pb-12">
      <dl className="flex flex-col gap-3">
        <InfoRow label="일시">{data.text.when}</InfoRow>
        <InfoRow label="장소">{data.text.place ?? '장소 미정'}</InfoRow>
        <InfoRow label="문의">{inquiryText(data.mine.form.notice)}</InfoRow>
      </dl>
      <div className="flex flex-col gap-2">
        <p className={`${type.label} text-fg-muted`}>같은 휴대폰으로 신청 링크를 다시 열면 이 화면이 나와요</p>
        <QuietButton onClick={() => copy('link', window.location.href, '주소를 복사했어요')}>
          주소 복사
        </QuietButton>
      </div>
      {data.mine.cancellable && !data.mine.attended && (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className={`-ml-1 min-h-11 cursor-pointer self-start px-1 ${type.label} text-fg-muted underline underline-offset-4`}
        >
          신청 취소
        </button>
      )}
      <ConfirmDialog
        open={asking}
        touch
        title="신청을 취소할까요?"
        description="취소하면 낸 이름과 연락처가 지워지고, 이 주소로 다시 볼 수 없어요. 마감 전이면 다시 신청할 수 있어요."
        confirmLabel="신청 취소"
        destructive
        onConfirm={() => {
          props.onCancel()
          setAsking(false)
        }}
        onClose={() => setAsking(false)}
      />
      <p className={`${type.small} text-fg-muted`}>{data.text.purge}</p>
    </div>
  )
}

// 신청 직후·내 신청. 차례: 완료 → 참가비·계좌 → 입장 QR → 행사 정보 → 다시 열기 → 취소 → 지우는 날.
// 행사 당일에는 입장 QR이 맨 위 Result 자리로 오고, 완료와 계좌는 그 아래로 내려간다.
export default function DoneScreen(props: FormProps) {
  const { data } = props
  const { copy, message } = useCopy(props.onCopy)
  const day = data.eventDay
  // 당일이고 낼 돈이 남지 않았으면(입금 확인됨·무료) 완료·계좌를 한 줄로 접는다.
  const settled = day && data.deposit !== '입금 전'
  return (
    <Page>
      <div className={`flex flex-col gap-6 pb-8 ${day ? '' : 'pt-6'}`}>
        {day && <EntryQrHero mine={data.mine} />}
        {day && <Band />}
        {settled ? <DayResult data={data} /> : <Result data={data} compact={day} />}
        {!settled && <AccountPanel data={data} copy={copy} />}
        {!day && <EntryQrRow mine={data.mine} />}
      </div>
      <Band />
      <Footer props={props} copy={copy} />
      <Toast message={message} />
    </Page>
  )
}
