import type { RegistrationForm } from '@vada/contracts'

// 짧은 답, 하나 고르기, 여럿 고르기 셋(기능 025 조각 21)
export const QUESTIONS = [
  { kind: 'short_text', title: '이니셜', required: true, choices: [] },
  {
    kind: 'single_choice',
    title: '티셔츠 사이즈',
    required: true,
    choices: [{ label: 'S' }, { label: 'M' }, { label: 'L' }],
  },
  {
    kind: 'multiple_choice',
    title: '참가 종목',
    required: false,
    choices: [{ label: '축구' }, { label: '농구' }],
  },
]
// 양식의 질문마다 답 하나(짧은 답 글, 하나 고르기 첫 선택지, 여럿 고르기 앞 둘)
export function answersOf(form: { questions: RegistrationForm['questions'] }) {
  return form.questions.map(question =>
    question.kind === 'short_text'
      ? { questionId: question.id, text: 'KHS' }
      : question.kind === 'single_choice'
        ? { questionId: question.id, choiceId: question.choices[0]!.id }
        : { questionId: question.id, choiceIds: question.choices.slice(0, 2).map(c => c.id) },
  )
}
