import permissionsJson from '../../../../../specs/figma/vada-wireframe/permissions.json'
import type { DataRow } from '../../data-sources/definitions'
import { matchesQuery } from './search'

// 역할 및 권한(ORG-04). **표를 여기 두지 않는다** — 열세 줄이 여기에도 있고
// 명세에도 있으면 언젠가 갈리고, 갈린 쪽이 어느 쪽인지 아무도 모른다.
//
// 규칙은 `specs/figma/vada-wireframe/permissions.json`에 있다. 여기서는 그중
// 표에 그리는 줄만 꺼내 칸에 들어갈 말로 옮긴다. 칸에 오는 것은 '되는가'가
// 아니라 '어떤 조건에서 되는가'이므로 완성된 말과 색 이름이 함께 온다.
const PERMISSION_MATRIX: DataRow[] = permissionsJson.areas
  .filter((area) => area.drawnInMatrix)
  .map((area) => ({
    id: area.key,
    area: area.name,
    chair: area.rules.chair.label!,
    // '가능'은 초록, 조건이 붙으면 노랑, 못 하면 무채색이다. 색 이름을 데이터가
    // 주는 이유는 조건이 하나 늘 때 화면이 짐작하지 않게 하기 위해서다.
    chairTone: permissionTone(area.rules.chair.label!),
    head: area.rules.head.label!,
    headTone: permissionTone(area.rules.head.label!),
    member: area.rules.member.label!,
    memberTone: permissionTone(area.rules.member.label!),
  }))

function permissionTone(label: string): string {
  if (label === '가능') return 'green'
  if (label === '—') return 'gray'
  return 'yellow'
}

// 초대 코드가 찾아낸 학생회(INV-01). **코드마다 다른 학생회가 나온다** — 그 전에는
// 명세가 이름을 고정 글로 들고 있어서 어떤 코드를 넣어도 같은 학생회가 나왔다.
const INVITED_ORGANIZATIONS: Record<string, DataRow> = {
  AB12CD34: {
    name: '제12대 소프트웨어융합대학 학생회',
    kind: '단과대 학생회',
    scope: '한양대학교 ERICA · 소프트웨어융합대학',
    term: '2026년',
  },
  // 코드가 다르면 다른 학생회다. 이 줄이 없으면 '코드마다 다르다'가 말뿐이 된다.
  EF56GH78: {
    name: '제9대 컴퓨터학부 학생회',
    kind: '학부 학생회',
    scope: '한양대학교 ERICA · 컴퓨터학부',
    term: '2026년',
  },
}

const ROLE_ASSIGNMENTS: DataRow[] = [
  { id: 'M-01', name: '김바다', department: '학술체육부', roleLabel: '회장단', roleTone: 'violet', role: 'chair' },
  { id: 'M-11', name: '이수현', department: '기획부', roleLabel: '부서장', roleTone: 'blue', role: 'head' },
  { id: 'M-02', name: '이윤슬', department: '홍보부', roleLabel: '부서장', roleTone: 'blue', role: 'head' },
  { id: 'M-12', name: '김민준', department: '재정부', roleLabel: '부서장', roleTone: 'blue', role: 'head' },
  { id: 'M-03', name: '박해랑', department: '운영부', roleLabel: '부원', roleTone: 'gray', role: 'member' },
  { id: 'M-07', name: '정하늘', department: '운영부', roleLabel: '부원', roleTone: 'gray', role: 'member' },
  { id: 'M-13', name: '박민수', department: '기획부', roleLabel: '부원', roleTone: 'gray', role: 'member' },
]

const ORG_DEPARTMENTS: DataRow[] = [
  {
    id: 'D-01',
    name: '기획부',
    memberCountLabel: '부원 2명',
    leaders: [{ id: 'M-03', name: '박해랑', major: '컴퓨터학부', grade: '3학년' }],
    members: [
      { id: 'M-04', name: '박해랑', major: '컴퓨터학부', grade: '2학년' },
      { id: 'M-05', name: '이윤슬', major: 'ICT융합학부', grade: '4학년' },
    ],
  },
  {
    id: 'D-02',
    name: '홍보부',
    memberCountLabel: '부원 2명',
    leaders: [],
    members: [
      { id: 'M-06', name: '이윤슬', major: 'ICT융합학부', grade: '4학년' },
      { id: 'M-07', name: '정하늘', major: '컴퓨터학부', grade: '3학년' },
    ],
  },
  {
    id: 'D-03',
    name: '디자인부',
    memberCountLabel: '부원 1명',
    leaders: [],
    members: [{ id: 'M-08', name: '정하늘', major: '컴퓨터학부', grade: '3학년' }],
  },
  {
    id: 'D-04',
    name: '운영부',
    memberCountLabel: '부원 1명',
    leaders: [],
    members: [{ id: 'M-10', name: '박해랑', major: '컴퓨터학부', grade: '2학년' }],
  },
  {
    id: 'D-05',
    name: '재정부',
    memberCountLabel: '부원 1명',
    leaders: [],
    members: [{ id: 'M-09', name: '김민준', major: '컴퓨터학부', grade: '4학년' }],
  },
]

