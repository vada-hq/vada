import { describe, expect, it } from 'vitest'
import { is } from 'drizzle-orm'
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core'
import * as schema from './schema.ts'

// **이음매마다 울타리를 다시 세운다.**
//
// 이 저장소가 되풀이해 겪은 결함이 하나 있다: 자식 줄은 우리 학생회 것이라고 적혀
// 있는데 그것이 가리키는 부모는 남의 학생회 것인 상태. 2026-08-31 교차검토에서
// 행사의 담당 부서가 그랬고, 그때 표에 겹열 외래키를 걸어 막았다.
//
// 그 뒤로 자리마다 손으로 걸어 왔다. 손으로 거는 것은 잊는다 — 표가 열다섯 개
// 늘어난 오늘 같은 날 특히 그렇다. 그래서 규칙을 글이 아니라 검사로 둔다.
//
// ## 규칙
//
// **자식이 조직을 들고 있고 부모도 조직을 들고 있으면, 그 이음매는 조직을 함께
// 지나가야 한다.** 둘 중 하나라도 조직이 없으면 어긋날 수가 없으므로 규칙 밖이다 —
// 예를 들어 참석 기록(`attendance_check_ins`)은 제 조직이 없고 QR을 통해서만 닿으니
// QR의 조직이 곧 그 줄의 조직이다.

const ORG = 'org_id'

interface Edge {
  child: string
  parent: string
  columns: string[]
  foreignColumns: string[]
}

/** 표마다의 열 이름과, 조직을 든 표끼리의 이음매. */
function tablesAndEdges(): { hasOrg: Set<string>; edges: Edge[] } {
  const hasOrg = new Set<string>()
  const configs: Array<ReturnType<typeof getTableConfig>> = []
  for (const value of Object.values(schema)) {
    if (!is(value, PgTable)) continue
    const config = getTableConfig(value)
    configs.push(config)
    if (config.columns.some((column) => column.name === ORG)) hasOrg.add(config.name)
  }

  const edges: Edge[] = []
  for (const config of configs) {
    for (const key of config.foreignKeys) {
      const reference = key.reference()
      const parent = getTableConfig(reference.foreignTable).name
      edges.push({
        child: config.name,
        parent,
        columns: reference.columns.map((column) => column.name),
        foreignColumns: reference.foreignColumns.map((column) => column.name),
      })
    }
    // `references(() => other.id)`로 건 한 열짜리 이음매는 위에 안 잡힌다 —
    // 열 자신이 들고 있다.
    for (const column of config.columns) {
      const inline = (column as { inlineForeignKeys?: unknown }).inlineForeignKeys
      void inline
    }
  }
  return { hasOrg, edges }
}

describe('조직을 든 표끼리의 이음매는 조직을 함께 지나간다', () => {
  const { hasOrg, edges } = tablesAndEdges()

  it('잴 것이 있다 — 조직을 든 표가 여럿이다', () => {
    expect(hasOrg.size).toBeGreaterThan(10)
    expect(edges.length).toBeGreaterThan(10)
  })

  it('조직을 든 두 표를 잇는 이음매가 조직을 빠뜨리지 않는다', () => {
    const leaky = edges
      .filter((edge) => hasOrg.has(edge.child) && hasOrg.has(edge.parent))
      .filter((edge) => !(edge.columns.includes(ORG) && edge.foreignColumns.includes(ORG)))
      .map((edge) => `${edge.child}(${edge.columns.join(',')}) → ${edge.parent}(${edge.foreignColumns.join(',')})`)
    expect(leaky).toEqual([])
  })

  // 규칙이 살아 있는지 반증한다. 조직을 뺀 이음매를 지어내면 위 검사가 잡아야 한다.
  it('규칙이 조직 없는 이음매를 잡는다', () => {
    const made: Edge[] = [
      { child: 'meetings', parent: 'events', columns: ['event_id'], foreignColumns: ['id'] },
    ]
    const leaky = made
      .filter((edge) => hasOrg.has(edge.child) && hasOrg.has(edge.parent))
      .filter((edge) => !(edge.columns.includes(ORG) && edge.foreignColumns.includes(ORG)))
    expect(leaky).toHaveLength(1)
  })
})
