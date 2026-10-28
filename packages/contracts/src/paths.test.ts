import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  APP_MENUS,
  appPath,
  ENTRY_PATHS,
  eventRoomPath,
  menuPath,
  parentOf,
  parseAppPath,
  RECORD_KINDS,
  recordPath,
} from './paths.js'
import { movedLocationOf, type AddressMove } from './moved-paths.js'

const C = '0199d1a0-0000-7000-8000-00000000000a'
const R = '0199d1a0-0000-7000-8000-00000000000b'
const P = '0199d1a0-0000-7000-8000-00000000000c'

test('메뉴 열하나와 기록 종류 여섯마다 만들고 다시 읽으면 같은 값이다', () => {
  assert.equal(APP_MENUS.length, 11)
  assert.equal(RECORD_KINDS.length, 6)
  for (const menu of APP_MENUS) {
    const path = menuPath(menu, C)
    assert.equal(path, `/${menu}/${C}`)
    assert.deepEqual(parseAppPath(path), { type: 'menu', menu, councilId: C, query: {} })
  }
  for (const record of RECORD_KINDS) {
    const path = recordPath(record, C, R)
    assert.equal(path, `/${record}/${C}/${R}`)
    assert.deepEqual(parseAppPath(path), {
      type: 'record',
      record,
      councilId: C,
      recordId: R,
      query: {},
    })
  }
})

test('탭과 거르기는 쿼리로 오가고, 기본값은 주소에 두지 않는다', () => {
  const tasks = menuPath('tasks', C, { view: 'all', filter: 'done', layout: 'calendar', dept: P })
  assert.equal(tasks, `/tasks/${C}?view=all&filter=done&layout=calendar&dept=${P}`)
  assert.deepEqual(parseAppPath(tasks), {
    type: 'menu',
    menu: 'tasks',
    councilId: C,
    query: { view: 'all', filter: 'done', layout: 'calendar', dept: P },
  })
  assert.equal(
    menuPath('tasks', C, { view: 'mine', filter: 'open', layout: 'board' }),
    `/tasks/${C}?view=mine`,
  )
  // 배치의 기본은 보드다(DEC-94). 표는 018의 값 list 그대로 주소에 남는다.
  assert.equal(menuPath('tasks', C, { layout: 'list' }), `/tasks/${C}?layout=list`)
  assert.deepEqual(parseAppPath(`/tasks/${C}?layout=board`)?.query, {})
  const finance = menuPath('finance', C, { tab: 'fees', view: 'pending', period: P })
  assert.equal(finance, `/finance/${C}?tab=fees&view=pending&period=${P}`)
  assert.equal(appPath(parseAppPath(finance)!), finance)
  // 공지 모아 보기는 없다(DEC-90). 옛 주소의 tab=notices는 버린다.
  assert.equal(menuPath('chat', C, { tab: 'notices' }), `/chat/${C}`)
  assert.deepEqual(parseAppPath(`/chat/${C}?tab=notices`)?.query, {})
  const event = appPath({
    type: 'record',
    record: 'events',
    councilId: C,
    recordId: R,
    query: { tab: 'money' },
  })
  assert.equal(event, `/events/${C}/${R}?tab=money`)
  assert.deepEqual(parseAppPath(event), {
    type: 'record',
    record: 'events',
    councilId: C,
    recordId: R,
    query: { tab: 'money' },
  })
})

