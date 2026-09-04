import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createApp } from '../../../api/src/app.ts'
import { freshDb } from '../../../api/src/db/testing.ts'
import { inMemoryCounter } from '../../../api/src/public/rate-limit.ts'
import { inMemoryAttempts } from '../../../api/src/idempotency.ts'
import {
  attendanceQrs,
  departments,
  events,
  members,
  organizations,
  users,
} from '../../../api/src/db/schema.ts'
import { hashToken } from '../../../api/src/public/tokens.ts'
import { ScreenRouter } from '../screens/ScreenRouter'
import { readListSource, readObjectSource } from './catalog'
import { draftValueOf, payloadOf } from '../spec/draft-values'
import { runMutation } from '../spec/mutations'
import { evt02b } from '../spec/screens'
import { loadSources, useServer } from './server'

// **행사의 앞자락을 끝까지 뚫는다.**
//
// 서버는 이 여덟 자리를 이미 답하고 있었다. 그런데 화면은 개발용 응답을 그렸다 —
// 조직 보기에서 겪은 것과 같은 모양이고, 그때 배운 것이 이것이다: **자리를 만든
// 것과 그 자리가 쓰이는 것은 다른 일이다.** 그 사이가 비어 있으면 아무 검사도
// 안 터지고, 사람이 배포된 화면을 눌러 보고서야 안다.
//
// 여기서 재는 여덟:
//
// | 읽기 | 쓰기 |
// | --- | --- |
// | `event.list`(EVT-00A) | `event.create`(EVT-00B) |
// | `event.basics`(EVT-02) | `event.saveBasics`(EVT-02B) |
// | `event.basicsDraft`(EVT-02B) | `event.attendanceQr.regenerate`(EVT-04B) |
// | `event.attendanceQr`(EVT-04B) | `event.attendanceQr.deactivate`(EVT-04B) |
//
// **쓰기는 화면이 누르는 그 길로 보낸다**(`runMutation`). 서버를 직접 부르면 그
// 사이의 코드가 통째로 빠지고, 앞서 난 결함이 정확히 그 사이에 있었다.

const NOW = new Date('2026-08-15T10:00:00+09:00')
let made = 0

let app: ReturnType<typeof createApp>
let restore: () => void
let close: () => Promise<void>

/** 뿌려 둔 QR의 열쇠. 다시 만들면 이것이 죽어야 한다. */
const POSTER = 'AAAAAAAAAAAAAAAAAAAAAA'

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
    departmentId: 'D-01',
    userId: 'U-01',
  })

  await fresh.db.insert(events).values([
    // 다 채워진 행사. 개발용 응답에 없는 이름이라 서버를 거친 증거가 된다.
    {
      id: 'E-01',
      orgId: 'ORG-01',
      title: '2026 소프트웨어융합대학 체육대회',
      status: 'inProgress',
      startAt: new Date('2026-08-20T10:00:00+09:00'),
      place: 'ERICA 체육관',
      // **참거짓 칸을 켜 둔다.** 서버는 참거짓을 주고 화면의 체크 상자는 글을
      // 다루므로 그 사이가 어긋날 수 있는 자리다 — 켜 두지 않으면 어긋나도 안 보인다.
      endUnset: true,
      hostDepartmentId: 'D-01',
      updatedAt: new Date('2026-08-15T09:30:00+09:00'),
    },
    // **아직 아무것도 안 채운 행사.** 무엇이 비었는지를 서버가 말해야 한다.
    {
      id: 'E-02',
      orgId: 'ORG-01',
      title: '2026 신입생 환영회',
      status: 'planning',
      updatedAt: new Date('2026-08-13T09:00:00+09:00'),
    },
    // **끝난 행사는 목록에 오지 않는다** — 머리의 별도 이동이 그것을 본다.
    {
      id: 'E-03',
      orgId: 'ORG-01',
      title: '2026 새내기 배움터',
      status: 'done',
      updatedAt: new Date('2026-08-01T09:00:00+09:00'),
    },
    // 옆 학생회의 행사. 이 목록에 나오면 안 된다.
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사', updatedAt: NOW },
  ])

  // **표에는 해시만 있다.** 원문을 담으면 저장소가 새는 날 QR도 함께 샌다.
  await fresh.db.insert(attendanceQrs).values({
    id: 'QR-01',
    orgId: 'ORG-01',
    eventId: 'E-01',
    tokenHash: hashToken(POSTER),
    active: true,
    opensAt: new Date('2026-08-20T09:00:00+09:00'),
    closesAt: new Date('2026-08-20T18:00:00+09:00'),
  })

  app = createApp({
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
    },
    signIn: {
      open: () => ({ google: true, kakao: false }),
      start: async (provider: string) => ({ url: `https://example.test/${provider}` }),
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    invite: { linkBase: 'https://vada.app/join', now: () => NOW, newCode: () => 'CODE' },
    // **부를 때마다 다른 것을 준다.** 하나로 고정하면 둘째가 같은 열쇠로 들어가
    // 충돌한다 — 이 저장소에서 두 번 겪은 일이다.
    newId: () => `X-${(made += 1)}`,
  })

  // **인자를 그대로 넘긴다.** 주소만 넘기면 쓰기가 전부 GET이 되어 '그 자리는
  // 명세에 없다'로 막힌다 — 검사 쪽 그물이 성기면 진짜 결함이 안 보인다.
  restore = useServer({
    baseUrl: 'http://server',
    fetch: async (input, init) => app.request(String(input), init),
  })
}, 60_000)

