import { describe, expect, it } from 'vitest'
import catalogJson from '../../../../specs/figma/vada-wireframe/data-sources.json'
import optionsJson from '../../../../specs/figma/vada-wireframe/option-sources.json'
import { readDataSource } from './catalog'
import { fetchOptions } from '../option-sources/catalog'

// **열쇠를 빠뜨리면 전부가 온다.**
//
// 명세는 인자마다 '부르는 쪽이 늘 넘기는가'를 갖게 됐다. 그런데 그 사실이 문서에만
// 있고 도는 코드가 지키지 않으면, 서버가 붙기 전까지 아무도 그 계약을 시험하지
// 못한다 — 개발용 응답은 인자가 없으면 조용히 안 걸러진 목록을 준다.
//
// 그래서 여기서 못 박는다. 카탈로그가 필수라 한 인자를 빼고 부르면 터져야 한다.

const sources = (catalogJson as { sources: Array<{ key: string; params: Array<{ key: string; required: boolean }> }> }).sources
const optionSources = (optionsJson as { sources: Array<{ key: string; params: Array<{ key: string; required: boolean }> }> }).sources

describe('열쇠 없이는 부를 수 없다', () => {
  it('데이터 출처가 필수 인자를 빼고 불리면 터진다', () => {
    const withKey = sources.filter((source) => source.params.some((param) => param.required))
    expect(withKey.length).toBeGreaterThan(50)

    for (const source of withKey) {
      const missing = source.params.find((param) => param.required)!
      const given: Record<string, string> = {}
      for (const param of source.params) {
        if (param.key !== missing.key) given[param.key] = 'x'
      }
      expect(() => readDataSource(source.key, given)).toThrowError(
        new RegExp(`'${missing.key}'를 반드시 받습니다`),
      )
    }
  })

  it('선택지 출처가 필수 인자를 빼고 불리면 터진다', async () => {
    const withKey = optionSources.filter((source) => source.params.some((param) => param.required))
    expect(withKey.length).toBeGreaterThan(5)

    for (const source of withKey) {
      const missing = source.params.find((param) => param.required)!
      const given: Record<string, string> = {}
      for (const param of source.params) {
        if (param.key !== missing.key) given[param.key] = 'x'
      }
      await expect(fetchOptions(source.key, given)).rejects.toThrowError(
        new RegExp(`'${missing.key}'를 반드시 받습니다`),
      )
    }
  })

  // 없어도 되는 인자까지 막으면 거르개를 쓸 수 없다.
  it('없어도 되는 인자는 빼고 불러도 된다', () => {
    const filtered = sources.find((source) => source.key === 'meeting.participants')!
    expect(filtered.params.find((param) => param.key === 'query')?.required).toBe(false)
    expect(() => readDataSource('meeting.participants', { meetingId: 'M-01' })).not.toThrow()
  })
})
