// 행사 업무 탭 보드 시안의 견본 넷(명세 board-spec.md 5절). 오늘 10월 30일 (금), 행사 '새내기 배움터'.
// 서버 없이 이것만으로 그린다. 세 안(b1·b2·b3)이 같이 쓴다.

export type Status = 'todo' | 'doing' | 'done'
export type DataName = 'main' | 'few' | 'many' | 'adding'
export const DATA_NAMES: DataName[] = ['main', 'few', 'many', 'adding']

export const STATUS_LABEL: Record<Status, string> = {
  todo: '할 일',
  doing: '진행 중',
  done: '끝남',
}
export const STATUSES: Status[] = ['todo', 'doing', 'done']

// 부서 색(범주 색). 차례: 재정부, 기획부, 홍보부, 대외협력부, 복지부(명세 5절). 앞 셋은 지금 배포본 색 그대로.
// Tailwind가 글자를 읽어 클래스를 만들므로 이름을 통째로 적는다.
export type Tint = {
  // 점·띠(채운 색)
  fill: string
  // 칩 바탕 + 글자
  chip: string
  // 흰 바탕 위 부서 이름 글자
  text: string
}
export type Department = { key: string; name: string; tint: Tint }

export const DEPARTMENTS: Record<string, Department> = {
  finance: {
    key: 'finance',
    name: '재정부',
    tint: {
      fill: 'bg-category-3',
      chip: 'bg-category-3-soft text-category-3-strong',
      text: 'text-category-3-strong',
    },
  },
  planning: {
    key: 'planning',
    name: '기획부',
    tint: {
      fill: 'bg-category-5',
      chip: 'bg-category-5-soft text-category-5-strong',
      text: 'text-category-5-strong',
    },
  },
  promo: {
    key: 'promo',
    name: '홍보부',
    tint: {
      fill: 'bg-category-4',
      chip: 'bg-category-4-soft text-category-4-strong',
      text: 'text-category-4-strong',
    },
  },
  outreach: {
    key: 'outreach',
    name: '대외협력부',
    tint: {
      fill: 'bg-category-2',
      chip: 'bg-category-2-soft text-category-2-strong',
      text: 'text-category-2-strong',
    },
  },
  welfare: {
    key: 'welfare',
    name: '복지부',
    tint: {
      fill: 'bg-category-8',
      chip: 'bg-category-8-soft text-category-8-strong',
      text: 'text-category-8-strong',
    },
  },
}
// 부서 없는 업무: 회색 '학생회 업무'
export const COUNCIL_TASK: Department = {
  key: 'council',
  name: '학생회 업무',
  tint: {
    fill: 'bg-category-none',
    chip: 'bg-surface-muted text-fg-tertiary',
    text: 'text-fg-tertiary',
  },
}

export type Task = {
  id: string
  title: string
  status: Status
  dept: keyof typeof DEPARTMENTS | null
  assignee: string | null
  // 카드 안 날짜('10월 30일'). 없으면 null('마감 없음').
  due: string | null
  overdue?: boolean
  result?: boolean
}

export type Sample = {
  tasks: Task[]
  // 끝남 열을 열 때 '+ 업무 추가'가 열린 모양
  adding: boolean
}

let seq = 0
const t = (
  status: Status,
  title: string,
  dept: Task['dept'],
  assignee: string | null,
  due: string | null,
  extra: Partial<Task> = {},
): Task => ({ id: `t${++seq}`, title, status, dept, assignee, due, ...extra })

// 운영 시연 데이터(배포본 now-1920 그림) 13건. 그림에서 잘린 할 일 5·6번째는 같은 정렬(부서별: 학생회 업무가 끝)로 지었다.
// 지남 1: '학과 사무실 협조 공문 보내기'를 10월 27일로.
const MAIN: Task[] = [
  t('todo', '장소 협조', 'finance', '최유진', '2월 10일'),
  t('todo', '공연 및 이벤트', 'planning', null, null),
  t('todo', '숙소 계약금 결제', null, '김바다', '10월 30일'),
  t('todo', '학과 사무실 협조 공문 보내기', null, '김바다', '10월 27일', { overdue: true }),
  t('todo', '버스 대절 예약', null, null, '2월 3일'),
  t('todo', '새내기 명찰 제작', null, '김바다', '2월 12일'),
  t('doing', '예산안 편성', 'finance', '신예린', '2월 10일'),
  t('doing', '레크레이션 준비', 'planning', '박지민', '2월 8일'),
  t('doing', '타임테이블 작성', 'planning', '조은호', '2월 14일'),
  t('doing', '홍보물 준비', 'promo', '이지우', '2월 8일'),
  t('done', '컨셉 및 슬로건 확정', 'planning', '송태윤', '2월 1일'),
  t('done', '상품 분리', 'planning', '백승훈', null),
  t('done', '협찬 및 제휴 유치', null, '권나연', '2월 5일'),
]

const FEW: Task[] = [
  t('todo', '장소 협조', 'finance', '최유진', '2월 10일'),
  t('todo', '숙소 계약금 결제', null, '김바다', '10월 30일'),
  t('doing', '예산안 편성', 'finance', '신예린', '2월 10일'),
]

