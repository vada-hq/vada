import { expect, it, vi } from 'vitest'

// 서버는 요청 정의를 읽되, 서버 응답을 소비하는 상위 조회 모듈을 불러오지 않는다.
vi.mock('./catalog', () => {
  throw new Error('서버 코드가 데이터 조회 모듈을 역참조합니다.')
})
vi.mock('../option-sources/catalog', () => {
  throw new Error('서버 코드가 선택지 조회 모듈을 역참조합니다.')
})

it('데이터·선택지 조회 모듈을 불러오지 않고 서버 요청 주소를 만든다', async () => {
  const { urlOf } = await import('./server')

  expect(urlOf('/api/events/{eventId}', { eventId: 'E-01', scope: 'mine' })).toBe(
    '/api/events/E-01?scope=mine',
  )
})
