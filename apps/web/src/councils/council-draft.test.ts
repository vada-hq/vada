import { expect, test } from 'vitest'
import { CreateCouncilSchema } from '@vada/contracts'
import { createRequestOf, financeSuggestionsOf, initialDraft, suggestionsOf } from './council-draft'

const draftOf = (financeName: string, names: string[]) => ({
  ...initialDraft('김회장'),
  financeName,
  departments: names.map((name, key) => ({ key, name })),
})

test.each<[string, string[], string]>([
  ['재정부', ['기획부', '홍보부'], '부'],
  ['재정부', [' 기획국 ', '홍보국'], '국'],
  ['총무팀', ['기획팀', '홍보부'], '팀'],
  ['재정부', ['기획국'], '부'],
  ['총무팀', ['기획국'], '부'],
  ['사무국', ['기획팀', '홍보부'], '부'],
  ['', ['', '기획실'], '부'],
])('카드 이름 끝말이 가장 많은 것을 쓰고 비기거나 없으면 부: %s / %j', (finance, names, suffix) => {
  const draft = draftOf(finance, names)
  expect(suggestionsOf(draft)).toEqual(['복지', '문화', '체육', '학술'].map(stem => stem + suffix))
  expect(financeSuggestionsOf(draft)).toEqual(['총무', '사무', '재정'].map(stem => stem + suffix))
})

test('추천은 복합 이름과 재정 부서에도 같은 줄기가 있으면 숨기고, 빼면 다시 보인다', () => {
  const draft = draftOf('학술재정팀', [' 인권복지국 ', '문화체육국', '기획국'])
  expect(suggestionsOf(draft)).toEqual([])
  draft.departments = draft.departments.filter(row => row.name !== '문화체육국')
  expect(suggestionsOf(draft)).toEqual(['문화국', '체육국'])
})

test('기본 재정부 이름은 유지하고 모든 끝말의 후보가 서버와 같은 계약을 통과한다', () => {
  expect(initialDraft('김회장').financeName).toBe('재정부')
  for (const suffix of ['부', '국', '팀']) {
    const draft = {
      ...draftOf(`재정${suffix}`, [`기획${suffix}`, `홍보${suffix}`]),
      name: '컴퓨터학부 학생회',
      schoolName: '한양대학교 ERICA',
    }
    for (const financeName of financeSuggestionsOf(draft)) {
      const departments = suggestionsOf(draft).map((name, key) => ({ key, name }))
      expect(
        CreateCouncilSchema.safeParse(createRequestOf({ ...draft, financeName, departments }, true))
          .success,
      ).toBe(true)
    }
  }
})
