import { useState, type ReactNode } from 'react'
import { CalendarDays, MapPin, Megaphone, MessageCircle } from 'lucide-react'
import type { MyRegistration } from '@vada/contracts'
import { whenLabel } from '@/events/event-view'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CopyFailed, type Copy } from './copy-toast'
import { phoneView } from './phone-view'
import { Fact, FactList } from './PageParts'
import { focusRing, type } from './public-look'
import { cancelNotice, dateText, inquiryText } from './registration-text'

export type Cancel = { busy: boolean; problem: string; run: () => Promise<void> }

function Value({ children }: { children: ReactNode }) {
  return <span className="whitespace-pre-wrap wrap-anywhere">{children}</span>
}

// 행사 정보(다시 읽을 때마다 최신)·안내·문의. 신청 화면 머리와 같은 아이콘 줄이다.
function EventInfo({ mine }: { mine: MyRegistration }) {
  return (
    <FactList>
      <Fact icon={CalendarDays}>
        <Value>{whenLabel(mine.event)}</Value>
      </Fact>
      <Fact icon={MapPin}>
        <Value>{mine.event.place ?? '장소 미정'}</Value>
      </Fact>
      {mine.form.notice && (
        <Fact icon={Megaphone}>
          <Value>{mine.form.notice}</Value>
        </Fact>
      )}
      <Fact icon={MessageCircle}>
        <Value>{inquiryText(mine.form.notice)}</Value>
      </Fact>
    </FactList>
  )
}

// 내가 낸 학번·휴대폰·답. 질문 제목이 길 수 있어 이름표를 값 위에 둔다. 낸 것이 이름뿐이면 그리지 않는다.
function MyAnswers({ mine }: { mine: MyRegistration }) {
  const rows = [
    ...(mine.mine.studentId
      ? [{ key: 'studentId', title: '학번', value: mine.mine.studentId }]
      : []),
    ...(mine.mine.phone
      ? [{ key: 'phone', title: '휴대폰 번호', value: phoneView(mine.mine.phone) }]
      : []),
    ...mine.answers.map(answer => ({
      key: answer.questionId,
      title: answer.title,
      value: answer.values.length ? answer.values.join(', ') : '답 없음',
    })),
  ]
  if (!rows.length) return null
  return (
    <section aria-label="내 답">
      <dl className="flex flex-col gap-3">
        {rows.map(row => (
          <div key={row.key} className="flex flex-col">
            <dt className={`${type.label} text-fg-muted wrap-anywhere`}>{row.title}</dt>
            <dd className={`${type.label} text-fg-body wrap-anywhere`}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// 같은 기기 재방문은 이미 이어지므로 '저장해 두세요'를 시키지 않고, 주소 복사는 작게 둔다(내용 ④).
function Reopen({ copy }: { copy: Copy }) {
  const href = window.location.href
  return (
    <div className="flex flex-col items-start gap-2">
      <p className={`${type.label} text-fg-muted`}>
        같은 휴대폰으로 신청 링크를 다시 열면 이 화면이 나와요
      </p>
      <Button
        variant="secondary"
        touch={false}
        onClick={() => copy.copy('link', href, '주소를 복사했어요')}
        className={cn(
          `min-h-11 rounded-full border-0 bg-surface-muted px-4 ${type.label} font-medium text-fg-secondary hover:bg-muted-strong active:bg-muted-strong`,
          focusRing,
        )}
      >
        주소 복사
      </Button>
      {copy.failed === 'link' && <CopyFailed value={href} />}
    </div>
  )
}

// [신청 취소]는 맨 아래 조용히 둔다(파괴적 행동은 아래). 보이기는 서버의 cancellable만 본다.
function CancelBlock({ cancel, description }: { cancel: Cancel; description: string }) {
  const [asking, setAsking] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        touch={false}
        onClick={() => setAsking(true)}
        className={cn(
          `-ml-1 min-h-11 self-start border-0 px-1 ${type.label} font-normal text-fg-muted underline underline-offset-4 hover:bg-transparent hover:text-fg-secondary`,
          focusRing,
        )}
      >
        신청 취소
      </Button>
      <ConfirmDialog
        open={asking}
        touch
        title="신청을 취소할까요?"
        description={description}
        confirmLabel="신청 취소"
        destructive
        busy={cancel.busy}
        onConfirm={() => {
          void cancel.run().then(() => setAsking(false))
        }}
        onClose={() => setAsking(false)}
      />
    </>
  )
}

// 띠 아래: 행사 정보·문의 → 내 답 → 다시 열기 → 취소 → 지우는 날.
export function MineFooter(props: { mine: MyRegistration; cancel: Cancel; copy: Copy }) {
  const { mine, cancel, copy } = props
  return (
    <div className="flex flex-col gap-6 pt-6 pb-12">
      <EventInfo mine={mine} />
      <MyAnswers mine={mine} />
      <Reopen copy={copy} />
      {mine.cancellable && <CancelBlock cancel={cancel} description={cancelNotice(mine)} />}
      {/* 취소 오류는 취소 버튼이 사라져도(마감이 지나 cancellable이 false가 되면) 이유와 함께 남는다. */}
      {cancel.problem && <StateMessage kind="error">{cancel.problem}</StateMessage>}
      {mine.purgeOn && (
        <p className={`${type.small} text-fg-muted`}>
          신청 정보는 {dateText(mine.purgeOn)}에 지워져요.
        </p>
      )}
    </div>
  )
}
