import { expect, test } from 'vitest'
import type { BudgetHistoryEntry } from '@vada/contracts'
import { budgetHistoryText, budgetMessage, currentPeriodId, defaultNewPeriod, draftOf, draftTotals, periodDayText, planInput, rateText, rebaseDraft,
  semesterOf, shareText } from './budget-view'
import { budgetEventLine, budgetPlan } from './budget-fixtures'

test('학기는 3~8월이 1학기, 9월~다음 해 2월 말일이 2학기다', () => {
  expect(semesterOf('2026-03-01')).toEqual({ name: '2026년 1학기', startsOn: '2026-03-01', endsOn: '2026-08-31' })
  expect(semesterOf('2026-10-10')).toEqual({ name: '2026년 2학기', startsOn: '2026-09-01', endsOn: '2027-02-28' })
  expect(semesterOf('2028-01-15')).toEqual({ name: '2027년 2학기', startsOn: '2027-09-01', endsOn: '2028-02-29' })
})

test('새 기간 기본값: 기간이 없으면 오늘이 든 학기, 있으면 가장 늦은 끝일 다음 날부터 그날이 든 학기 끝까지', () => {
  expect(defaultNewPeriod([], '2026-10-10')).toEqual({ name: '2026년 2학기', startsOn: '2026-09-01', endsOn: '2027-02-28' })
  expect(defaultNewPeriod([{ endsOn: '2026-08-31' }, { endsOn: '2027-02-28' }], '2026-10-10'))
    .toEqual({ name: '2027년 1학기', startsOn: '2027-03-01', endsOn: '2027-08-31' })
  expect(defaultNewPeriod([{ endsOn: '2026-06-30' }], '2026-10-10')).toEqual({ name: '2026년 1학기', startsOn: '2026-07-01', endsOn: '2026-08-31' })
})

test('처음 고를 기간: 오늘이 든 기간, 없으면 목록의 첫 기간(가장 늦게 시작한 기간)', () => {
  const periods = [{ id: 'later', startsOn: '2027-03-01', endsOn: '2027-08-31' }, { id: 'now', startsOn: '2026-09-01', endsOn: '2027-02-28' }]
  expect(currentPeriodId(periods, '2026-10-10')).toBe('now')
  expect(currentPeriodId(periods, '2030-01-01')).toBe('later')
  expect(currentPeriodId([], '2026-10-10')).toBeNull()
})

test('집행률은 예산이 미정이거나 0원이면 없다', () => {
  expect([rateText(54000, 100000), rateText(150, 100), rateText(1, null), rateText(1, 0)]).toEqual(['집행 54%', '집행 150%', null, null])
})

test('편성 입력: 쉼표·원을 지우고, 행사 줄은 금액을 바꿨을 때만 보내며, 수입·운영 금액을 비우거나 글자를 넣으면 NaN·null로 넘긴다', () => {
  const draft = draftOf(budgetPlan({ events: [budgetEventLine(), budgetEventLine({ eventId: 'e3', name: '종강총회', budget: null, version: 0 })] }))
  expect(draft.incomes.map(line => [line.id, line.name, line.amount])).toEqual([['li', '학생회비', '800,000']])
  draft.incomes[0]!.amount = '750,000원'
  draft.operating[0]!.amount = ''
  draft.events[0]!.amount = '350000'
  const input = planInput(draft, 2)
  expect(input).toEqual({ version: 2, name: '2026년 2학기', startsOn: '2026-09-01', endsOn: '2027-02-28',
    incomes: [{ id: 'li', name: '학생회비', amount: 750000 }], operating: [{ id: 'lo', name: '회의비', amount: null }],
    events: [{ eventId: 'e', version: 1, budget: 350000 }, { eventId: 'e3', version: 0 }] })
  // 미정이던 행사에 금액을 넣거나, 금액이 있던 행사를 비우면 보낸다.
  draft.events[1]!.amount = '10,000'
  draft.events[0]!.amount = ''
  expect(planInput(draft, 2).events).toEqual([{ eventId: 'e', version: 1, budget: null }, { eventId: 'e3', version: 0, budget: 10000 }])
  draft.incomes[0]!.amount = '삼만'
  expect(Number.isNaN(planInput(draft, 2).incomes[0]!.amount)).toBe(true)
})

test('합계 미리 보기: 형식이 맞는 금액만 더하고, 배정 안 한 돈은 수입 예산 − 예산이다', () => {
  const draft = draftOf(budgetPlan())
  expect(draftTotals(draft)).toEqual({ income: 800000, budget: 400000, unallocated: 400000 })
  draft.operating[0]!.amount = '오류'
  draft.events[0]!.amount = '900,000'
  expect(draftTotals(draft)).toEqual({ income: 800000, budget: 900000, unallocated: -100000 })
})

