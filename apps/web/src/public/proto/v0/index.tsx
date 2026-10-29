import { useEffect, useState } from 'react'
import ApplyFields from '../../ApplyFields'
import FormSummary from '../../FormSummary'
import { MyRegistrationView } from '../../MyRegistrationPage'
import RegistrationUnavailable from '../../RegistrationUnavailable'
import type { FormProps } from '../form-props'

// v0 = 지금 구현 그대로(비교 기준). 지금 public 부품에 견본을 넣어 그린다. 서버를 부르지 않는다. 고치지 않는다.
// 틀은 PublicApp.tsx, apply·closed는 ApplyPage.tsx(이미 신청한 기기 띠 빼고), done은 MyRegistrationPage의 ready 갈래다.
// 지금 구현에 없는 것: 완료 안내(doneNotice), 취소된 행사·새 설문으로 이동 카드(마감 카드로 보임), 행사 당일 QR 차례.
function Apply(props: FormProps) {
  const form = props.data.form
  const [values, setValues] = useState(props.values)
  const hasErrors = Object.keys(props.errors).length > 0
  // 지금 구현은 누른 뒤에만 칸 문제를 보인다. 오류 견본이면 한 번 눌러 그 모습으로 연다.
  useEffect(() => {
    if (hasErrors) document.querySelector<HTMLFormElement>('[data-form-root] form')?.requestSubmit()
  }, [hasErrors])
  return (
    <div className="flex flex-col gap-6">
      <FormSummary data={form} />
      {form.status !== 'open' ? (
        <RegistrationUnavailable data={form} />
      ) : (
        <ApplyFields
          data={form}
          values={values}
          busy={props.busy}
          problem={props.problem}
          onValues={setValues}
          onSubmit={() => props.onApply(values)}
        />
      )}
    </div>
  )
}

export default function V0(props: FormProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 py-6">
      {props.screen === 'done' ? (
        <MyRegistrationView
          mine={props.data.mine}
          cancel={{ busy: false, problem: '', run: () => Promise.resolve(props.onCancel()) }}
        />
      ) : (
        <Apply {...props} />
      )}
    </main>
  )
}
