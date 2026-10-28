import {
  CALENDAR_KIND_LABELS,
  DAY_MS,
  KOREAN_DATE_LENGTH,
  calendarTitleOf,
  dateFromKorean,
  recordPath,
  type CalendarItem,
} from '@vada/contracts'

const LINE_OCTETS = 75
type IcsItem = CalendarItem & { memo?: string | null }
export type IcsCalendar = {
  items: IcsItem[]
  councilId: string
  councilName: string
  origin: string
  now: Date
}

const escapeText = (value: string) =>
  value
    .replaceAll('\\', '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')

function fold(line: string) {
  let result = ''
  let octets = 0
  for (const character of line) {
    const size = Buffer.byteLength(character, 'utf8')
    if (octets + size > LINE_OCTETS) {
      result += '\r\n '
      octets = 1
    }
    result += character
    octets += size
  }
  return result
}

const utc = (date: Date) => date.toISOString().replace(/[-:]|\.\d{3}/g, '')
const dateValue = (value: string) => value.replaceAll('-', '')
const nextDay = (value: string) =>
  dateValue(
    new Date(Date.parse(`${value}T00:00:00Z`) + DAY_MS).toISOString().slice(0, KOREAN_DATE_LENGTH),
  )

function datesOf(item: CalendarItem) {
  if (item.allDay)
    return [
      `DTSTART;VALUE=DATE:${dateValue(item.start)}`,
      `DTEND;VALUE=DATE:${nextDay(item.end ?? item.start)}`,
    ]
  return [
    `DTSTART:${utc(dateFromKorean(item.start))}`,
    ...(item.end ? [`DTEND:${utc(dateFromKorean(item.end))}`] : []),
  ]
}

function eventLines(item: IcsItem, calendar: IcsCalendar) {
  const { target } = item
  const path =
    target.record === 'meetings'
      ? `/meetings/${calendar.councilId}/${target.id}`
      : recordPath(target.record, calendar.councilId, target.id)
  const url = new URL(
    `${path}${target.record === 'events' ? `?tab=${target.tab}` : ''}`,
    calendar.origin,
  ).href
  const title = `${item.kind === 'other' ? '' : `[${CALENDAR_KIND_LABELS[item.kind]}] `}${calendarTitleOf(item)}`
  const description = [item.memo, url].filter(Boolean).join('\n')
  return [
    'BEGIN:VEVENT',
    `UID:${item.key.replace(':', '-')}@vada`,
    `DTSTAMP:${utc(calendar.now)}`,
    ...datesOf(item),
    `SUMMARY:${escapeText(title)}`,
    ...(item.place ? [`LOCATION:${escapeText(item.place)}`] : []),
    `URL:${url}`,
    `DESCRIPTION:${escapeText(description)}`,
    `TRANSP:${item.allDay && item.kind !== 'event' && item.kind !== 'meeting' ? 'TRANSPARENT' : 'OPAQUE'}`,
    'END:VEVENT',
  ]
}

export function calendarIcs(calendar: IcsCalendar): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VADA//Calendar//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(`VADA ${calendar.councilName}`)}`,
    'X-WR-TIMEZONE:Asia/Seoul',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...calendar.items.flatMap(item => eventLines(item, calendar)),
    'END:VCALENDAR',
    '',
  ]
    .map(fold)
    .join('\r\n')
}
