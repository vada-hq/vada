import { expect, test } from 'vitest'
import { recordItem } from './test-support/record-samples'
import {
  attendanceChip,
  completedLabel,
  recordWhen,
  executionChip,
  RECORD_SECTIONS,
  tasksChip,
  visibleRecords,
} from './record-view'

test('카드 칩 셋: 참석 N명 (신청 M명), 예산 집행 N%, 완료 업무 N건', () => {
  const { chips } = recordItem()
  expect(attendanceChip(chips)).toBe('참석 186명 (신청 210명)')
  expect(executionChip(chips)).toBe('예산 집행 92%')
  expect(tasksChip(chips)).toBe('완료 업무 14건')
})

test('예산이 0이라 집행률이 없으면(null) 칩은 예산 없음이다', () => {
  expect(executionChip({ ...recordItem().chips, budget: 0, executionRate: null })).toBe('예산 없음')
})

test('완료 처리일은 날짜 도우미의 꼴이고 올해가 아니면 연도를 붙인다', () => {
  const now = new Date('2026-10-29T03:00:00.000Z')
  expect(completedLabel('2026-10-24T06:00:00.000Z', now)).toBe('완료 처리 10월 24일 (토)')
  expect(completedLabel('2025-03-28T06:00:00.000Z', now)).toBe('완료 처리 2025년 3월 28일 (금)')
})

test('행사 일시는 올해가 아니면 앞에 연도를 붙인다(지난 행사가 많은 목록)', () => {
  const now = new Date('2026-10-29T03:00:00.000Z')
  expect(recordWhen(recordItem(), now)).toBe('10월 17일 (토) 11:00 ~ 17:00')
  expect(recordWhen({ startsAt: '2025-12-19T18:00', endsAt: '2025-12-19T21:00' }, now)).toBe(
    '2025년 12월 19일 (금) 18:00 ~ 21:00',
  )
  expect(recordWhen({ startsAt: null, endsAt: null }, now)).toBe('일시 미정')
})

const a = recordItem({ id: 'a', name: '봄 축제', startsAt: '2026-05-28T11:00' })
const b = recordItem({ id: 'b', name: '가을 축제 부스', startsAt: '2026-10-17T11:00' })
const c = recordItem({ id: 'c', name: '신입생 환영회', startsAt: null, endsAt: null })

test('완료 처리일순(기본)은 서버 차례 그대로다', () => {
  expect(visibleRecords([a, b, c], '', 'completed').map(item => item.id)).toEqual(['a', 'b', 'c'])
})

test('행사 일시순은 최근 행사부터이고 일시 미정은 끝이다', () => {
  expect(visibleRecords([c, a, b], '', 'date').map(item => item.id)).toEqual(['b', 'a', 'c'])
})

test('행사명 찾기는 앞뒤 공백과 대소문자를 가리지 않는다', () => {
  const english = recordItem({ id: 'e', name: 'VADA Night' })
  expect(visibleRecords([a, b, c, english], ' 축제 ', 'completed').map(item => item.id)).toEqual([
    'a',
    'b',
  ])
  expect(visibleRecords([a, english], 'vada', 'completed').map(item => item.id)).toEqual(['e'])
})

test('목차는 자동 대목 넷이고 차례는 개요·성과·타임라인·근거 자료다', () => {
  expect(RECORD_SECTIONS.map(section => section.label)).toEqual([
    '개요',
    '성과',
    '타임라인',
    '근거 자료',
  ])
})