test('행사 업무 탭의 보기와 거르기는 업무 메뉴와 같은 키로 행사 주소에 남고, 업무 탭이 아니면 빠진다', () => {
  const event = (query: Record<string, string>) =>
    appPath({ type: 'record', record: 'events', councilId: C, recordId: R, query })
  const tasksTab = event({ tab: 'tasks', view: 'unassigned', filter: 'done', dept: P })
  assert.equal(tasksTab, `/events/${C}/${R}?tab=tasks&view=unassigned&filter=done&dept=${P}`)
  assert.deepEqual(parseAppPath(tasksTab)?.query, {
    tab: 'tasks',
    view: 'unassigned',
    filter: 'done',
    dept: P,
  })
  // 행사 안의 기본 보기는 그 행사의 모든 업무(all)라 주소에 두지 않는다. 업무 메뉴의 기본(mine)은 행사 안에서는 기본이 아니다.
  assert.equal(event({ tab: 'tasks', view: 'all', filter: 'open' }), `/events/${C}/${R}?tab=tasks`)
  assert.equal(event({ tab: 'tasks', view: 'mine' }), `/events/${C}/${R}?tab=tasks&view=mine`)
  assert.equal(
    event({ tab: 'money', filter: 'done', view: 'unassigned' }),
    `/events/${C}/${R}?tab=money`,
  )
  assert.equal(event({ filter: 'done' }), `/events/${C}/${R}`)
  assert.deepEqual(parseAppPath(`/events/${C}/${R}?tab=overview&filter=done`)?.query, {
    tab: 'overview',
  })
  assert.deepEqual(parseAppPath(`/events/${C}/${R}?tab=registrations&dept=${P}`)?.query, {
    tab: 'registrations',
  })
  // 업무 메뉴의 주소는 그대로다.
  assert.equal(
    menuPath('tasks', C, { view: 'mine', filter: 'done' }),
    `/tasks/${C}?view=mine&filter=done`,
  )
  assert.equal(menuPath('tasks', C, { view: 'all' }), `/tasks/${C}?view=all`)
})

test('행사의 기본 탭은 메시지이고, 메시지 탭의 방은 메시지 탭일 때만 주소에 남는다', () => {
  // DEC-90 "행사 화면의 첫 탭은 메시지다", DEC-96 "처음 여는 방이면 주소에 없다"
  assert.equal(eventRoomPath(C, R, null), `/events/${C}/${R}`)
  assert.equal(eventRoomPath(C, R, P), `/events/${C}/${R}?room=${P}`)
  assert.deepEqual(parseAppPath(`/events/${C}/${R}?room=${P}`)?.query, { room: P })
  assert.deepEqual(parseAppPath(`/events/${C}/${R}?tab=messages&room=${P}`)?.query, { room: P })
  assert.deepEqual(parseAppPath(`/events/${C}/${R}?tab=overview&room=${P}`)?.query, {
    tab: 'overview',
  })
  assert.deepEqual(parseAppPath(`/events/${C}/${R}?room=not-uuid`)?.query, {})
})

test('홈의 재정 보기는 view=finance이고 기본(운영 보기)은 주소에 없다', () => {
  assert.equal(menuPath('home', C, { view: 'finance' }), `/home/${C}?view=finance`)
  assert.equal(menuPath('home', C), `/home/${C}`)
  assert.deepEqual(parseAppPath(`/home/${C}?view=finance`)?.query, { view: 'finance' })
  assert.deepEqual(parseAppPath(`/home/${C}?view=ops`)?.query, {})
})

test('우리 학생회는 메시지가 기본이고 업무 탭만 업무 쿼리를 받는다', () => {
  assert.deepEqual(parseAppPath(`/council/${C}`), {
    type: 'menu',
    menu: 'council',
    councilId: C,
    query: {},
  })
  const query = { tab: 'tasks', view: 'unassigned', filter: 'done', layout: 'list', dept: P }
  const path = `/council/${C}?tab=tasks&view=unassigned&filter=done&layout=list&dept=${P}`
  assert.equal(menuPath('council', C, query), path)
  assert.deepEqual(parseAppPath(path)?.query, query)
  assert.equal(
    menuPath('council', C, { tab: 'tasks', view: 'all', layout: 'board' }),
    `/council/${C}?tab=tasks`,
  )
  for (const tab of ['messages', 'unknown', 'money']) {
    assert.deepEqual(
      parseAppPath(`/council/${C}?tab=${tab}&layout=list&view=mine&dept=${P}`)?.query,
      {},
    )
  }
})

