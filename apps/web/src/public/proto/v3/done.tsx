import { useState } from 'react'
import { Check, CircleCheck, Clock, Copy, MessageCircle } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { cn } from '@/lib/utils'
import { inquiryText } from '../../registration-text'
import type { FormSample } from '../form-data'
import type { FormProps } from '../form-props'
import { Page } from './band'
import EntryTicket from './ticket'
import { useCopyToast } from './toast'
import { color, radius, size, space, type } from './tokens'

type Copy = (what: 'account' | 'link', value: string) => void

// 완료 띠(신청 직후·당일 아님): 머리 띠와 같은 행사 색 면. 체크 + '신청 완료' + 이름·행사명 + 운영진 안내.
// 아래 입금 띠가 24px 겹쳐 올라온다(신청 화면의 시트와 같은 겹침).
function DoneBand({ data }: { data: FormSample }) {
  return (
    <header
      className={cn('pt-6 pb-12', space.page, color.event, color.onEvent, 'sm:rounded-[28px]')}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full bg-white',
            size.doneIcon,
            color.eventText,
          )}
        >
          <Check aria-hidden strokeWidth={3} className="size-5" />
        </span>
        <h1 className={cn(type.title, color.onEvent)}>신청 완료</h1>
      </div>
      <p className={cn(type.label, 'mt-2 break-keep wrap-anywhere', color.onEventSoft)}>
        {data.mine.mine.name} · {data.mine.event.name}
      </p>
      {data.doneNotice && (
        <p
          className={cn(
            type.label,
            'mt-4 rounded-xl bg-white/12 px-4 py-3 break-keep whitespace-pre-wrap',
          )}
        >
          {data.doneNotice}
        </p>
      )}
    </header>
  )
}

// 당일에는 입장권이 맨 위라 완료는 쟁반 위 한 줄로 줄인다.
function DoneLine({ data }: { data: FormSample }) {
  return (
    <div className="flex items-start gap-3 px-1">
      <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-success-emphasis" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className={cn(type.body, 'font-bold text-fg')}>신청 완료</h1>
        <p className={cn(type.label, 'break-keep wrap-anywhere', color.trayText)}>
          {data.mine.mine.name} · {data.mine.event.name}
        </p>
        {data.doneNotice && (
          <p className={cn(type.label, 'mt-1 break-keep text-fg-secondary')}>{data.doneNotice}</p>
        )}
      </div>
    </div>
  )
}

function DepositPill({ confirmed }: { confirmed: boolean }) {
  return (
    <span
      className={cn(
        type.small,
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-bold',
        confirmed ? 'bg-success-surface text-success' : 'bg-pending-surface text-pending',
      )}
    >
      {confirmed ? (
        <Check aria-hidden strokeWidth={3} className="size-3.5" />
      ) : (
        <Clock aria-hidden strokeWidth={2.5} className="size-3.5" />
      )}
      {confirmed ? '입금 확인됨' : '입금 전'}
    </span>
  )
}

// 입금 띠(새 부품): 티켓 위를 가로지르는 흰 띠. 입금 전 = 상태 알약 + 금액(크게) + 계좌·예금주 + [복사].
// 입금 확인됨·무료 = 한 줄로 줄어든다(볼 때가 된 것만).
function DepositStrip({ data, copy, lifted }: { data: FormSample; copy: Copy; lifted: boolean }) {
  const { text, mine } = data
  const base = cn('relative bg-white shadow-sm', radius.card, lifted && space.overlap)
  if (data.deposit !== '입금 전' || !mine.account)
    return (
      <section
        aria-label="참가비"
        className={cn(base, 'flex min-h-14 items-center justify-between gap-3 px-5 py-3')}
      >
        <div className="flex items-center gap-2">
          <h2 className={cn(type.label, 'font-semibold text-fg-secondary')}>참가비</h2>
          {data.deposit && <DepositPill confirmed />}
        </div>
        <p className={cn(type.body, 'font-bold text-fg tabular-nums')}>{text.appliedFee}</p>
      </section>
    )
  return (
    <section aria-label="참가비" className={cn(base, 'flex flex-col gap-3 px-5 pt-4 pb-4')}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={cn(type.label, 'font-semibold text-fg-secondary')}>참가비</h2>
        <DepositPill confirmed={false} />
      </div>
      <p className={cn(type.title, 'text-fg tabular-nums')}>{text.appliedFee}</p>
      <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-3">
        <div className="flex min-w-0 flex-col">
          <p className={cn(type.label, 'text-fg-muted')}>{mine.account.bank}</p>
          <p className={cn(type.body, 'font-semibold text-fg tabular-nums select-all')}>
            {mine.account.accountNumber}
          </p>
          <p className={cn(type.label, 'break-keep text-fg-muted wrap-anywhere')}>
            예금주 {mine.account.holder}
          </p>
        </div>
        <button
          type="button"
          aria-label="계좌번호 복사"
          onClick={() => copy('account', mine.account?.accountNumber ?? '')}
          className={cn(
            type.label,
            'flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-surface-muted px-4 font-semibold text-fg-secondary outline-none hover:bg-muted-strong focus-visible:ring-2 focus-visible:ring-category-7-strong/40',
            size.smallButton,
          )}
        >
          <Copy aria-hidden className="size-4" />
          복사
        </button>
      </div>
    </section>
  )
}