// 아직 어느 자리에도 없는 사람들. 디자인이 둘을 그렸다.
// **id가 겹치면 안 된다.** 한 사람은 정확히 한 자리에 있다는 것이 이 화면의
// 규칙이고, 같은 id가 부서와 여기에 함께 있으면 옮기기가 무엇을 옮기는지
// 말할 수 없다. 와이어프레임이 같은 이름을 예시로 되풀이해 쓸 뿐이다.
const UNASSIGNED_MEMBERS: DataRow[] = [
  { id: 'M-09', name: '정하늘', major: '컴퓨터학부', grade: '3학년' },
  { id: 'M-10', name: '박해랑', major: '컴퓨터학부', grade: '2학년' },
]

// 학생 명단(ORG-07A). 디자인이 그린 여덟 줄 그대로다.
//
// **rowTone은 대부분 비어 있다.** 손봐야 하는 줄에만 색 이름이 오고, 그 줄은
// 명단과 납부 기록이 어긋나 사람이 확인해야 하는 학생이다.
const STUDENT_ROSTER: DataRow[] = [
  ['S-01', '김바다', '2022123456', '3학년', '납부', 'green', ''],
  ['S-02', '박해랑', '2023234567', '2학년', '납부', 'green', ''],
  ['S-03', '이윤슬', '2020345678', '4학년', '미납', 'red', ''],
  ['S-04', '정하늘', '2022456789', '3학년', '미납', 'red', ''],
  ['S-05', '최바람', '2021567890', '3학년', '확인 필요', 'yellow', 'yellow'],
  ['S-06', '강별', '2024678901', '1학년', '납부', 'green', ''],
  ['S-07', '오하늘', '2023789012', '2학년', '납부', 'green', ''],
  ['S-08', '윤서진', '2022890123', '3학년', '미납', 'red', ''],
].map(([id, name, studentNumber, grade, duesLabel, duesTone, rowTone]) => ({
  id,
  name,
  studentNumber,
  // 관리 범위가 컴퓨터학부 하나라 여덟 줄이 다 같다. 그래도 조각으로 온다 -
  // 범위가 넓어지면 줄마다 갈린다.
  college: '소프트웨어융합대학',
  department: '컴퓨터학부',
  grade,
  duesLabel,
  duesTone,
  rowTone,
}))

const DUES_BY_STATUS: Record<string, string> = {
  paid: '납부',
  unpaid: '미납',
  check: '확인 필요',
}

