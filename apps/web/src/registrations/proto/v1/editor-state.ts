import { useEffect, useState } from 'react'
import { pickAccount } from '@/finance/account-form'
import type { FieldErrors } from '@/lib/use-form-check'
import { questionErrors, type QuestionDraft } from '../../question-draft'
import { formErrors, hasFee, type FormValues } from '../../registration-form'
import type { EditorSample } from '../builder-data'
import type { BuilderProps } from '../builder-props'
import { basicMissing, feeMissing } from './editor-sections'

// 편집기 상태: 칸 값, 고른 계좌, 오류, 펼친 카드. 그리고 첫 틀린 칸 옮기기, 미리보기 따라 스크롤.

const PREVIEW_TOP_GAP = 16
const ACCOUNT_MISSING = '참가비 받을 계좌를 골라 주세요'
const BASIC_KEYS = ['name', 'opensAt', 'closesAt', 'capacity']
const FEE_KEYS = ['fee', 'payerFee', 'nonPayerFee', 'account']

export const questionKey = (draft: QuestionDraft) => `q:${draft.key}`

// 오류가 있는 카드들
function errorCards(errors: FieldErrors, questions: QuestionDraft[]) {
  const has = (key: string) => Boolean(errors[key])
  const cards = new Set<string>()
  if (BASIC_KEYS.some(has)) cards.add('basic')
  if (FEE_KEYS.some(has)) cards.add('fee')
  questions.forEach((draft, at) => {
    if (Object.entries(errors).some(([key, text]) => text && key.startsWith(`questions.${at}.`)))
      cards.add(questionKey(draft))
  })
  return cards
}

// 처음 펼칠 카드: 오류 카드들, 없으면 채울 칸이 남은 첫 카드, 없으면 모집
function firstOpen(editor: EditorSample, accountId: string | null) {
  const errors = errorCards(editor.errors, editor.values.questions)
  if (errors.size) return errors
  if (basicMissing(editor.values) === 0 && feeMissing(editor.values, accountId) > 0)
    return new Set(['fee'])
  return new Set(['basic'])
}

export function useEditor(editor: EditorSample, onSubmit: BuilderProps['onSubmit']) {
  const [values, setValues] = useState(editor.values)
  const [chosen, setChosen] = useState(editor.chosenAccountId)
  const account = pickAccount(chosen, editor.accounts)
  const [errors, setErrors] = useState<FieldErrors>(editor.errors)
  const [open, setOpen] = useState(() => firstOpen(editor, account.id))
  const [tries, setTries] = useState(0)
  const set = (patch: Partial<FormValues>) => setValues(now => ({ ...now, ...patch }))
  const toggle = (key: string) => setOpen(now => (now.has(key) ? new Set() : new Set([key])))
  function submit() {
    const found: FieldErrors = {
      ...formErrors(values),
      ...questionErrors(values.questions),
      account: hasFee(values) && account.id === null ? ACCOUNT_MISSING : undefined,
    }
    setErrors(found)
    const cards = errorCards(found, values.questions)
    if (cards.size === 0) return onSubmit(values, account.id)
    setOpen(cards)
    setTries(n => n + 1)
  }
  return {
    values,
    set,
    chosen: account.id,
    setChosen,
    errors,
    open,
    setOpen,
    toggle,
    submit,
    tries,
  }
}

export type State = ReturnType<typeof useEditor>

// 누른 뒤 첫 틀린 칸으로 옮긴다(GOV.UK)
export function useFocusFirstError(form: React.RefObject<HTMLFormElement | null>, tries: number) {
  useEffect(() => {
    if (tries === 0) return
    const first = form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
    first?.scrollIntoView({ block: 'center' })
    first?.focus({ preventScroll: true })
  }, [form, tries])
}

// 고친 카드에 해당하는 자리로 미리보기를 따라 스크롤한다(refs 2.1). 모집·참가비는 맨 위(행사 머리에 보임).
export function usePreviewFollow(
  box: React.RefObject<HTMLDivElement | null>,
  target: string | null,
) {
  useEffect(() => {
    const screen = box.current
    if (!screen) return
    const found = target
      ? [...screen.querySelectorAll('label, legend, p, span, div')].find(
          el =>
            el.firstChild?.nodeType === Node.TEXT_NODE &&
            el.firstChild.textContent?.trim() === target,
        )
      : null
    const top = found
      ? found.getBoundingClientRect().top -
        screen.getBoundingClientRect().top +
        screen.scrollTop -
        PREVIEW_TOP_GAP
      : 0
    screen.scrollTo({ top, behavior: 'smooth' })
  }, [box, target])
}

export function previewTarget(open: Set<string>, questions: QuestionDraft[]) {
  const key = [...open][0]
  if (key === 'collect') return '이름'
  const draft = questions.find(item => questionKey(item) === key)
  return draft ? draft.title.trim() || '새 질문' : null
}
