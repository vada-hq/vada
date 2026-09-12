import { expect, it, vi } from 'vitest'

// 출처 이름을 검증할 때 서버 연결이나 개발용 응답을 초기화할 필요가 없다.
vi.mock('./server', () => {
  throw new Error('출처 정의 조회가 서버 코드에 의존합니다.')
})
vi.mock('./fixtures', () => {
  throw new Error('출처 정의 조회가 데이터 대역에 의존합니다.')
})
vi.mock('../option-sources/fixtures', () => {
  throw new Error('출처 정의 조회가 선택지 대역에 의존합니다.')
})

it('서버와 개발용 응답을 불러오지 않고 데이터·선택지 출처를 검증한다', async () => {
  const { SERVED, unknownServedKeys } = await import('./served')

  expect(SERVED.length).toBeGreaterThan(0)
  expect(unknownServedKeys()).toEqual([])
})
