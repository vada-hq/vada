// 개발용 응답. 값은 figma.design.json이 그린 예시를 그대로 옮긴 것이라
// 구현 화면과 reference.png를 눈으로 대조할 수 있다. 백엔드가 붙으면
// catalog.ts의 request.path로 대체된다.
import permissionsJson from '../../../../specs/figma/vada-wireframe/permissions.json'
import type { DataRow } from '../data-sources/definitions'
import { ATTENDANCE_FILTERED_FIXTURES } from './fixtures/attendance'
import {
  EVENT_DASHBOARD_FIXTURES,
  EVENT_FILTERED_FIXTURES,
  EVENT_TASK_FILTERED_FIXTURES,
} from './fixtures/events'
import { FINANCE_DASHBOARD_FIXTURES, FINANCE_FILTERED_FIXTURES } from './fixtures/finance'
import {
  MEETING_DASHBOARD_FIXTURES,
  MEETING_FILTERED_FIXTURES,
} from './fixtures/meetings'
import { matchesQuery } from './fixtures/search'
import { SURVEY_FILTERED_FIXTURES } from './fixtures/surveys'
import { TASK_DASHBOARD_FIXTURES } from './fixtures/tasks'

// 목록의 머리. 몇 건이 미발행인지는 서버가 세고 화면은 그 문구만 그린다 —
// 검색으로 목록이 걸러져도 이 수는 걸러지지 않는다.
const COMPLETED_EVENT_ALERT: DataRow = { unpublishedNote: '인수인계 문서 미발행 2건' }

// 셋이 저마다 다른 단계다. **셋째에는 actionLabel이 오지 않고 blockedNote가 대신
// 온다** — 갈 곳이 없는 항목에는 그 문구가 오지 않는다는 규칙(event.checklist의
// actionLabel·targetKind와 같은 자리).
const COMPLETED_EVENTS: DataRow[] = [
  {
    id: 'E-REC-01',
    statusLabel: '완료',
    archiveStatus: '발행 v1.0',
    archiveStatusTone: 'green',
    title: '봄 축제 학생회 부스',
    date: '2026. 05. 28',
    host: '대외협력부',
    highlights: [
      { label: '186명 참석 (신청 210명)' },
      { label: '예산 집행 92%' },
      { label: '완료 업무 14건' },
    ],
    completedNote: '완료 처리 2026. 06. 04',
    actionLabel: '상세 보기 →',
    // 발행된 문서는 읽는 화면으로 간다.
    targetKind: 'published',
  },
  {
    id: 'E-REC-02',
    statusLabel: '완료',
    archiveStatus: '검토 중',
    archiveStatusTone: 'blue',
    title: '2025 학년도 종강 행사',
    date: '2025. 12. 19',
    host: '학술체육부',
    highlights: [
      { label: '320명 참석 (신청 356명)' },
      { label: '예산 집행 88%' },
      { label: '완료 업무 21건' },
    ],
    completedNote: '완료 처리 2026. 01. 07',
    actionLabel: '상세 보기 →',
    // **아직 발행되지 않았으므로 쓰고 검토받는 화면으로 간다.** 그것이 REC-02A로
    // 들어가는 문이다 — 그 전에는 주소로만 열렸다.
    targetKind: 'draft',
  },
  {
    id: 'E-REC-03',
    statusLabel: '완료',
    archiveStatus: '인수인계 문서 미발행',
    archiveStatusTone: 'gray',
    title: '2025 신입생 환영회',
    date: '2025. 03. 14',
    host: '홍길동',
    highlights: [
      { label: '210명 참석 (신청 240명)' },
      { label: '예산 집행 95%' },
      { label: '완료 업무 9건' },
    ],
    completedNote: '완료 처리 2025. 03. 28',
    blockedNote: '인수인계 문서가 아직 발행되지 않았습니다',
  },
]

