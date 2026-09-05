import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createApp } from '../../../api/src/app.ts'
import { freshDb } from '../../../api/src/db/testing.ts'
import { inMemoryCounter } from '../../../api/src/public/rate-limit.ts'
import { inMemoryAttempts } from '../../../api/src/idempotency.ts'
import {
  attendanceCheckIns,
  attendanceQrs,
  departments,
  events,
  members,
  organizations,
  surveyApplications,
  surveyQuestions,
  surveys,
  users,
} from '../../../api/src/db/schema.ts'
import { ScreenRouter } from '../screens/ScreenRouter'
import { fetchOptions } from '../option-sources/catalog'
import { useServer } from './server'

// **행사 참여자와 참여 설문을 서버에 붙인다**(EVT-04 · EVT-04B · EVT-05).
//
// 세 화면이 통째로 '아직 준비 중'이었다. 자리 열이 비어 있었기 때문인데, 그중
// EVT-04B는 **자기 자리를 하나도 안 갖는다** — 그 모달이 읽는 `event.attendanceQr`는
// 이미 붙어 있었고, 뒤에 남는 EVT-04(명세의 overlay)가 못 서서 함께 닫혀 있었다.
// 겹쳐 뜨는 화면은 뒤 화면의 자리까지 함께 읽는다.
//
// 재는 것은 **그 값이 서버에서 왔다는 것**이다. 그래서 개발용 응답에 없는 말로
// 고른다(사람 이름·학부 이름·문항 제목). 그리고 어느 화면도 '준비 중'이 아니어야
// 한다 — 자리 하나가 안 붙으면 바깥 그물이 화면을 통째로 가린다.

const NOW = new Date('2026-08-15T10:00:00+09:00')
let made = 0

let restore: () => void
let close: () => Promise<void>

beforeAll(async () => {
  const fresh = await freshDb()
  close = fresh.close

  await fresh.db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    // **옆 학생회를 하나 더 둔다.** 울타리를 재려면 넘어갈 담이 있어야 한다.
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await fresh.db.insert(departments).values({ id: 'D-01', orgId: 'ORG-01', name: '학술체육부' })
  await fresh.db.insert(users).values({ id: 'U-01', email: 'bada@example.ac.kr' })
  await fresh.db.insert(members).values({
    id: 'M-01',
    orgId: 'ORG-01',
    name: '김바다',
    role: 'chair',
    major: '컴퓨터학부',
    grade: '3학년',
    departmentId: 'D-01',
    userId: 'U-01',
  })

  await fresh.db.insert(events).values([
    // 참가자 명단과 설문이 걸린 행사. **다 채운 것은 아니다** — 조건 목록이
    // 빨간 줄을 그리는 것을 보려면 빈 자리가 남아 있어야 한다.
    {
      id: 'E-01',
      orgId: 'ORG-01',
      title: '2026 소프트웨어융합대학 체육대회',
      status: 'inProgress',
      startAt: new Date('2026-08-20T10:00:00+09:00'),
      endAt: new Date('2026-08-20T17:00:00+09:00'),
      place: 'ERICA 체육관',
      audience: '소프트웨어융합대학 전체',
      feeType: 'fixed',
      capacityType: 'limited',
      capacityCount: 200,
      hostDepartmentId: 'D-01',
      hostMemberId: 'M-01',
      contact: '카카오톡 채널 @swcollege',
      updatedAt: NOW,
    },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사', updatedAt: NOW },
  ])

  await fresh.db.insert(surveys).values([
    {
      id: 'S-01',
      orgId: 'ORG-01',
      eventId: 'E-01',
      linkToken: 'SURVEY-TOKEN',
      active: false,
      opensAt: new Date('2026-08-01T09:00:00+09:00'),
      // **신청 마감을 안 적어 두었다.** 조건 목록의 빨간 줄이 이것이다.
      applyMethod: 'approval',
      duesCheck: true,
      completionTitle: '신청이 완료되었습니다. 행사 당일 QR을 준비해 주세요.',
    },
    { id: 'S-99', orgId: 'ORG-02', eventId: 'E-99', linkToken: 'OTHER-TOKEN' },
  ])

  await fresh.db.insert(surveyQuestions).values([
    {
      id: 'SQ-01',
      orgId: 'ORG-01',
      surveyId: 'S-01',
      sortOrder: 0,
      title: '참가 종목 선택',
      type: 'choice',
      required: true,
    },
    {
      id: 'SQ-02',
      orgId: 'ORG-01',
      surveyId: 'S-01',
      sortOrder: 1,
      title: '개인정보 수집·이용 동의',
      type: 'privacy',
      required: true,
      locked: true,
    },
  ])

  await fresh.db.insert(surveyApplications).values([
    {
      id: 'SA-01',
      surveyId: 'S-01',
      name: '차오름',
      studentNumber: '2022111111',
      department: '컴퓨터학부',
      applyStatus: 'applied',
      payStatus: 'paid',
      receiptHash: 'H-01',
      receiptExpiresAt: NOW,
      privacyConsentAt: NOW,
      at: new Date('2026-08-01T10:00:00+09:00'),
    },
    {
      id: 'SA-02',
      surveyId: 'S-01',
      name: '한여름',
      studentNumber: '2023222222',
      department: 'ICT융합학부',
      applyStatus: 'waitlisted',
      receiptHash: 'H-02',
      receiptExpiresAt: NOW,
      privacyConsentAt: NOW,
      at: new Date('2026-08-02T10:00:00+09:00'),
    },
    // 남의 학생회의 신청. 이 명단에 나오면 안 된다.
    {
      id: 'SA-99',
      surveyId: 'S-99',
      name: '남의 신청자',
      studentNumber: '2020999999',
      receiptHash: 'H-99',
      receiptExpiresAt: NOW,
      privacyConsentAt: NOW,
    },
  ])

  // 찍고 간 사람 하나. 셋째 딱지는 이 표가 정한다.
  await fresh.db.insert(attendanceQrs).values({
    id: 'QR-01',
    orgId: 'ORG-01',
    eventId: 'E-01',
    tokenHash: 'QR-HASH-01',
    active: true,
  })
  await fresh.db.insert(attendanceCheckIns).values({
    id: 'CI-01',
    qrId: 'QR-01',
    name: '차오름',
    studentNumber: '2022111111',
    receiptHash: 'CI-HASH-01',
    receiptExpiresAt: NOW,
    matched: true,
  })

  const app = createApp({
    audit: { async write() {} },
    db: fresh.db as never,
    who: async () => ({
      userId: 'U-01',
      membership: {
        orgId: 'ORG-01',
        memberId: 'M-01',
        role: 'chair',
        departmentId: 'D-01',
        inFinanceDepartment: false,
      },
    }),
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      isMeetingHost: async () => false,
      isMeetingCreator: async () => false,
      isMeetingParticipant: async () => false,
    },
    signIn: {
      open: () => ({ google: true, kakao: false }),
      start: async (provider: string) => ({ url: `https://example.test/${provider}` }),
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    invite: { linkBase: 'https://vada.app/join', now: () => NOW, newCode: () => 'CODE' },
    newId: () => `X-${(made += 1)}`,
  })

  restore = useServer({
    baseUrl: 'http://server',
    fetch: async (input, init) => app.request(String(input), init),
  })
}, 60_000)

