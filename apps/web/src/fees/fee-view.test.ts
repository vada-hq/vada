import { describe, expect, it } from 'vitest'
import { findMembers, semesterEnd, useUntilRange } from './fee-view'

describe('참가비 설정 화면 도움 함수', () => {
  it('이번 학기 끝날: 3~8월은 8월 31일, 9~12월은 다음 해 2월 말일, 1~2월은 그해 2월 말일이다', () => {
    expect(semesterEnd('2026-03-01')).toBe('2026-08-31')
    expect(semesterEnd('2026-08-31')).toBe('2026-08-31')
    expect(semesterEnd('2026-09-01')).toBe('2027-02-28')
    expect(semesterEnd('2027-12-31')).toBe('2028-02-29')
    expect(semesterEnd('2028-01-15')).toBe('2028-02-29')
    expect(semesterEnd('2026-02-10')).toBe('2026-02-28')
  })

  it('쓰는 기한은 오늘부터 366일 뒤까지다', () => {
    expect(useUntilRange('2026-10-10')).toEqual({ min: '2026-10-10', max: '2027-10-11' })
  })

  it('명단 찾기: 이름 일부나 학번 일부로 찾고, 많이 맞으면 앞에서 정한 수까지만 준다', () => {
    const members = [{ studentId: '2022000001', name: '김바다' }, { studentId: '2022000002', name: '박해랑' }, { studentId: '2023000003', name: '김하늘' }]
    expect(findMembers(members, '')).toEqual({ shown: [], more: false })
    expect(findMembers(members, ' 김 ').shown.map(member => member.name)).toEqual(['김바다', '김하늘'])
    expect(findMembers(members, '2022-0000').shown.map(member => member.name)).toEqual(['김바다', '박해랑'])
    expect(findMembers(members, '없는 사람')).toEqual({ shown: [], more: false })
    expect(findMembers(members, '김', 1)).toEqual({ shown: [members[0]], more: true })
  })
})
