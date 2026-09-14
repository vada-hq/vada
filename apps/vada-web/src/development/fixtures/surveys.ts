import type { DataRow } from '../../data-sources/definitions'
import { EVENT_OVERVIEW } from './event-state'

// ─── 참여 설문(EVT-05 · EVT-05B) ───────────────────────────────────────────
//
// 설문의 상태는 **행사의 상태와 다른 축이다.** E-01은 기획 중인데 그 설문은
// 초안이고, 신청자 142명은 event.recruitSettings가 이미 세고 있던 수다.
const EVENT_SURVEY: Record<string, DataRow> = {
  'E-01': {
    statusLabel: '초안',
    statusTone: 'gray',
    previewUrl: 'https://vada.app/s/2026-swcollege-sports/preview',
  },
  // **설문은 행사와 함께 생긴다.** 아직 아무것도 안 정한 행사에도 설문의 자리가
  // 있고, 그래서 EVT-05가 열린다 — EVT-04의 빈 참가자 명단이 권하는 곳이 여기다.
  // 이것이 없으면 그 단추가 터지는 화면으로 데려간다.
  'E-03': {
    statusLabel: '초안',
    statusTone: 'gray',
    previewUrl: 'https://vada.app/s/2026-freshman-welcome/preview',
  },
}

// 모집 설정 초안(EVT-05). 비어 있는 칸은 아예 넣지 않는다 — 카탈로그가 전부
// optional로 두었고, 와이어프레임도 신청 기간과 완료 안내를 빈 칸으로 그렸다.
const EVENT_SURVEY_SETTINGS_DRAFT: Record<string, DataRow> = {
  'E-01': {
    applyMethod: 'firstCome',
    duesCheck: 'y',
  },
  // 아무것도 안 정한 새 행사. **빈 한 줄이지 없는 것이 아니다** — 초안의 자리는
  // 있고 담긴 값이 없을 뿐이라, 화면이 '못 찾았다'가 아니라 빈 칸을 그린다.
  'E-03': {},
}

// 링크를 켤 수 있는지. **막는 것은 서버다** — 무엇이 모자란지를 화면이 세면
// 조직의 규칙이 화면에 적히게 된다(meeting.minutesProgress와 같은 자리).
const EVENT_SURVEY_ACTIVATION: Record<string, DataRow> = {
  // 새 행사는 채운 것이 거의 없다. **막는 것은 서버이므로 화면이 이 수를 세지
  // 않는다** — 세면 조직의 규칙이 화면에 적힌다.
  'E-03': {
    unmetCountNote: '미충족 12개',
    unmetCount: 12,
    canActivate: false,
    blockedNote: '아직 채우지 않은 활성화 조건이 12개 있습니다.',
  },
  'E-01': {
    unmetCountNote: '미충족 2개',
    unmetCount: 2,
    canActivate: false,
    blockedNote: '아직 채우지 않은 활성화 조건이 2개 있습니다.',
  },
}

