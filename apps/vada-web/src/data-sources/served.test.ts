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
const optionSources = (optionsJson as { sources: Array<{ key: string; type: string }> }).sources
const mutations = (mutationsJson as { mutations: Array<{ key: string }> }).mutations

// **명세가 값을 들고 있는 목록은 분모가 아니다.**
//
// 선택지 쉰하나 중 스물넷은 `static`이라 값이 계약 안에 박혀 있고, OpenAPI에 자리조차
// 생기지 않는다(학년·학생회 유형·운영 연도·조직 구조 방식). 서버로 갈 일이 없는 것을
// '아직 안 붙었다'로 세면 **눈금이 거짓말을 한다** — 한동안 172를 196으로 세고 있었고,
// 그래서 진도가 실제보다 나빠 보였다.
const staticOptions = optionSources.filter((source) => source.type === 'static')
const remoteOptions = optionSources.filter((source) => source.type !== 'static')
const all = dataSources.length + remoteOptions.length

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

  // **분모를 붙잡아 둔다.** `static`을 분모에 넣으면 영영 못 채우는 수가 되고,
  // 그 수를 보고 진도를 판단하면 판단이 틀린다.
  it('명세가 값을 들고 있는 목록은 분모에 없다', () => {
    for (const source of staticOptions) {
      expect(isServed(source.key)).toBe(false)
    }
    expect(all).toBe(dataSources.length + remoteOptions.length)
    expect(all + staticOptions.length).toBe(dataSources.length + optionSources.length)
  })

  // 이 수를 소리 내어 적는다. 진도가 안 나가면 그것이 눈에 보여야 한다.
  it('세어 둔다 — 몇이 진짜이고 몇이 가짜인가', () => {
    const real = SERVED.length
    const wrote = SERVED_MUTATIONS.length
    // eslint-disable-next-line no-console
    console.log(
      `\n  읽기: 그물을 타는 출처 ${all}개 중 서버에서 오는 것 ${real}개 · 개발용 응답 ${all - real}개\n` +
        `  쓰기: 변이 ${mutations.length}개 중 서버로 가는 것 ${wrote}개 · 안 보내는 것 ${mutations.length - wrote}개\n` +
        `  (선택지 ${staticOptions.length}개는 명세가 값을 들고 있어 서버 자리가 없다 — 분모가 아니다)\n` +
        `  → 흐름을 하나 붙일 때마다 앞의 수가 늘고 뒤의 수가 준다\n`,
    )
    expect(real).toBeLessThanOrEqual(all)
    expect(wrote).toBeLessThanOrEqual(mutations.length)

    // **줄어드는 것을 막는다.** 세기만 하던 동안은 목록에서 한 줄을 빼도 이 검사가
    // 조용했다 — 그러면 눈금이 아니라 기록이다. 붙인 것을 되돌리려면 이 수부터
    // 내려야 하고, 내리는 일은 눈에 띈다(교차검토가 짚었다, 2026-09-05).
    expect(real).toBeGreaterThanOrEqual(131)
    expect(wrote).toBeGreaterThanOrEqual(20)
  })
})
