import type { FormQuestion } from '@vada/contracts'

// 질문 셋(짧은 답, 하나 고르기, 여럿 고르기). 번호는 계약 검사를 통과하는 UUID다.
export const sampleQuestions: FormQuestion[] = [
  {
    id: '00000000-0000-4000-8000-000000000601',
    kind: 'short_text',
    title: '이니셜',
    required: true,
    choices: [],
  },
  {
    id: '00000000-0000-4000-8000-000000000602',
    kind: 'single_choice',
    title: '티셔츠 사이즈',
    required: true,
    choices: [
      { id: '00000000-0000-4000-8000-000000000611', label: 'S' },
      { id: '00000000-0000-4000-8000-000000000612', label: 'M' },
      { id: '00000000-0000-4000-8000-000000000613', label: 'L' },
    ],
  },
  {
    id: '00000000-0000-4000-8000-000000000603',
    kind: 'multiple_choice',
    title: '참가 종목',
    required: false,
    choices: [
      { id: '00000000-0000-4000-8000-000000000621', label: '축구' },
      { id: '00000000-0000-4000-8000-000000000622', label: '농구' },
    ],
  },
]

export const sampleAnswers = [
  { questionId: sampleQuestions[0]!.id, title: '이니셜', values: ['KHS'] },
  { questionId: sampleQuestions[1]!.id, title: '티셔츠 사이즈', values: ['M'] },
  { questionId: sampleQuestions[2]!.id, title: '참가 종목', values: ['축구', '농구'] },
]
