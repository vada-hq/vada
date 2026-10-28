import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CalendarItem } from '@vada/contracts'
import { calendarIcs } from './ics.js'

const now = new Date('2026-10-28T03:04:05Z')
const origin = 'https://vada.example.test'
const item: CalendarItem = {
  key: 'schedule_item:019a0000-0000-7000-8000-000000000001',
  source: 'schedule_item',
  kind: 'academic',
  title: '시험',
  allDay: true,
  start: '2026-12-31',
  end: null,
  place: null,
  event: null,
  department: null,
  mine: false,
  overdue: false,
  target: { record: 'schedule', id: '019a0000-0000-7000-8000-000000000001' },
}
const render = (items = [item]) =>
  calendarIcs({ items, councilId: 'council', councilName: '학생회', origin, now })
const unfolded = (value: string) => value.replace(/\r\n /g, '')

test('VCALENDAR 머리·UTC DTSTAMP와 안정된 UID·원본 URL을 쓴다', () => {
  const body = unfolded(render())
  for (const line of [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VADA//Calendar//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:VADA 학생회',
    'X-WR-TIMEZONE:Asia/Seoul',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    'DTSTAMP:20261028T030405Z',
    `UID:schedule_item-${item.target.id}@vada`,
    `URL:${origin}/schedule/council/${item.target.id}`,
    'SUMMARY:[시험·학사] 시험',
    'END:VCALENDAR',
  ])
    assert.ok(body.includes(`${line}\r\n`), line)
  assert.equal(body.replaceAll('\r\n', '').includes('\n'), false)
  assert.equal(
    unfolded(render([{ ...item, title: '바꾼 제목' }])).match(/UID:.*/)?.[0],
    body.match(/UID:.*/)?.[0],
  )
})

test('종일의 끝은 다음 날이며 한 날·여러 날·연말·윤년을 처리한다', () => {
  assert.match(render(), /DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101/)
  assert.match(
    render([{ ...item, start: '2026-10-28', end: '2026-10-30' }]),
    /DTEND;VALUE=DATE:20261031/,
  )
  assert.match(render([{ ...item, start: '2028-02-28' }]), /DTEND;VALUE=DATE:20280229/)
  assert.match(render(), /TRANSP:TRANSPARENT/)
  assert.match(render([{ ...item, kind: 'event' }]), /TRANSP:OPAQUE/)
  assert.match(render([{ ...item, kind: 'meeting' }]), /TRANSP:OPAQUE/)
})

test('한국 시각을 UTC로 바꾸며 끝 없는 시각에는 DTEND를 만들지 않는다', () => {
  const timed = { ...item, allDay: false, start: '2026-01-01T00:30', end: '2026-01-01T01:30' }
  assert.match(render([timed]), /DTSTART:20251231T153000Z\r\nDTEND:20251231T163000Z/)
  assert.ok(!render([{ ...timed, end: null }]).includes('DTEND'))
})

test('TEXT를 이스케이프하고 메모와 주소를 DESCRIPTION에 담으며 줄 삽입을 막는다', () => {
  const body = unfolded(
    calendarIcs({
      items: [
        {
          ...item,
          kind: 'other',
          title: '가\\나;다,라\r\nBEGIN:VEVENT',
          place: '강당;1층',
          memo: '메모\n두 번째',
        },
      ],
      councilId: 'council',
      councilName: '학생회\n이름',
      origin,
      now,
    }),
  )
  assert.ok(body.includes('SUMMARY:가\\\\나\\;다\\,라\\nBEGIN:VEVENT\r\n'))
  assert.ok(body.includes('LOCATION:강당\\;1층\r\n'))
  assert.ok(
    body.includes(`DESCRIPTION:메모\\n두 번째\\n${origin}/schedule/council/${item.target.id}\r\n`),
  )
  assert.equal(body.split('\r\n').filter(line => line === 'BEGIN:VEVENT').length, 1)
})

test('75옥텟 접기는 한글·이모지를 가르지 않고 이어지는 공백도 센다', () => {
  const title = '한글😀'.repeat(40)
  const body = render([{ ...item, title }])
  assert.ok(body.includes('\r\n '))
  for (const line of body.split('\r\n')) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75)
    assert.ok(!line.includes('\uFFFD'))
  }
  assert.ok(unfolded(body).includes(`SUMMARY:[시험·학사] ${title}\r\n`))
})