afterAll(async () => {
  restore()
  await close()
})

const NOT_BUILT = '이 화면은 아직 준비 중입니다.'

function draw(screenId: string) {
  render(
    <ScreenRouter
      screenId={screenId}
      screenParams={{ eventId: 'E-01' }}
      scopes={{}}
      onChangeScope={() => {}}
      onNavigate={() => {}}
    />,
  )
}

describe('행사 참가자 명단이 저장소에서 온다', () => {
  it('EVT-04가 신청자와 그 딱지 셋을 그린다', async () => {
    draw('EVT-04')
    await waitFor(() => expect(screen.getByText('차오름')).toBeInTheDocument())
    const drawn = document.body.textContent ?? ''
    expect(drawn).toContain('2022111111')
    expect(drawn).toContain('컴퓨터학부')
    // 딱지의 말은 서버가 만든다 — 표에 든 것은 갈래뿐이다.
    expect(screen.getByText('신청 완료')).toBeInTheDocument()
    expect(screen.getByText('납부 확인')).toBeInTheDocument()
    // QR을 찍은 사람만 참석이다.
    expect(screen.getByText('참석')).toBeInTheDocument()
    expect(screen.getByText('대기 중')).toBeInTheDocument()
    // **남의 학생회 신청자는 오지 않는다.**
    expect(drawn).not.toContain('남의 신청자')
    expect(drawn).not.toContain(NOT_BUILT)
  })

  // **화면이 수에 '명'을 붙이지 않는다.** 무엇을 세어 뭐라 부르는지는 서버가 안다.
  it('센 것과 쪽 수가 서버에서 온다', async () => {
    draw('EVT-04')
    await waitFor(() => expect(screen.getByText('총 2명')).toBeInTheDocument())
    expect(document.body.textContent).not.toContain(NOT_BUILT)
  })

  // **고르는 목록도 같은 서버에서 온다.** 이 칸들은 메뉴를 열어야 부르므로
  // (`loadOn: open`) 화면을 그리는 것으로는 지나지 않는다 — 그 길을 따로 지난다.
  it('거르는 선택지 넷이 저장소에서 온다', async () => {
    expect(await fetchOptions('event.participantAffiliations', { eventId: 'E-01' })).toEqual([
      { value: 'ICT융합학부', label: 'ICT융합학부' },
      { value: '컴퓨터학부', label: '컴퓨터학부' },
    ])
    expect(await fetchOptions('event.participantApplyStatus', { eventId: 'E-01' })).toEqual([
      { value: '신청 완료', label: '신청 완료' },
      { value: '대기 중', label: '대기 중' },
    ])
    expect(await fetchOptions('event.participantPayStatus', { eventId: 'E-01' })).toEqual([
      { value: '납부 확인', label: '납부 확인' },
      { value: '미납', label: '미납' },
      { value: '미확인', label: '미확인' },
    ])
    // 행사 전에는 미확인뿐이고 당일에 늘어난다 — 하나가 찍고 갔으므로 둘이다.
    expect(await fetchOptions('event.participantAttendStatus', { eventId: 'E-01' })).toEqual([
      { value: '참석', label: '참석' },
      { value: '미확인', label: '미확인' },
    ])
  })

  // **겹쳐 뜨는 화면은 뒤 화면의 자리까지 읽는다.** 이 모달 자신의 자리는 진작
  // 붙어 있었는데 뒤의 EVT-04가 못 서서 함께 닫혀 있었다.
  it('EVT-04B가 명단 위에 열린다', async () => {
    draw('EVT-04B')
    // 같은 말이 둘이다 — 뒤 화면의 단추와 모달의 머리글.
    await waitFor(() => expect(screen.getAllByText('참석 확인 QR')).toHaveLength(2))
    // 뒤 화면이 그대로 남는다.
    expect(screen.getByText('차오름')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain(NOT_BUILT)
  })
})

describe('참여 설문을 세우는 자리가 저장소에서 온다', () => {
  it('EVT-05가 모집 설정을 저장소의 값으로 채운다', async () => {
    draw('EVT-05')
    await waitFor(() =>
      expect(
        screen.getByText('신청이 완료되었습니다. 행사 당일 QR을 준비해 주세요.'),
      ).toBeInTheDocument(),
    )
    // 신청 방식은 승인제로 저장돼 있다 — 고른 것이 서버에서 온다.
    expect(screen.getByRole('radio', { name: '관리자 승인' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '선착순' })).not.toBeChecked()
    // 참거짓이 체크 상자가 읽는 꼴로 건너온다 — 그 사이가 어긋나면 켜 둔 것이 꺼져 보인다.
    expect(screen.getByLabelText('학생회비 납부 여부 대조')).toBeChecked()
    expect(document.body.textContent).not.toContain(NOT_BUILT)
  })

  // **막는 것은 서버다.** 무엇이 모자란지를 화면이 세면 조직의 규칙이 화면에 적힌다.
  it('활성화 조건과 못 채운 수가 서버에서 온다', async () => {
    draw('EVT-05')
    await waitFor(() => expect(screen.getByText('설문 링크 활성화 조건')).toBeInTheDocument())
    const drawn = document.body.textContent ?? ''
    expect(drawn).toContain('행사 기본정보')
    expect(drawn).toContain('참여 설문 설정')
    // 신청 마감을 안 적어 두었다 — 그 한 줄만 빨갛고, 딱지의 수가 그것과 같다.
    expect(screen.getByText('신청 마감 일시가 설정되지 않았습니다')).toBeInTheDocument()
    expect(screen.getByText('모집 설정에서 입력 →')).toBeInTheDocument()
    expect(screen.getByText('미충족 1개')).toBeInTheDocument()
    expect(drawn).not.toContain(NOT_BUILT)
  })

  // 갈래의 말은 명세가 들고(`event.surveyQuestionTypes`) 어느 갈래인지는 표가 든다.
  it('설문 문항이 저장소에서 온다', async () => {
    draw('EVT-05')
    await waitFor(() => expect(screen.getByText('참가 종목 선택')).toBeInTheDocument())
    const drawn = document.body.textContent ?? ''
    expect(drawn).toContain('개인정보 수집·이용 동의')
    expect(screen.getAllByText('객관식').length).toBeGreaterThan(0)
    // 딱지의 개수가 데이터에 달렸다 — 잠긴 문항에만 '삭제 불가'가 붙는다.
    expect(screen.getByText('필수 · 삭제 불가')).toBeInTheDocument()
    expect(drawn).not.toContain(NOT_BUILT)
  })
})
