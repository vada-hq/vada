import type { DataRow } from '../../data-sources/definitions'
import {
  EVENT_SUMMARIES,
  EVENT_WORKSPACES,
  EVENT_WRAP_UP_BANNER,
  EVENT_WRAP_UP_COUNTS,
  WRAP_UP_EVENT,
} from './event-state'

// ─── 행사 기본정보 편집 초안(EVT-02B) ───────────────────────────────────────
//
// event.basics와 **다른 조각이다.** 저기는 그려진 한 줄('납부자 무료 / 미납자
// 5000원')을 주고 이것은 고칠 칸 하나하나를 준다. 두 벌이 어긋나지 않도록 값은
// EVENT_OVERVIEW.basics와 EVENT_LIST에서 옮겼다.
//
// 비어 있는 칸은 아예 넣지 않는다 — 카탈로그가 optional로 두었고, 와이어프레임도
// 그 칸들을 안내 문구만 있는 빈 칸으로 그렸다.
export const EVENT_BASICS_DRAFT: Record<string, DataRow> = {
  'E-01': {
    title: '2026 소프트웨어융합대학 체육대회',
    startAt: '2026-08-20T10:00',
    endAt: '2026-08-20T14:00',
    place: 'ERICA 체육관',
    address: '경기 안산시 상록구 한양대학로 55',
    audience: '소프트웨어융합대학 전체',
    feeType: 'duesConditional',
    paidAmount: '0',
    unpaidAmount: '5000',
    capacityType: 'limited',
    capacity: '200',
    hostDepartment: '학술체육부',
    hostPerson: '김바다',
    contact: '카카오톡 채널 @swcollege',
  },
  'E-02': {
    title: '봄 축제 학생회 부스',
    place: '한양대 ERICA 잔디밭',
    feeType: 'free',
    capacityType: 'unlimited',
    hostDepartment: '대외협력부',
  },
  // 아직 기본 정보를 채우지 않은 행사. 행사 목록이 그 줄에 '기본 정보 입력 필요'만
  // 그린 것이 이 상태다 — 유형 둘은 카탈로그가 늘 온다고 했으므로 '미정'으로 온다.
  'E-03': {
    title: '2026 신입생 환영 행사',
    feeType: 'undecided',
    capacityType: 'undecided',
  },
}

// ─── 행사를 끝내고 완료하는 자리(EVT-02C · EVT-02E) ─────────────────────────
//
// 둘 다 **역할 이름을 화면이 들지 않는 자리**다. 누가 종료할 수 있고 누가 완료
// 처리할 수 있는지는 조직의 규칙이라 서버가 완성한 글로 온다 — 명세가 적으면
// 규칙이 바뀔 때마다 명세가 틀린다(event.wrapUpBanner.permissionNote와 같다).

// 종료를 누른 사람에게 권한이 없을 때(EVT-02C). 와이어프레임이 배경으로 그린 것이
// 기획 중 개요이므로 그 행사(E-01)에 붙인다.
export const EVENT_END_PERMISSION: Record<string, DataRow> = {
  'E-01': {
    title: '이 행사를 종료할 권한이 없습니다',
    note: '행사 종료는 행사 운영 조직 관리자 또는 회장단만 할 수 있습니다.',
  },
}

// 완료 처리해도 되는지 살펴 준 것(EVT-02E). **막지 않는다** — 남은 것이 있어도
// 알려 줄 뿐이다.
//
// 남은 업무 수를 여기 다시 적지 않는다. 후속 정리 현황의 타일과 같은 것이므로
// 그 값에서 만든다 — 두 벌을 손으로 쓰면 한쪽만 고쳐지고, 그 어긋남이 재정 보드와
// 요청 상세에서 이미 한 번 났다.
export const EVENT_COMPLETE_CONFIRM: Record<string, DataRow> = {
  [WRAP_UP_EVENT]: {
    warningNote: `미완료 업무 ${String(EVENT_WRAP_UP_COUNTS[WRAP_UP_EVENT].unfinishedTasks)}`,
    // 타일은 red인데 이 상자는 orange다. 같은 사실이라도 그려지는 자리가 다르면
    // 색이 다르고, 그래서 색 이름을 데이터가 갖는다(design 20:6339).
    warningTone: 'orange',
    permissionNote: EVENT_WRAP_UP_BANNER[WRAP_UP_EVENT].permissionNote,
  },
}

// ─── 행사 운영 조직(EVT-03A) ───────────────────────────────────────────────
//
// 디자인이 그린 그대로다 - 책임자 하나, 부서 셋이고 **홍보팀만 부서장이 없다.**
// 그 없음이 부서장을 지정하라는 자리를 부른다.
//
// 학생회의 조직도(org.executives·org.departments)와 모양이 같고 물건이 다르다 -
// 저기는 학생회가 늘 갖는 조직이고 여기는 이 행사에만 있는 조직이라 행사마다 따로 온다.
export const EVENT_STAFF_LEADERS: Record<string, DataRow[]> = {
  'E-01': [
    {
      id: 'ES-01',
      name: '김바다',
      major: '컴퓨터학부',
      grade: '3학년',
      roleLabel: '책임자',
      roleTone: 'yellow',
    },
  ],
}