afterAll(async () => {
  restore()
  await close()
})

describe('행사 목록이 저장소에서 온다', () => {
  it('EVT-00A가 이 학생회의 행사를 그린다', async () => {
    render(
      <ScreenRouter screenId="EVT-00A" scopes={{}} onChangeScope={() => {}} onNavigate={() => {}} />,
    )
    await waitFor(() =>
      expect(screen.getByText('2026 소프트웨어융합대학 체육대회')).toBeInTheDocument(),
    )
    const drawn = document.body.textContent ?? ''
    // **끝난 행사도 남의 행사도 없다.** 둘 중 하나라도 보이면 개발용 응답이거나
    // 울타리가 없는 것이다.
    expect(drawn).not.toContain('2026 새내기 배움터')
    expect(drawn).not.toContain('남의 행사')
  })

  // **무엇이 비었는지는 서버가 말한다.** 화면이 빈 칸을 세면 화면마다 답이 갈린다.
  it('아직 안 채운 것을 완성된 문구로 준다', async () => {
    await loadSources([{ key: 'event.list', params: { query: '', status: '' } }])
    const rows = readListSource('event.list', { query: '', status: '' })
    const empty = rows.find((row) => row.title === '2026 신입생 환영회')!
    expect((empty.highlights as Array<{ label: string }>).map((one) => one.label)).toEqual([
      '일시가 아직 없습니다',
      '장소가 아직 없습니다',
      '담당이 아직 없습니다',
    ])
    // 다 채운 행사에는 아무것도 안 뜬다. 맡은 곳도 이어 붙인 글로 온다.
    const full = rows.find((row) => row.title === '2026 소프트웨어융합대학 체육대회')!
    expect(full.highlights).toEqual([])
    expect(full.host).toBe('학술체육부')
  })

  // 거르는 것도 서버가 한다. 개발용 응답의 행사 이름과 겹치지 않는 말로 찾는다.
  it('행사명으로 거르는 것을 서버가 한다', async () => {
    await loadSources([{ key: 'event.list', params: { query: '환영회', status: '' } }])
    expect(readListSource('event.list', { query: '환영회', status: '' }).map((row) => row.title)).toEqual([
      '2026 신입생 환영회',
    ])
  })
})

describe('행사를 만든다', () => {
  // **화면이 누르는 그 길로 만든다.** 서버를 직접 부르면 그 사이가 빠진다.
  it('EVT-00B가 누르는 길로 행사가 생긴다', async () => {
    const answer = await runMutation('event.create', { title: '2026 가을 축제' }, {})
    // 새 행사의 id는 서버가 만든다 — 화면이 지어낼 수 없다.
    expect(typeof answer.id).toBe('string')

    await loadSources([{ key: 'event.list', params: { query: '가을 축제', status: '' } }])
    expect(
      readListSource('event.list', { query: '가을 축제', status: '' }).map((row) => row.title),
    ).toEqual(['2026 가을 축제'])
  })
})

