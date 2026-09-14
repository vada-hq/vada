import type { DataRow } from '../../data-sources/definitions'

// ─── 행사 참석 확인 QR(EVT-04B) ─────────────────────────────────────────────
//
// **행사 상태와 따로 켜고 끈다.** 기획 중인 E-01의 QR은 켜져 있고 후속 정리 중인
// E-02의 것은 꺼져 있다 — 행사가 어느 단계냐로는 이 값을 유도할 수 없다.
//
// **아직 만들지 않은 행사가 있다.** 카탈로그가 '아직 만들어진 QR이 없습니다'를
// 들고 있는 것이 그 자리이고, 아직 조직도 세우지 않은 E-03이 그렇다.
const EVENT_ATTENDANCE_QR: Record<string, DataRow> = {
  'E-01': {
    statusLabel: '활성 중',
    statusTone: 'green',
    // 체크인 시간대는 **09:30 ~ 11:00**이다(사람이 정한 것). 행사 자체는 10:00~14:00
    // 이고 체크인은 그 앞 한 시간 반이다 — 두 값은 다른 것이며 어긋난 것이 아니다.
    //
    // 와이어프레임은 이 자리를 **빈 DateTime Picker 둘**로 그렸다(25:398·25:402).
    // 그린 값이 없으므로 대조가 강제하는 것도 없고, 여기 적힌 것은 처음부터
    // 개발용으로 지어낸 값이었다. 한동안 '그림 둘이 어긋난다'로 적혀 있었는데
    // 어긋난 것은 그림이 아니라 **그림과 이 파일**이었다.
    startAt: '2026. 08. 20 09:30',
    endAt: '2026. 08. 20 11:00',
    guideNote:
      '참가자는 휴대폰 기본 카메라로 촬영합니다. 로그인이나 앱 설치가 필요 없습니다.',
    fileName: '2026-체육대회-참석확인-QR.png',
  },
  'E-02': {
    statusLabel: '비활성',
    statusTone: 'gray',
    startAt: '2026. 05. 28 11:00',
    endAt: '2026. 05. 28 17:00',
    guideNote:
      '참가자는 휴대폰 기본 카메라로 촬영합니다. 로그인이나 앱 설치가 필요 없습니다.',
    fileName: '봄축제-부스-참석확인-QR.png',
  },
}

// ─── QR 참석 확인(EXT-01A · EXT-01B) ────────────────────────────────────────
//
// **열쇠가 행사가 아니라 토큰이다.** 위의 EVENT_ATTENDANCE_QR은 학생회 사람이 행사로
// 찾는 것이고, 이 둘은 밖에서 온 사람이 QR로 찾는 것이다. QR은 껐다 켜고 다시 만들 수
// 있으므로(EVT-04B의 재생성·비활성화) 같은 행사라도 토큰이 갈린다.
//
// **토큰을 여섯 둔다.** 하나만 두면 '토큰마다 다르다'가 말뿐이 되고, 결과가 여섯인데
// 몇만 두면 **회색 둘이 시계와 X로 갈린다**는 사실이 드러나지 않는다.
//
// **체크인 시간대는 09:30 ~ 11:00이다.** 이 글은 EXT-01A가 실제로 그린 것이고,
// EVENT_ATTENDANCE_QR의 시각도 이제 여기에 맞췄다 — 저쪽은 그림이 빈 DateTime
// Picker라 그린 값이 없었고, 어긋나 보이던 10:00~14:00은 지어낸 개발용 값이었다.
const SPORTS_CHECK_IN: DataRow = {
  eventName: '2026 소프트웨어융합대학 체육대회',
  statusLabel: '체크인 가능',
  statusTone: 'green',
  checkInWindow: '09:30 ~ 11:00',
  guideNote: '참가 신청 시 입력한 이름과 학번을 정확히 입력해 주세요.',
}

const ATTENDANCE_CHECK_IN_FORM: Record<string, DataRow> = {
  // 열리는 넷. 명단에 있는지·이미 냈는지·조건을 채웠는지는 내 봐야 안다.
  A7K2M9: { ...SPORTS_CHECK_IN },
  B3N8P4: { ...SPORTS_CHECK_IN },
  C5Q1R6: { ...SPORTS_CHECK_IN },
  D8W4X2: { ...SPORTS_CHECK_IN },
  // 열자마자 막히는 둘. blocked 셋은 함께 오고, 오면 이름·학번 칸을 그리지 않는다.
  E2Y7Z5: {
    ...SPORTS_CHECK_IN,
    statusLabel: '체크인 시간 아님',
    statusTone: 'gray',
    blockedLabel: '체크인 시간 전·후',
    blockedTone: 'gray',
    blockedNote: '체크인 가능 시간이 아닙니다. (09:30 ~ 11:00)',
  },
  F6H1J3: {
    eventName: '봄 축제 학생회 부스',
    statusLabel: '비활성',
    statusTone: 'gray',
    checkInWindow: '2026. 05. 28 11:00 ~ 17:00',
    guideNote: '참가 신청 시 입력한 이름과 학번을 정확히 입력해 주세요.',
    blockedLabel: '비활성화된 QR',
    blockedTone: 'gray',
    blockedNote: '이 QR은 더 이상 사용할 수 없습니다.',
  },
}