test('모르는 쿼리 키와 값은 기본값으로 읽는다', () => {
  const read = (path: string) => parseAppPath(path)?.query
  assert.deepEqual(read(`/tasks/${C}?view=nope&filter=&layout=x&dept=not-uuid&q=검색어`), {})
  assert.deepEqual(read(`/tasks/${C}?view=all&view=done`), { view: 'all' })
  assert.deepEqual(read(`/finance/${C}?tab=nope&view=all`), { view: 'all' })
  assert.deepEqual(read(`/finance/${C}?tab=requests&view=mine`), { tab: 'requests' })
  assert.deepEqual(read(`/events/${C}/${R}?tab=overview`), { tab: 'overview' })
  assert.deepEqual(read(`/events/${C}/${R}?tab=messages`), {})
  assert.deepEqual(read(`/events/${C}/${R}?tab=nope`), {})
  assert.deepEqual(read(`/chat/${C}/${R}?tab=notices`), {})
  assert.deepEqual(read(`/home/${C}?tab=money`), {})
  assert.deepEqual(read(`/tasks/${C}?view=all#frag`), { view: 'all' })
})

test('끝 슬래시, 퍼센트 인코딩, 대문자 id는 같은 화면이다', () => {
  const same = parseAppPath(`/chat/${C}/${R}`)
  assert.ok(same)
  assert.deepEqual(parseAppPath(`/chat/${C}/${R}/`), same)
  assert.deepEqual(parseAppPath(`/chat/${C}/${R}?x=1`), same)
  assert.deepEqual(parseAppPath(`/chat/${C.toUpperCase()}/${R.replace('-', '%2D')}`), same)
  assert.deepEqual(parseAppPath(`/chat/${C}/`), parseAppPath(`/chat/${C}`))
})

test('모르는 꼴은 읽지 않는다', () => {
  const bad = [
    '',
    '/',
    'chat',
    `chat/${C}`,
    `xchat/${C}`,
    `/Chat/${C}`,
    `/CHAT/${C}/${R}`,
    `/unknown/${C}`,
    `/unknown/${C}/${R}`,
    `/home/${C}/${R}`,
    `/people/${C}/${R}`,
    `/purchases/${C}/nope`,
    `/purchases/${C}/new/x`,
    `/calendar/${C}/${R}`,
    `/chat/${C}/${R}/x`,
    `/chat/${C}//`,
    `//chat/${C}`,
    `/chat//${R}`,
    `/chat/not-uuid`,
    `/chat/${C}/not-uuid`,
    `/chat/${C}/%E0%A4%A`,
    `/chat/${C.slice(1)}/${R}`,
    `/chat/${C}x/${R}`,
    `/chat/${C}\\${R}`,
    `https://example.com/chat/${C}`,
    `/join/ABCD2345`,
    `/apply/ABCD2345`,
    '/r',
    '/auth-done',
  ]
  for (const path of bad) assert.equal(parseAppPath(path), null, path)
})

test('옛 알림 주소 셋은 지금과 같은 값으로 읽힌다(영구히 열린다)', () => {
  assert.deepEqual(parseAppPath(`/chat/${C}/${R}`), {
    type: 'record',
    record: 'chat',
    councilId: C,
    recordId: R,
    query: {},
  })
  assert.equal(parseAppPath(`/tasks/${C}/${R}`)?.type, 'record')
  assert.equal(parseAppPath(`/purchases/${C}/${R}`)?.type, 'record')
})

test('기록 주소의 상위 목록은 종류마다 여는 메뉴와 탭이다', () => {
  const up = (record: (typeof RECORD_KINDS)[number]) =>
    appPath(parentOf({ type: 'record', record, councilId: C, recordId: R, query: {} }))
  assert.equal(up('chat'), `/chat/${C}`)
  assert.equal(up('events'), `/events/${C}`)
  assert.equal(up('tasks'), `/tasks/${C}`)
  assert.equal(up('purchases'), `/purchases/${C}`)
  assert.equal(up('expenses'), `/finance/${C}?tab=expenses`)
  assert.equal(up('incomes'), `/finance/${C}?tab=incomes`)
  const menu = parseAppPath(`/tasks/${C}`)!
  assert.equal(parentOf(menu), menu)
})

