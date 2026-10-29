import type { EventEntry, MeetingEntry, ScheduleEntry, TaskEntry } from './types.js'

// 행사, 업무, 회의, 일정.
export const EVENTS: EventEntry[] = [
  {
    name: '새내기 배움터',
    by: '김바다',
    at: 'D-4 22:55',
    startsAt: 'D+116 10:00',
    endsAt: 'D+118 12:00',
    place: '가평 베이직하우스',
  },
  {
    name: '중간고사 간식행사',
    by: '김바다',
    at: 'D-3 19:14',
    startsAt: 'D-10 14:00',
    endsAt: null,
    place: '미래관 1층',
    complete: { by: '김바다', at: 'D-1 23:07' },
  },
  {
    name: '기말고사 간식행사',
    by: '황성욱',
    at: 'D-1 10:19',
    startsAt: 'D+2 10:20',
    endsAt: null,
    place: '미래관 1층',
  },
  {
    name: '학과 체육대회',
    by: '김바다',
    at: 'D-1 21:33',
    startsAt: 'D+8 10:00',
    endsAt: 'D+8 17:00',
    place: null,
  },
]

const FRESHMEN = '새내기 배움터'
const SNACK = '기말고사 간식행사'

export const TASKS: TaskEntry[] = [
  {
    title: '레크레이션 준비',
    by: '김바다',
    at: 'D-4 23:00',
    event: FRESHMEN,
    department: '기획부',
    assignee: '박지민',
    due: 'D+101',
    status: { to: 'in_progress', at: 'D-3 10:00' },
  },
  {
    title: '장소 협조',
    by: '김바다',
    at: 'D-4 23:01',
    event: FRESHMEN,
    department: '재정부',
    assignee: '최유진',
    due: 'D+103',
  },
  {
    title: '홍보물 준비',
    by: '김바다',
    at: 'D-4 23:02',
    event: FRESHMEN,
    department: '홍보부',
    assignee: '이지우',
    due: 'D+1',
    status: { to: 'in_progress', at: 'D-2 15:00' },
  },
  {
    title: '예산안 편성',
    by: '김바다',
    at: 'D-4 23:06',
    event: FRESHMEN,
    department: '재정부',
    assignee: '신예린',
    due: 'D+103',
    status: { to: 'in_progress', at: 'D-3 11:00' },
  },
  {
    title: '타임테이블 작성',
    by: '김바다',
    at: 'D-4 23:07',
    event: FRESHMEN,
    department: '소통부',
    assignee: '조은호',
    due: 'D+107',
    status: { to: 'in_progress', at: 'D-3 12:00' },
  },
  {
    title: '공연 및 이벤트',
    by: '김바다',
    at: 'D-4 23:09',
    event: FRESHMEN,
    department: '기획부',
  },
  {
    title: '컨셉 및 슬로건 확정',
    by: '김바다',
    at: 'D-4 23:10',
    event: FRESHMEN,
    department: '기획부',
    assignee: '송태윤',
    due: 'D+94',
    status: { to: 'done', at: 'D-2 16:00' },
  },
  {
    title: '협찬 및 제휴 유치',
    by: '김바다',
    at: 'D-4 23:11',
    event: FRESHMEN,
    department: '소통부',
    assignee: '권나연',
    due: 'D+98',
    status: { to: 'done', at: 'D-2 17:00' },
  },
  {
    title: '상품 준비',
    by: '김바다',
    at: 'D-3 19:15',
    event: '중간고사 간식행사',
    department: '기획부',
    assignee: '이지우',
    status: { to: 'done', at: 'D-3 19:30' },
  },
  {
    title: '숙소 계약금 결재',
    by: '김바다',
    at: 'D-3 21:19',
    event: FRESHMEN,
    assignee: '김바다',
    due: 'D+1',
  },
  {
    title: '간식 수량 확정',
    by: '김바다',
    at: 'D-1 21:36',
    event: SNACK,
    department: '기획부',
    assignee: '백승훈',
    due: 'D0',
  },
  {
    title: '간식 나눔 자리 배치',
    by: '김바다',
    at: 'D-1 21:41',
    event: SNACK,
    department: '기획부',
    due: 'D+1',
  },
  {
    title: '학생회비 납부 현황 공지',
    by: '김바다',
    at: 'D-1 21:42',
    assignee: '김바다',
    due: 'D0',
  },
]

export const MEETINGS: MeetingEntry[] = [
  {
    title: '{{D-1 주}} 운영진 회의',
    by: '김바다',
    at: 'D-2 12:00',
    heldAt: 'D-1 19:00',
    endsAt: 'D-1 20:00',
    place: '학생회실',
    agenda: [
      {
        title: '기말고사 간식행사 준비',
        notes:
          '간식은 60인분으로 준비하기로 함. 나눔 장소는 미래관 1층 로비가 유력하고, 동선은 기획부가 금요일까지 정리한다.',
        decisions: [
          {
            content: '간식은 60세트, 1세트 5,000원 안에서 준비한다',
            rationale: '지난 중간고사 간식행사 참여 인원 52명',
          },
          { content: '나눔 장소는 미래관 1층 로비로 한다' },
        ],
      },
    ],
    minutesAt: 'D-1 20:10',
    confirmAt: 'D-1 20:20',
  },
  {
    title: '기말고사 간식행사 준비 회의',
    by: '김바다',
    at: 'D-2 12:05',
    heldAt: 'D-1 17:00',
    endsAt: 'D-1 18:00',
    place: '학생회실',
    agenda: [
      {
        title: '간식 구성과 나눔 동선',
        notes:
          '간식은 샌드위치와 음료 세트로 정함. 나눔은 시험 기간 첫날 점심, 미래관 1층 로비에서 한다.',
        decisions: [
          {
            content: '간식은 샌드위치와 음료 세트로 한다',
            rationale: '지난 설문에서 가장 많이 고름',
          },
          { content: '나눔은 {{D+1}} 점심, 미래관 1층 로비에서 한다' },
        ],
      },
    ],
    minutesAt: 'D-1 18:10',
  },
  {
    title: '{{D+3 주}} 운영진 회의',
    by: '김바다',
    at: 'D-1 21:43',
    heldAt: 'D+3 19:00',
    endsAt: 'D+3 20:00',
    place: '학생회실',
    agenda: [{ title: '기말고사 간식행사 정산' }],
  },
]

export const SCHEDULE: ScheduleEntry[] = [
  {
    title: '총학생회 대표자 회의',
    type: 'external',
    by: '김바다',
    at: 'D-1 21:44',
    when: { allDay: false, startsAt: 'D+4 18:00', endsAt: 'D+4 20:00' },
    place: '학생회관 2층',
  },
  {
    title: '2학기 학생회비 집행 내역 제출',
    type: 'deadline',
    by: '김바다',
    at: 'D-1 21:45',
    when: { allDay: true, on: 'D+6' },
    place: null,
  },
]
