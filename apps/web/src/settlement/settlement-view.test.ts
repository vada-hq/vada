import { expect, test } from 'vitest'
import type { EventFinanceAction, EventFinanceHistoryEntry } from '@vada/contracts'
import { budgetInput, budgetText, downloadName, financeHistoryText, readyToSettle, remainingText, requirements, settledDay,
  settlementMessage } from './settlement-view'
import { eventFinance } from './settlement-fixtures'

test('예산·남은 예산: 미정은 미정과 —이고, 0보다 작으면 초과로 적는다', () => {
  expect([budgetText(null), budgetText(0), budgetText(3000000)]).toEqual(['미정', '0원', '3,000,000원'])
  expect([remainingText(null), remainingText(0), remainingText(-120000)]).toEqual(['—', '0원', '120,000원 초과'])
})

test('정산 조건 셋이 모두 0이어야 정산할 수 있고, 각 줄에 개수와 해결 방법이 있다', () => {
  const pending = eventFinance({ missingEvidence: 2, pendingRequests: 0, unrecordedItems: 1 })
  expect(requirements(pending).map(item => [item.label, item.done])).toEqual([['증빙 누락 2건', false], ['검토 대기 요청 0건', true],
    ['지출로 기록하지 않은 승인 품목 1개', false]])
  expect(requirements(pending).map(item => item.hint)).toEqual(['지출 상세에서 증빙을 올려 주세요.', '구매 검토에서 승인하거나 반려해 주세요.',
    '산 품목은 지출에 연결하고, 사지 않을 품목은 승인을 취소해 주세요.'])
  expect([readyToSettle(pending), readyToSettle(eventFinance())]).toEqual([false, true])
})

test('처리 기록 문구와 정산한 날', () => {
  const entry = (action: EventFinanceAction, changes: Record<string, unknown> = {}, reason: string | null = null): EventFinanceHistoryEntry =>
    ({ id: 'h', action, actor: { id: 'f', name: '재정' }, changes, reason, createdAt: '2026-10-09T09:00:00.000Z' })
  expect(financeHistoryText(entry('budget_set', { from: null, to: 3000000 }))).toBe('예산 미정 → 3,000,000원')
  expect(financeHistoryText(entry('settled', { budget: 3000000, spent: 950000, expenseCount: 4 }))).toBe('정산 완료 · 실제 지출 950,000원')
  expect(financeHistoryText(entry('reopened', {}, '영수증 빠짐'))).toBe('정산 다시 엶: 영수증 빠짐')
  // 한국 시간으로 날짜를 센다.
  expect(settledDay('2026-10-09T15:30:00.000Z')).toBe('10월 10일')
})

test('내려받은 파일 이름은 filename*에서 꺼내고, 없거나 깨졌으면 기본 이름이다. 오류는 화면 문구로 바꾼다', () => {
  expect(downloadName(`attachment; filename="settlement.xlsx"; filename*=UTF-8''${encodeURIComponent('체육대회 정산 2026-10-09.xlsx')}`))
    .toBe('체육대회 정산 2026-10-09.xlsx')
  expect(downloadName("attachment; filename*=UTF-8''%28%27%29.xlsx")).toBe("(')" + '.xlsx')
  expect(downloadName(null)).toBe('정산.xlsx')
  expect(downloadName("attachment; filename*=UTF-8''%E0%A4%A.xlsx")).toBe('정산.xlsx')
  expect(settlementMessage('NOT_READY_TO_SETTLE')).toBe('아직 정산할 수 없어요. 남은 항목을 확인해 주세요.')
  expect(settlementMessage('EXPORT_TOO_LARGE')).toBe('지출이 너무 많아 엑셀로 만들 수 없어요.')
  expect(settlementMessage('???')).toBe('처리하지 못했어요. 다시 시도해 주세요.')
})

test('예산 칸의 글: 쉼표·공백·"원"은 지우고, 비우면 미정이며, 숫자가 아닌 글자가 남으면 저장할 수 없는 값이다', () => {
  expect([budgetInput('300,000'), budgetInput(' 3,000,000원 '), budgetInput('0')]).toEqual([300000, 3000000, 0])
  expect([budgetInput(''), budgetInput('  ')]).toEqual([null, null])
  for (const text of ['30만', '1e5', '-1', '3.5', '３００']) expect(Number.isNaN(budgetInput(text)), text).toBe(true)
})
