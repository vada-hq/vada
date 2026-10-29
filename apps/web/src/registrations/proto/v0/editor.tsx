import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pickAccount } from '@/finance/account-form'
import type { FieldErrors } from '@/lib/use-form-check'
import { FeeAccountSelect } from '../../FeeAccountSelect'
import { FormEventFacts } from '../../FormEventFacts'
import { BasicFields, CollectFields, FeeFields } from '../../FormFields'
import { FormSection } from '../../FormSection'
import { QuestionEditor } from '../../QuestionEditor'
import { questionErrors } from '../../question-draft'
import { formErrors, hasFee } from '../../registration-form'
import { ApplyPreview } from '../apply-preview'
import type { EditorSample } from '../builder-data'
import type { BuilderProps } from '../builder-props'

// v0 편집기 = FormEditor와 같은 차례·부품(행사 기본정보 → 모집 설정·참가비·계좌 → 받는 항목 → [만들기], 오른쪽 미리보기).
// FormEditor는 계좌 목록(useAccounts)과 보내기(useStaffPost)를 서버에서 하므로 그대로 쓰지 못해 같은 부품을 견본으로 엮었다.
// 다른 점: 미리보기는 지금 FormPreview 대신 신청자 화면 확정안(../apply-preview, 실제 제품에 들어가는 중)이다.
// 미리보기는 편집기 form 바깥에 둔다(확정안 신청 화면이 제 form을 가져 form 안에 form이 되면 안 된다).
// 오류 견본은 누른 뒤 모습(칸 아래 오류)으로 연다.
const ACCOUNT_MISSING = '참가비 받을 계좌를 골라 주세요'

function useEditor(editor: EditorSample, onSubmit: BuilderProps['onSubmit']) {
  const [values, setValues] = useState(editor.values)
  const [chosen, setChosen] = useState(editor.chosenAccountId)
  const [errors, setErrors] = useState<FieldErrors>(editor.errors)
  const account = {
    accounts: editor.accounts,
    failed: false,
    pick: pickAccount(chosen, editor.accounts),
  }
  function submit() {
    const found: FieldErrors = {
      ...formErrors(values),
      ...questionErrors(values.questions),
      account: hasFee(values) && account.pick.id === null ? ACCOUNT_MISSING : undefined,
    }
    setErrors(found)
    if (!Object.values(found).some(Boolean)) onSubmit(values, account.pick.id)
  }
  return { values, setValues, setChosen, errors, account, submit }
}

function Fields({ props, state }: { props: BuilderProps; state: ReturnType<typeof useEditor> }) {
  const editor = props.data.editor!
  const { values, setValues, errors } = state
  const fields = { values, disabled: false, onChange: setValues, errors }
  return (
    <div className="flex flex-col gap-4">
      <FormEventFacts event={props.data.event} onEdit={props.onEditEvent} />
      <FormSection title="모집 설정">
        <BasicFields {...fields} />
        <FeeFields {...fields}>
          {hasFee(values) && (
            <FeeAccountSelect
              account={state.account}
              disabled={false}
              error={errors.account}
              onPick={state.setChosen}
            />
          )}
        </FeeFields>
      </FormSection>
      <FormSection title="받는 항목">
        <CollectFields {...fields} />
        <QuestionEditor
          questions={values.questions}
          locked={editor.locked}
          disabled={false}
          errors={errors}
          onChange={questions => setValues({ ...values, questions })}
        />
      </FormSection>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="submit">{editor.submit}</Button>
      </div>
    </div>
  )
}

export function EditorScreen(props: BuilderProps) {
  const { data } = props
  const editor = data.editor!
  const state = useEditor(editor, props.onSubmit)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start gap-1">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={props.onBack}>
          <ChevronLeft aria-hidden />
          신청 양식 목록
        </Button>
        <h2 className="text-lg font-semibold text-fg">{editor.title}</h2>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-5">
        <form
          noValidate
          aria-label={editor.title}
          className="lg:col-span-3"
          onSubmit={event => {
            event.preventDefault()
            state.submit()
          }}
        >
          <Fields props={props} state={state} />
        </form>
        <section
          aria-label="미리보기"
          className="flex flex-col gap-2 lg:sticky lg:top-4 lg:col-span-2"
        >
          <h3 className="text-sm font-semibold text-fg">미리보기</h3>
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm lg:h-180 lg:overflow-y-auto">
            <ApplyPreview values={state.values} event={data.event} councilName={data.councilName} />
          </div>
        </section>
      </div>
    </div>
  )
}
