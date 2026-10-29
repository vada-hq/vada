import { useState } from 'react'
import { momentLabel } from '@/events/event-view'
import { openAccounts, pickAccount } from '@/finance/account-form'
import type { FieldErrors } from '@/lib/use-form-check'
import { questionErrors } from '../../question-draft'
import { collectsStudentId, formErrors, hasFee, type FormValues } from '../../registration-form'
import type { BuilderSample, EditorSample } from '../builder-data'

// 편집기 상태와 구역 줄(행사 정보·모집·참가비·받는 항목)의 요약·상태 계산.

export type SectionId = 'event' | 'recruit' | 'fee' | 'items'
// done = ✓, todo = 빈 원, required = 빈 원 + '필수', error = 빈 원 + '입력 필요', locked = ✓ + '잠김'
export type SectionState = 'done' | 'todo' | 'required' | 'error' | 'locked'

const ACCOUNT_MISSING = '참가비 받을 계좌를 골라 주세요'
const SECTION_KEYS: Record<Exclude<SectionId, 'event'>, (key: string) => boolean> = {
  recruit: key => ['name', 'opensAt', 'closesAt', 'capacity', 'notice'].includes(key),
  fee: key => ['fee', 'payerFee', 'nonPayerFee', 'account'].includes(key),
  items: key => key.startsWith('questions.'),
}

export function errorsOf(values: FormValues, accountId: string | null): FieldErrors {
  const found: FieldErrors = {
    ...formErrors(values),
    ...questionErrors(values.questions),
    account: hasFee(values) && accountId === null ? ACCOUNT_MISSING : undefined,
  }
  return Object.fromEntries(Object.entries(found).filter(([, message]) => message))
}

export const sectionOfError = (key: string): SectionId =>
  (Object.keys(SECTION_KEYS) as (keyof typeof SECTION_KEYS)[]).find(id => SECTION_KEYS[id](key)) ??
  'recruit'

const won = (value: string) => `${Number(value).toLocaleString('ko-KR')}원`
const amount = (value: string, empty: string) => (value.trim() === '' ? empty : won(value))

type Ctx = { values: FormValues; accountId: string | null; editor: EditorSample }

function feeSummary({ values, accountId, editor }: Ctx) {
  if (values.feeKind === 'none') return '없음'
  const money =
    values.feeKind === 'one'
      ? amount(values.fee, '금액 비어 있음')
      : `납부자 ${amount(values.payerFee, '비어 있음')} · 미납자 ${amount(values.nonPayerFee, '비어 있음')}`
  const account = openAccounts(editor.accounts).find(item => item.id === accountId)
  return `${money} · ${account ? account.name : '계좌 비어 있음'}`
}

export function summaryOf(id: SectionId, ctx: Ctx, data: BuilderSample) {
  const { values } = ctx
  if (id === 'event') return `${data.eventText.when.split(' ~ ')[0]} · ${data.eventText.place}`
  if (id === 'fee') return feeSummary(ctx)
  if (id === 'recruit') {
    const parts = [
      values.name.trim() || '이름 비어 있음',
      values.closesAt ? `${momentLabel(values.closesAt)}까지` : '마감 비어 있음',
      values.capacity.trim() ? `정원 ${values.capacity.trim()}명` : null,
    ]
    return parts.filter(Boolean).join(' · ')
  }
  const basics = ['이름', collectsStudentId(values) && '학번', values.collectsPhone && '휴대폰']
  const questions = values.questions.length ? `질문 ${values.questions.length}개` : null
  return [...basics, questions].filter(Boolean).join(' · ')
}

// 필수가 비었는가(누르기 전에도 보이는 '필수' 알약).
function missingRequired(id: SectionId, { values, accountId }: Ctx) {
  if (id === 'recruit') return values.name.trim() === '' || values.closesAt === ''
  if (id !== 'fee' || values.feeKind === 'none') return false
  const empty =
    values.feeKind === 'one'
      ? values.fee.trim() === ''
      : values.payerFee.trim() === '' || values.nonPayerFee.trim() === ''
  return empty || (hasFee(values) && accountId === null)
}

export function stateOf(
  id: SectionId,
  ctx: Ctx,
  errors: FieldErrors,
  data: BuilderSample,
): SectionState {
  if (id === 'event') return data.event.startsAt ? 'done' : 'required'
  if (Object.keys(errors).some(key => sectionOfError(key) === id)) return 'error'
  if (id === 'items') {
    if (ctx.editor.locked) return 'locked'
    return Object.values(questionErrors(ctx.values.questions)).some(Boolean) ? 'todo' : 'done'
  }
  return missingRequired(id, ctx) ? 'required' : 'done'
}

export const SECTIONS: SectionId[] = ['event', 'recruit', 'fee', 'items']

// 처음 펼칠 구역: 오류 → 빈 필수 → 받는 항목(가장 자주 고치는 곳).
function firstOpen(ctx: Ctx, errors: FieldErrors, data: BuilderSample): SectionId {
  const firstError = Object.keys(errors)[0]
  if (firstError) return sectionOfError(firstError)
  return (
    SECTIONS.find(id => id !== 'event' && stateOf(id, ctx, errors, data) === 'required') ?? 'items'
  )
}

export function useEditor(data: BuilderSample) {
  const editor = data.editor!
  const [values, setValues] = useState(editor.values)
  const [chosen, setChosen] = useState(editor.chosenAccountId)
  const [submitted, setSubmitted] = useState(Object.keys(editor.errors).length > 0)
  const accountId = pickAccount(chosen, editor.accounts).id
  const ctx: Ctx = { values, accountId, editor }
  // 한 번 누른 뒤에는 칸을 고칠 때마다 다시 확인한다(고친 칸의 오류가 바로 사라진다).
  const errors = submitted ? errorsOf(values, accountId) : {}
  const [open, setOpen] = useState<SectionId | null>(() => firstOpen(ctx, errors, data))
  return {
    editor,
    values,
    setValues,
    accountId,
    setChosen,
    ctx,
    errors,
    setSubmitted,
    open,
    setOpen,
  }
}
export type EditorState = ReturnType<typeof useEditor>
