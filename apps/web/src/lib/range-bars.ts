type DayRange = { from: string; to: string }
export type RangeBar<T> = {
  item: T
  start: number
  span: number
  lane: number
  before: boolean
  after: boolean
}

// 업무 달력과 모은 일정의 여러 날 막대가 같은 주 경계·겹침 계산을 쓴다.
export function rangeBarsOf<T>(
  items: T[],
  week: string[],
  rangeOf: (item: T) => DayRange | null,
): RangeBar<T>[] {
  const first = week[0] ?? ''
  const last = week[week.length - 1] ?? ''
  const bars = items
    .flatMap(item => {
      const range = rangeOf(item)
      if (!range || range.to < first || range.from > last) return []
      const start = range.from < first ? 0 : week.indexOf(range.from)
      const end = range.to > last ? week.length - 1 : week.indexOf(range.to)
      return [
        { item, start, span: end - start + 1, before: range.from < first, after: range.to > last },
      ]
    })
    .sort((a, b) => a.start - b.start || b.span - a.span)
  const laneEnds: number[] = []
  return bars.map(bar => {
    const free = laneEnds.findIndex(end => end < bar.start)
    const lane = free === -1 ? laneEnds.length : free
    laneEnds[lane] = bar.start + bar.span - 1
    return { ...bar, lane }
  })
}
