import type { PublicRegistrationForm } from '@vada/contracts'
import { momentLabel, whenLabel } from '@/events/event-view'
import { Fact } from '@/components/Fact'
import { feeText } from './registration-text'
import { DEFAULT_FORM_NAME } from '@/registrations/registration-form'

// 신청 화면 위쪽: 어느 학생회의 무슨 행사인지, 남은 자리, 신청 마감, 참가비, 안내. 받는 칸은 아래 ApplyFields가 맡는다.
export default function FormSummary({ data }: { data: PublicRegistrationForm }) {
  const { event, form } = data
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs text-fg-muted wrap-anywhere">{data.councilName}</p>
        <h1 className="text-lg font-bold break-keep text-fg wrap-anywhere">{event.name}</h1>
        {form.name !== DEFAULT_FORM_NAME && (
          <p className="text-sm text-fg-secondary wrap-anywhere">{form.name}</p>
        )}
      </div>
      {data.remaining !== null && data.status === 'open' && (
        <span className="text-xs text-fg-muted">남은 자리 {data.remaining}</span>
      )}
      <dl className="flex flex-col gap-3">
        {/* 받는 중일 때만. 받지 않을 때는 신청 불가 카드가 보인다. 마감이 빈 것은 만드는 중인 미리보기뿐이다. */}
        {data.status === 'open' && form.closesAt !== '' && (
          <Fact label="신청 마감">{`${momentLabel(form.closesAt)}까지`}</Fact>
        )}
        <Fact label="일시">{whenLabel(event)}</Fact>
        {event.place && <Fact label="장소">{event.place}</Fact>}
        <Fact label="참가비">{feeText(data)}</Fact>
      </dl>
      {form.notice && (
        <p className="rounded-md bg-surface-subtle p-3 text-sm break-keep whitespace-pre-wrap text-fg-secondary wrap-anywhere">
          {form.notice}
        </p>
      )}
    </div>
  )
}
