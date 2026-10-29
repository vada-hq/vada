import { C1R_TODAY, type C1rRow } from '../c1r-data'

// 날짜 머리 축: 보이는 줄(차례대로)을 같은 날짜끼리 이어 묶는다. 견본 줄은 이미 날짜 차례라 이웃한 것만 묶으면 된다.
// 머리는 '날짜 + 사실'을 한 번만 말한다. 묶음 안 줄들의 사실이 같을 때만 머리에 싣고, 다르면(기한 없음의 부서 미정·미배정)
// 줄마다 싣는다. 위험 색은 머리의 사실 글(row.fact와 같은 글)에만 쓴다.

export type C1rDate = { month: number; day: number; week: string; rel: 'past' | 'today' | 'future' }

export type C1rGroup = {
  key: string
  date: C1rDate | null
  // 묶음 전체의 사실(줄마다 같을 때만)
  fact: string | null
  danger: boolean
  rows: C1rRow[]
}

// when 꼴: '10월 26일 (월) 마감' / '11월 1일 (일)에 필요'
const WHEN_RE = /(\d+)월 (\d+)일 \((.)\)/
const TODAY = new Date(`${C1R_TODAY}T00:00:00Z`)
const YEAR = TODAY.getUTCFullYear()
// 머리에 '11월'처럼 달을 붙일지 가르는 이번 달
export const THIS_MONTH = TODAY.getUTCMonth() + 1

function dateOf(row: C1rRow): C1rDate | null {
  const m = row.when?.match(WHEN_RE)
  if (!m) return null
  const [month, day] = [Number(m[1]), Number(m[2])]
  const t = Date.UTC(YEAR, month - 1, day)
  const rel = t < TODAY.getTime() ? 'past' : t === TODAY.getTime() ? 'today' : 'future'
  return { month, day, week: m[3] ?? '', rel }
}

export function groupsOf(rows: C1rRow[]): C1rGroup[] {
  const out: { key: string; date: C1rDate | null; rows: C1rRow[] }[] = []
  for (const row of rows) {
    const date = dateOf(row)
    const key = date ? `${date.month}-${date.day}` : 'none'
    const last = out.at(-1)
    if (last?.key === key) last.rows.push(row)
    else out.push({ key, date, rows: [row] })
  }
  return out.map(g => {
    const first = g.rows[0]
    const same = first !== undefined && g.rows.every(r => r.fact === first.fact)
    return { ...g, fact: same ? first.fact : null, danger: same && g.rows.every(r => r.danger) }
  })
}