// 채워야 하는 것들. 행사 기본정보에서 채울 것과 참여 설문에서 채울 것이 갈린다.
// 못 채운 둘의 수가 곧 위의 unmetCount이므로 여기서 세어도 같다.
const EVENT_SURVEY_ACTIVATION_CONDITIONS: Record<string, DataRow[]> = {
  'E-01': [
    {
      groupLabel: '행사 기본정보',
      rows: [
        { key: 'title', label: '행사명', met: 'y', tone: 'green' },
        { key: 'startAt', label: '시작 일시', met: 'y', tone: 'green' },
        { key: 'endAt', label: '종료 일시', met: 'y', tone: 'green' },
        { key: 'place', label: '장소', met: 'y', tone: 'green' },
        { key: 'audience', label: '참가 대상', met: 'y', tone: 'green' },
        { key: 'feeType', label: '참가비 유형', met: 'y', tone: 'green' },
        {
          key: 'feeAmounts',
          label: '납부자·미납자 금액·결제 안내',
          met: '',
          tone: 'red',
          detail: '금액과 결제 안내를 입력하세요',
          locationNote: '입력 위치: 행사 기본정보 → 참가비(학생회비 조건부)',
          actionLabel: '기본정보에서 수정 →',
          targetKind: 'basics',
        },
        { key: 'capacityType', label: '행사 정원 유형', met: 'y', tone: 'green' },
        { key: 'capacity', label: '정원 인원', met: 'y', tone: 'green' },
      ],
    },
    {
      groupLabel: '참여 설문 설정',
      rows: [
        {
          key: 'applyEnd',
          label: '신청 마감 일시',
          met: '',
          tone: 'red',
          detail: '신청 마감 일시가 설정되지 않았습니다',
          locationNote: '입력 위치: 모집 설정',
          actionLabel: '모집 설정에서 입력 →',
          targetKind: 'surveySettings',
        },
        { key: 'applyOrder', label: '신청 시작·마감 순서', met: 'y', tone: 'green' },
        { key: 'applyMethod', label: '신청 방식', met: 'y', tone: 'green' },
        { key: 'nameQuestion', label: '이름 필수 문항', met: 'y', tone: 'green' },
        { key: 'studentNoQuestion', label: '학번 필수 문항', met: 'y', tone: 'green' },
        { key: 'privacyConsent', label: '개인정보 수집·이용 동의', met: 'y', tone: 'green' },
        { key: 'duesIdentity', label: '학생회비 대조용 식별 문항', met: 'y', tone: 'green' },
      ],
    },
  ],
  // 새 행사. 채운 것이 넷뿐이라 나머지 열둘이 빨갛다 — 위의 unmetCount 12와 같은
  // 수다. 어디서 채우는지(locationNote·targetKind)는 조건마다 다르고 그것을 아는
  // 것은 서버다.
  'E-03': [
    {
      groupLabel: '행사 기본정보',
      rows: [
        { key: 'title', label: '행사명', met: 'y', tone: 'green' },
        {
          key: 'startAt',
          label: '시작 일시',
          met: '',
          tone: 'red',
          detail: '시작 일시가 설정되지 않았습니다',
          locationNote: '입력 위치: 행사 기본정보 → 일시',
          actionLabel: '기본정보에서 수정 →',
          targetKind: 'basics',
        },
        {
          key: 'endAt',
          label: '종료 일시',
          met: '',
          tone: 'red',
          detail: '종료 일시가 설정되지 않았습니다',
          locationNote: '입력 위치: 행사 기본정보 → 일시',
          actionLabel: '기본정보에서 수정 →',
          targetKind: 'basics',
        },
        {
          key: 'place',
          label: '장소',
          met: '',
          tone: 'red',
          detail: '장소가 입력되지 않았습니다',
          locationNote: '입력 위치: 행사 기본정보 → 장소',
          actionLabel: '기본정보에서 수정 →',
          targetKind: 'basics',
        },
        {
          key: 'audience',
          label: '참가 대상',
          met: '',
          tone: 'red',
          detail: '참가 대상이 입력되지 않았습니다',
          locationNote: '입력 위치: 행사 기본정보 → 참가 대상',
          actionLabel: '기본정보에서 수정 →',
          targetKind: 'basics',
        },
        {
          key: 'feeType',
          label: '참가비 유형',
          met: '',
          tone: 'red',
          detail: '참가비 유형이 정해지지 않았습니다',
          locationNote: '입력 위치: 행사 기본정보 → 참가비',
          actionLabel: '기본정보에서 수정 →',
          targetKind: 'basics',
        },
        {
          key: 'capacityType',
          label: '행사 정원 유형',
          met: '',
          tone: 'red',
          detail: '정원 유형이 정해지지 않았습니다',
          locationNote: '입력 위치: 행사 기본정보 → 정원',
          actionLabel: '기본정보에서 수정 →',
          targetKind: 'basics',
        },
      ],
    },
    {
      groupLabel: '참여 설문 설정',
      rows: [
        {
          key: 'applyStart',
          label: '신청 시작 일시',
          met: '',
          tone: 'red',
          detail: '신청 시작 일시가 설정되지 않았습니다',
          locationNote: '입력 위치: 모집 설정',
          actionLabel: '모집 설정에서 입력 →',
          targetKind: 'surveySettings',
        },
        {
          key: 'applyEnd',
          label: '신청 마감 일시',
          met: '',
          tone: 'red',
          detail: '신청 마감 일시가 설정되지 않았습니다',
          locationNote: '입력 위치: 모집 설정',
          actionLabel: '모집 설정에서 입력 →',
          targetKind: 'surveySettings',
        },
        {
          key: 'applyMethod',
          label: '신청 방식',
          met: '',
          tone: 'red',
          detail: '신청 방식이 정해지지 않았습니다',
          locationNote: '입력 위치: 모집 설정',
          actionLabel: '모집 설정에서 입력 →',
          targetKind: 'surveySettings',
        },
        { key: 'nameQuestion', label: '이름 필수 문항', met: 'y', tone: 'green' },
        { key: 'studentNoQuestion', label: '학번 필수 문항', met: 'y', tone: 'green' },
        { key: 'privacyConsent', label: '개인정보 수집·이용 동의', met: 'y', tone: 'green' },
        {
          key: 'duesIdentity',
          label: '학생회비 대조용 식별 문항',
          met: '',
          tone: 'red',
          detail: '학생회비 대조를 켜면 식별 문항이 필요합니다',
          locationNote: '입력 위치: 설문 문항',
          actionLabel: '문항에서 추가 →',
          targetKind: 'surveySettings',
        },
      ],
    },
  ],
}