// 문서 자체. 발행 전에도 있다 — 쓰는 화면은 이름과 상태만 읽는다.
const ARCHIVE_AI_DISCLAIMER =
  'AI 초안은 이 행사의 업무·회의·문서·정산 기록만 재구성하며, 기록에 없는 자산·연락처·담당자를 새로 만들지 않습니다. 생성 후 반드시 검토·수정해 확정하세요.'

const RECORD_ARCHIVES: Record<string, DataRow> = {
  'E-REC-01': {
    title: '봄 축제 학생회 부스',
    statusLabel: '발행 v1.0',
    statusTone: 'green',
    scheduleNote: '2026. 05. 28 (목) 11:00–17:00',
    ownerNote: '대외협력부 · 책임자 이윤슬',
    publishedNote: '발행 2026. 06. 04',
    authorNote: '작성 이윤슬',
    reviewerNote: '검토 김바다 (회장단)',
    nextOwnerNote: '다음 담당: 대외협력부 부서장',
  },
  // 아직 발행되지 않은 문서. **본문은 E-REC-01의 것을 그대로 쓴다** — 검토 중인
  // 아카이브를 따로 그린 프레임이 없으므로 지어내지 않는다.
  'E-REC-02': {
    title: '2025 학년도 종강 행사',
    statusLabel: '검토 중',
    statusTone: 'blue',
    scheduleNote: '2025. 12. 19 (금) 18:00–21:00',
    ownerNote: '학술체육부 · 책임자 김바다',
    nextOwnerNote: '다음 담당: 학술체육부 부서장',
  },
  // 아직 아무것도 쓰지 않은 문서(REC-02A가 여는 그것).
  'E-REC-03': {
    title: '2025 신입생 환영회',
    statusLabel: '인수인계 문서 미발행',
    statusTone: 'gray',
    aiDisclaimer: ARCHIVE_AI_DISCLAIMER,
  },
}

// 목차. 발행된 문서는 회고가 세 갈래로 펴지고, 쓰는 중인 문서는 절마다 어디까지
// 왔는지가 함께 온다. 같은 목록을 두 화면이 다르게 그린다.
const PUBLISHED_SECTIONS: DataRow[] = [
  { key: 'overview', label: '개요' },
  { key: 'outcome', label: '성과' },
  { key: 'timeline', label: '타임라인' },
  { key: 'onSite', label: '현장 운영' },
  { key: 'evidence', label: '근거 자료' },
  {
    key: 'retro',
    label: '회고',
    rows: [
      { key: 'retroGood', label: '잘된 점' },
      { key: 'retroIssues', label: '미흡했던 점' },
      { key: 'retroImprovements', label: '개선안' },
    ],
  },
  { key: 'handover', label: '인수인계' },
]

const DRAFT_SECTIONS: DataRow[] = [
  { key: 'overview', label: '개요', statusLabel: '자동', statusTone: 'gray' },
  { key: 'outcome', label: '성과', statusLabel: '자동', statusTone: 'gray' },
  { key: 'timeline', label: '타임라인', statusLabel: '자동', statusTone: 'gray' },
  { key: 'evidence', label: '근거 자료', statusLabel: '자동', statusTone: 'gray' },
  { key: 'onSite', label: '현장 운영', statusLabel: '작성 전', statusTone: 'orange' },
  { key: 'retro', label: '회고', statusLabel: '작성 전', statusTone: 'orange' },
  { key: 'handover', label: '인수인계', statusLabel: '작성 전', statusTone: 'orange' },
]

const RECORD_ARCHIVE_SECTIONS: Record<string, DataRow[]> = {
  'E-REC-01': PUBLISHED_SECTIONS,
  'E-REC-02': PUBLISHED_SECTIONS,
  'E-REC-03': DRAFT_SECTIONS,
}

