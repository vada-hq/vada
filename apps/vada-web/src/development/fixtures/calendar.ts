import type { DataRow } from '../../data-sources/definitions'

// ── 운영 캘린더(OPS-CAL-01) ────────────────────────────────────────────────
//
// 값은 figma.design.json이 그린 2026년 7월을 그대로 옮긴 것이다. **어느 달인지는
// 서버가 정한다** — 명세가 달을 옮기는 조작을 담을 어휘가 없어 화면이 넘길 값이
// 없다(finance.ledgerSummary의 DEFAULT_LEDGER_MONTH와 같은 처지다).
//
// 유형은 조각으로 내보내지 않고 여기서만 쓴다 — 서버가 걸러서 주는 값이므로
// 화면이 볼 일이 없다. 딱지 색은 그 유형의 이름이 곧 톤 이름이다.
const CALENDAR_DAYS: Array<{
  id: string
  dayLabel: string
  dayTone: string
  schedules: Array<{ id: string; title: string; type: string }>
}> = [
  { id: '2026-06-28', dayLabel: '', dayTone: 'gray', schedules: [] },
  { id: '2026-06-29', dayLabel: '', dayTone: 'gray', schedules: [] },
  { id: '2026-06-30', dayLabel: '', dayTone: 'gray', schedules: [] },
  { id: '2026-07-01', dayLabel: '1', dayTone: 'gray', schedules: [] },
  { id: '2026-07-02', dayLabel: '2', dayTone: 'gray', schedules: [] },
  { id: '2026-07-03', dayLabel: '3', dayTone: 'gray', schedules: [] },
  { id: '2026-07-04', dayLabel: '4', dayTone: 'blue', schedules: [] },
  { id: '2026-07-05', dayLabel: '5', dayTone: 'red', schedules: [] },
  { id: '2026-07-06', dayLabel: '6', dayTone: 'gray', schedules: [] },
  { id: '2026-07-07', dayLabel: '7', dayTone: 'gray', schedules: [] },
  { id: '2026-07-08', dayLabel: '8', dayTone: 'gray', schedules: [] },
  { id: '2026-07-09', dayLabel: '9', dayTone: 'gray', schedules: [] },
  { id: '2026-07-10', dayLabel: '10', dayTone: 'gray', schedules: [] },
  { id: '2026-07-11', dayLabel: '11', dayTone: 'blue', schedules: [] },
  { id: '2026-07-12', dayLabel: '12', dayTone: 'red', schedules: [] },
  { id: '2026-07-13', dayLabel: '13', dayTone: 'gray', schedules: [] },
  { id: '2026-07-14', dayLabel: '14', dayTone: 'gray', schedules: [] },
  { id: '2026-07-15', dayLabel: '15', dayTone: 'gray', schedules: [] },
  { id: '2026-07-16', dayLabel: '16', dayTone: 'gray', schedules: [] },
  { id: '2026-07-17', dayLabel: '17', dayTone: 'gray', schedules: [] },
  { id: '2026-07-18', dayLabel: '18', dayTone: 'blue', schedules: [{ id: 'SCH-0718-1', title: '현수막 디자인 수정 반영', type: 'deadline' }, { id: 'SCH-0718-2', title: '학생 건의함 확인·답변', type: 'deadline' }] },
  { id: '2026-07-19', dayLabel: '19', dayTone: 'today', schedules: [] },
  { id: '2026-07-20', dayLabel: '20', dayTone: 'gray', schedules: [{ id: 'SCH-0720-1', title: '체육대회 참가 신청 마감', type: 'deadline' }, { id: 'SCH-0720-2', title: '참가자 모집 공지 작성', type: 'deadline' }] },
  { id: '2026-07-21', dayLabel: '21', dayTone: 'gray', schedules: [{ id: 'SCH-0721-1', title: '주간 운영회의 자료 준비', type: 'deadline' }] },
  { id: '2026-07-22', dayLabel: '22', dayTone: 'gray', schedules: [{ id: 'SCH-0722-1', title: '정기 운영회의', type: 'meeting' }, { id: 'SCH-0722-2', title: '행사 안전 안내문 검토', type: 'deadline' }, { id: 'SCH-0722-3', title: '회계 장부 주간 정리', type: 'deadline' }, { id: 'SCH-0722-4', title: '학생 건의 답변 문안 검토', type: 'deadline' }] },
  { id: '2026-07-23', dayLabel: '23', dayTone: 'gray', schedules: [{ id: 'SCH-0723-1', title: '비상 연락망 최종본 배포', type: 'deadline' }] },
  { id: '2026-07-24', dayLabel: '24', dayTone: 'gray', schedules: [] },
  { id: '2026-07-25', dayLabel: '25', dayTone: 'blue', schedules: [{ id: 'SCH-0725-1', title: '물품 구매 요청', type: 'deadline' }] },
  { id: '2026-07-26', dayLabel: '26', dayTone: 'red', schedules: [] },
  { id: '2026-07-27', dayLabel: '27', dayTone: 'gray', schedules: [] },
  { id: '2026-07-28', dayLabel: '28', dayTone: 'gray', schedules: [{ id: 'SCH-0728-1', title: '신입생 환영 기획회의 2차', type: 'meeting' }] },
  { id: '2026-07-29', dayLabel: '29', dayTone: 'gray', schedules: [] },
  { id: '2026-07-30', dayLabel: '30', dayTone: 'gray', schedules: [] },
  { id: '2026-07-31', dayLabel: '31', dayTone: 'gray', schedules: [{ id: 'SCH-0731-1', title: '행사장 사전 답사', type: 'event' }, { id: 'SCH-0731-2', title: '게시판 공지물 정리', type: 'deadline' }] },
]

