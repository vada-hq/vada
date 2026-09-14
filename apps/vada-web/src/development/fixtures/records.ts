import type { DataRow } from '../../data-sources/definitions'
import { matchesQuery } from './search'

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

export const RECORD_DASHBOARD_FIXTURES: Record<string, DataRow | DataRow[]> = {
  'record.completedEventAlert': COMPLETED_EVENT_ALERT,
}

export const RECORD_FILTERED_FIXTURES: Record<
  string,
  (params: Record<string, string>) => DataRow[]
> = {
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
}