test('서버 진입 목록은 목록의 모든 꼴과 끝 슬래시를 담는다', () => {
  for (const menu of APP_MENUS) {
    const own = ENTRY_PATHS.filter(
      p => p.startsWith(`/${menu}/:council{`) && !p.includes(':record'),
    )
    // 구매 요청 쓰기: 새 꼴(/purchases/<c>/new)과 옛 꼴(/finance/<c>/requests/new)을 다 받는다.
    assert.equal(own.length, menu === 'finance' || menu === 'purchases' ? 4 : 2, menu)
    assert.ok(own.some(p => p.endsWith('}/')))
  }
  for (const kind of RECORD_KINDS) {
    const own = ENTRY_PATHS.filter(
      p => p.startsWith(`/${kind}/:council{`) && p.includes(':record{'),
    )
    assert.equal(own.length, 2, kind)
  }
  for (const path of ['/', '/index.html', '/join/:code', '/apply/:code/', '/r', '/auth-done'])
    assert.ok(ENTRY_PATHS.includes(path), path)
  assert.equal(new Set(ENTRY_PATHS).size, ENTRY_PATHS.length)
})

const sameAfterRoundTrip = (location: NonNullable<ReturnType<typeof parseAppPath>>) =>
  assert.deepEqual(parseAppPath(appPath(location)), location)

test('만든 주소를 다시 읽으면 같은 값이다: 상위 목록, 대문자 id', () => {
  for (const record of RECORD_KINDS) {
    sameAfterRoundTrip(parentOf({ type: 'record', record, councilId: C, recordId: R, query: {} }))
  }
  // 대문자로 준 id도 소문자 한 가지 주소가 되어, 주소 문자열 비교로 같은 화면을 알아본다.
  const upper = appPath({ type: 'menu', menu: 'chat', councilId: C.toUpperCase(), query: {} })
  assert.equal(upper, `/chat/${C}`)
  const record = appPath({
    type: 'record',
    record: 'tasks',
    councilId: C.toUpperCase(),
    recordId: R.toUpperCase(),
    query: {},
  })
  assert.equal(record, `/tasks/${C}/${R}`)
})

test('uuid가 아닌 id로 만든 주소는 읽히지 않는다', () => {
  assert.equal(parseAppPath(menuPath('home', 'c1')), null)
})

const D = '0199d1a0-0000-7000-8000-00000000000d'
const movedTo = (path: string, moves?: AddressMove[]) => {
  const location = parseAppPath(path)
  assert.ok(location, path)
  const moved = movedLocationOf(location, { department: D, ...(moves ? { moves } : {}) })
  return moved && appPath(moved)
}

// 메뉴 v7 설계 2.2 대응표의 줄마다 하나. 새 꼴은 다시 읽으면 같은 값이고(왕복), 다시 옮기지 않는다.
const MOVES: [old: string, now: string][] = [
  [`/tasks/${C}?view=mine`, `/tasks/${C}?tab=mine`],
  [`/council/${C}`, `/chat/${C}`],
  [`/council/${C}?tab=messages`, `/chat/${C}`],
  [`/council/${C}?tab=tasks`, `/tasks/${C}?events=include`],
  [
    `/council/${C}?tab=tasks&view=unassigned&filter=done&layout=list&dept=${P}`,
    `/tasks/${C}?filter=done&layout=list&dept=${P}&assignee=none&events=include`,
  ],
  [`/council/${C}?tab=tasks&view=mine`, `/tasks/${C}?tab=mine`],
  [`/council/${C}?tab=tasks&layout=calendar`, `/calendar/${C}`],
  [`/tasks/${C}?view=department`, `/tasks/${C}?dept=${D}`],
  [`/tasks/${C}?view=all&filter=done`, `/tasks/${C}?filter=done&events=include`],
  [`/tasks/${C}?view=unassigned`, `/tasks/${C}?assignee=none&events=include`],
  [`/tasks/${C}?layout=calendar`, `/calendar/${C}`],
  [`/tasks/${C}?view=all&layout=calendar`, `/calendar/${C}`],
  [`/finance/${C}?tab=requests`, `/purchases/${C}?view=mine`],
  [`/finance/${C}?tab=requests&view=mine`, `/purchases/${C}?view=mine`],
  [`/finance/${C}?tab=requests&view=pending`, `/purchases/${C}?view=pending`],
  [`/finance/${C}?tab=requests&view=all`, `/purchases/${C}?view=all`],
  [`/finance/${C}/requests/new`, `/purchases/${C}/new`],
  [`/finance/${C}?compose=new`, `/purchases/${C}/new`],
  [`/finance/${C}?tab=overview`, `/finance/${C}`],
  [`/finance/${C}?tab=budget`, `/finance/${C}`],
  [`/finance/${C}?tab=expenses`, `/finance/${C}?tab=ledger`],
  [`/finance/${C}?tab=incomes&period=${P}`, `/finance/${C}?tab=ledger&kind=income&period=${P}`],
  [`/finance/${C}?tab=settlements`, `/finance/${C}?tab=closing`],
  [`/finance/${C}?tab=accounts`, `/settings/${C}?section=accounts`],
  [`/finance/${C}?tab=fees&view=pending`, `/settings/${C}?section=fees`],
]

