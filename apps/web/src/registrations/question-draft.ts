import type { FormQuestion, QuestionInput, QuestionKind } from '@vada/contracts'
import type { FieldErrors } from '@/lib/use-form-check'

// 양식 편집 화면의 질문 하나. key는 화면 안에서만 쓰는 이름이다(저장한 질문은 그 번호, 새 질문은 임시 이름).
// 서버는 질문 목록 전체를 받아 바꾸므로 번호를 보내지 않는다.
export type QuestionDraft = {
  key: string
  kind: QuestionKind
  title: string
  required: boolean
  choices: { key: string; label: string }[]
}

let drafted = 0
const nextKey = () => `new-${++drafted}`

export const draftsOf = (questions: FormQuestion[]): QuestionDraft[] =>
  questions.map(question => ({
    key: question.id,
    kind: question.kind,
    title: question.title,
    required: question.required,
    choices: question.choices.map(choice => ({ key: choice.id, label: choice.label })),
  }))

// 새 질문. 고르기는 선택지 둘로 시작한다(구글폼이 '옵션 1'로 시작하는 것과 같은 꼴). 필수는 고를 때 켠다(와이어프레임 EVT-05).
const FIRST_CHOICES = ['선택 1', '선택 2']
export const newChoice = (at: number) => ({ key: nextKey(), label: `선택 ${at}` })
export const newDraft = (kind: QuestionKind): QuestionDraft => ({
  key: nextKey(),
  kind,
  title: '',
  required: false,
  choices: kind === 'short_text' ? [] : FIRST_CHOICES.map(label => ({ key: nextKey(), label })),
})

// 종류를 바꾸면 선택지가 필요한지에 맞춘다. 고르기끼리는 선택지를 그대로 둔다.
export function withKind(draft: QuestionDraft, kind: QuestionKind): QuestionDraft {
  if (kind === 'short_text') return { ...draft, kind, choices: [] }
  if (draft.choices.length) return { ...draft, kind }
  return { ...newDraft(kind), key: draft.key, title: draft.title, required: draft.required }
}

export const questionsRequest = (drafts: QuestionDraft[]): QuestionInput[] =>
  drafts.map(draft => ({
    kind: draft.kind,
    title: draft.title,
    required: draft.required,
    choices: draft.kind === 'short_text' ? [] : draft.choices.map(({ label }) => ({ label })),
  }))

// 미리보기용: 학생 화면과 같은 모양(번호 대신 화면 이름).
export const previewQuestions = (drafts: QuestionDraft[]): FormQuestion[] =>
  drafts.map(draft => ({
    id: draft.key,
    kind: draft.kind,
    title: draft.title.trim() || '새 질문',
    required: draft.required,
    choices: draft.choices.map(choice => ({ id: choice.key, label: choice.label })),
  }))

const choiceErrors = (draft: QuestionDraft, at: number): FieldErrors => {
  const errors: FieldErrors = {}
  const seen = new Set<string>()
  draft.choices.forEach((choice, order) => {
    const label = choice.label.trim()
    const key = `questions.${at}.choices.${order}.label`
    if (label === '') errors[key] = '선택지를 입력해 주세요'
    else if (seen.has(label)) errors[key] = '같은 선택지가 있어요'
    seen.add(label)
  })
  return errors
}

// 저장을 눌렀을 때 질문 칸 아래에 보일 문제. 칸 이름은 계약 경로와 같다(길이 상한은 계약이 마지막에 막는다).
export function questionErrors(drafts: QuestionDraft[]): FieldErrors {
  return Object.assign(
    {},
    ...drafts.map((draft, at) => ({
      [`questions.${at}.title`]: draft.title.trim() === '' ? '질문을 입력해 주세요' : undefined,
      ...(draft.kind === 'short_text' ? {} : choiceErrors(draft, at)),
    })),
  ) as FieldErrors
}
