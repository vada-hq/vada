// ─────────────────────────────────────────────────────────────────────────────
// 공용 파일: 만드는 쪽(v1~v3)은 읽기만 한다. 고치려면 진행 에이전트에게 말한다.
// ─────────────────────────────────────────────────────────────────────────────
// 양식 만들기 화면(신청 양식 영역 둘째 화면) 시안의 공용 견본. 판 문서: notes/integration/events/form-builder-board.md
// 내용: notes/integration/events/form-builder-content.md(목적, 구역 ①~③, 화면 차례).
// 견본 하나 = 서버 모양(event, forms[].form, editor.values: v0가 지금 부품에 그대로 넣는다) + 화면 글(text, 이미 만든 글).
import {
  FORM_ACTIVATION_CONDITIONS,
  QUESTION_KIND_LABELS,
  registrationStatusLabel,
  type AccountItem,
  type EventDetail,
  type FormActivationCondition,
  type FormListAction,
  type RegistrationForm,
} from '@vada/contracts'
import { whenLabel } from '@/events/event-view'
import { FORM_ACTIVATION_LABELS } from '@/lib/registration-messages'
import type { FieldErrors } from '@/lib/use-form-check'
import { feeText } from '@/public/registration-text'
import { emptyFormValues, formErrors, valuesOfForm, type FormValues } from '../registration-form'
import { countLabel, periodLabel } from '../registration-view'
import {
  ACCOUNTS,
  COUNCIL_NAME,
  EVENT,
  FORMS,
  MAIN_ACCOUNT,
  PUBLIC_ORIGIN,
  TODAY,
} from './builder-forms'

export const BUILDER_SCREENS = ['card', 'editor', 'empty'] as const
// card = 인원 관리 탭 위쪽(도구 줄 + 양식 카드), editor = 양식 만들기·고치기, empty = 양식 없음
export type BuilderScreen = (typeof BUILDER_SCREENS)[number]

// 화면마다 쓰는 견본. 첫째가 그 화면의 기본값이다(주소에 모르는 값이 오면).
export const SCREEN_DATA = {
  card: ['active', 'draft', 'ready', 'paused', 'ended', 'multi'],
  editor: ['new', 'filled', 'locked', 'error'],
  empty: ['none'],
} as const satisfies Record<BuilderScreen, readonly string[]>
export type BuilderDataName = (typeof SCREEN_DATA)[BuilderScreen][number]

// 카드 하나에 쓰는 화면 글(지금 구현 꼴로 이미 만든 것, 자르지 않음).
export type CardText = {
  // 상태 칩 '초안' / '잠시 멈춤' / '활성' / '종료'
  status: string
  name: string
  // '신청 18/40명 · 출석 0명'(정원 없으면 '신청 0명 · 출석 0명')
  count: string
  // '11월 3일 (화) 18:00까지'. 마감이 비었으면 '마감 미정'
  period: string
  // 공개 링크(배포 주소). 초안은 null(내용 ①: 초안이면 숨김)
  link: string | null
  // '학생회비 납부자 5,000원 · 미납자 10,000원' / '5,000원' / '무료'
  fee: string
  // '학생회 대표 계좌 (카카오뱅크)', 참가비가 있는데 고르지 않았으면 null, 참가비가 없으면 '계좌 없음'
  account: string | null
  // 정원 '40명' / '제한 없음'
  capacity: string
  // 받는 항목 한 줄 '이름 · 학번 · 휴대폰 · 질문 3개'
  collected: string
  // 받는 항목 펼친 목록(차례대로) { label, kind: '하나 고르기' 등 또는 null, required }
  items: { label: string; kind: string | null; required: boolean }[]
  // 신청이 있어 받는 항목을 바꿀 수 없다(EVT-05B)
  locked: boolean
}

// 링크 활성화 조건 한 줄. 넷 다 늘 있다(FORM_ACTIVATION_CONDITIONS 차례).
export type CardCondition = {
  key: FormActivationCondition
  // '행사 시작 일시' / '신청 마감' / '신청 시작보다 늦은 마감' / '참가비 받을 계좌'
  label: string
  done: boolean
}

export type CardForm = { form: RegistrationForm; text: CardText; conditions: CardCondition[] }

export type EditorSample = {
  mode: 'create' | 'edit'
  // 제목 '신청 양식 만들기' / '신청 양식 고치기', 버튼 '만들기' / '저장'
  title: string
  submit: string
  // 처음 칸 값(지금 구현의 FormValues 그대로)
  values: FormValues
  // 고를 수 있는 계좌와 처음 고른 계좌 id. undefined면 대표 계좌(pickAccount)
  accounts: AccountItem[]
  chosenAccountId: string | null | undefined
  // 고치는 양식의 신청 수. 0보다 크면 받는 항목이 잠긴다(locked)
  applicantCount: number
  locked: boolean
  // 처음부터 칸 아래에 보일 문제(누른 뒤 모습). 칸 이름 → 글: name, closesAt, capacity, fee, payerFee, nonPayerFee, account, questions.<n>.title …
  errors: FieldErrors
}

