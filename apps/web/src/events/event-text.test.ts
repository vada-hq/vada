import { expect, test } from 'vitest'
import type { EventChange } from '@vada/contracts'
import { eventVersionLine } from './event-text'

const line = (changes: EventChange[]) =>
  eventVersionLine({
    versionNo: 2,
    at: '2026-10-20T05:03:00.000Z',
    by: { id: 'm1', name: '김회장' },
    changes,
  })

test('판마다 바꾼 사람, 시각, 바뀐 칸이 한 줄로 보인다', () => {
  expect(line([{ field: 'created' }])).toBe('김회장 · 10월 20일 14:03 · 만듦')
  expect(
    line([
      { field: 'name', from: '축제', to: '봄 축제' },
      { field: 'startsAt', from: null, to: '2026-10-24T14:00' },
      { field: 'endsAt', from: '2026-10-24T18:00', to: null },
      { field: 'place', from: null, to: '대강당' },
    ]),
  ).toBe(
    '김회장 · 10월 20일 14:03 · 이름 축제 → 봄 축제, 시작 미정 → 10월 24일 (토) 14:00, 끝 10월 24일 (토) 18:00 → 미정, 장소 없음 → 대강당',
  )
})

test('책임자 변경은 비운 쪽과 이름을 모르는 사람도 보인다', () => {
  expect(
    line([
      {
        field: 'owner',
        from: null,
        to: { id: 'm2', name: null },
      },
    ]),
  ).toBe('김회장 · 10월 20일 14:03 · 책임자 책임자 없음 → 알 수 없는 사람')
})