// 라벨이 고정된 열세 조각. 값만 서버가 준다.
const ARCHIVE_DETAIL: DataRow = {
  goal: '재학생 교류 확대와 학생회 활동 홍보',
  audience: '소프트웨어융합대학 재학생 전체',
  scheduleAndPlace: '2026. 05. 28 11:00–17:00 · 한양대 ERICA 잔디밭',
  owner: '대외협력부 · 이윤슬',
  scale: '부스 4개 · 운영 인력 12명 · 참석 186명',
  attendance: '신청 210명 → 참석 186명 (88.6%)',
  satisfaction: '설문 응답 142건 · 긍정 89%',
  budget: '계획 1,200,000원 → 집행 1,104,000원 (92%)',
  taskCompletion: '전체 14건 완료 · 지연 2건',
  runOrder: '09:00 설치 → 11:00 개장 → 14:00 경품 추첨 → 16:30 정리 → 17:00 철수',
  staffing: '부스별 2명 · 안내 2명 · 물품 관리 1명 · 총괄 1명',
  incident: '13시경 강풍으로 배너 2개 전도. 즉시 고정 추가 후 재설치',
  operationChange: '대기 인원이 몰려 경품 추첨을 30분 앞당김',
}

const ARCHIVE_TIMELINE: DataRow[] = [
  { id: 'T-1', date: '04. 12', title: '기획 확정', description: '부스 4종 구성과 예산 규모를 운영회의에서 승인' },
  { id: 'T-2', date: '04. 26', title: '주요 의사결정', description: '우천 대비 실내 대체 장소를 학생회관 1층으로 확정' },
  { id: 'T-3', date: '05. 08', title: '업무 지연', description: '현수막 제작이 업체 사정으로 5일 지연 · 대체 업체로 변경' },
  { id: 'T-4', date: '05. 20', title: '일정 변경', description: '종료 시각을 16:00 → 17:00으로 연장' },
  { id: 'T-5', date: '05. 28', title: '행사 진행', description: '부스 4개 정상 운영 · 참석 186명' },
  { id: 'T-6', date: '06. 04', title: '행사 종료·정산', description: '정산 완료 및 완료 처리' },
]

// 갈 곳은 데이터가 준 열쇠(targetKind)로 명세가 정한다. 데이터가 화면 이름을
// 직접 주면 검증기가 그 화면이 있는지 확인할 수 없다.
const ARCHIVE_EVIDENCE: DataRow[] = [
  { id: 'EV-1', title: '행사 업무', detail: '14건 (완료 12 · 지연 2)', actionLabel: '원본 보기 →', targetKind: 'tasks' },
  { id: 'EV-2', title: '관련 회의', detail: '3건 · 결정 5건', actionLabel: '원본 보기 →', targetKind: 'meetings' },
  { id: 'EV-3', title: '행사 문서', detail: '8건 (사양서·시안·정산 근거)', actionLabel: '원본 보기 →', targetKind: 'documents' },
  { id: 'EV-4', title: '정산', detail: '구매 요청 6건 · 집행 1,104,000원', actionLabel: '원본 보기 →', targetKind: 'finance' },
]

const ARCHIVE_RETRO: DataRow[] = [
  {
    groupLabel: '잘된 점',
    rows: [
      { key: 'G-1', label: '부스별 담당자를 미리 2명씩 배치해 공백이 없었다' },
      { key: 'G-2', label: '우천 대비 장소를 사전에 확정해 당일 혼선이 없었다' },
    ],
  },
  {
    groupLabel: '미흡했던 점',
    rows: [
      { key: 'B-1', label: '현수막 제작이 5일 지연됐다', causeNote: '원인 · 업체 확정을 행사 3주 전에 시작했다' },
      { key: 'B-2', label: '경품 대기 줄 관리가 미흡했다', causeNote: '원인 · 대기 동선을 사전에 정하지 않았다' },
    ],
  },
  {
    groupLabel: '다음 행사 개선안',
    rows: [
      { key: 'I-1', label: '제작물 업체는 행사 6주 전까지 확정한다', ownerLabel: '홍보부' },
      { key: 'I-2', label: '대기 인원이 몰리는 프로그램은 동선과 번호표를 사전에 준비한다', ownerLabel: '운영부' },
    ],
  },
]

