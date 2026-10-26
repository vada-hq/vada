import { expect, test } from 'vitest'
import { submitLabelOf, tallyOf, tallyText } from './decision-form'

test('고른 것을 승인·반려·미검토로 센다', () => {
  const tally = tallyOf(['approve', 'reject', null, 'approve', null])
  expect(tally).toEqual({ approve: 2, reject: 1, unreviewed: 2 })
  expect(tallyText(tally)).toBe('승인 2 · 반려 1 · 미검토 2')
})

test.each([
  [['approve', null], '최종 처리'],
  [['approve', 'approve'], '승인 완료 처리'],
  [['reject'], '반려 처리'],
  [['approve', 'reject'], '부분 승인 처리'],
] as const)('보내기 버튼 이름은 고른 조합을 따른다 %j', (choices, label) => {
  expect(submitLabelOf(tallyOf(choices))).toBe(label)
})
