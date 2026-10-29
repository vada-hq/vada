import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, Eye } from 'lucide-react'
import { pickAccount } from '@/finance/account-form'
import type { FieldErrors } from '@/lib/use-form-check'
import { questionErrors } from '../../question-draft'
import { formErrors, hasFee, type FormValues } from '../../registration-form'
import type { EditorSample } from '../builder-data'
import type { BuilderProps } from '../builder-props'
import { CollectSection } from './items'
import { MainButton, PageIcon, TextAction } from './parts'
import { PhonePreview, PreviewSheet } from './preview'
import { SettingRows } from './settings'
import { radius, size, type } from './tokens'

// 편집기 = 흰 화면 한 장의 문서(쟁반 없이 탭 내용 폭 전체를 흰 종이로, 390은 가장자리까지). 맨 위 큰 양식 이름 → 속성 줄 → 선 하나 → 학생 화면 모양 받는 항목.
// [만들기]/[저장]은 위 고정 머리줄 오른쪽 하나(문서가 길어져도 늘 손에 닿음). 1280은 오른쪽에 학생 화면(확정안)을 늘 둔다.
// 미리보기는 편집기 form 바깥에 둔다(확정안 신청 화면이 제 form을 가진다). 머리줄 버튼은 form 속성으로 이 form을 보낸다.

const FORM_ID = 'v2-editor-form'
const ACCOUNT_MISSING = '참가비 받을 계좌를 골라 주세요'

function useEditor(editor: EditorSample, onSubmit: BuilderProps['onSubmit']) {
  const [values, setValues] = useState(editor.values)
  const [chosen, setChosen] = useState(editor.chosenAccountId)
  const [errors, setErrors] = useState<FieldErrors>(editor.errors)
  const [tries, setTries] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  const pick = pickAccount(chosen, editor.accounts).id
  useEffect(() => {
    if (tries) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [tries])
  const change = (patch: Partial<FormValues>, key?: string) => {
    setValues(current => ({ ...current, ...patch }))
    if (key) setErrors(current => ({ ...current, [key]: undefined }))
  }
  const choose = (id: string | null) => {
    setChosen(id)
    setErrors(current => ({ ...current, account: undefined }))
  }
  function submit() {
    const found: FieldErrors = {
      ...formErrors(values),
      ...questionErrors(values.questions),
      account: hasFee(values) && pick === null ? ACCOUNT_MISSING : undefined,
    }
    setErrors(found)
    setTries(count => count + 1)
    if (!Object.values(found).some(Boolean)) onSubmit(values, pick)
  }
  return { formRef, values, errors, pick, change, choose, submit }
}

type State = ReturnType<typeof useEditor>

function Header({ props, onPreview }: { props: BuilderProps; onPreview: () => void }) {
  const editor = props.data.editor!
  return (
    <header className="sticky top-0 z-20 -mx-4 flex items-center gap-1 border-b border-border-subtle bg-white px-2 py-2 sm:-mx-8 sm:rounded-t-[20px] sm:px-4">
      <TextAction icon={ChevronLeft} label="신청 양식 목록" onClick={props.onBack}>
        <span className="max-sm:sr-only">신청 양식 목록</span>
      </TextAction>
      <span aria-hidden="true" className="text-fg-faint max-sm:hidden">
        /
      </span>
      <h2 className={`mr-auto truncate px-1 ${type.body} font-semibold text-fg`}>{editor.title}</h2>
      <button
        type="button"
        onClick={onPreview}
        className={`inline-flex ${size.hit} shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-surface-muted px-3 ${type.body} font-medium text-fg-secondary hover:bg-muted-strong lg:hidden pointer-coarse:px-4`}
      >
        <Eye aria-hidden className="size-4" />
        미리보기
      </button>
      <MainButton submit form={FORM_ID} measure="submit">
        {editor.submit}
      </MainButton>
    </header>
  )
}

function TitleBlock({ state }: { state: Omit<State, 'formRef'> }) {
  const error = state.errors.name
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-4">
        <PageIcon large />
        <div className="flex min-w-0 flex-1 flex-col">
          <label htmlFor="v2-name" className={`${type.small} text-fg-muted`}>
            양식 이름
            <span aria-hidden="true" className="ml-0.5 text-danger-emphasis">
              *
            </span>
          </label>
          <input
            id="v2-name"
            value={state.values.name}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'v2-name-error' : undefined}
            onChange={event => state.change({ name: event.target.value }, 'name')}
            className={`-ml-2 w-full min-w-0 rounded-lg bg-transparent px-2 pointer-coarse:min-h-11 ${type.docTitle} text-fg outline-none hover:bg-surface-muted focus:bg-surface-muted focus:ring-2 focus:ring-primary-emphasis aria-invalid:ring-2 aria-invalid:ring-danger-emphasis`}
          />
        </div>
      </div>
      {error && (
        <p id="v2-name-error" className={`${type.small} font-medium text-danger`}>
          {error}
        </p>
      )}
    </div>
  )
}

export function EditorScreen(props: BuilderProps) {
  const { data } = props
  const editor = data.editor!
  const { formRef, ...state } = useEditor(editor, props.onSubmit)
  const [previewing, setPreviewing] = useState(false)
  const preview = { values: state.values, event: data.event, councilName: data.councilName }
  return (
    <div className={`-mx-4 flex flex-col bg-white px-4 sm:mx-0 sm:px-8 ${radius.page}`}>
      <Header props={props} onPreview={() => setPreviewing(true)} />
      <div className="grid items-start gap-8 pt-6 sm:pt-8 lg:grid-cols-[minmax(0,640px)_300px] lg:justify-between">
        <form
          id={FORM_ID}
          ref={formRef}
          noValidate
          aria-label={editor.title}
          className={`flex w-full ${size.docColumn} flex-col gap-6 pb-16`}
          onSubmit={event => {
            event.preventDefault()
            state.submit()
          }}
        >
          <TitleBlock state={state} />
          <SettingRows
            values={state.values}
            errors={state.errors}
            accounts={editor.accounts}
            chosen={state.pick}
            data={data}
            onChange={state.change}
            onPick={state.choose}
            onEditEvent={props.onEditEvent}
          />
          <div className="pt-4">
            <CollectSection
              values={state.values}
              locked={editor.locked}
              errors={state.errors}
              onChange={state.change}
            />
          </div>
        </form>
        <aside aria-label="미리보기" className="sticky top-20 hidden lg:block">
          <PhonePreview {...preview} />
        </aside>
      </div>
      {previewing && <PreviewSheet {...preview} onClose={() => setPreviewing(false)} />}
    </div>
  )
}
