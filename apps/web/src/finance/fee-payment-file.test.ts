import { expect, test } from 'vitest'
import { studentsFromFile } from './fee-payment-file'

test('CSV의 학번 열만 읽고 이름·다른 열을 버린다. BOM·따옴표·줄바꿈·앞자리 0을 보존한다', () => {
  expect(
    studentsFromFile('\ufeff이름,학번,메모\r\n"김,학생",00123456,"여러\n줄"\r\n이학생,20260002,'),
  ).toBe('00123456\n20260002')
  expect(studentsFromFile('이름\t학번\n김학생\t20260001\n')).toBe('20260001')
})
test.each([
  '이름,번호\n김학생,20260001',
  '학번,학번\n20260001,20260002',
  '학번,이름\n,김학생',
  '학번\nabc',
  '학번\n"20260001',
  '학번\n20260001"',
])('틀린 파일은 전체를 거절한다: %s', value => {
  expect(() => studentsFromFile(value)).toThrow()
})
