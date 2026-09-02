import { describe, expect, it } from 'vitest'
import catalogJson from '../../../../specs/figma/vada-wireframe/data-sources.json'
import optionsJson from '../../../../specs/figma/vada-wireframe/option-sources.json'
import { SERVED, isServed, unknownServedKeys } from './served'

// **가짜에서 진짜로 옮겨 가는 진도를 여기서 센다.**
//
// 화면 여든넷이 다 그려지지만 그 값은 대부분 개발용 응답 4,400줄에서 온다.
// 흐름 하나를 서버에 붙일 때마다 그 출처가 `SERVED`로 옮겨 오고 가짜 줄이 지워진다.
// 그 수가 늘지 않으면 아무리 자리를 만들어도 **사람이 보는 것은 그대로 가짜다.**

const dataSources = (catalogJson as { sources: Array<{ key: string }> }).sources
const optionSources = (optionsJson as { sources: Array<{ key: string }> }).sources
const all = dataSources.length + optionSources.length

describe('무엇이 진짜에서 오는가', () => {
  // 오타 하나면 그 출처는 영영 가짜로 남는데, **가짜로 남는 것은 조용하다** —
  // 화면이 그대로 그려지므로 아무도 모른다.
  it('목록에 적힌 이름이 전부 실제 출처다', () => {
    expect(unknownServedKeys()).toEqual([])
  })

  it('목록에 없는 것은 진짜가 아니다', () => {
    expect(isServed('있을 리 없는 출처')).toBe(false)
  })

  // 이 수를 소리 내어 적는다. 진도가 안 나가면 그것이 눈에 보여야 한다.
  it('세어 둔다 — 몇이 진짜이고 몇이 가짜인가', () => {
    const real = SERVED.length
    // eslint-disable-next-line no-console
    console.log(
      `\n  출처 ${all}개 중 서버에서 오는 것 ${real}개 · 개발용 응답 ${all - real}개\n` +
        `  → 흐름을 하나 붙일 때마다 앞의 수가 늘고 뒤의 수가 준다\n`,
    )
    expect(real).toBeLessThanOrEqual(all)
  })
})
