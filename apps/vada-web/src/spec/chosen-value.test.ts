import { describe, expect, it } from 'vitest'
import { ALL_SCREENS, exampleParamsOf } from './screens'
import { dataSourceCallsOf } from './screen-sources'
import { findDataSource, readDataSource } from '../data-sources/catalog'
import { getOptionSource } from '../option-sources/catalog'
import type { SelectSpec, ScreenSpec } from './types'
import type { DataRow } from '../data-sources/catalog'

// **고른 값이 선택지에 있는가.**
//
// 데이터가 select의 값으로 시작하는 자리가 있다 — 검토 화면의 판정, 회의 만들기의
// 진행 방식, 예산 항목의 담당 부서. 그 값이 선택지에 없으면 화면은 **아무것도 안
// 고른 채로** 그려진다. 터지지도 않고 붉지도 않다. 그냥 빈 칸이다.
//
// 실제로 났다(2026-09-04): `finance.reviewItems.result`가 선택지에 없는 값을 들고
// 있었고 검토 화면의 판정 칸이 통째로 비어 있었다. 준수 검사도 그림 대조도 못 봤다 —
// **빈 칸은 아무 규칙도 어기지 않기 때문이다.**
//
// 그래서 여기서 잰다: 화면이 읽는 값과 그 화면이 그리는 선택지를 맞대 본다.
//
// **선택지가 명세에 박힌 자리만 여기서 본다.** 서버에서 오는 목록은 그 목록 자체가
// 저장소의 진도에 달렸고(부서·예산 항목·검토자), 개발용 응답끼리 맞대는 것은
// '두 가짜가 서로 맞는가'를 재는 일이라 뜻이 얇다. 그 자리는 카나리가 진짜 서버로
// 걷는다. 몇 자리가 그렇게 빠지는지는 아래에서 소리 내어 센다.

interface Seat {
  screenId: string
  sourceKey: string
  fieldKey: string
  optionsKey: string
}

/** 이 화면에서 select가 읽는 자리들. 값이 데이터에서 오는 것만 든다. */
function seatsOf(spec: ScreenSpec): Seat[] {
  const selects: SelectSpec[] = []
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    if (node === null || typeof node !== 'object') return
    const holder = node as { type?: unknown }
    if (holder.type === 'select') selects.push(node as SelectSpec)
    for (const value of Object.values(node)) walk(value)
  }
  walk(spec.elements)

  const keys = new Set(dataSourceCallsOf(spec, { screenParams: exampleParamsOf(spec.screenId) }).map((call) => call.key))
  const seats: Seat[] = []
  for (const select of selects) {
    const optionsKey = select.optionsSource?.key
    if (optionsKey === undefined) continue
    for (const sourceKey of keys) {
      if (!fieldNamesOf(sourceKey).has(select.fieldKey)) continue
      seats.push({ screenId: spec.screenId, sourceKey, fieldKey: select.fieldKey, optionsKey })
    }
  }
  return seats
}

/** 이 출처가 든 조각 이름 전부. 묶음 안의 것도 이름으로는 같은 자리다. */
function fieldNamesOf(sourceKey: string): Set<string> {
  const names = new Set<string>()
  const walk = (fields: unknown) => {
    if (!Array.isArray(fields)) return
    for (const field of fields as Array<{ key?: unknown; fields?: unknown }>) {
      if (typeof field.key === 'string') names.add(field.key)
      walk(field.fields)
    }
  }
  walk(findDataSource(sourceKey).fields)
  return names
}

/** 이 조각이 든 값들. 줄이든 한 건이든 이름으로 찾는다. */
function valuesAt(row: unknown, fieldKey: string, into: string[]): void {
  if (Array.isArray(row)) {
    for (const one of row) valuesAt(one, fieldKey, into)
    return
  }
  if (row === null || typeof row !== 'object') return
  for (const [name, value] of Object.entries(row as DataRow)) {
    if (name === fieldKey && (typeof value === 'string' || typeof value === 'number')) {
      const said = String(value)
      if (said !== '') into.push(said)
      continue
    }
    valuesAt(value, fieldKey, into)
  }
}

const SEATS = ALL_SCREENS.flatMap(seatsOf)

describe('고른 값이 선택지에 있다', () => {
  // 잴 것이 없으면 늘 통과한다. 몇 자리를 보는지 먼저 센다.
  it('잴 자리가 있다', () => {
    expect(SEATS.length).toBeGreaterThanOrEqual(15)
    // 명세가 든 선택지라야 여기서 견줄 수 있다. 그 수가 줄면 이 눈금이 얇아진다.
    const settled = SEATS.filter((seat) => getOptionSource(seat.optionsKey).type === 'static')
    expect(settled.length).toBeGreaterThanOrEqual(10)
  })

  /**
   * 값을 못 읽은 자리. **조용히 넘기지 않는다.**
   *
   * 못 읽으면 이 눈금은 그 자리에서 늘 통과한다 — 빈 것에 대고 재면 늘 통과하는
   * 그 모양이다. 몇 자리가 그런지 세어 두고 늘지 않게 한다.
   */
  const unread: string[] = []

  it('명세가 든 선택지에는 없는 값이 오지 않는다', () => {
    const wrong: string[] = []
    for (const seat of SEATS) {
      const source = getOptionSource(seat.optionsKey)
      if (source.type !== 'static') continue
      const allowed = new Set(source.options.map((option) => option.value))
      const found: string[] = []
      try {
        valuesAt(readDataSource(seat.sourceKey, exampleParamsOf(seat.screenId)), seat.fieldKey, found)
      } catch (thrown) {
        unread.push(`${seat.screenId}의 ${seat.sourceKey}: ${String(thrown).slice(0, 70)}`)
        continue
      }
      for (const said of found) {
        if (!allowed.has(said)) {
          wrong.push(
            `${seat.screenId}의 ${seat.sourceKey}.${seat.fieldKey}가 '${said}' — ` +
              `${seat.optionsKey}에 없습니다(${[...allowed].join('·')})`,
          )
        }
      }
    }
    expect(wrong, wrong.join('\n')).toEqual([])
  })

  // **빈 것에 대고 재면 늘 통과한다.** 못 읽은 자리가 늘면 이 눈금이 조용히 얇아진다.
  it('값을 못 읽은 자리가 조용히 늘지 않는다', () => {
    expect(unread, unread.join('\n')).toEqual([])
  })

  // **서버에서 오는 목록은 여기서 못 잰다.** 숨기지 않고 몇 자리인지 센다.
  it('서버가 목록을 주는 자리가 몇인지 센다', () => {
    const remote = SEATS.filter((seat) => getOptionSource(seat.optionsKey).type !== 'static')
    console.log(`\n  선택지가 서버에서 오는 자리 ${remote.length}개 — 카나리가 걷는다\n`)
    expect(remote.length).toBeLessThanOrEqual(SEATS.length)
  })
})