// 설문 문항. **응답이 있는 문항은 잠긴다**(locked) — 이름·학번이 그 자리다.
const EVENT_SURVEY_QUESTIONS: Record<string, DataRow[]> = {
  'E-01': [
    {
      id: 'SQ-01',
      title: '이름',
      typeLabel: '단답형',
      badges: [{ label: '필수 · 삭제 불가', tone: 'gray' }],
      locked: 'y',
    },
    {
      id: 'SQ-02',
      title: '학번',
      typeLabel: '단답형',
      badges: [{ label: '필수 · 삭제 불가', tone: 'gray' }],
      locked: 'y',
    },
    { id: 'SQ-03', title: '단과대학', typeLabel: '단답형', badges: [{ label: '필수', tone: 'blue' }] },
    { id: 'SQ-04', title: '학부·학과', typeLabel: '단답형', badges: [{ label: '필수', tone: 'blue' }] },
    { id: 'SQ-05', title: '학년', typeLabel: '객관식', badges: [{ label: '필수', tone: 'blue' }] },
    {
      id: 'SQ-06',
      title: '개인정보 동의',
      typeLabel: '개인정보 동의',
      badges: [{ label: '필수', tone: 'blue' }],
    },
  ],
}

// 갈아 끼우면 무엇이 어떻게 되는지(EVT-05B). 응답자 수는 신청자 수와 같은 사실이라
// event.recruitSettings의 '142명'에서 왔다 — 두 벌을 손으로 쓰면 어긋난다.
const EVENT_SURVEY_REPLACE_IMPACT: Record<string, DataRow> = {
  'E-01': {
    title: '새 설문으로 교체하시겠어요?',
    warning: '응답이 존재하는 설문은 직접 수정할 수 없습니다.',
    currentRespondents: '142명',
    affectedRespondents: '142명 (재응답 필요)',
    notes: [
      { text: "기존 설문은 '교체됨' 상태로 변경됩니다." },
      { text: '기존 응답자 데이터는 삭제되지 않고 보관됩니다.' },
      { text: '기존 응답자는 새 설문에 다시 응답해야 합니다.' },
      { text: '기존 링크에서는 새 설문으로 이동 버튼이 표시됩니다.' },
    ],
  },
}

// ─── 링크로 온 설문 응답자가 보는 것(EXT-02A · 02B · 02C) ───────────────────
//
// **주소가 실어 오는 것은 행사가 아니라 설문의 토큰이다.** 설문은 교체될 수 있고
// 링크가 가리키는 것은 설문이므로 한 행사에 토큰이 여럿 있다 — 교체되기 전의 것과
// 지금 신청을 받는 것.
//
// 토큰을 여럿 두는 까닭은 '상태마다 다르다'가 말뿐이 되지 않게 하기 위해서다.
// 하나만 두면 화면이 늘 같은 카드를 그리고, 그래도 아무도 모른다.
//
// **바깥에서 보는 값이라 안쪽 출처를 쓰지 않는다.** 그래도 같은 사실이므로 행사의
// 기본정보에서 끌어온다 — 두 벌을 손으로 쓰면 어긋난다.
const SURVEY_APPLY_FORM: Record<string, DataRow> = {
  'SVY-4f2a91c7': {
    title: String(EVENT_OVERVIEW['E-01'].basics.title),
    // 일시만 다르다: 이 화면은 '2026-08-20 10:00'으로, 행사 개요는
    // '08. 20. (목) 10:00'으로 그렸다. EVT-05에도 있는 같은 어긋남이라 그림대로 둔다.
    startAt: '2026-08-20 10:00',
    place: String(EVENT_OVERVIEW['E-01'].basics.place),
    audience: String(EVENT_OVERVIEW['E-01'].basics.audience),
    fee: String(EVENT_OVERVIEW['E-01'].basics.fee),
  },
  // 같은 학생회의 다른 행사. 참가비를 받지 않아도 그 자리는 늘 문장으로 온다.
  'SVY-9c05b71d': {
    title: '2026 소프트웨어융합대학 학술제',
    startAt: '2026-11-05 13:00',
    place: '제3공학관 대강당',
    audience: '소프트웨어융합대학 재학생',
    fee: '무료',
  },
}