test('처리 기록 문구', () => {
  const entry = (changes: Record<string, unknown>, action: BudgetHistoryEntry['action'] = 'updated'): BudgetHistoryEntry =>
    ({ id: 'h', action, actor: { id: 'f', name: '재정' }, changes, createdAt: '2026-10-10T01:00:00.000Z' })
  expect(budgetHistoryText(entry({ name: '2026년 2학기', startsOn: '2026-09-01', endsOn: '2027-02-28' }, 'created')))
    .toBe('기간 만듦: 2026년 2학기 (2026-09-01 ~ 2027-02-28)')
  expect(budgetHistoryText(entry({ name: { from: '가을', to: '2학기' }, endsOn: { from: '2027-02-28', to: '2027-01-31' }, lines: [
    { group: 'income', action: 'changed', name: '전기 이월금', previousName: '이월금', from: 120000, to: 120000 },
    { group: 'income', action: 'changed', name: '학생회비', from: 800000, to: 750000 },
    { group: 'event', action: 'added', name: '축제', to: null },
    { group: 'event', action: 'removed', name: '체육대회', from: 400000 },
    { group: 'operating', action: 'added', name: '예비비', to: 50000 },
    { group: 'operating', action: 'removed', name: '회의비', from: 100000 },
  ] }))).toBe('편성 수정: 이름 가을 → 2학기 · 끝일 2027-02-28 → 2027-01-31 · 수입 이월금 → 전기 이월금 · 수입 학생회비 800,000원 → 750,000원'
    + ' · 행사 축제 넣음(미정) · 행사 체육대회 뺌 · 운영 예비비 더함(50,000원) · 운영 회의비 지움')
})

test('오류 코드마다 문구가 있고, 모르는 코드는 기본 문구다', () => {
  expect(budgetMessage('PERIOD_OVERLAP')).toBe('다른 회계 기간과 날짜가 겹쳐요.')
  expect(budgetMessage('LINE_IN_USE')).toBe('지출이나 수입이 고른 항목은 지울 수 없어요.')
  expect(budgetMessage('WHAT')).toBe('처리하지 못했어요. 다시 시도해 주세요.')
})

test('저장에 실패해 편성을 새로 받으면: 기간 버전이 바뀌었으면 새로 시작하고, 아니면 버전이 바뀐 행사 줄만 새 값으로 바꾼다', () => {
  const before = budgetPlan({ events: [budgetEventLine(), budgetEventLine({ eventId: 'e3', name: '종강총회', budget: 100000, version: 1 })] })
  const draft = draftOf(before)
  draft.incomes[0]!.amount = '900,000'
  draft.events[0]!.amount = '350,000'
  draft.events[1]!.amount = '150,000'
  // 종강총회만 행사 재정 탭에서 바뀌었다. 체육대회의 입력은 남고, 종강총회는 새 값으로 바뀐다.
  const after = budgetPlan({ events: [budgetEventLine(), budgetEventLine({ eventId: 'e3', name: '종강총회', budget: 120000, version: 2 })] })
  const rebased = rebaseDraft(draft, before, after)
  expect(rebased.incomes[0]!.amount).toBe('900,000')
  expect(rebased.events.map(line => [line.eventId, line.amount, line.version, line.budget])).toEqual([['e', '350,000', 1, 300000], ['e3', '120,000', 2, 120000]])
  // 다른 사람이 편성을 저장했으면(기간 버전이 바뀜) 겹쳐 쓰지 않도록 새 편성으로 다시 시작한다.
  const saved = budgetPlan({ period: { ...after.period, version: 3 } })
  expect(rebaseDraft(draft, before, saved)).toEqual(draftOf(saved))
})

test('수입 비율·기간 날짜·결산 오류 문구', () => {
  expect([shareText(750000, 800000), shareText(0, 800000), shareText(30000, 0)]).toEqual(['예산의 94%', '예산의 0%', null])
  expect(periodDayText('2026-09-01')).toBe('2026.9.1')
  expect(budgetMessage('LINE_IN_USE')).toBe('지출이나 수입이 고른 항목은 지울 수 없어요.')
  expect(budgetMessage('INCOMES_OUTSIDE_PERIOD')).toBe('이 기간의 수입이 기간 밖으로 나가요. 날짜를 확인해 주세요.')
  expect(budgetMessage('EXPORT_TOO_LARGE')).toBe('기록이 너무 많아 엑셀로 만들 수 없어요.')
})
