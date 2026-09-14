import type { DataRow } from '../../data-sources/definitions'
import {
  MEETING_AGENDAS,
  MEETING_CANDIDATES,
  MEETING_DETAIL,
  MEETING_DOCUMENTS,
  MEETING_DRAFT,
  MEETING_FOLLOW_UPS,
  MEETING_FOLLOW_UPS_MTG09,
  MEETING_GROUPS,
  MEETING_HOST_OWNER,
  MEETING_PARTICIPANTS,
} from './meeting-data'
import { matchesQuery } from './search'

export const MEETING_DASHBOARD_FIXTURES: Record<string, DataRow | DataRow[]> = {
  // 회의 목록의 띠. 지금 보는 사람은 일반 참가자다 - 와이어프레임의 다른 셋
  // (진행 권한자·회의 생성 가능·미참가자)은 같은 화면을 다른 사람이 볼 때다.
  'meeting.attention': {
    viewerTitle: '일반 참가자 화면',
    viewerNote: '초대된 회의의 일정과 참가 상태를 확인합니다.',
    attentionNote: '확인 필요한 회의 2건',
    canCreateMeeting: false,
  },
}

export const MEETING_FILTERED_FIXTURES: Record<
  string,
  (params: Record<string, string>) => DataRow[]
> = {
  // 검색은 묶음이 아니라 회의를 거른다. 남는 회의가 없는 묶음은 통째로 사라진다 —
  // 빈 묶음 머리만 남으면 '총 0건'이 줄줄이 보인다.
  // 회의 한 건. 인자가 가리킨 회의가 없으면 빈 것을 돌려준다 - 조용히 다른
  // 회의를 대신 보여주면 사람이 남의 회의를 자기 것으로 읽는다.
  'meeting.detail': ({ meetingId = '' }) => {
    const row = MEETING_DETAIL[meetingId]
    return row === undefined ? [] : [row]
  },
  'meeting.agendas': ({ meetingId = '' }) => MEETING_AGENDAS[meetingId] ?? [],
  // 참가자는 03·05·07의 목록과 04B의 권한 관리가 같은 사람들이다. 검색은 04B만
  // 쓰지만 출처가 하나이므로 여기서 함께 거른다.
  'meeting.participants': ({ meetingId = '', query = '', excludeHostOwner = 'false' }) =>
    (MEETING_PARTICIPANTS[meetingId] ?? [])
      .filter((row) => excludeHostOwner !== 'true' || row.memberId !== 'M-01')
      .filter((row) => matchesQuery(row, query)),
  'meeting.hostOwner': ({ meetingId = '' }) => {
    const row = MEETING_HOST_OWNER[meetingId]
    return row === undefined ? [] : [row]
  },
  'meeting.documents': ({ meetingId = '' }) => MEETING_DOCUMENTS[meetingId] ?? [],
  // 후속 업무는 와이어프레임이 빈 상태만 그렸다. 지어내지 않는다.
  'meeting.followUps': ({ meetingId = '' }) =>
    meetingId === 'MTG-09' ? MEETING_FOLLOW_UPS_MTG09 : (MEETING_FOLLOW_UPS[meetingId] ?? []),
  // **다른 물음이라 따로 답한다.** 위는 '이 회의가 만든 후속 업무'이고 이것은
  // '그중 내 것'이다. 그림이 둘 다 0건을 그렸으므로 여기도 빈 목록이다 — 비었을 때
  // 뭐라고 말하는지가 둘의 다름을 드러낸다.
  'meeting.myFollowUps': () => [],
  'meeting.minutes': ({ meetingId = '' }) =>
    meetingId === 'MTG-01'
      ? [
          {
            summaryText:
              '체육대회 안전 점검 결과를 바탕으로 위험 구간 조치 방안을 확정했습니다. 비상 연락은 현장 담당자에서 운영본부를 거쳐 학생회장과 학교 안전관리팀에 보고하며, 경기별 안전 담당자 명단은 7월 23일까지 전체 운영진에게 배포합니다.',
          },
        ]
      : meetingId === 'MTG-09'
      ? [
          {
            // 아직 요약이 없는 회의. **없다는 말도 서버가 준다.**
            summaryText: '아직 작성된 전체 요약이 없습니다',
            statusLabel: '정리 중 · 변경될 수 있음',
            statusTone: 'yellow',
            aiDisclaimer:
              'AI 초안은 안건별 논의·결정 기록만 재구성하며, 기록에 없는 결정·담당자·기한을 새로 만들지 않습니다.\n요약이 없어도 정리 완료가 막히지는 않습니다.',
          },
        ]
      : meetingId === 'MTG-06'
      ? [
          {
            summaryText:
              '신입생 환영 행사 프로그램 순서와 부서별 준비 범위를 논의했습니다. 장소 답사 후 세부 동선과 무대 운영 계획을 최종 확정할 예정입니다.',
            statusLabel: '정리 중 · 변경될 수 있음',
            statusTone: 'yellow',
            aiDisclaimer:
              'AI 초안은 안건별 논의·결정 기록만 재구성하며, 기록에 없는 결정·담당자·기한을 새로 만들지 않습니다. 요약이 없어도 정리 완료가 막히지는 않습니다.',
          },
        ]
      : [],
  'meeting.minutesProgress': ({ meetingId = '' }) =>
    meetingId === 'MTG-09'
      ? [
          {
            requiredDoneNote: '필수 2 / 4',
            blockedNote: '안건별 필수 정리를 완료해 주세요',
            canComplete: false,
            // 그림이 그린 글 그대로다. '(선택)'까지 서버가 붙여 온다 — 무엇이
            // 없어도 되는지는 조직의 규칙이고, 화면이 optional을 보고 그 말을
            // 지어내면 그 규칙이 화면에 적힌다.
            conditions: [
              { label: '안건별 논의 내용', done: 'y', optional: '' },
              { label: '결정사항 또는 없음 표시', done: '', optional: '' },
              { label: '후속 업무 또는 없음 표시', done: '', optional: '' },
              { label: '참가 결과', done: 'y', optional: '' },
              { label: '회의 전체 요약 (선택)', done: '', optional: 'y' },
            ],
          },
        ]
      : meetingId === 'MTG-06'
      ? [
          {
            requiredDoneNote: '필수 2 / 4',
            blockedNote: '안건별 필수 정리를 완료해 주세요',
            canComplete: false,
            conditions: [
              { label: '안건별 논의 내용', done: 'y', optional: '' },
              { label: '결정사항 또는 없음 표시', done: '', optional: '' },
              { label: '후속 업무 또는 없음 표시', done: '', optional: '' },
              { label: '참가 결과', done: 'y', optional: '' },
              { label: '회의 전체 요약', done: '', optional: 'y' },
            ],
          },
        ]
      : [],
  // 회의록의 각 부분이 어디까지 왔는지. **위의 minutesProgress와 다른 물건이다** —
  // 저것은 마칠 수 있는가를 조건으로 세고, 이것은 부분마다 어디까지 왔는지 말한다.
  // 세는 단위가 부분마다 다르므로(개·건·초안) 완성된 문구로 온다.
  'meeting.minutesStatus': ({ meetingId = '' }) =>
    meetingId === 'MTG-06'
      ? [
          {
            parts: [
              { label: '안건 내용', stateNote: '2 / 3 정리' },
              { label: '의사결정', stateNote: '2건 확인' },
              { label: '후속 업무', stateNote: '1건 연결' },
              { label: '전체 요약', stateNote: '초안 작성' },
            ],
          },
        ]
      : [],
  // 권한 안내는 04B의 띠와 D03의 확인 글이 나눠 쓴다.
  'meeting.permissionNotice': ({ meetingId = '' }) =>
    MEETING_DETAIL[meetingId] === undefined
      ? []
      : [
          {
            title: '이 회의에만 적용되는 권한입니다',
            grantNote:
              '진행 권한자는 회의 시작·종료, 안건 진행, 결정 기록과 회의록 정리를 할 수 있습니다.',
            limitNote:
              '회의 수정·취소와 다른 사람의 권한 변경은 회의 생성자만 할 수 있습니다.',
            ruleChipLabel: '최소 1명 유지',
            ruleChipTone: 'yellow',
            summaryNote: '현재 진행 권한자 2명 · 일반 참가자 3명',
          },
        ],
  'meeting.startConfirm': () => [
    {
      warningNote:
        '예정 시간보다 7일 이른 시각입니다. 잘못 시작한 것은 아닌지 확인해 주세요.',
    },
  ],
  'meeting.endConfirm': () => [
    { warningNote: '미완료 안건 1개 · 참석 3명 · 미참가 1명' },
  ],
  // 제목에 사람 이름이 박혀 있으므로 서버가 완성해 준다.
  'meeting.hostGrantConfirm': ({ meetingId = '', memberId = '' }) => {
    const person = (MEETING_PARTICIPANTS[meetingId] ?? []).find(
      (row) => row.memberId === memberId,
    )
    return person === undefined
      ? []
      : [
          {
            title: `${String(person.name)}에게 진행 권한을 부여할까요?`,
            grantNote:
              '이 회의에서 회의 시작·종료, 안건 진행, 의사결정 기록과 회의록 정리를 할 수 있게 됩니다.',
            limitNote:
              '회의 수정·취소와 다른 참가자의 권한 변경은 할 수 없습니다.',
          },
        ]
  },
  // 회의를 새로 쓸 때는 서버가 아는 것만 채워 온다.
  // 새로 쓰면 서버가 아는 것만 채워 온다. 고치러 들어오면 그 회의를 통째로 준다.
  'meeting.draft': ({ meetingId = '' }) =>
    meetingId === ''
      ? [{ hostName: '박해랑', statusLabel: '예정' }]
      : [MEETING_DRAFT[meetingId] ?? { hostName: '박해랑', statusLabel: '예정' }],
  'meeting.memberCandidates': ({ query = '' }) =>
    MEETING_CANDIDATES.filter((row) => matchesQuery(row, query)),
  'meeting.groups': ({ query = '' }) =>
    MEETING_GROUPS.map((group) => ({
      ...group,
      meetings: (group.meetings as DataRow[]).filter((row) => matchesQuery(row, query)),
    })).filter((group) => (group.meetings as DataRow[]).length > 0),
}