export type BuilderSample = {
  name: BuilderDataName
  today: string
  councilName: string
  // 행사(서버 모양 그대로)와 그 글
  event: EventDetail
  eventText: { name: string; when: string; place: string }
  // [참여 설문 만들기]를 보일지(목록 동작 form.create)
  listActions: FormListAction[]
  // card 화면의 양식(첫째가 기본으로 보이는 양식). editor·empty는 []
  forms: CardForm[]
  // editor 화면의 편집기. card·empty는 null
  editor: EditorSample | null
}

const NO_DEADLINE = '마감 미정'

function accountText(form: RegistrationForm) {
  if (Math.max(form.payerFee ?? 0, form.nonPayerFee ?? 0) === 0) return '계좌 없음'
  const picked = ACCOUNTS.find(item => item.id === form.feeAccount?.id)
  return picked ? `${picked.name} (${picked.bank})` : null
}

function itemsOf(form: RegistrationForm): CardText['items'] {
  return [
    { label: '이름', kind: null, required: true },
    ...(form.collectsStudentId ? [{ label: '학번', kind: null, required: true }] : []),
    ...(form.collectsPhone ? [{ label: '휴대폰 번호', kind: null, required: true }] : []),
    ...form.questions.map(question => ({
      label: question.title,
      kind: QUESTION_KIND_LABELS[question.kind],
      required: question.required,
    })),
  ]
}

function collectedText(form: RegistrationForm) {
  const basics = ['이름', form.collectsStudentId && '학번', form.collectsPhone && '휴대폰']
  const questions = form.questions.length ? `질문 ${form.questions.length}개` : null
  return [...basics, questions].filter(Boolean).join(' · ')
}

function cardOf(form: RegistrationForm): CardForm {
  const draft = form.paused && form.applicantCount === 0
  return {
    form,
    text: {
      status: registrationStatusLabel(form.status, form.applicantCount),
      name: form.name,
      count: countLabel(form),
      period: form.closesAt === '' ? NO_DEADLINE : periodLabel(form),
      link: draft ? null : `${PUBLIC_ORIGIN}/apply/${form.publicCode}`,
      fee: feeText(form),
      account: accountText(form),
      capacity: form.capacity === null ? '제한 없음' : `${form.capacity}명`,
      collected: collectedText(form),
      items: itemsOf(form),
      locked: form.applicantCount > 0,
    },
    conditions: FORM_ACTIVATION_CONDITIONS.map(key => ({
      key,
      label: FORM_ACTIVATION_LABELS[key],
      done: !form.missingConditions.includes(key),
    })),
  }
}

type Parts = Pick<BuilderSample, 'name'> & Partial<BuilderSample>

const sample = ({ name, ...rest }: Parts): BuilderSample => ({
  name,
  today: TODAY,
  councilName: COUNCIL_NAME,
  event: EVENT,
  eventText: { name: EVENT.name, when: whenLabel(EVENT), place: EVENT.place ?? '' },
  listActions: ['form.create'],
  forms: [],
  editor: null,
  ...rest,
})

const CREATE = { mode: 'create', title: '신청 양식 만들기', submit: '만들기' } as const
const EDIT = { mode: 'edit', title: '신청 양식 고치기', submit: '저장' } as const

const editor = (over: Partial<EditorSample> & Pick<EditorSample, 'values'>): EditorSample => ({
  ...CREATE,
  accounts: ACCOUNTS,
  chosenAccountId: undefined,
  applicantCount: 0,
  locked: false,
  errors: {},
  ...over,
})

// filled: 앞 회차 main 견본과 같은 양식을 새로 만드는 중(다 채우고 [만들기] 직전)
const filledValues = valuesOfForm(FORMS.active)
// error: 새 양식에서 참가비 있음을 고르고 마감·금액을 비운 채 [만들기]를 누른 뒤
const errorValues: FormValues = { ...emptyFormValues, feeKind: 'one' }

export const BUILDER_DATA: Record<BuilderDataName, BuilderSample> = {
  active: sample({ name: 'active', forms: [cardOf(FORMS.active)] }),
  draft: sample({ name: 'draft', forms: [cardOf(FORMS.draft)] }),
  ready: sample({ name: 'ready', forms: [cardOf(FORMS.ready)] }),
  paused: sample({ name: 'paused', forms: [cardOf(FORMS.paused)] }),
  ended: sample({ name: 'ended', forms: [cardOf(FORMS.ended)] }),
  multi: sample({ name: 'multi', forms: [cardOf(FORMS.first), cardOf(FORMS.second)] }),
  new: sample({ name: 'new', editor: editor({ values: emptyFormValues }) }),
  filled: sample({
    name: 'filled',
    editor: editor({ values: filledValues, chosenAccountId: MAIN_ACCOUNT.id }),
  }),
  locked: sample({
    name: 'locked',
    editor: editor({
      ...EDIT,
      values: filledValues,
      chosenAccountId: MAIN_ACCOUNT.id,
      applicantCount: FORMS.active.applicantCount,
      locked: true,
    }),
  }),
  error: sample({
    name: 'error',
    editor: editor({ values: errorValues, errors: formErrors(errorValues) }),
  }),
  none: sample({ name: 'none' }),
}