test('옛 주소는 메뉴 v7의 새 주소로 옮기고, 새 주소는 다시 읽어도 같고 더 옮기지 않는다', () => {
  for (const [old, now] of MOVES) {
    assert.equal(movedTo(old), now, old)
    assert.equal(appPath(parseAppPath(now)!), now, now)
    assert.equal(movedTo(now), null, now)
  }
})

test('그대로인 주소: 기록 주소(알림), 업무 첫 화면, 결산, 행사의 재정 탭', () => {
  for (const path of [
    `/tasks/${C}`,
    `/tasks/${C}?layout=list&filter=done`,
    `/finance/${C}`,
    `/finance/${C}?tab=closing&period=${P}`,
    `/events/${C}/${R}?tab=money`,
    ...RECORD_KINDS.map(kind => recordPath(kind, C, R)),
    `/home/${C}?view=finance`,
  ])
    assert.equal(movedTo(path), null, path)
})

test('옮기기는 켠 것만 하고, 내 부서를 모르면 부서 칩 없이 학생회 업무다', () => {
  assert.equal(movedTo(`/council/${C}`, []), null)
  assert.equal(movedTo(`/council/${C}`, ['tasks']), null)
  assert.equal(
    movedTo(`/council/${C}?tab=tasks&layout=calendar`, ['tasks']),
    `/tasks/${C}?layout=calendar&events=include`,
  )
  assert.equal(movedTo(`/tasks/${C}?view=all&layout=calendar`, ['calendar']), `/calendar/${C}`)
  assert.equal(movedTo(`/finance/${C}?tab=requests`, ['ledger', 'settings']), null)
  const location = parseAppPath(`/tasks/${C}?view=department`)!
  assert.equal(appPath(movedLocationOf(location)!), `/tasks/${C}`)
  const picked = parseAppPath(`/tasks/${C}?view=department&dept=${P}`)!
  assert.equal(appPath(movedLocationOf(picked)!), `/tasks/${C}?dept=${P}`)
})

test('새 메뉴 주소: 구매 요청 쓰기와 업무 칩·재정 구분은 그 자리에서만 남는다', () => {
  assert.deepEqual(parseAppPath(`/purchases/${C}/new?body=x`), {
    type: 'menu',
    menu: 'purchases',
    councilId: C,
    query: { compose: 'new' },
  })
  assert.equal(menuPath('purchases', C, { compose: 'new', view: 'all' }), `/purchases/${C}/new`)
  assert.equal(menuPath('tasks', C, { tab: 'council' }), `/tasks/${C}`)
  assert.deepEqual(parseAppPath(`/tasks/${C}?assignee=nobody&events=all&tab=x`)?.query, {})
  assert.deepEqual(parseAppPath(`/finance/${C}?tab=expenses&kind=income`)?.query, {
    tab: 'expenses',
  })
  assert.deepEqual(parseAppPath(`/settings/${C}?section=nope`)?.query, {})
})