// 신청을 마친 사람이 보는 결과(EXT-02B). 신청 폼이 보내고 그대로 넘기는 토큰이다.
const SURVEY_APPLY_RESULT: Record<string, DataRow> = {
  'RCPT-SVY-4f2a91c7': {
    title: '참여 신청이 완료되었습니다',
    eventTitle: '2026 소프트웨어융합대학 체육대회',
    applicantNote: '신청자: 김바다',
    feeStatus: '관리자 확인 중',
    feeNote: '학생회비 납부 여부 확인 후 결정됩니다.',
    notices: [
      { text: '· 신청 내용은 마감 전까지 운영진에게 문의하면 수정 가능합니다.' },
      { text: '· 문의: @sw_student_council (인스타그램)' },
    ],
  },
}

// 링크가 막힌 까닭(EXT-02C). **다섯이 서로 배타적이라 토큰 하나에 하나만 온다.**
// 지금 신청을 받는 SVY-4f2a91c7은 여기 없다 — 막히지 않은 링크는 서버가 신청 폼으로
// 보내므로 이 출처가 답할 것이 없다.
const SURVEY_LINK_STATE: Record<string, DataRow> = {
  'SVY-9c15ae40': { label: '모집 전', tone: 'gray', note: '참가 신청이 아직 시작되지 않았습니다.' },
  'SVY-2e6b81f3': { label: '모집 마감', tone: 'gray', note: '참가 신청이 종료되었습니다.' },
  'SVY-77d4c0a9': { label: '정원 마감', tone: 'orange', note: '신청 정원이 모두 찼습니다.' },
  'SVY-1a58e3b6': {
    label: '링크 비활성화',
    tone: 'red',
    note: '이 링크는 더 이상 사용할 수 없습니다.',
  },
  // 응답이 있어 교체된 옛 설문(EVT-05B가 만든 상태). 다섯 중 유일하게 갈 곳이 있고,
  // 옛 토큰과 새 토큰을 잇는 것은 서버뿐이다.
  'SVY-0b3d77e1': {
    label: '기존 설문 종료 · 새 설문으로 교체됨',
    tone: 'yellow',
    note: '이 참여 조사는 종료되었습니다. 새로 진행 중인 참여 조사에 다시 응답해 주세요.',
    actionLabel: '새 설문으로 이동 →',
    replacementToken: 'SVY-4f2a91c7',
  },
}

export const SURVEY_FILTERED_FIXTURES: Record<
  string,
  (params: Record<string, string>) => DataRow[]
> = {
  'event.survey': ({ eventId = '' }) => {
    const row = EVENT_SURVEY[eventId]
    return row === undefined ? [] : [row]
  },
  'event.surveySettingsDraft': ({ eventId = '' }) => {
    const row = EVENT_SURVEY_SETTINGS_DRAFT[eventId]
    return row === undefined ? [] : [row]
  },
  'event.surveyActivation': ({ eventId = '' }) => {
    const row = EVENT_SURVEY_ACTIVATION[eventId]
    return row === undefined ? [] : [row]
  },
  'event.surveyActivationConditions': ({ eventId = '' }) =>
    EVENT_SURVEY_ACTIVATION_CONDITIONS[eventId] ?? [],
  'event.surveyQuestions': ({ eventId = '' }) => EVENT_SURVEY_QUESTIONS[eventId] ?? [],
  'event.surveyReplaceImpact': ({ eventId = '' }) => {
    const row = EVENT_SURVEY_REPLACE_IMPACT[eventId]
    return row === undefined ? [] : [row]
  },
  'survey.applyForm': ({ surveyToken = '' }) => {
    const row = SURVEY_APPLY_FORM[surveyToken]
    return row === undefined ? [] : [row]
  },
  // 영수증으로 찾는다(attendance.checkInResult와 같은 까닭).
  'survey.applyResult': ({ receiptToken = '' }) => {
    const row = SURVEY_APPLY_RESULT[receiptToken]
    return row === undefined ? [] : [row]
  },
  'survey.linkState': ({ surveyToken = '' }) => {
    const row = SURVEY_LINK_STATE[surveyToken]
    return row === undefined ? [] : [row]
  },
}
