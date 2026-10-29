import { Check } from 'lucide-react'
import type { MyRegistration } from '@vada/contracts'
import { Fact } from '@/components/Fact'
import QrCode from '@/components/QrCode'
import { Alert } from '@/components/ui/alert'
import { cardClass } from '@/components/ui/card'
import CopyButton from './CopyButton'
import { inquiryText, won } from './registration-text'

export function AttendanceBlock({ mine }: { mine: MyRegistration }) {
  return (
    <section aria-label="출석 QR" className={`${cardClass} flex flex-col items-center p-4`}>
      {mine.attended ? (
        <Alert tone="success">출석 확인됨</Alert>
      ) : (
        // 내부 2모듈에 흰 여백 16px를 더해 QR 사방 4모듈 이상을 비운다(DENSO).
        <div className="max-w-full bg-white p-4">
          <QrCode text={mine.qrText} label="출석 확인 QR" />
        </div>
      )}
    </section>
  )
}

function FeeBlock({ mine }: { mine: MyRegistration }) {
  return (
    <section aria-label="참가비" className={`${cardClass} flex w-full flex-col gap-1 p-5`}>
      <h2 className="text-sm text-muted-foreground">참가비</h2>
      <p className="text-right text-lg font-semibold tabular-nums">{won(mine.appliedFee)}</p>
      {mine.appliedFee > 0 && (
        <p className="text-right text-sm text-muted-foreground">
          {mine.depositConfirmed ? '입금 확인됨' : '입금 확인 전'}
        </p>
      )}
    </section>
  )
}

export function AccountBlock({ mine }: { mine: MyRegistration }) {
  if (!mine.account) return null
  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-col gap-3">
        <Fact label="입금 계좌">
          {mine.account.bank} {mine.account.accountNumber}
        </Fact>
        <Fact label="예금주">{mine.account.holder}</Fact>
      </dl>
      <CopyButton
        value={mine.account.accountNumber}
        label="계좌번호 복사"
        failedHint="복사하지 못했어요. 길게 눌러 복사해 주세요."
      />
    </div>
  )
}

export function SavedLinkBlock({ mine }: { mine: MyRegistration }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm break-keep text-muted-foreground">
        {mine.attended
          ? '이 주소를 저장해 두면 신청 내용을 다시 볼 수 있어요.'
          : '이 주소를 저장해 두고, 행사 당일 이 QR을 보여 주세요.'}
      </p>
      <CopyButton
        value={window.location.href}
        label="주소 복사"
        failedHint="복사하지 못했어요. 길게 눌러 복사해 주세요."
      />
    </div>
  )
}

// 내가 낸 답(질문마다). 질문이 없는 양식은 그리지 않는다.
function AnswersBlock({ mine }: { mine: MyRegistration }) {
  if (!mine.answers.length) return null
  return (
    <section aria-label="내 답" className={`${cardClass} w-full p-5 text-left`}>
      <dl className="flex flex-col gap-3">
        {mine.answers.map(answer => (
          <Fact key={answer.questionId} label={answer.title}>
            {answer.values.length ? answer.values.join(', ') : '답 없음'}
          </Fact>
        ))}
      </dl>
    </section>
  )
}

export function MineFacts({ mine }: { mine: MyRegistration }) {
  return (
    <div className="flex flex-col items-center gap-5 text-center break-keep wrap-anywhere">
      <div className="flex size-20 items-center justify-center rounded-full bg-green-100 text-green-600">
        <Check aria-hidden="true" className="size-10" />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-xl font-bold">신청 완료</h1>
        <h2 className="text-base text-muted-foreground">{mine.event.name}</h2>
        <p className="text-sm font-medium">
          신청자: <span>{mine.mine.name}</span>
        </p>
        {mine.mine.studentId && (
          <p className="text-sm text-muted-foreground">{mine.mine.studentId}</p>
        )}
        {mine.mine.phone && <p className="text-sm text-muted-foreground">{mine.mine.phone}</p>}
      </div>
      <FeeBlock mine={mine} />
      <AnswersBlock mine={mine} />
      <section className="flex w-full flex-col gap-3 rounded-lg bg-muted p-4 text-left">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">안내 사항</h2>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
            {mine.form.notice || '안내 사항 없음'}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">문의</h2>
          <p className="text-sm text-muted-foreground">{inquiryText(mine.form.notice)}</p>
        </div>
      </section>
    </div>
  )
}