// 이번 주(07.19~07.25) 줄. 격자와 **같은 일정**을 세로로 세운 것이라 제목이 겹친다.
// 행사에 딸린 줄만 '행사 일정 보기'를 갖는다 — 상시 업무의 마감과 운영 회의는
// 열 행사가 없다. 이 있고 없음이 표현이 아니라 뜻이다.
const CALENDAR_WEEK: Array<{ type: string; row: DataRow }> = [
  { type: 'deadline', row: { id: 'SCH-0720-1', typeLabel: '마감', typeTone: 'deadline', dateLabel: '07.20', title: '체육대회 참가 신청 마감', actionLabel: '행사 일정 보기', eventId: 'E-01' } },
  { type: 'meeting', row: { id: 'SCH-0722-1', typeLabel: '회의', typeTone: 'meeting', dateLabel: '07.22', title: '정기 운영회의' } },
  { type: 'deadline', row: { id: 'SCH-0723-1', typeLabel: '마감', typeTone: 'deadline', dateLabel: '07.23', title: '비상 연락망 최종본 배포' } },
  { type: 'deadline', row: { id: 'SCH-0720-2', typeLabel: '마감', typeTone: 'deadline', dateLabel: '07.20', title: '참가자 모집 공지 작성', actionLabel: '행사 일정 보기', eventId: 'E-01' } },
  { type: 'deadline', row: { id: 'SCH-0725-1', typeLabel: '마감', typeTone: 'deadline', dateLabel: '07.25', title: '물품 구매 요청', actionLabel: '행사 일정 보기', eventId: 'E-01' } },
  { type: 'deadline', row: { id: 'SCH-0722-2', typeLabel: '마감', typeTone: 'deadline', dateLabel: '07.22', title: '행사 안전 안내문 검토', actionLabel: '행사 일정 보기', eventId: 'E-01' } },
  { type: 'deadline', row: { id: 'SCH-0721-1', typeLabel: '마감', typeTone: 'deadline', dateLabel: '07.21', title: '주간 운영회의 자료 준비' } },
  { type: 'deadline', row: { id: 'SCH-0722-3', typeLabel: '마감', typeTone: 'deadline', dateLabel: '07.22', title: '회계 장부 주간 정리' } },
  { type: 'deadline', row: { id: 'SCH-0722-4', typeLabel: '마감', typeTone: 'deadline', dateLabel: '07.22', title: '학생 건의 답변 문안 검토' } },
]

export const CALENDAR_DASHBOARD_FIXTURES: Record<string, DataRow | DataRow[]> = {
  // 캘린더가 지금 보여주는 달과 이번 주. 둘 다 오늘이 정하므로 서버의 것이다.
  'ops.calendarMonth': { monthLabel: '2026년 7월' },
  'ops.calendarWeekRange': { rangeNote: '07.19 (일) – 07.25 (토) · 오늘 07.19' },
}

export const CALENDAR_FILTERED_FIXTURES: Record<
  string,
  (params: Record<string, string>) => DataRow[]
> = {
  // 유형으로 좁히는 것은 **일정**이지 날이 아니다. 칸은 그대로 서른넷이고
  // 그 안의 일정만 걸린다 — 격자에서 날이 사라지면 달력이 아니게 된다.
  'ops.calendarDays': ({ type = 'all' }) =>
    CALENDAR_DAYS.map((day) => ({
      id: day.id,
      dayLabel: day.dayLabel,
      dayTone: day.dayTone,
      schedules: day.schedules
        .filter((schedule) => type === 'all' || schedule.type === type)
        .map((schedule) => ({ id: schedule.id, title: schedule.title, typeTone: schedule.type })),
    })),
  'ops.calendarWeek': ({ type = 'all' }) =>
    CALENDAR_WEEK.filter((entry) => type === 'all' || entry.type === type).map(
      (entry) => entry.row,
    ),
}
