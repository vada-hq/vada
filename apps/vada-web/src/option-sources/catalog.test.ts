// @vitest-environment node
// DOM을 쓰지 않는 테스트다. jsdom을 띄우지 않으면 워커 기동이 빨라지고,
// 부하가 걸렸을 때 환경 준비가 타임아웃되는 경로 자체가 사라진다.
import { describe, expect, it } from 'vitest'
import { asOptionSourcesCatalog, getOptionSource } from './catalog'

describe('asOptionSourcesCatalog', () => {
  it('loadOn search인데 원격 검색 계약이 없으면 거부한다 (F5)', () => {
    expect(() =>
      asOptionSourcesCatalog({
        schemaVersion: 2,
        sources: [
          {
            key: 'broken.search',
            type: 'remote',
            description: 'x',
            params: [],
            request: { method: 'GET', path: '/x', loadOn: 'search' },
            messages: { idle: 'i', loading: 'l', empty: 'e', error: 'err' },
          },
        ],
      }),
    ).toThrow(/broken\.search/)
  })

  it('sources 배열이 없으면 거부한다 (F5)', () => {
    expect(() => asOptionSourcesCatalog({ schemaVersion: 2 })).toThrow(/sources/)
  })

  it('실제 카탈로그는 통과하고 계약 값을 그대로 노출한다', () => {
    const schools = getOptionSource('education.schools')
    expect(schools.type).toBe('remote')
    if (schools.type === 'remote') {
      expect(schools.request.search).toMatchObject({ mode: 'remote', minLength: 2 })
    }
  })
})