// 결과 여섯. **글은 와이어프레임이 카드마다 그린 것을 그대로 옮겼다** — 대조가 그 글을
// 지킨다. 회색 둘(clock·x)이 이 표의 값이다.
// canRetry는 **서버의 판정**이다. 이름이 명단과 다를 때만 다시 내는 것이 뜻이
// 있다 — 참석이 이미 끝났거나 QR이 꺼진 결과에서는 다시 내도 같은 답이 온다.
// 화면은 이 값만 보고 '다시 입력'을 그릴지 정한다(EXT-01B의 drawnWhen).
// **열쇠가 영수증이다.** 낼 때 서버가 사람마다 다른 값을 돌려주고 결과는 그것으로
// 찾는다 — QR의 토큰으로 찾으면 같은 QR을 찍은 여러 사람이 서로의 이름과 결과를
// 본다. 여기 여섯은 여섯 가지 결과를 보여 주려고 둔 것이고, 진짜 서버라면
// 낸 횟수만큼 있다.
const ATTENDANCE_CHECK_IN_RESULT: Record<string, DataRow> = {
  'RCPT-A7K2M9': {
    label: '참석 완료',
    tone: 'green',
    iconName: 'check',
    description: '2026. 08. 20 09:47 체크인되었습니다.',
    canRetry: false,
  },
  'RCPT-B3N8P4': {
    label: '참가자 명단 불일치',
    tone: 'yellow',
    iconName: 'circle-alert',
    description: '입력하신 정보가 명단에 없습니다. 운영진에게 문의해 주세요.',
    canRetry: true,
  },
  'RCPT-C5Q1R6': {
    label: '이미 참석 처리됨',
    tone: 'blue',
    iconName: 'info',
    description: '이미 참석 확인이 완료된 상태입니다.',
    canRetry: false,
  },
  'RCPT-D8W4X2': {
    label: '조건 미충족',
    tone: 'red',
    iconName: 'x',
    description: '참가비 미납 또는 신청 미완료 상태입니다.',
    canRetry: false,
  },
  'RCPT-E2Y7Z5': {
    label: '체크인 시간 전·후',
    tone: 'gray',
    iconName: 'clock',
    description: '체크인 가능 시간이 아닙니다. (09:30 ~ 11:00)',
    canRetry: false,
  },
  'RCPT-F6H1J3': {
    label: '비활성화된 QR',
    tone: 'gray',
    iconName: 'x',
    description: '이 QR은 더 이상 사용할 수 없습니다.',
    canRetry: false,
  },
}

export const ATTENDANCE_FILTERED_FIXTURES: Record<
  string,
  (params: Record<string, string>) => DataRow[]
> = {
  // 인자가 가리키는 행사에 아직 QR이 없으면 빈 목록이고, 그것은 '개발용 응답이
  // 없다'가 아니라 **아직 만들지 않았다**다(readDataSource가 NOT_FOUND로 가른다).
  'event.attendanceQr': ({ eventId = '' }) => {
    const row = EVENT_ATTENDANCE_QR[eventId]
    return row === undefined ? [] : [row]
  },
  // 밖에서 온 사람이 QR로 찾는다. 토큰이 가리키는 것이 없으면 빈 목록이고, 그것은
  // '개발용 응답이 없다'가 아니라 **찾지 못했다**다.
  'attendance.checkInForm': ({ checkInToken = '' }) => {
    const row = ATTENDANCE_CHECK_IN_FORM[checkInToken]
    return row === undefined ? [] : [row]
  },
  // **영수증으로 찾는다.** QR의 토큰으로 찾으면 같은 QR을 찍은 여러 사람이 서로의
  // 이름과 결과를 본다 — 열쇠가 사람마다 달라야 한다.
  'attendance.checkInResult': ({ receiptToken = '' }) => {
    const row = ATTENDANCE_CHECK_IN_RESULT[receiptToken]
    return row === undefined ? [] : [row]
  },
}