// 주의사항만 색 이름을 갖는다 — 나머지 줄은 무채색이다.
const ARCHIVE_HANDOVER: DataRow[] = [
  {
    groupLabel: '재사용 자산',
    rows: [
      { key: 'A-1', label: '· 부스 배치도 (재사용 가능)' },
      { key: 'A-2', label: '· 참가 안내 포스터 원본 파일' },
      { key: 'A-3', label: '· 경품 수령 확인 서식' },
    ],
  },
  {
    groupLabel: '협력처·담당자',
    rows: [
      { key: 'P-1', label: '현수막 제작', value: '한빛기획 · 031-000-0000' },
      { key: 'P-2', label: '경품 납품', value: '새봄상사 · 031-111-1111' },
    ],
  },
  {
    groupLabel: '주의사항',
    rows: [
      { key: 'C-1', label: '⚠ 잔디밭 사용은 총무처 사전 승인이 필요하다 (2주 소요)', tone: 'orange' },
      { key: 'C-2', label: '⚠ 강풍 시 배너 고정 추가가 필수다', tone: 'orange' },
    ],
  },
]

const ARCHIVE_CHECKLIST: DataRow[] = [
  {
    groupLabel: '대외협력부',
    rows: [
      { key: 'K-1', label: '장소 사용 승인 절차 확인', done: 'false' },
      { key: 'K-2', label: '협력처 연락처 갱신', done: 'false' },
    ],
  },
  {
    groupLabel: '홍보부',
    rows: [
      { key: 'K-3', label: '제작물 일정 6주 전 착수', done: 'false' },
      { key: 'K-4', label: '포스터 원본 파일 인수', done: 'false' },
    ],
  },
  {
    groupLabel: '운영부',
    rows: [
      { key: 'K-5', label: '대기 동선 계획 수립', done: 'false' },
      { key: 'K-6', label: '현장 물품 목록 점검', done: 'false' },
    ],
  },
]

// 쓰는 중인 아카이브(REC-02A). 자동으로 채워지는 넷과 사람이 쓰는 칸이 갈린다.
const ARCHIVE_AUTO_FILLED: Record<string, DataRow> = {
  'E-REC-03': {
    overview: '2025 신입생 환영회 · 2025. 03. 14 · 담당 홍길동 · 책임자 홍길동 · 210명 참석 (신청 240명)',
    outcome: '210명 참석 (신청 240명) · 예산 집행 95% · 완료 업무 9건',
    timeline: '행사 2025. 03. 14 → 완료 처리 2025. 03. 28 · 참석자 210명 · 참여 설문 완료',
    evidence: '완료 업무 9건 · 회의·문서·구매 연결 데이터 없음',
  },
}

// 아직 아무것도 쓰지 않았다. 조각이 통째로 오지 않는 것과 빈 글이 오는 것은 다르다 —
// 여기서는 아직 적힌 적이 없으므로 오지 않는다.
const ARCHIVE_DRAFTS: Record<string, DataRow> = {
  'E-REC-03': {},
}

// 여섯 조건. **무엇이 조건인지도 서버가 준다** — 명세가 조건을 들면 문서 서식이
// 바뀔 때마다 명세가 틀린다.
const ARCHIVE_GATE_CONDITIONS: DataRow[] = [
  { key: 'C-1', label: '현장 운영 기록', met: 'false', tone: 'orange' },
  { key: 'C-2', label: '회고 · 잘된 점', met: 'false', tone: 'orange' },
  { key: 'C-3', label: '회고 · 미흡했던 점과 원인', met: 'false', tone: 'orange' },
  { key: 'C-4', label: '회고 · 다음 행사 개선안', met: 'false', tone: 'orange' },
  { key: 'C-5', label: '인수인계 내용', met: 'false', tone: 'orange' },
  { key: 'C-6', label: '다음 담당자 지정', met: 'false', tone: 'orange' },
]

const ARCHIVE_GATE: Record<string, DataRow> = {
  'E-REC-03': {
    metCountNote: '0 / 6',
    blockedNote:
      '직접 작성하는 부분(현장 운영·회고·인수인계)을 모두 채워야 검토를 요청할 수 있습니다',
  },
}