describe('기본정보를 읽고 고친다', () => {
  // **EVT-02B는 아직 못 연다 — 뒤에 남는 화면이 안 지어졌다.**
  //
  // 이 패널 자신의 자리는 다 붙었다(`event.basicsDraft`·`event.saveBasics`). 그런데
  // 명세가 이것을 EVT-02 위에 겹쳐 뜨는 것으로 적었고(`overlay.screenId`), 그 뒤
  // 화면이 읽는 여섯이 아직 없다. 사람도 EVT-02를 지나지 않고는 여기 못 온다.
  //
  // **한동안 이 검사가 통과했다.** 개발용 응답이 그 여섯을 채워 주고 있었기 때문이다 —
  // 검사도 배포와 같은 거짓말을 하고 있었다(2026-09-05).
  it('EVT-02B는 뒤 화면이 아직이라 준비 중을 그린다', async () => {
    render(
      <ScreenRouter
        screenId="EVT-02B"
        screenParams={{ eventId: 'E-01' }}
        scopes={{}}
        onChangeScope={() => {}}
        onNavigate={() => {}}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('이 화면은 아직 준비 중입니다.')).toBeInTheDocument(),
    )
  })

  // **켜져 있는 것이 켜져 보여야 한다.**
  //
  // 아무도 옮겨 주지 않으면 서버의 `true`가 초안에서 `'true'`가 되고 체크 상자는
  // `'y'`를 보므로 **꺼져 보인다** — 그리고 그대로 저장하면 켜져 있던 것이 꺼진다.
  // 회의 쪽에서 같은 자리가 드러났고(비공개 회의가 공개가 된다) 이 화면이 이미
  // 그러고 있었다(2026-09-04).
  //
  // 화면을 그려서 재던 자리인데 위의 까닭으로 못 그린다. 그래서 **화면이 쓰는 그
  // 두 함수**를 진짜 서버의 답에 대고 잰다 — 읽을 때 옮기는 것과 보낼 때 되돌리는 것.
  it('서버의 참거짓이 체크 상자가 읽는 꼴로 오간다', async () => {
    await loadSources([{ key: 'event.basicsDraft', params: { eventId: 'E-01' } }])
    const fromDb = readObjectSource('event.basicsDraft', { eventId: 'E-01' })
    // 서버는 참거짓을 준다.
    expect(fromDb.endUnset).toBe(true)
    // 초안은 체크 상자가 아는 꼴로 담는다. `String(true)`였다면 'true'다.
    expect(draftValueOf(fromDb.endUnset)).toBe('y')

    // 보낼 때 되돌린다. 'y'를 그대로 보내면 서버가 422로 막는다.
    const body = payloadOf(evt02b, { title: '체크 확인용', endUnset: 'y', placeUnset: '' })
    expect(body).toMatchObject({ endUnset: true, placeUnset: false })
    await runMutation('event.saveBasics', body, { eventId: 'E-01' })

    await loadSources([{ key: 'event.basicsDraft', params: { eventId: 'E-01' } }])
    expect(readObjectSource('event.basicsDraft', { eventId: 'E-01' }).endUnset).toBe(true)
  })

  // **화면이 누르는 그 길로 저장한다.**
  it('저장이 저장소에 남는다', async () => {
    await runMutation(
      'event.saveBasics',
      { title: '2026 소프트웨어융합대학 한마당', place: '학생회관 대강당' },
      { eventId: 'E-01' },
    )
    await loadSources([{ key: 'event.basics', params: { eventId: 'E-01' } }])
    expect(readObjectSource('event.basics', { eventId: 'E-01' }).title).toBe(
      '2026 소프트웨어융합대학 한마당',
    )
  })
})

describe('참석 확인 QR을 만들고 끈다', () => {
  it('EVT-04B가 저장소의 QR 상태를 그린다', async () => {
    await loadSources([{ key: 'event.attendanceQr', params: { eventId: 'E-01' } }])
    // 8월 15일에는 아직 열리기 전이다 — 상태는 시각이 정한다.
    expect(readObjectSource('event.attendanceQr', { eventId: 'E-01' }).statusLabel).toBe('시작 전')
  })

  // **되돌릴 수 없다.** 뿌린 포스터의 QR이 전부 죽는다 — 그것이 이 자리의 값이므로
  // 표의 해시가 아니라 **밖에서 오는 사람의 문**으로 잰다. 열쇠만 바꾸고 문이 그대로
  // 열려 있으면 바뀐 것이 아니다.
  it('다시 만들면 뿌려 둔 QR이 죽는다', async () => {
    const opens = async () =>
      (await app.request(`/api/public/attendance/check-in-form?checkInToken=${POSTER}`)).status

    expect(await opens()).toBe(200)
    await runMutation('event.attendanceQr.regenerate', {}, { eventId: 'E-01' })
    expect(await opens()).toBe(404)
  })

  it('끄면 상태가 저장소에서 바뀐다', async () => {
    await runMutation('event.attendanceQr.deactivate', {}, { eventId: 'E-01' })
    await loadSources([{ key: 'event.attendanceQr', params: { eventId: 'E-01' } }])
    expect(readObjectSource('event.attendanceQr', { eventId: 'E-01' }).statusLabel).toBe('비활성화됨')
  })
})