function CancelButton({ onCancel }: { onCancel: () => void }) {
  const [asking, setAsking] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        className={cn(
          type.label,
          '-ml-3 cursor-pointer self-start rounded-lg px-3 font-medium text-fg-tertiary underline underline-offset-4 outline-none hover:text-fg-secondary focus-visible:ring-2 focus-visible:ring-border-strong',
          size.smallButton,
        )}
      >
        신청 취소
      </button>
      <ConfirmDialog
        open={asking}
        touch
        title="신청을 취소할까요?"
        description="취소하면 낸 이름과 연락처가 지워지고, 이 주소로 다시 볼 수 없어요. 마감 전이면 다시 신청할 수 있어요."
        confirmLabel="신청 취소"
        destructive
        onConfirm={() => {
          onCancel()
          setAsking(false)
        }}
        onClose={() => setAsking(false)}
      />
    </>
  )
}

// 카드 밖 아래 상세 목록(Google 지갑 r14): 문의 → 다시 열기 + [주소 복사] → [신청 취소] → 지우는 날.
// 일시·장소는 입장권 위 칸에 있어 여기서 다시 적지 않는다.
function AfterList({
  data,
  copy,
  onCancel,
}: {
  data: FormSample
  copy: Copy
  onCancel: () => void
}) {
  return (
    <section aria-label="문의와 다시 열기" className="flex flex-col gap-4 px-1 pt-2">
      <p className={cn(type.label, 'flex items-start gap-2 break-keep text-fg-secondary')}>
        <MessageCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
        {inquiryText(data.mine.form.notice)}
      </p>
      <div className="flex items-center justify-between gap-3">
        <p className={cn(type.label, 'break-keep', color.trayText)}>
          같은 휴대폰으로 신청 링크를 다시 열면 이 화면이 나와요
        </p>
        <button
          type="button"
          onClick={() => copy('link', window.location.href)}
          className={cn(
            type.label,
            'shrink-0 cursor-pointer rounded-full border border-border-strong bg-white px-4 font-medium text-fg-secondary outline-none hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-category-7-strong/40',
            size.smallButton,
          )}
        >
          주소 복사
        </button>
      </div>
      <div className="flex flex-col gap-1 border-t border-border-default pt-3">
        {data.mine.cancellable && !data.mine.attended && <CancelButton onCancel={onCancel} />}
        <p className={cn(type.small, color.trayText)}>{data.text.purge}</p>
      </div>
    </section>
  )
}

// 신청 직후·내 신청. 맨 위 행사 색 면 = 지금 1순위 하나: 평소엔 완료 띠, 당일엔 입장권.
export default function Done(props: FormProps) {
  const { data } = props
  const { copy, toast } = useCopyToast(props.onCopy)
  const day = data.eventDay
  return (
    <Page>
      {day ? (
        <div className={cn('flex flex-col gap-4 pt-4 pb-10 sm:pt-0', 'px-4 sm:px-0')}>
          <EntryTicket data={data} strong />
          <DoneLine data={data} />
          <DepositStrip data={data} copy={copy} lifted={false} />
          <AfterList data={data} copy={copy} onCancel={props.onCancel} />
        </div>
      ) : (
        <>
          <DoneBand data={data} />
          <div className="flex flex-col gap-4 px-4 pb-10 sm:px-3">
            <DepositStrip data={data} copy={copy} lifted />
            <EntryTicket data={data} strong={false} />
            <AfterList data={data} copy={copy} onCancel={props.onCancel} />
          </div>
        </>
      )}
      {toast}
    </Page>
  )
}
