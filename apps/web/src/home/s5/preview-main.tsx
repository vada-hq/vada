import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { menuPath, type HomeResponse, type MyCouncil } from '@vada/contracts'
import { rewriteAddress, useHere } from '@/lib/app-location'
import { agreementResponse } from '@/test-support/agreement-fixtures'
import { councilView, PRESIDENT_PERMISSIONS, teamResponse } from '@/test-support/council-fixtures'
import CouncilWorkspace from '../../workspace/CouncilWorkspace'
import { targetOf } from '../../workspace/address'
import { HomeS5Preview, type S5Variant } from './HomeS5'
import { S5_DATA, type S5DataName } from './s5-data'
import { S7_DATA, type S7Greeting } from '../s7/s7-data'
import C1Preview from '../c1/C1Preview'
import type { C1DataName } from '../c1/c1-view'
import C1rPreview, { C1R_VARIANTS, type C1rVariant } from '../c1r/C1rPreview'
import { C1R_DATA_NAMES, type C1rDataName } from '../c1r/c1r-data'
import '../../index.css'

// S5 흑백 시안 미리보기: /home-s5.html?variant=A|B|C|B2&data=main|normal|empty[&greeting=line|date|merge]
// B2는 10/29 내용 확정판(s7). greeting은 B2에서만 쓴다.
// 실제 작업 공간(옆 메뉴 포함)을 가짜 API로 띄우고, 회장단 홈 자리만 시안으로 바꾼다(S1 1절과 같은 방법).
const params = new URLSearchParams(window.location.search)
const variant = (['A', 'B', 'C', 'B2'].includes(params.get('variant') ?? '') ? params.get('variant') : 'A') as S5Variant
const dataName = (params.get('data') ?? 'main') as S5DataName
const data = S5_DATA[dataName] ?? S5_DATA.main
const greeting = (['line', 'date', 'merge'].includes(params.get('greeting') ?? '') ? params.get('greeting') : 'line') as S7Greeting
const s7 = variant === 'B2' ? { data: S7_DATA[dataName] ?? S7_DATA.main, greeting } : undefined

const COUNCIL_ID = '0199d1a0-0000-7000-8000-0000000000c1'
const council: MyCouncil = {
  id: COUNCIL_ID,
  name: 'VADA 시연 학생회',
  unit: 'department',
  schoolName: 'VADA 시연 학교',
  councilRank: 'president',
  departments: [],
}
const base = `/api/organizations/${COUNCIL_ID}`

const view = councilView(COUNCIL_ID, { name: council.name, permissions: PRESIDENT_PERMISSIONS })
view.me.name = data.name

// 홈 읽기는 회장단 홈 종류만 맞으면 된다(그리는 내용은 시안 견본 데이터).
const home = {
  today: data.today,
  kind: 'council',
  financeView: false,
  asOf: `${data.today}T09:00`,
  myTasks: { open: data.myTasks.open, overdue: 0, nearest: null },
  featuredEvents: [],
  participating: { events: [], total: 0 },
  upcoming: { items: [], total: 0 },
  myRequests: { requests: [], total: 0 },
  mine: { tasks: [], counts: { overdue: 0, today: 0, soon: 0, later: 0, noDue: 0 } },
  councilBoard: {
    financeStaffed: true,
    events: { cards: [], counts: { planning: 0, ongoing: 0, followUp: 0 } },
    followUp: { events: [], total: 0 },
    attention: { items: [], total: 0 },
    unassignedMembers: 0,
  },
} satisfies HomeResponse

const room = (id: string, name: string | null, type: string, unread: number) => ({
  id,
  type,
  name,
  departmentId: null,
  readOnly: false,
  unread,
  mentions: 0,
  lastMessageAt: '2026-10-29T00:00:00.000Z',
  lastMessage: null,
  memberCount: 3,
})
const rooms = data.rooms.map(item =>
  room(item.id, item.name.replace(' · 1:1', ''), item.name.includes('1:1') ? 'direct' : 'all_members', item.unread),
)