// 아직 검토되지 않았다. 의견이 없으면 조각이 오지 않고, 그 자리를 말하는 것은
// 출처의 messages.empty다.
const ARCHIVE_REVIEWS: Record<string, DataRow> = {
  'E-REC-03': {},
}

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


export const DASHBOARD_FIXTURES: Record<string, DataRow | DataRow[]> = {
  ...EVENT_DASHBOARD_FIXTURES,
  ...FINANCE_DASHBOARD_FIXTURES,
  // 캘린더가 지금 보여주는 달과 이번 주. 둘 다 오늘이 정하므로 서버의 것이다.
//   'record.completedEventAlert': COMPLETED_EVENT_ALERT,
  'record.completedEventAlert': COMPLETED_EVENT_ALERT,
  'ops.calendarMonth': { monthLabel: '2026년 7월' },
  'ops.calendarWeekRange': { rangeNote: '07.19 (일) – 07.25 (토) · 오늘 07.19' },
  ...MEETING_DASHBOARD_FIXTURES,
  'home.briefing': { title: '박해랑님, 확인이 필요해요' },
  'home.briefingNotices': [
    { message: '지연된 업무가 1건 있습니다.' },
    { message: '담당자가 없는 업무가 2건 있습니다.' },
  ],
  'home.eventCounts': {
    activeEvents: 1,
    upcomingEvents: 2,
    weeklySchedules: 8,
  },
  'home.events': [
    {
      status: '기획 중',
      title: '2026 소프트웨어융합대학 체육대회',
      date: '2026-08-20',
      place: 'ERICA 체육관',
      team: '학술체육부',
      progressPercent: 62,
      delayedTaskCount: 1,
    },
    {
      status: '기획 중',
      title: '2026 신입생 환영 행사',
      date: '미정',
      place: '미정',
      team: '홍보부',
      progressPercent: 18,
    },
  ],
  'home.schedules': [
    { date: '07.20', title: '체육대회 참가 신청 마감', badge: '마감' },
    { date: '07.20', title: '참가자 모집 공지 작성', badge: '마감' },
    { date: '07.21', title: '주간 운영회의 자료 준비', badge: '마감' },
  ],
  'home.orgAlerts': [
    { kind: 'document', label: '증빙 서류 누락', count: 3 },
    { kind: 'members', label: '참가자 명단 확인 필요', count: 1 },
  ],
  'home.financeSummary': {
    budgetUsedPercent: 34,
    budgetUsedNote: '34%',
    availableBudgetNote: '66%',
    plannedNote: '4건',
    missingProofNote: '5건',
  },

  // 셸 — 모든 데스크톱 화면이 공유한다.
  // 어느 길이 열려 있는가(SIGN-IN). 배포가 정하므로 진짜는 서버가 답한다.
  'auth.ways': { google: true, kakao: true },
  'shell.organization': { name: '소프트웨어융합대학' },
  'shell.viewer': { name: '박해랑', role: '운영부 · 부원' },

  // 내 업무(MY-01).
  // 내 정보(MY-INFO-01). **고르는 값은 코드와 이름표가 함께 온다** — 코드만 주면
  // 화면이 열리는 순간 사람이 'COL-…'을 본다.
  'my.profile': {
    name: '김바다',
    studentNumber: '2022123456',
    schoolName: '한양대학교 ERICA',
    college: 'COL-HYU-ERICA-SW',
    collegeName: '소프트웨어융합대학',
    department: 'DEP-HYU-ERICA-SW-ICT',
    departmentName: 'ICT융합학부',
    currentGrade: '3',
    currentGradeName: '3학년',
  },
  // 소속은 고치는 값이 아니라 읽는 값이라 출처가 갈려 있다.
  'my.belonging': {
    orgName: '제12대 소프트웨어융합대학 학생회',
    orgDepartment: '회장단',
    executiveTitle: '회장',
  },
  ...TASK_DASHBOARD_FIXTURES,
  // 운영 허브(OPS-00).
  'ops.intro': {
    description:
      '박해랑님이 확인할 업무·회의·행사·일정을 선택하세요. 각 공간에서 역할과 참여 관계에 맞는 다음 행동을 제공합니다.',
  },
  'ops.spaceStats': {
    taskInProgress: 4,
    taskReview: 1,
    meetingToday: 1,
    meetingCleanup: 1,
    eventInProgress: 1,
    eventPlanning: 2,
    calendarThisWeek: 6,
    calendarUpcoming: 4,
  },
  // 조직 관리 홈(ORG-00). 디자인이 그린 그대로의 한 줄이다 - 셈한 숫자가 아니라
  // 서버가 완성해 보내는 문장이라는 것이 이 출처의 계약이다.
  'org.areaSummaries': {
    departments: '부서 5개 · 구성원 18명',
    students: '학생 1,284명 · 최근 갱신 07.01',
    roles: '기본 역할 3종 · 확정된 권한 매트릭스',
  },
  // 앱을 열면 어디부터인가. **서버가 세션을 보고 정한다** — 개발용 응답으로 도는
  // 동안은 그림을 보러 온 것이므로 이미 들어온 사람의 자리를 준다.
  'app.start': { screenId: 'HOME-01K' },
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
  'org.roleAssignments': [
    { id: 'M-01', name: '김바다', department: '학술체육부', roleLabel: '회장단', roleTone: 'violet', role: 'chair' },
    { id: 'M-11', name: '이수현', department: '기획부', roleLabel: '부서장', roleTone: 'blue', role: 'head' },
    { id: 'M-02', name: '이윤슬', department: '홍보부', roleLabel: '부서장', roleTone: 'blue', role: 'head' },
    { id: 'M-12', name: '김민준', department: '재정부', roleLabel: '부서장', roleTone: 'blue', role: 'head' },
    { id: 'M-03', name: '박해랑', department: '운영부', roleLabel: '부원', roleTone: 'gray', role: 'member' },
    { id: 'M-07', name: '정하늘', department: '운영부', roleLabel: '부원', roleTone: 'gray', role: 'member' },
    { id: 'M-13', name: '박민수', department: '기획부', roleLabel: '부원', roleTone: 'gray', role: 'member' },
  ],
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
  // 메시지 방 목록(MSG-01). **비어 있는 것이 이 저장소가 아는 전부다** —
  // 와이어프레임이 그린 것은 방이 하나도 없는 모습뿐이고, 줄에 무엇이 그려지는지는
  // 어느 프레임에도 없다. 여기에 방을 하나 넣으면 그 줄의 모양을 개발용 응답이
  // 지어내게 되고, 그것은 서버 대역이 아니라 디자인을 만드는 일이다.
  'message.rooms': [],
  // 대화(MSG-03). 같은 이유로 비었다. 빈 상태의 글이 '주고받은 말이 없다'가 아니라
  // **'들어갈 방이 없다'**고 말하므로, message.rooms가 빈 동안 이쪽도 비는 것이 앞뒤가 맞는다.
  'message.conversation': [],
  'org.permissionMatrix': PERMISSION_MATRIX,
}

