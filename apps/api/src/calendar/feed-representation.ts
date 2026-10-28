import { createHash } from 'node:crypto'
import { calendarIcs, type IcsCalendar } from './ics.js'

const ETAG_HEX_LENGTH = 32
const REPRESENTATION_LIMIT = 1000
const digest = (body: string) => createHash('sha256').update(body).digest('hex')

// DTSTAMP는 표현을 만든 시각이다. 내용이 같으면 그 시각도 유지해야 본문 해시로 304를 줄 수 있다.
// 본문·토큰 원문은 보관하지 않고 지문과 시각만 두며, 권한과 원본 읽기는 요청마다 다시 한다.
export function createFeedRepresentation() {
  const versions = new Map<string, { fingerprint: string; stamp: Date }>()
  return (key: string, calendar: IcsCalendar) => {
    const fingerprint = digest(calendarIcs({ ...calendar, now: new Date(0) }))
    const previous = versions.get(key)
    const stamp = previous?.fingerprint === fingerprint ? previous.stamp : calendar.now
    versions.delete(key)
    if (versions.size >= REPRESENTATION_LIMIT) versions.delete(versions.keys().next().value!)
    versions.set(key, { fingerprint, stamp })
    const body = calendarIcs({ ...calendar, now: stamp })
    return { body, etag: `"${digest(body).slice(0, ETAG_HEX_LENGTH)}"` }
  }
}
