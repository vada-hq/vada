import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createApp } from '../../../api/src/app.ts'
import { freshDb } from '../../../api/src/db/testing.ts'
import { inMemoryCounter } from '../../../api/src/public/rate-limit.ts'
import { inMemoryAttempts } from '../../../api/src/idempotency.ts'
import {
  attendanceQrs,
  events,
  organizations,
  students,
  surveys,
} from '../../../api/src/db/schema.ts'
import { hashToken } from '../../../api/src/public/tokens.ts'
import { ScreenRouter } from '../screens/ScreenRouter'
import { fetchOptions } from '../option-sources/catalog'
import { runMutation } from '../spec/mutations'
import { useServer } from './server'

// **밖에서 오는 사람의 길을 끝까지 뚫는다.**
//
// 로그인이 없는 흐름이다. 설문 링크를 받은 학생이 폼을 열고, 이름과 학번을 넣고,
// 내고, 결과를 본다 — 그 사이에 세션이 한 번도 없다. **링크가 실어 온 토큰 하나가
// 유일한 벽이다.**
//
// 그림 → 명세 → 계약 → 서버 → 저장소가 한 줄로 이어지는지가 이 검사의 전부다.
// 앞선 흐름과 다른 점: 이 흐름은 사람이 로그인해 볼 필요가 없어 **검사가 끝까지 잰다.**

const LINK = 'SSSSSSSSSSSSSSSSSSSSSS'
const QR = 'AAAAAAAAAAAAAAAAAAAAAA'
const NOW = new Date('2026-08-15T10:00:00+09:00')
let made = 0

let restore: () => void
let close: () => Promise<void>
let request: (path: string, init?: RequestInit) => Promise<Response>

beforeAll(async () => {
  const fresh = await freshDb()
  close = fresh.close

  await fresh.db.insert(organizations).values({ id: 'ORG-01', name: '제12대 학생회' })
  await fresh.db.insert(events).values({
    id: 'E-01',
    orgId: 'ORG-01',
    title: '2026 체육대회',
    startAt: new Date('2026-08-20T10:00:00+09:00'),
    place: 'ERICA 체육관',
    audience: '소프트웨어융합대학 전체',
    fee: '납부자 무료 / 미납자 5000원',
    contact: '학생회 카카오톡 채널',
    updatedAt: NOW,
  })
  // **명단이 고를 수 있는 것을 정한다.** 단과대학과 학부는 이 학생회가 올린 명단에
  // 실제로 있는 값만 나온다 — 화면이 목록을 지어내지 않는다.
  await fresh.db.insert(students).values([
    {
      id: 'S-01',
      orgId: 'ORG-01',
      name: '김바다',
      studentNumber: '2021000001',
      college: '소프트웨어융합대학',
      department: '소프트웨어학부',
      duesStatus: 'paid',
    },
    {
      id: 'S-02',
      orgId: 'ORG-01',
      name: '이하늘',
      studentNumber: '2021000002',
      college: '소프트웨어융합대학',
      department: '인공지능학과',
      duesStatus: 'unpaid',
    },
    {
      id: 'S-03',
      orgId: 'ORG-01',
      name: '박산',
      studentNumber: '2021000003',
      college: '공학대학',
      department: '기계공학과',
      duesStatus: 'paid',
    },
  ])
  // **표에는 해시만 있다.** 원문을 담으면 저장소가 새는 날 QR도 함께 샌다.
  await fresh.db.insert(attendanceQrs).values({
    id: 'QR-01',
    orgId: 'ORG-01',
    eventId: 'E-01',
    tokenHash: hashToken(QR),
    active: true,
  })
  await fresh.db.insert(surveys).values({
    id: 'SV-01',
    orgId: 'ORG-01',
    eventId: 'E-01',
    linkToken: LINK,
    active: true,
    opensAt: new Date('2026-08-10T00:00:00+09:00'),
    closesAt: new Date('2026-08-19T23:59:00+09:00'),
    completionTitle: '참가 신청이 접수되었습니다',
  })

  const app = createApp({
    audit: { async write() {} },
    db: fresh.db as never,
    // **로그인이 없다.** 이 흐름의 모든 자리가 세션 없이 답해야 한다.
    who: async () => null,
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
    // **부를 때마다 다른 것을 준다.** 하나로 고정하면 둘째 사람이 같은 열쇠로 들어가
    // 충돌하고, 그것이 '이미 찍었다'로 잘못 읽힌다.
    newId: () => `X-${(made += 1)}`,
  })
  request = async (path, init) => app.request(path, init)

  restore = useServer({
    baseUrl: 'http://server',
    fetch: async (input, init) => request(String(input), init),
  })
}, 60_000)

afterAll(async () => {
  restore()
  await close()
})

