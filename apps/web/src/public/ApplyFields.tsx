import type { PublicRegistrationForm } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useReveal } from '@/lib/use-reveal'
import { collectedItems, dateText } from './registration-text'
import { parseApply, type ApplyValues } from './useApply'

type Props = {
  data: PublicRegistrationForm
  values: ApplyValues
  busy: boolean
  problem: string
  onValues: (values: ApplyValues) => void
  onSubmit: () => void
  // 버튼 아래 고지를 보일지. 운영진의 미리보기만 끈다(학생 화면에는 늘 있다, DEC-62).
  notice?: boolean
}

// 버튼 아래 고정 고지. 체크칸은 두지 않는다: 신청하기를 누르는 것이 이 고지를 읽고 낸다는 뜻이다.
// 지우는 날은 서버가 늘 주지만, 운영진이 만드는 중인 미리보기에는 셀 날짜가 아직 없을 수 있다.
function Notice({ data }: { data: PublicRegistrationForm }) {
  return (
    <p className="text-xs text-gray-500 wrap-anywhere">
      받는 곳: {data.councilName} · 받는 항목: {collectedItems(data).join(', ')} · 목적: 행사 참가
      신청과 출석 확인 · 지우는 날: {data.purgeOn ? dateText(data.purgeOn) : '행사가 끝나고 1년 뒤'}
      .{' '}
      {data.form.notice
        ? '문의는 위 안내에 적힌 곳으로 해 주세요.'
        : '문의는 이 링크를 보낸 운영진에게 해 주세요.'}
    </p>
  )
}

// 학번은 참가비가 갈릴 때만, 휴대폰은 받을 때만 있다. 서버가 같은 기준으로 칸을 검사한다(FORM_CHANGED).
function OptionalFields(props: {
  data: PublicRegistrationForm
  values: ApplyValues
  busy: boolean
  set: (patch: Partial<ApplyValues>) => void
}) {
  const { data, values, busy, set } = props
  return (
    <>
      {data.collectsStudentId && (
        <Field label="학번" required>
          <Input
            value={values.studentId}
            disabled={busy}
            inputMode="numeric"
            onChange={event => set({ studentId: event.target.value })}
          />
        </Field>
      )}
      {data.collectsPhone && (
        <Field label="휴대폰 번호" required hint="010-1234-5678처럼 써도 돼요.">
          <Input
            value={values.phone}
            disabled={busy}
            inputMode="tel"
            autoComplete="tel"
            onChange={event => set({ phone: event.target.value })}
          />
        </Field>
      )}
    </>
  )
}

// 받는 중일 때만 쓰는 칸과 버튼. 학번은 참가비가 갈릴 때만, 휴대폰은 받을 때만 있다. 오류는 버튼 옆에 보인다.
export default function ApplyFields({
  data,
  values,
  busy,
  problem,
  onValues,
  onSubmit,
  notice = true,
}: Props) {
  const valid = parseApply(data, values).success
  const problemRef = useReveal<HTMLDivElement>(problem)
  const set = (patch: Partial<ApplyValues>) => onValues({ ...values, ...patch })
  return (
    <form
      aria-label="참가 신청"
      className="flex flex-col gap-4"
      onSubmit={event => {
        event.preventDefault()
        if (valid) onSubmit()
      }}
    >
      <Field label="이름" required>
        <Input
          value={values.name}
          disabled={busy}
          autoComplete="name"
          onChange={event => set({ name: event.target.value })}
        />
      </Field>
      <OptionalFields data={data} values={values} busy={busy} set={set} />
      <Button type="submit" disabled={!valid || busy}>
        신청하기
      </Button>
      <div ref={problemRef}>{problem && <StateMessage kind="error">{problem}</StateMessage>}</div>
      {notice && <Notice data={data} />}
    </form>
  )
}
