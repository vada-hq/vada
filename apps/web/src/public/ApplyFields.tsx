import { AlertCircle } from 'lucide-react'
import type { PublicRegistrationForm } from '@vada/contracts'
import { useFormCheck, type FieldErrors } from '@/lib/use-form-check'
import { useReveal } from '@/lib/use-reveal'
import { BigButton, BottomBar } from './BottomBar'
import { FilledField } from './FilledField'
import { phoneView } from './phone-view'
import { type } from './public-look'
import { collectedItems, dateText, inquiryText, noticePurpose } from './registration-text'
import { QuestionFields } from './QuestionFields'
import { applyErrors, type ApplyValues } from './useApply'

type Props = {
  data: PublicRegistrationForm
  values: ApplyValues
  busy: boolean
  problem: string
  onValues: (values: ApplyValues) => void
  onSubmit: () => void
  // 운영진의 미리보기 안이면 고지를 빼고 버튼을 아래에 붙이지 않는다(학생 화면에는 고지가 늘 있다, DEC-62).
  preview?: boolean
}

// 버튼 아래 고정 고지. 체크칸은 두지 않는다: 신청하기를 누르는 것이 이 고지를 읽고 낸다는 뜻이다.
// 지우는 날은 서버가 늘 주지만, 운영진이 만드는 중인 미리보기에는 셀 날짜가 아직 없을 수 있다.
function Notice({ data }: { data: PublicRegistrationForm }) {
  return (
    <p className={`pt-1 pb-10 ${type.small} text-fg-muted wrap-anywhere`}>
      받는 곳: {data.councilName} · 받는 항목: {collectedItems(data).join(', ')} · 목적:{' '}
      {noticePurpose(data)} · 지우는 날:{' '}
      {data.purgeOn ? dateText(data.purgeOn) : '행사가 끝나고 1년 뒤'}.{' '}
      {inquiryText(data.form.notice)}
    </p>
  )
}

// 이름 → 학번(숫자 키패드) → 휴대폰(전화 키패드, 보이기만 하이픈). 학번은 양식이 받을 때만(DEC-75), 휴대폰은 받을 때만 있다.
// 서버가 같은 기준으로 칸을 검사한다(FORM_CHANGED).
function BasicFields(props: {
  data: PublicRegistrationForm
  values: ApplyValues
  busy: boolean
  errors: FieldErrors
  set: (patch: Partial<ApplyValues>) => void
}) {
  const { data, values, busy, errors, set } = props
  return (
    <>
      <FilledField
        label="이름"
        required
        error={errors.name}
        value={values.name}
        disabled={busy}
        autoComplete="name"
        onChange={event => set({ name: event.target.value })}
      />
      {data.collectsStudentId && (
        <FilledField
          label="학번"
          required
          error={errors.studentId}
          value={values.studentId}
          disabled={busy}
          inputMode="numeric"
          onChange={event => set({ studentId: event.target.value })}
        />
      )}
      {data.collectsPhone && (
        <FilledField
          label="휴대폰 번호"
          required
          error={errors.phone}
          value={values.phone}
          disabled={busy}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          onChange={event => set({ phone: phoneView(event.target.value) })}
        />
      )}
    </>
  )
}

// 받는 중일 때만 쓰는 칸과 버튼. 칸은 간격으로만 나누고(상자 없음), [신청하기]는 휴대폰에서 화면 아래에 붙는다.
// 거절 문구는 버튼 바로 위에 보인다.
export default function ApplyFields({
  data,
  values,
  busy,
  problem,
  onValues,
  onSubmit,
  preview = false,
}: Props) {
  const { formRef, errors, attempt } = useFormCheck(() => applyErrors(data, values))
  const problemRef = useReveal<HTMLDivElement>(problem)
  const set = (patch: Partial<ApplyValues>) => onValues({ ...values, ...patch })
  return (
    <form
      ref={formRef}
      noValidate
      aria-label="참가 신청"
      className="mt-10 flex flex-1 flex-col"
      onSubmit={event => {
        event.preventDefault()
        if (attempt()) onSubmit()
      }}
    >
      <div className="flex flex-col gap-6">
        <BasicFields data={data} values={values} busy={busy} errors={errors} set={set} />
        <QuestionFields
          questions={data.questions}
          answers={values.answers}
          busy={busy}
          errors={errors}
          onAnswer={(questionId, value) =>
            set({ answers: { ...values.answers, [questionId]: value } })
          }
        />
      </div>
      <div className="mt-8" />
      <BottomBar sticky={!preview}>
        <div ref={problemRef} hidden={!problem}>
          {problem && (
            <p
              role="alert"
              className={`flex items-start gap-1.5 ${type.label} font-medium text-danger`}
            >
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {problem}
            </p>
          )}
        </div>
        <BigButton submit busy={busy} busyLabel="신청하는 중">
          신청하기
        </BigButton>
      </BottomBar>
      {!preview && <Notice data={data} />}
    </form>
  )
}
