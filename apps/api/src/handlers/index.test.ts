import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { allOperationIds } from '../routes.ts'
import { BY_AREA, HANDLERS } from './index.ts'

// **답을 놓는 자리를 영역별로 갈랐다.**
//
// 한 파일에 다 있는 동안은 흐름을 하나 붙일 때마다 그 파일을 고쳐야 했다 — 가져오는
// 줄까지 한 덩이라, 둘을 나란히 붙이면 같은 자리에서 부딪힌다. 남은 자리가 백예순인데
// 그것을 한 줄로만 갈 수는 없어서 갈랐다.
//
// 가르면 새로 생기는 위험이 둘이다. 이 파일이 그 둘을 잰다.
//
// 1. **같은 이름을 두 영역이 답하면 나중 것이 앞엣것을 덮는다.** 펼치기(`...`)는
//    조용하다 — 덮인 자리는 그냥 다른 답을 낸다.
// 2. **영역이 서로를 가져오면 가른 뜻이 없다.** 한쪽을 고칠 때 다른 쪽이 함께 움직인다.

const HERE = fileURLToPath(new URL('./', import.meta.url))

describe('영역이 서로를 덮지 않는다', () => {
  it('잴 것이 있다 — 영역이 여럿이고 자리가 여럿이다', () => {
    expect(Object.keys(BY_AREA).length).toBeGreaterThan(1)
    expect(Object.keys(HANDLERS).length).toBeGreaterThan(20)
  })

  it('같은 자리를 두 영역이 답하지 않는다', () => {
    const seen = new Map<string, string>()
    const clashes: string[] = []
    for (const [area, handlers] of Object.entries(BY_AREA)) {
      for (const operationId of Object.keys(handlers)) {
        const already = seen.get(operationId)
        if (already !== undefined) clashes.push(`${operationId}: ${already} · ${area}`)
        else seen.set(operationId, area)
      }
    }
    expect(clashes).toEqual([])
  })

  // 덮인 자리는 세어도 하나다 — 그래서 수만 세면 겹침이 안 보인다.
  it('모은 것의 수가 영역들의 합과 같다', () => {
    const total = Object.values(BY_AREA).reduce((sum, one) => sum + Object.keys(one).length, 0)
    expect(Object.keys(HANDLERS)).toHaveLength(total)
  })

  // 오타 하나면 그 자리는 안 열린다. `attach`가 시작할 때 던지지만, 그때는 이미
  // 서버가 안 뜨는 상태다 — 검사가 먼저 잡는다.
  it('답하는 이름이 전부 계약에 있는 자리다', () => {
    const contract = new Set(allOperationIds())
    expect(Object.keys(HANDLERS).filter((name) => !contract.has(name))).toEqual([])
  })
})

describe('영역이 서로를 가져오지 않는다', () => {
  const areaFiles = readdirSync(HERE).filter(
    (name) => name.endsWith('.ts') && name !== 'index.ts' && !name.endsWith('.test.ts'),
  )

  it('잴 것이 있다', () => {
    expect(areaFiles.length).toBeGreaterThan(2)
  })

  // **모으는 자리(index.ts)만 영역을 안다.** 영역끼리 아는 사이가 되면 가른 뜻이
  // 없어지고, 두 사람이 나란히 붙일 때 다시 한 파일에서 부딪힌다.
  it('영역 파일이 다른 영역 파일을 가져오지 않는다', () => {
    const crossed: string[] = []
    for (const name of areaFiles) {
      const source = readFileSync(HERE + name, 'utf8')
      for (const other of areaFiles) {
        if (other === name) continue
        const stem = other.replace(/\.ts$/, '')
        if (new RegExp(String.raw`from '\./` + stem + String.raw`\.ts'`).test(source)) {
          crossed.push(`${name} → ${other}`)
        }
      }
    }
    expect(crossed).toEqual([])
  })
})
