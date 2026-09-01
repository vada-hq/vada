// 때를 글로 만든다.
//
// **어느 시간대인지를 서버가 못 박는다.** 오랫동안 `at.getHours()`로 찍었는데 그것은
// **그 기계의 시간대**다 — 내 기계는 한국이라 검사가 통과했고, 배포하는 기계는 UTC라
// 아홉 시간 어긋난다. 체육대회 '10:00 시작'이 '01:00'으로 보이는 것이고, 아무도
// 서버 오류를 보지 못한 채 틀린 시각만 본다.
//
// CI가 잡았다(2026-09-01). 남의 기계에서 한 번 돌리는 것이 이래서 있다.
//
// ## 왜 상수인가
//
// 이 도구를 쓰는 곳은 한국 대학의 학생회다. 조직마다 시간대를 고르게 하면 그 값을
// 담을 자리(표·명세·화면)가 전부 필요한데, **두 시간대에 걸친 학생회가 아직 없다.**
// 지어내지 않고 상수로 두되, 여기 하나에만 둔다 — 늘려야 할 날 고칠 자리가 한 곳이다.
const ZONE = 'Asia/Seoul'

/** 자리마다 새로 만들면 비싸다. 형식이 몇 안 되므로 만들어 두고 나눠 쓴다. */
const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** 그 시간대에서 본 조각들. `Intl`이 시간대를 아는 유일한 자리다. */
function at(when: Date): Record<string, string> {
  const found: Record<string, string> = {}
  for (const part of parts.formatToParts(when)) found[part.type] = part.value
  // 자정을 '24'로 내는 구현이 있다. 하루가 바뀌는 자리라 그대로 두면 '24:30'이 나온다.
  if (found.hour === '24') found.hour = '00'
  return found
}

/** `2026. 08. 20 10:00` — 행사·기록이 쓰는 긴 꼴. */
export function stamp(when: Date): string {
  const it = at(when)
  return `${it.year}. ${it.month}. ${it.day} ${it.hour}:${it.minute}`
}

/** `2026-08-20 10:00` — 밖에서 온 사람이 보는 꼴. */
export function moment(when: Date): string {
  const it = at(when)
  return `${it.year}-${it.month}-${it.day} ${it.hour}:${it.minute}`
}

/** `08.20 10:00` — 목록의 좁은 자리. */
export function shortStamp(when: Date): string {
  const it = at(when)
  return `${it.month}.${it.day} ${it.hour}:${it.minute}`
}

/** `10:00` — 시각만. */
export function clock(when: Date): string {
  const it = at(when)
  return `${it.hour}:${it.minute}`
}

/** `2026. 08. 20` — 날짜만. */
export function day(when: Date): string {
  const it = at(when)
  return `${it.year}. ${it.month}. ${it.day}`
}

/** `2026.08.20 10:00` — 초대가 쓰는 촘촘한 꼴. */
export function dottedStamp(when: Date): string {
  const it = at(when)
  return `${it.year}.${it.month}.${it.day} ${it.hour}:${it.minute}`
}

/** 그 시간대에서 본 **날짜 자체**. 날 수를 세는 데만 쓴다. */
function dayKey(when: Date): number {
  const it = at(when)
  return Date.UTC(Number(it.year), Number(it.month) - 1, Number(it.day))
}

/**
 * 두 때 사이의 **날 수**.
 *
 * 시각이 아니라 날짜로 센다 — '어제'는 스물네 시간 전이 아니라 **하루 전 날짜**다.
 * 그리고 그 날짜는 시간대가 정한다: 한국 새벽 6시 행사는 UTC로는 전날이라, 기계의
 * 시간대로 세면 D-day가 하루 어긋난다.
 */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((dayKey(to) - dayKey(from)) / 86_400_000)
}

/**
 * `2026-08-20T10:00` — 브라우저의 `datetime-local` 칸이 읽고 쓰는 꼴.
 *
 * 다른 꼴들과 달리 **사람에게 보이는 글이 아니라 칸에 들어가는 값**이다. 그래서
 * 여기만 'T'가 있고 여기만 되돌릴 수 있어야 한다(`momentOf`).
 */
export function fieldMoment(when: Date): string {
  const it = at(when)
  return `${it.year}-${it.month}-${it.day}T${it.hour}:${it.minute}`
}

/** 그 시간대가 그 순간에 UTC보다 얼마나 앞서는가(밀리초). */
function offsetAt(when: Date): number {
  const it = at(when)
  const seen = Date.UTC(
    Number(it.year),
    Number(it.month) - 1,
    Number(it.day),
    Number(it.hour),
    Number(it.minute),
  )
  // `at`은 분까지만 본다. 같은 자리끼리 견주려고 이쪽도 분으로 자른다.
  return seen - Math.floor(when.getTime() / 60_000) * 60_000
}

/**
 * 칸에 적힌 벽시계 글을 **그 순간**으로 되돌린다. 읽지 못하면 null이다.
 *
 * **`new Date('2026-08-20T10:00')`을 쓰지 않는다.** 그것은 시간대가 없는 글을
 * **기계의 시간대**로 읽는다 — UTC에서 도는 서버는 한국 사람이 적은 10시를 19시로
 * 저장한다. 시각을 글로 만들 때 못 박은 시간대를 되읽을 때도 똑같이 못 박는다.
 *
 * 두 번 셈하는 까닭: 첫 셈에 쓴 순간과 답이 서로 다른 시간대 규칙에 들 수 있다
 * (서머타임이 있는 곳이면). 한국은 지금 그런 규칙이 없지만, 이 함수가 ZONE 하나에만
 * 매여 있으므로 그 날이 와도 조용히 틀리지 않게 해 둔다.
 *
 * 마지막에 되돌려 찍어 견주는 까닭: **없는 날과 없는 시각을 걸러낸다.** `2026-02-31`은
 * 3월 3일로 굴러가고, 서머타임이 건너뛴 한 시간은 아예 존재하지 않는다 — 둘 다
 * 조용히 다른 때가 되는 대신 '읽지 못했다'가 되어야 한다.
 */
export function momentOf(text: string): Date | null {
  const found = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(text.trim())
  if (found === null) return null
  const [, year, month, dayOfMonth, hour, minute] = found as unknown as string[]
  const wall = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(dayOfMonth),
    Number(hour),
    Number(minute),
  )
  let guess = new Date(wall - offsetAt(new Date(wall)))
  guess = new Date(wall - offsetAt(guess))
  return fieldMoment(guess) === `${year}-${month}-${dayOfMonth}T${hour}:${minute}` ? guess : null
}