export const ORGANIZATION_DASHBOARD_FIXTURES: Record<string, DataRow | DataRow[]> = {
  // 조직 관리 홈(ORG-00). 디자인이 그린 그대로의 한 줄이다 - 셈한 숫자가 아니라
  // 서버가 완성해 보내는 문장이라는 것이 이 출처의 계약이다.
  'org.areaSummaries': {
    departments: '부서 5개 · 구성원 18명',
    students: '학생 1,284명 · 최근 갱신 07.01',
    roles: '기본 역할 3종 · 확정된 권한 매트릭스',
  },
  'org.chartTitle': { name: '제12대 소프트웨어융합대학 학생회' },
  // 그림이 그린 이름이다(ORG-03D). 묻는 말은 서버가 만든다 — 화면이
  // '{이름} 님을'을 잇지 않는다.
  'org.memberToRemove': { question: '김바다 님을 내보낼까요?', name: '김바다' },
  'org.roleCounts': { chairCount: 1, headCount: 3, memberCount: 3 },
  'org.roleAssignmentCount': { total: '7명' },
  'org.rosterScope': {
    path: '한양대학교 ERICA › 소프트웨어융합대학 › 컴퓨터학부',
    note: '컴퓨터학부 학생만 이 명단에 등록할 수 있습니다. 범위 변경은 조직 설정에서 가능합니다.',
    rosterUpdatedAt: '2026-07-20 14:32',
    rosterUpdatedBy: '학생 명단 업로드 · 이지원',
    duesUpdatedAt: '2026-07-18 10:15',
    duesUpdatedBy: '2026년 1학기 · 김민준',
  },
  'org.roleAssignments': ROLE_ASSIGNMENTS,
  'org.unassignedHint': { hint: '2명 · 드래그해서 부서로 이동' },
  'org.invite': {
    stateLabel: '활성',
    stateTone: 'green',
    stateNote: '현재 사용할 수 있는 초대 정보입니다.',
    regeneratedNote: '마지막 재생성: 2026.07.22 18:30',
    url: 'https://vada.app/join/swcollege12/abc123xyz',
    code: 'AB12CD34',
  },

  // 조직도(ORG-03A). 디자인이 그린 그대로다 - 회장단 둘, 부서 셋이고
  // **기획부만 부서장이 있다.** 그 없음이 '＋ 부서장 지정'을 부르는 자리다.
  'org.executives': [
    {
      id: 'M-01',
      name: '김바다',
      major: '컴퓨터학부',
      grade: '3학년',
      roleLabel: '회장',
      roleTone: 'yellow',
    },
    {
      id: 'M-02',
      name: '이윤슬',
      major: 'ICT융합학부',
      grade: '4학년',
      roleLabel: '부회장',
      roleTone: 'blue',
    },
  ],
  'org.permissionMatrix': PERMISSION_MATRIX,
}

function filterStudents({
  query = '',
  grade = '',
  duesStatus = '',
}: Record<string, string>): DataRow[] {
  return STUDENT_ROSTER.filter((row) => matchesQuery(row, query))
    .filter((row) => grade === '' || row.grade === grade)
    .filter(
      (row) =>
        duesStatus === '' ||
        duesStatus === 'all' ||
        row.duesLabel === DUES_BY_STATUS[duesStatus],
    )
}

export const ORGANIZATION_FILTERED_FIXTURES: Record<
  string,
  (params: Record<string, string>) => DataRow[]
> = {
  // 미배정 구성원은 이름으로 거른다. 조직도를 고치는 화면(ORG-03B)의 오른쪽 칸이다.
  // 부서는 이름으로 좁혀 볼 수 있다(MSG-02의 '이름 검색'). 부서 이름을 찾는 것인지
  // 그 안의 사람 이름을 찾는 것인지 그림이 말하지 않아 서버가 정한다 — 개발용
  // 응답은 부서 이름만 본다(matchesQuery가 중첩 목록을 들여다보지 않는다).
  'org.departments': ({ query = '' }) =>
    ORG_DEPARTMENTS.filter((row) => matchesQuery(row, query)),
  'org.unassignedMembers': ({ query = '' }) =>
    UNASSIGNED_MEMBERS.filter((row) => matchesQuery(row, query)),
  // **고른 사람은 자리가 말한다.** 한동안 서버가 '마지막으로 고른 사람'을 기억해
  // 주고 있었는데, 그것은 사람마다 다른 서버 상태라 두 사람이 같은 화면을 열면
  // 서로의 고른 것을 본다. 이제 인자로 집어 온다.
  'org.selectedRoleAssignment': ({ memberId = '' }) =>
    ROLE_ASSIGNMENTS.filter((row) => row.id === memberId),
  // 학생 명단은 이름·학번으로 찾고 학년·납부 상태로 거른다.
  'org.students': filterStudents,
  'org.studentPaging': (params) => {
    const rows = filterStudents(params)
    // 총 건수는 거른 뒤의 것이다 - 화면이 세지 않고 서버가 말한다.
    return [{ totalNote: `총 ${rows.length}명`, pageCount: 1 }]
  },
  // 없는 코드면 빈 목록이고, 그것은 '개발용 응답이 없다'가 아니라 **그런 학생회가
  // 없다**다(readDataSource가 NOT_FOUND로 가른다).
  'org.invitedOrganization': ({ inviteCode = '' }) => {
    const row = INVITED_ORGANIZATIONS[inviteCode]
    return row === undefined ? [] : [row]
  },
}
