import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { copyText } from '@/lib/copy-text'
import { inquiryText } from '../../registration-text'
import type { FormProps } from '../form-props'
import { useToast } from './paper'
import { DepositMark, DoneNotice, DonePanel, KeyRow, Perforation, StampQr } from './receipt-parts'
import { CLS } from './tokens'

// 신청 직후·내 신청: 같은 종이가 영수증이 된다. 완료 패널 → (안내) → 참가비 점선 줄 → 절취 점선 → 도장 칸 QR → 행사 정보.
// 행사 당일에는 도장 칸이 완료 패널 바로 아래로 올라오고 커진다.

type Copy = (what: 'account' | 'link', value: string, done: string) => void

function FeeRows({ data, copy }: { data: FormProps['data']; copy: Copy }) {
  const { text, mine } = data
  return (
    <section className={`${CLS.pad} pt-5 pb-5`} aria-labelledby="v1-fee">
      <h2 id="v1-fee" className="text-sm font-semibold text-fg">
        참가비
      </h2>
      <dl className={`mt-1 ${CLS.dashedList}`}>
        <KeyRow label="금액">
          <span data-k="fee-amount" className="text-xl leading-7 font-bold tabular-nums text-fg">
            {text.appliedFee}
          </span>
          <DepositMark deposit={data.deposit} />
        </KeyRow>
        {text.account && mine.account && (
          <KeyRow
            label="계좌"
            end={
              <Button
                variant="ghost"
                className={`${CLS.textButton} -mr-2 min-w-11 text-primary-strong`}
                onClick={() =>
                  copy('account', mine.account?.accountNumber ?? '', '계좌번호를 복사했어요')
                }
              >
                복사
              </Button>
            }
          >
            <span className="block text-sm text-fg-secondary">{mine.account.bank}</span>
            <span className="block text-base whitespace-nowrap text-fg tabular-nums">
              {mine.account.accountNumber}
            </span>
          </KeyRow>
        )}
        {text.holder && (
          <KeyRow label="예금주">
            <span className="text-base text-fg">{text.holder}</span>
          </KeyRow>
        )}
      </dl>
    </section>
  )
}

function EventRows({ data }: { data: FormProps['data'] }) {
  return (
    <section className={`${CLS.pad} pt-5 pb-2`} aria-labelledby="v1-event">
      <h2 id="v1-event" className="text-sm font-semibold text-fg">
        행사 정보
      </h2>
      <dl className="mt-1 divide-y divide-border-default">
        <KeyRow label="일시">{data.text.when}</KeyRow>
        <KeyRow label="장소">{data.text.place ?? '장소 미정'}</KeyRow>
        <KeyRow label="문의">{inquiryText(data.mine.form.notice)}</KeyRow>
      </dl>
    </section>
  )
}

function Footer({ props, copy }: { props: FormProps; copy: Copy }) {
  const [asking, setAsking] = useState(false)
  const { mine, text } = props.data
  return (
    <footer className={`${CLS.pad} flex flex-col gap-1 pt-3 pb-6 sm:pb-8`}>
      <div className="flex items-center gap-3 rounded-[4px] bg-surface-subtle py-1 pr-1 pl-3">
        <p className="flex-1 text-sm break-keep text-fg-secondary">
          같은 휴대폰으로 신청 링크를 다시 열면 이 화면이 나와요
        </p>
        <Button
          variant="ghost"
          className={`${CLS.textButton} text-primary-strong`}
          onClick={() => copy('link', window.location.href, '주소를 복사했어요')}
        >
          주소 복사
        </Button>
      </div>
      {mine.cancellable && (
        <Button
          variant="ghost"
          className={`${CLS.textButton} -ml-2 self-start font-medium text-fg-muted underline underline-offset-4`}
          onClick={() => setAsking(true)}
        >
          신청 취소
        </Button>
      )}
      <p className={`text-xs text-fg-muted ${mine.cancellable ? '' : 'pt-3'}`}>{text.purge}</p>
      <ConfirmDialog
        open={asking}
        title="신청을 취소할까요?"
        description="취소하면 낸 이름과 연락처가 지워지고, 이 주소로 다시 볼 수 없어요. 마감 전이면 다시 신청할 수 있어요."
        confirmLabel="신청 취소"
        destructive
        touch
        onConfirm={() => {
          props.onCancel()
          setAsking(false)
        }}
        onClose={() => setAsking(false)}
      />
    </footer>
  )
}

export default function ReceiptSheet(props: FormProps) {
  const { data } = props
  const toast = useToast()
  const copy: Copy = (what, value, done) => {
    props.onCopy(what, value)
    void copyText(value).then(ok =>
      toast.show(ok ? done : '복사하지 못했어요. 길게 눌러 복사해 주세요.'),
    )
  }
  const qr = <StampQr data={data} />
  return (
    <>
      <DonePanel data={data} />
      {data.eventDay && (
        <>
          {qr}
          <Perforation />
        </>
      )}
      <DoneNotice text={data.doneNotice} />
      <FeeRows data={data} copy={copy} />
      {!data.eventDay && (
        <>
          <Perforation />
          {qr}
        </>
      )}
      <Perforation />
      <EventRows data={data} />
      <Footer props={props} copy={copy} />
      {toast.node}
    </>
  )
}
