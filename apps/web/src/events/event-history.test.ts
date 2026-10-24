import { expect, test } from 'vitest'
import type { EventChange } from '@vada/contracts'
import { versionLine } from './event-history'

const line = (changes: EventChange[], by: { id: string; name: string } | null = null) =>
  versionLine({ versionNo: 2, at: '2026-10-20T05:03:00.000Z', by, changes })

test('행사 이력 줄은 이름, 한국 시각, 바뀐 칸 차례다', () => {
  expect(line([{ field: 'created' }], { id: 'm1', name: '김회장' })).toBe(
    '김회장 · 10월 20일 14:03 · 만듦',
  )
  expect(line([{ field: 'created' }])).toBe('알 수 없는 사람 · 10월 20일 14:03 · 만듦')
})

test('이름, 일시, 장소, 담당이 바뀐 글', () => {
  expect(
    line([
      { field: 'name', from: '가', to: '나' },
      { field: 'startsAt', from: null, to: '2026-10-25T14:00' },
      { field: 'endsAt', from: '2026-10-25T18:00', to: null },
      { field: 'place', from: null, to: '대강당' },
      { field: 'owner', from: { id: 'm1', name: null }, to: { id: 'm2', name: '이재정' } },
    ]),
  ).toContain(
    '이름 가 → 나, 시작 없음 → 10월 25일 (일) 14:00, 끝 10월 25일 (일) 18:00 → 없음, 장소 없음 → 대강당, 담당 알 수 없는 사람 → 이재정',
  )
})