describe('참여 신청 폼이 저장소에서 그려진다', () => {
  it('EXT-02A가 그 행사의 정보를 그린다', async () => {
    render(
      <ScreenRouter
        screenId="EXT-02A"
        screenParams={{ surveyToken: LINK }}
        scopes={{}}
        onChangeScope={() => {}}
        onNavigate={() => {}}
      />,
    )
    await waitFor(() => expect(screen.getByText('2026 체육대회')).toBeInTheDocument())
    // **서버가 완성된 글을 준다** — 화면이 장소와 대상을 이어 붙이지 않는다.
    const drawn = document.body.textContent ?? ''
    expect(drawn).toContain('ERICA 체육관')
    expect(drawn).toContain('납부자 무료 / 미납자 5000원')
  })

  // 명단에 있는 값만 고를 수 있다. 개발용 응답에는 없는 값이라 서버를 거친 증거다.
  it('고를 수 있는 단과대학이 명단에서 온다', async () => {
    expect(await fetchOptions('survey.colleges', { surveyToken: LINK })).toEqual([
      { value: '공학대학', label: '공학대학' },
      { value: '소프트웨어융합대학', label: '소프트웨어융합대학' },
    ])
  })

  it('고른 단과대학의 학부만 온다', async () => {
    expect(
      await fetchOptions('survey.departments', {
        surveyToken: LINK,
        collegeId: '소프트웨어융합대학',
      }),
    ).toEqual([
      { value: '소프트웨어학부', label: '소프트웨어학부' },
      { value: '인공지능학과', label: '인공지능학과' },
    ])
  })

  // **없는 토큰에도 빈 목록으로 답한다.** 가려 주면 그것이 토큰이 있는지 없는지를
  // 알려 주는 자리가 된다.
  it('없는 토큰은 아무것도 알려 주지 않는다', async () => {
    expect(await fetchOptions('survey.colleges', { surveyToken: 'ZZZZZZZZZZZZZZZZZZZZZZ' })).toEqual(
      [],
    )
  })
})

describe('신청을 내고 결과를 본다', () => {
  let receipt: string

  // **화면이 누르는 그 길로 낸다.** 서버를 직접 부르면 그 사이의 코드가 통째로 빠진다 —
  // 오늘 난 결함이 정확히 그 사이에 있었다.
  it('화면이 누르는 길로 신청이 저장된다', async () => {
    const answer = await runMutation(
      'survey.apply',
      {
        name: '김바다',
        studentNumber: '2021000001',
        college: '소프트웨어융합대학',
        department: '소프트웨어학부',
        currentGrade: '3학년',
        privacyConsent: true,
      },
      { surveyToken: LINK },
    )
    // 영수증은 서버가 만든다 — 사람마다 다른 값이라 화면이 지어낼 수 없다.
    expect(typeof answer.receiptToken).toBe('string')
    receipt = answer.receiptToken as string
    expect(receipt.length).toBeGreaterThan(0)
  })

  it('EXT-02B가 그 영수증으로 결과를 그린다', async () => {
    render(
      <ScreenRouter
        screenId="EXT-02B"
        screenParams={{ receiptToken: receipt }}
        scopes={{}}
        onChangeScope={() => {}}
        onNavigate={() => {}}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('참가 신청이 접수되었습니다')).toBeInTheDocument(),
    )
    // 낸 사람의 이름이 그 영수증에서만 나온다.
    expect(document.body.textContent ?? '').toContain('김바다')
  })

  // **남의 영수증으로는 열 수 없다.** 같은 링크를 여럿이 여는 자리라, 영수증이
  // 아니라 링크로 결과를 열면 서로의 이름과 결과를 본다.
  it('없는 영수증은 카탈로그의 글을 그린다', async () => {
    render(
      <ScreenRouter
        screenId="EXT-02B"
        screenParams={{ receiptToken: 'RCPT-없는것' }}
        scopes={{}}
        onChangeScope={() => {}}
        onNavigate={() => {}}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('신청 결과를 불러오지 못했습니다')).toBeInTheDocument(),
    )
  })
})

describe('QR을 찍어 참석을 남긴다', () => {
  it('EXT-01A가 그 행사의 참석 폼을 그린다', async () => {
    render(
      <ScreenRouter
        screenId="EXT-01A"
        screenParams={{ checkInToken: QR }}
        scopes={{}}
        onChangeScope={() => {}}
        onNavigate={() => {}}
      />,
    )
    await waitFor(() => expect(screen.getByText('2026 체육대회')).toBeInTheDocument())
  })

  // **화면이 누르는 그 길로 찍는다.** 서버를 직접 부르면 그 사이의 코드가 빠진다.
  it('화면이 누르는 길로 참석이 남는다', async () => {
    const answer = await runMutation(
      'attendance.checkIn',
      { name: '김바다', studentNumber: '2021000001' },
      { checkInToken: QR },
    )
    // 영수증은 서버가 만든다 — 사람마다 다르므로 화면이 지어낼 수 없다.
    expect(typeof answer.receiptToken).toBe('string')
  })

  // **결과는 그 영수증에서만 온다.** 같은 QR을 여럿이 찍으므로, QR로 결과를 열게
  // 두면 나중에 찍은 사람의 것이 앞사람에게 보인다.
  //
  // 명세는 이 자리에 이름을 담지 않는다(`label`·`tone`·`description`뿐) — 결과 화면이
  // 알려 주는 것은 **찍혔는가**이지 누가 찍었는가가 아니다. 그 판정만 잰다.
  it('찍은 사람마다 제 영수증으로 결과를 연다', async () => {
    const made = await runMutation(
      'attendance.checkIn',
      { name: '이하늘', studentNumber: '2021000002' },
      { checkInToken: QR },
    )
    const receipt = String(made.receiptToken)
    expect(receipt.length).toBeGreaterThan(0)

    render(
      <ScreenRouter
        screenId="EXT-01B"
        screenParams={{ receiptToken: receipt, checkInToken: QR }}
        scopes={{}}
        onChangeScope={() => {}}
        onNavigate={() => {}}
      />,
    )
    await waitFor(() => expect(screen.getByText('참석 완료')).toBeInTheDocument())
  })

  it('없는 영수증은 카탈로그의 글을 그린다', async () => {
    render(
      <ScreenRouter
        screenId="EXT-01B"
        screenParams={{ receiptToken: 'RCPT-없는것', checkInToken: QR }}
        scopes={{}}
        onChangeScope={() => {}}
        onNavigate={() => {}}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('참석 확인 결과를 불러오지 못했습니다')).toBeInTheDocument(),
    )
  })
})
