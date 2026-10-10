import { describe, expect, it } from 'vitest'
import { parseRoster } from './roster-paste'

describe('학생회비 명단 붙여 넣기', () => {
  it('엑셀에서 복사한 두 칸(탭)을 읽고, CRLF·빈 줄·칸 앞뒤 공백·학번의 하이픈을 받아 준다', () => {
    expect(parseRoster('2022000001\t김바다\r\n 2022-000002 \t 박해랑 \r\n\r\n   \r\n')).toEqual({
      members: [{ studentId: '2022000001', name: '김바다' }, { studentId: '2022000002', name: '박해랑' }], merged: 0, problems: [] })
  })

  it('쉼표로 나눈 줄과 이름이 먼저 오는 줄도 받는다', () => {
    expect(parseRoster('Kim Bada,2022000003\n이윤슬\t2023000004').members)
      .toEqual([{ studentId: '2022000003', name: 'Kim Bada' }, { studentId: '2023000004', name: '이윤슬' }])
  })

  it('첫 줄이 "학번"을 담은 제목이면 건너뛰고, 둘째 줄부터의 제목은 학번 형식 문제로 알린다', () => {
    expect(parseRoster('학번\t이름\n2022000001\t김바다')).toEqual({ members: [{ studentId: '2022000001', name: '김바다' }], merged: 0, problems: [] })
    expect(parseRoster('\n이름,학번\n김바다,2022000001').problems).toEqual([])
    expect(parseRoster('2022000001\t김바다\n학번\t이름').problems).toEqual([{ line: 2, reason: 'studentId' }])
  })

  it('두 칸이 아닌 줄, 학번 형식이 아닌 줄, 이름이 틀린 줄을 원래 줄 번호와 함께 알리고 명단에 넣지 않는다', () => {
    const result = parseRoster(['2022000001\t김바다\t컴퓨터학부', '12345\t박해랑', `2022000003\t${'가'.repeat(31)}`, '', '2022000004',
      '2022000005\t2022000006', '2022000007\t김바다'].join('\n'))
    expect(result.problems).toEqual([{ line: 1, reason: 'shape' }, { line: 2, reason: 'studentId' }, { line: 3, reason: 'name' },
      { line: 5, reason: 'shape' }, { line: 6, reason: 'name' }])
    expect(result.members).toEqual([{ studentId: '2022000007', name: '김바다' }])
  })

  it('같은 학번에 같은 이름(공백·대소문자 무시)은 하나로 합치고, 이름이 다르면 뒤 줄을 충돌로 알린다', () => {
    expect(parseRoster('2022000001\tKim Bada\n2022-000001\tKIM  BADA\n2022000001\t김바다\n2022000002\t박해랑')).toEqual({
      members: [{ studentId: '2022000001', name: 'Kim Bada' }, { studentId: '2022000002', name: '박해랑' }], merged: 1,
      problems: [{ line: 3, reason: 'conflict' }] })
  })

  it('빈 글이면 아무것도 없고, 많은 줄도 끝까지 읽는다', () => {
    expect(parseRoster('')).toEqual({ members: [], merged: 0, problems: [] })
    const text = Array.from({ length: 10_001 }, (_, n) => `${2000000000 + n}\t학생`).join('\n')
    expect(parseRoster(text).members).toHaveLength(10_001)
  })
})
