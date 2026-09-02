import { describe, expect, it } from 'vitest'
import catalogJson from '../../../../specs/figma/vada-wireframe/data-sources.json'
import optionsJson from '../../../../specs/figma/vada-wireframe/option-sources.json'
import mutationsJson from '../../../../specs/figma/vada-wireframe/mutations.json'
import {
  SERVED,
  SERVED_MUTATIONS,
  isServed,
  isServedMutation,
  unknownServedKeys,
  unknownServedMutations,
} from './served'

// **가짜에서 진짜로 옮겨 가는 진도를 여기서 센다.**
//
// 화면 여든넷이 다 그려지지만 그 값은 대부분 개발용 응답 4,400줄에서 온다.
// 흐름 하나를 서버에 붙일 때마다 그 출처가 `SERVED`로 옮겨 오고 가짜 줄이 지워진다.
// 그 수가 늘지 않으면 아무리 자리를 만들어도 **사람이 보는 것은 그대로 가짜다.**

const dataSources = (catalogJson as { sources: Array<{ key: string }> }).sources
const optionSources = (optionsJson as { sources: Array<{ key: string }> }).sources
const all = dataSources.length + optionSources.length
const mutations = (mutationsJson as { mutations: Array<{ key: string }> }).mutations

describe('무엇이 진짜에서 오는가', () => {
  // 오타 하나면 그 출처는 영영 가짜로 남는데, **가짜로 남는 것은 조용하다** —
  // 화면이 그대로 그려지므로 아무도 모른다.
  it('목록에 적힌 이름이 전부 실제 출처다', () => {
    expect(unknownServedKeys()).toEqual([])
  })

  it('목록에 없는 것은 진짜가 아니다', () => {
    expect(isServed('있을 리 없는 출처')).toBe(false)
  })

  // **쓰기도 센다.** 오랫동안 읽기만 세고 있었고, 그동안 쓰기는 통째로 가짜였다 —
  // '조직 만들기'를 누르면 학생회가 안 생기는데 다음 화면으로 넘어갔다. 세는 자리가
  // 없으면 없는 것도 없어 보인다.
  it('쓰기 목록에 적힌 이름이 전부 실제 변이다', () => {
    expect(unknownServedMutations()).toEqual([])
  })

  it('쓰기 목록에 없는 것은 진짜가 아니다', () => {
    expect(isServedMutation('있을 리 없는 변이')).toBe(false)
  })

  // 이 수를 소리 내어 적는다. 진도가 안 나가면 그것이 눈에 보여야 한다.
  it('세어 둔다 — 몇이 진짜이고 몇이 가짜인가', () => {
    const real = SERVED.length
    const wrote = SERVED_MUTATIONS.length
    // eslint-disable-next-line no-console
    console.log(
      `\n  읽기: 출처 ${all}개 중 서버에서 오는 것 ${real}개 · 개발용 응답 ${all - real}개\n` +
        `  쓰기: 변이 ${mutations.length}개 중 서버로 가는 것 ${wrote}개 · 안 보내는 것 ${mutations.length - wrote}개\n` +
        `  → 흐름을 하나 붙일 때마다 앞의 수가 늘고 뒤의 수가 준다\n`,
    )
    expect(real).toBeLessThanOrEqual(all)
    expect(wrote).toBeLessThanOrEqual(mutations.length)
  })
})
