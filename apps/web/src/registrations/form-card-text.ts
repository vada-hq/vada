import {
  FORM_ACTIVATION_CONDITIONS,
  QUESTION_KIND_LABELS,
  type FormActivationCondition,
  type RegistrationForm,
} from '@vada/contracts'
import { FORM_ACTIVATION_LABELS } from '@/lib/registration-messages'
import type { Tone } from './DocParts'

// 양식 카드의 글과 상태. 서버가 준 양식 값(상태, 신청 수, 부족 조건)만 읽고 다시 계산하지 않는다.

// 초안 = 한 번도 열지 않은 멈춘 양식(상태 이름 '초안'과 같은 규칙, registrationStatusLabel). 시작 전·정원 마감도 링크는 살아 있어 '받는 중' 모양이다.
export function cardTone(form: Pick<RegistrationForm, 'status' | 'applicantCount'>): Tone {
  if (form.status === 'paused') return form.applicantCount === 0 ? 'draft' : 'paused'
  return form.status === 'closed' ? 'closed' : 'open'
}

// 참가비가 0보다 큰 칸이 있으면 계좌가 필요하다(서버 규칙).
export const chargesFee = (form: Pick<RegistrationForm, 'payerFee' | 'nonPayerFee'>) =>
  Math.max(form.payerFee ?? 0, form.nonPayerFee ?? 0) > 0

type CollectedItem = { key: string; label: string; kind: string | null; required: boolean }

// 받는 항목(차례대로): 이름, 학번·휴대폰(받을 때), 질문.
export function collectedItems(form: RegistrationForm): CollectedItem[] {
  return [
    { key: 'name', label: '이름', kind: null, required: true },
    ...(form.collectsStudentId
      ? [{ key: 'studentId', label: '학번', kind: null, required: true }]
      : []),
    ...(form.collectsPhone
      ? [{ key: 'phone', label: '휴대폰 번호', kind: null, required: true }]
      : []),
    ...form.questions.map(question => ({
      key: question.id,
      label: question.title,
      kind: QUESTION_KIND_LABELS[question.kind],
      required: question.required,
    })),
  ]
}

// 받는 항목 한 줄 요약 '이름 · 학번 · 휴대폰 · 질문 3개'.
export function collectedSummary(form: RegistrationForm) {
  const basics = ['이름', form.collectsStudentId && '학번', form.collectsPhone && '휴대폰']
  const questions = form.questions.length > 0 && `질문 ${form.questions.length}개`
  return [...basics, questions].filter(Boolean).join(' · ')
}

export type Check = {
  key: FormActivationCondition
  label: string
  state: 'done' | 'missing' | 'pending'
}

// 링크 활성화 조건(서버 차례). 마감이 비면 그 값에 딸린 '마감이 시작보다 뒤'는 통과가 아니라 보류다(마감을 넣은 뒤 확인).
export function activationChecks(missing: readonly FormActivationCondition[]): Check[] {
  return FORM_ACTIVATION_CONDITIONS.map(key => {
    const absent = missing.includes(key)
    const pending = key === 'registration_period' && !absent && missing.includes('closes_at')
    return {
      key,
      label: FORM_ACTIVATION_LABELS[key],
      state: absent ? 'missing' : pending ? 'pending' : 'done',
    }
  })
}

// 화면에 보이는 공개 링크(주소 앞 http(s)://를 뺀다). 복사는 전체 주소다.
export const shownLink = (url: string) => url.replace(/^https?:\/\//, '')