const sideEvents = [
  { id: 'ev-1', name: '가을 축제', status: 'ongoing' },
  { id: 'ev-2', name: '진로 특강', status: 'upcoming' },
  { id: 'ev-3', name: '2026 소프트웨어융합대학 체육대회 및 학과 대항 e스포츠 리그', status: 'upcoming' },
  { id: 'ev-4', name: '겨울 MT', status: 'tbd' },
  { id: 'ev-5', name: '신입생 환영회', status: 'ended' },
]

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const routes: Record<string, () => Response> = {
  'GET /api/me/agreement': () => json(agreementResponse()),
  // 알림 서버 꺼짐(404)이면 알림 꺼짐 띠가 없다. 띠는 측정 때 56px를 더해 본다(규칙 K8).
  'GET /api/me/push': () => json({ error: 'NOT_FOUND' }, 404),
  [`GET ${base}`]: () => json(view),
  [`GET ${base}/members`]: () => json(teamResponse()),
  [`GET ${base}/rooms`]: () =>
    json({ rooms, unreadTotal: rooms.reduce((sum, item) => sum + item.unread, 0), mentionTotal: 0 }),
  [`GET ${base}/home`]: () => json(home),
  [`GET ${base}/events/open`]: () => json({ events: dataName === 'empty' ? [] : sideEvents, more: false }),
  [`GET ${base}/tasks?view=mine&status=open`]: () => json({ tasks: [], truncated: false }),
}

window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin)
  const method = (init?.method ?? 'GET').toUpperCase()
  const key = `${method} ${url.pathname}${url.search}`
  const handler = routes[key] ?? routes[`${method} ${url.pathname}`]
  if (handler) return handler()
  console.warn(`[s5] 가짜 API에 없는 요청: ${key}`)
  return json({ error: 'NOT_FOUND' }, 404)
}) as typeof fetch

window.history.replaceState(null, '', menuPath('home', COUNCIL_ID))

function Workspace() {
  const target = targetOf(useHere(), [council])
  const moved = target.kind === 'moved' ? target.to : null
  useEffect(() => {
    if (moved) rewriteAddress(moved)
  }, [moved])
  if (target.kind !== 'ready') return null
  return (
    <CouncilWorkspace
      council={council}
      councils={[council]}
      target={target}
      onSelect={() => {}}
      returnFocusTo={null}
      user={{ id: 'u1', name: data.name, email: 'kim@example.com' }}
      logoutBusy={false}
      onLogout={() => {}}
      onCouncilsChanged={() => {}}
      onCouncilLost={() => {}}
    />
  )
}

// 실제 앱은 작업 공간을 h-dvh 열(SignedInView) 안에 둔다. 미리보기에 그 열이 없어 짧은 페이지에서 옆 메뉴 바탕이
// 내용 높이에서 끊겼다(S6 검토). 미리보기는 페이지 전체를 찍어야 해서 h-dvh 대신 min-h-dvh로 같은 높이를 채운다.
// C1: ① 컴포넌트 하나만 띄운다(작업 공간 없음). /home-s5.html?component=c1&variant=A|B&data=main|many|normal
// C1R: ① 컴포넌트 시안 절차(P3~)의 판. /home-s5.html?component=c1r&variant=0|1|2|3&data=main|many|assign|normal|empty
const c1 = params.get('component') === 'c1'
const c1r = params.get('component') === 'c1r'
const c1rVariant = (Object.keys(C1R_VARIANTS).includes(params.get('variant') ?? '') ? params.get('variant') : '0') as C1rVariant
const c1rData = (C1R_DATA_NAMES.includes(params.get('data') as C1rDataName) ? params.get('data') : 'main') as C1rDataName
createRoot(document.getElementById('root')!).render(
  c1r ? (
    <StrictMode>
      <C1rPreview variant={c1rVariant} data={c1rData} />
    </StrictMode>
  ) : c1 ? (
    <StrictMode>
      <C1Preview variant={params.get('variant') === 'B' ? 'B' : 'A'} data={(params.get('data') ?? 'main') as C1DataName} />
    </StrictMode>
  ) : (
  <StrictMode>
    <HomeS5Preview.Provider value={{ variant, data, s7 }}>
      <div className="flex min-h-dvh flex-col">
        <Workspace />
      </div>
    </HomeS5Preview.Provider>
  </StrictMode>
  ),
)