// 인자를 받는 출처. 실제로는 서버가 걸러 주므로 mock도 여기서 거른다 —
// 받아온 것을 화면에서 거르면 명세(itemList.params)와 다른 것을 구현하게 된다.
//
// MY-01 디자인이 그린 것은 '해야 할 업무' 탭 2건뿐이다. 다른 탭의 행은
// 탭이 실제로 무언가를 바꾸는지 보려고 둔 개발용 값이다(HOME-01K의 일정에서
// 가져왔다). 탭 건수는 이 목록에서 세므로 목록과 배지가 어긋날 수 없다.

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

// 개요의 조각들은 한 행사에 딸려 있으므로 한 자리에 모아 두고 이름으로 집는다.



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


export const FILTERED_FIXTURES: Record<
  string,
  (params: Record<string, string>) => DataRow[]
> = {
  ...FINANCE_FILTERED_FIXTURES,
  ...EVENT_TASK_FILTERED_FIXTURES,
  ...EVENT_FILTERED_FIXTURES,
  ...ATTENDANCE_FILTERED_FIXTURES,
  ...SURVEY_FILTERED_FIXTURES,
  ...MEETING_FILTERED_FIXTURES,
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
    (DASHBOARD_FIXTURES['org.roleAssignments'] as DataRow[]).filter(
      (row) => row.id === memberId,
    ),
  // 학생 명단은 이름·학번으로 찾고 학년·납부 상태로 거른다.
  'org.students': ({ query = '', grade = '', duesStatus = '' }) =>
    STUDENT_ROSTER.filter((row) => matchesQuery(row, query))
      .filter((row) => grade === '' || row.grade === grade)
      .filter(
        (row) =>
          duesStatus === '' ||
          duesStatus === 'all' ||
          row.duesLabel === DUES_BY_STATUS[duesStatus],
      ),
  'org.studentPaging': ({ query = '', grade = '', duesStatus = '' }) => {
    const rows = (FILTERED_FIXTURES['org.students'] as (p: Record<string, string>) => DataRow[])({
      query,
      grade,
      duesStatus,
    })
    // 총 건수는 거른 뒤의 것이다 - 화면이 세지 않고 서버가 말한다.
    return [{ totalNote: `총 ${rows.length}명`, pageCount: 1 }]
  },
  // 유형으로 좁히는 것은 **일정**이지 날이 아니다. 칸은 그대로 서른넷이고
  // 그 안의 일정만 걸린다 — 격자에서 날이 사라지면 달력이 아니게 된다.
  // 없는 코드면 빈 목록이고, 그것은 '개발용 응답이 없다'가 아니라 **그런 학생회가
  // 없다**다(readDataSource가 NOT_FOUND로 가른다).
  'org.invitedOrganization': ({ inviteCode = '' }) => {
    const row = INVITED_ORGANIZATIONS[inviteCode]
    return row === undefined ? [] : [row]
  },
  'ops.calendarDays': ({ type = 'all' }) =>
    CALENDAR_DAYS.map((day) => ({
      id: day.id,
      dayLabel: day.dayLabel,
      dayTone: day.dayTone,
      schedules: day.schedules
        .filter((schedule) => type === 'all' || schedule.type === type)
        .map((schedule) => ({ id: schedule.id, title: schedule.title, typeTone: schedule.type })),
    })),
//
//   // 완료된 행사는 행사명으로 좁혀 본다. event.list와 다른 목록이다.
//   'record.completedEvents': ({ query = '' }) =>
//     COMPLETED_EVENTS.filter((row) => matchesQuery(row, query)),
//   'record.archive': ({ eventId = '' }) => {
//     const row = RECORD_ARCHIVES[eventId]
//     return row === undefined ? [] : [row]
//   },
//   'record.archiveSections': ({ eventId = '' }) => RECORD_ARCHIVE_SECTIONS[eventId] ?? [],
//   // 발행된 문서의 본문은 한 벌만 손으로 적는다. 검토 중인 문서를 따로 그린
//   // 프레임이 없으므로 지어내지 않고 같은 것을 준다.
//   'record.archiveDetail': ({ eventId = '' }) =>
//     RECORD_ARCHIVES[eventId] === undefined || eventId === 'E-REC-03' ? [] : [ARCHIVE_DETAIL],
//   'record.archiveTimeline': ({ eventId = '' }) =>
//     eventId === 'E-REC-01' || eventId === 'E-REC-02' ? ARCHIVE_TIMELINE : [],
//   'record.archiveEvidence': ({ eventId = '' }) =>
//     eventId === 'E-REC-01' || eventId === 'E-REC-02' ? ARCHIVE_EVIDENCE : [],
//   'record.archiveRetro': ({ eventId = '' }) =>
//     eventId === 'E-REC-01' || eventId === 'E-REC-02' ? ARCHIVE_RETRO : [],
//   'record.archiveHandover': ({ eventId = '' }) =>
//     eventId === 'E-REC-01' || eventId === 'E-REC-02' ? ARCHIVE_HANDOVER : [],
//   'record.archiveChecklist': ({ eventId = '' }) =>
//     eventId === 'E-REC-01' || eventId === 'E-REC-02' ? ARCHIVE_CHECKLIST : [],
//   'record.archiveAutoFilled': ({ eventId = '' }) => {
//     const row = ARCHIVE_AUTO_FILLED[eventId]
//     return row === undefined ? [] : [row]
//   },
//   'record.archiveDraft': ({ eventId = '' }) => {
//     const row = ARCHIVE_DRAFTS[eventId]
//     return row === undefined ? [] : [row]
//   },
//   'record.archiveGate': ({ eventId = '' }) => {
//     const row = ARCHIVE_GATE[eventId]
//     return row === undefined ? [] : [row]
//   },
//   'record.archiveGateConditions': ({ eventId = '' }) =>
//     ARCHIVE_GATE[eventId] === undefined ? [] : ARCHIVE_GATE_CONDITIONS,
//   'record.archiveReview': ({ eventId = '' }) => {
//     const row = ARCHIVE_REVIEWS[eventId]
//     return row === undefined ? [] : [row]
//   },
  // 완료된 행사는 행사명으로 좁혀 본다. event.list와 다른 목록이다.
  'record.completedEvents': ({ query = '' }) =>
    COMPLETED_EVENTS.filter((row) => matchesQuery(row, query)),
  'record.archive': ({ eventId = '' }) => {
    const row = RECORD_ARCHIVES[eventId]
    return row === undefined ? [] : [row]
  },
  'record.archiveSections': ({ eventId = '' }) => RECORD_ARCHIVE_SECTIONS[eventId] ?? [],
  // 발행된 문서의 본문은 한 벌만 손으로 적는다. 검토 중인 문서를 따로 그린
  // 프레임이 없으므로 지어내지 않고 같은 것을 준다.
  'record.archiveDetail': ({ eventId = '' }) =>
    RECORD_ARCHIVES[eventId] === undefined || eventId === 'E-REC-03' ? [] : [ARCHIVE_DETAIL],
  'record.archiveTimeline': ({ eventId = '' }) =>
    eventId === 'E-REC-01' || eventId === 'E-REC-02' ? ARCHIVE_TIMELINE : [],
  'record.archiveEvidence': ({ eventId = '' }) =>
    eventId === 'E-REC-01' || eventId === 'E-REC-02' ? ARCHIVE_EVIDENCE : [],
  'record.archiveRetro': ({ eventId = '' }) =>
    eventId === 'E-REC-01' || eventId === 'E-REC-02' ? ARCHIVE_RETRO : [],
  'record.archiveHandover': ({ eventId = '' }) =>
    eventId === 'E-REC-01' || eventId === 'E-REC-02' ? ARCHIVE_HANDOVER : [],
  'record.archiveChecklist': ({ eventId = '' }) =>
    eventId === 'E-REC-01' || eventId === 'E-REC-02' ? ARCHIVE_CHECKLIST : [],
  'record.archiveAutoFilled': ({ eventId = '' }) => {
    const row = ARCHIVE_AUTO_FILLED[eventId]
    return row === undefined ? [] : [row]
  },
  'record.archiveDraft': ({ eventId = '' }) => {
    const row = ARCHIVE_DRAFTS[eventId]
    return row === undefined ? [] : [row]
  },
  'record.archiveGate': ({ eventId = '' }) => {
    const row = ARCHIVE_GATE[eventId]
    return row === undefined ? [] : [row]
  },
  'record.archiveGateConditions': ({ eventId = '' }) =>
    ARCHIVE_GATE[eventId] === undefined ? [] : ARCHIVE_GATE_CONDITIONS,
  'record.archiveReview': ({ eventId = '' }) => {
    const row = ARCHIVE_REVIEWS[eventId]
    return row === undefined ? [] : [row]
  },
  'ops.calendarWeek': ({ type = 'all' }) =>
    CALENDAR_WEEK.filter((entry) => type === 'all' || entry.type === type).map(
      (entry) => entry.row,
    ),
}