// 할 일 14 · 진행 중 6 · 끝남 8. 30자 제목 셋, 부서 다섯, 결과물 셋, 지남 둘.
const MANY: Task[] = [
  t('todo', '장소 협조', 'finance', '최유진', '2월 10일'),
  t(
    'todo',
    '버스 대절 업체 세 곳 견적 비교하고 계약금 입금 일정 정하기',
    'finance',
    '신예린',
    '11월 6일',
  ),
  t('todo', '참가비 환불 기준 정리', 'finance', null, '11월 3일'),
  t('todo', '공연 및 이벤트', 'planning', null, null),
  t('todo', '조별 레크레이션 진행자 정하기', 'planning', '박지민', '11월 10일'),
  t('todo', '둘째 날 아침 일정표', 'planning', '조은호', null),
  t(
    'todo',
    '새내기 배움터 안내 카드뉴스와 신청 링크 학과 단톡방에 올리기',
    'promo',
    '이지우',
    '10월 28일',
    { overdue: true },
  ),
  t('todo', '현수막 시안', 'promo', '한소율', '11월 4일', { result: true }),
  t('todo', '동문회 후원 요청 메일', 'outreach', '권나연', '11월 7일'),
  t('todo', '근처 식당 단체 예약', 'outreach', null, '11월 12일'),
  t('todo', '상비약·응급 키트 준비', 'welfare', '정하람', '2월 9일'),
  t('todo', '숙소 계약금 결제', null, '김바다', '10월 30일'),
  t('todo', '학과 사무실 협조 공문 보내기', null, '김바다', '10월 27일', { overdue: true }),
  t('todo', '새내기 명찰 제작', null, null, '2월 12일'),
  t('doing', '예산안 편성', 'finance', '신예린', '2월 10일', { result: true }),
  t('doing', '레크레이션 준비', 'planning', '박지민', '2월 8일'),
  t('doing', '타임테이블 작성', 'planning', '조은호', '2월 14일'),
  t('doing', '홍보물 준비', 'promo', '이지우', '2월 8일'),
  t(
    'doing',
    '협력 업체 연락처 목록 만들고 담당자별로 연락 나누기',
    'outreach',
    '권나연',
    '11월 5일',
  ),
  t('doing', '참가자 알레르기 조사', 'welfare', '정하람', '11월 2일'),
  t('done', '컨셉 및 슬로건 확정', 'planning', '송태윤', '2월 1일', { result: true }),
  t('done', '상품 분리', 'planning', '백승훈', null),
  t('done', '협찬 및 제휴 유치', null, '권나연', '2월 5일'),
  t('done', '숙소 후보 답사', 'finance', '최유진', '10월 20일'),
  t('done', '포스터 문구 정하기', 'promo', '한소율', '10월 22일'),
  t('done', '학생처 행사 신고', null, '김바다', '10월 21일'),
  t('done', '지난해 결산 확인', 'finance', '신예린', '10월 18일'),
  t('done', '설문 문항 만들기', 'welfare', '정하람', '10월 24일'),
]

export const SAMPLES: Record<DataName, Sample> = {
  main: { tasks: MAIN, adding: false },
  few: { tasks: FEW, adding: false },
  many: { tasks: MANY, adding: false },
  adding: { tasks: MAIN, adding: true },
}

export const deptOf = (task: Task): Department =>
  task.dept ? (DEPARTMENTS[task.dept] ?? COUNCIL_TASK) : COUNCIL_TASK

export const byStatus = (tasks: Task[], status: Status) =>
  tasks.filter(task => task.status === status)

// 거르기 칩의 수(끝나지 않은 업무). 지남·마감 없음은 0이면 숨기고, 담당자 없음은 늘 보인다(명세 3절 1).
export function chipCounts(tasks: Task[]) {
  const open = tasks.filter(task => task.status !== 'done')
  const depts: Department[] = []
  for (const task of tasks) {
    if (!task.dept) continue
    const dept = DEPARTMENTS[task.dept]
    if (dept && !depts.includes(dept)) depts.push(dept)
  }
  const order = Object.keys(DEPARTMENTS)
  depts.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
  return {
    overdue: open.filter(task => task.overdue).length,
    unassigned: open.filter(task => !task.assignee).length,
    noDue: open.filter(task => !task.due).length,
    depts,
  }
}

// 머리글자: 성을 뺀 이름(홈 f8 Face와 같음). 두 자 이하는 그대로.
export const initialsOf = (name: string) => (name.length >= 3 ? name.slice(1) : name)

// 끝남 열 상한(DEC-94)
export const DONE_LIMIT = 50
export const countText = (n: number) => (n > DONE_LIMIT ? `${DONE_LIMIT}+` : String(n))

// 휴대폰 목록은 지금처럼 정렬 '부서별' 묶음(부서 차례, 학생회 업무가 끝).
export function groupByDept(tasks: Task[]): { dept: Department; tasks: Task[] }[] {
  const keys = [...Object.keys(DEPARTMENTS), null]
  return keys
    .map(key => ({
      dept: key ? (DEPARTMENTS[key] ?? COUNCIL_TASK) : COUNCIL_TASK,
      tasks: tasks.filter(task => task.dept === key),
    }))
    .filter(group => group.tasks.length > 0)
}