export const EVENT_STAFF_DEPARTMENTS: Record<string, DataRow[]> = {
  'E-01': [
    {
      id: 'ED-01',
      name: '운영팀',
      memberCountLabel: '부원 2명',
      leaders: [{ id: 'ES-02', name: '이윤슬', major: '컴퓨터학부', grade: '3학년' }],
      members: [
        { id: 'ES-03', name: '김바다', major: '컴퓨터학부', grade: '3학년' },
        { id: 'ES-04', name: '박해랑', major: '컴퓨터학부', grade: '2학년' },
      ],
    },
    {
      id: 'ED-02',
      name: '홍보팀',
      memberCountLabel: '부원 1명',
      leaders: [],
      members: [{ id: 'ES-05', name: '이윤슬', major: 'ICT융합학부', grade: '4학년' }],
    },
    {
      id: 'ED-03',
      name: '현장팀',
      memberCountLabel: '부원 1명',
      leaders: [{ id: 'ES-06', name: '정하늘', major: '컴퓨터학부', grade: '3학년' }],
      members: [
        // 이 사람만 부서장을 겸한다. 그 사실은 leaders로는 알 수 없다 —
        // 부원 줄에 무엇이 그려지는지는 그 줄의 조각이 말해야 한다.
        {
          id: 'ES-07',
          name: '정하늘',
          major: '컴퓨터학부',
          grade: '3학년',
          roleLabel: '· 부서장',
          roleTone: 'yellow',
        },
      ],
    },
  ],
  // E-03은 자리를 만들지 않는다. 아직 조직을 구성하지 않은 행사이고, 그 상태를
  // 그린 것이 EVT-03C다 - 목록이 비는 것이지 행사가 없는 것이 아니다.
}

// 운영 조직을 세울 때의 미리보기(EVT-01). event.staffDepartments가 **이미 있는**
// 조직을 말하는 반면 이것은 고른 방식으로 **만들어질** 조직이라 조회 인자에
// 방식이 함께 든다(setupMode).
//
// 행사가 아니라 방식이 정한다 - '기본 조직 불러오기'는 학생회의 기본 조직을
// 그대로 가져오는 것이므로 어느 행사에서 열든 같은 것이 온다.
export const EVENT_STAFF_SETUP_PREVIEW: Record<string, DataRow[]> = {
  // 두 벌로 적으면 한쪽만 고쳐진다. 만들어질 것이 곧 기본 조직이다.
  copyBase: EVENT_STAFF_DEPARTMENTS['E-01'],
  // 부서만 가져오고 사람은 만든 뒤에 배정한다.
  pickDepartments: EVENT_STAFF_DEPARTMENTS['E-01'].map((row) => ({
    ...row,
    memberCountLabel: '부원 0명',
    leaders: [],
    members: [],
  })),
  empty: [],
}

// EVT-03B의 오른쪽 기둥. **카탈로그는 '미배정'이라 부르는데 디자인은 '기본 조직
// 구성원'이라 적고 부서에 이미 든 사람을 그대로 그렸다**(20:7302). 그래서 부서의
// 부원과 같은 id를 쓴다 - 다른 id를 주면 한 사람이 두 사람이 되고, 자리에서 뺀
// 사람이 명단에 두 번 나온다.
export const EVENT_STAFF_UNASSIGNED: Record<string, DataRow[]> = {
  'E-01': [
    { id: 'ES-03', name: '김바다', major: '컴퓨터학부', grade: '3학년' },
    { id: 'ES-04', name: '박해랑', major: '컴퓨터학부', grade: '2학년' },
    { id: 'ES-05', name: '이윤슬', major: 'ICT융합학부', grade: '4학년' },
    { id: 'ES-07', name: '정하늘', major: '컴퓨터학부', grade: '3학년' },
  ],
}

// 조직이 아직 없는 행사. **E-02를 쓸 수 없다** - 그쪽은 끝나고 정리 중인 행사라
// 조직이 없을 수 없다. 값은 행사 목록(EVT-00A)이 그린 '2026 신입생 환영 행사'의
// 줄에서 옮겼다. 그 줄이 '기본 정보 입력 필요 / 일시 미정 / 담당 미정'이다.
const UNSTAFFED_EVENT = 'E-03'

// 작업 공간의 머리가 이 둘을 한 건씩 집어 오므로, 없으면 빈 상태를 열기도 전에
// readObjectSource가 던진다.
EVENT_WORKSPACES[UNSTAFFED_EVENT] = {
  status: '기획 중',
  statusKey: 'planning',
  statusTone: 'blue',
  host: '담당 미정',
  startAt: '일시 미정',
  nextSchedule: '다음 일정 · 미정',
  permissionNote: '행사 관리 행동은 담당 운영진에게 제공됩니다.',
}

EVENT_SUMMARIES[UNSTAFFED_EVENT] = {
  title: '2026 신입생 환영 행사',
  schedule: '일시 미정 · 장소 미정',
  dday: '일정 미정',
  progressPercent: 0,
  progressLabel: '0 / 0 완료',
}
