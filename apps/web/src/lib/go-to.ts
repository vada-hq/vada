import {
  appPath,
  eventRoomPath,
  menuPath,
  recordPath,
  type AppMenu,
  type AppQuery,
  type EventTab,
  type RecordKind,
} from '@vada/contracts'
import { navigate } from './app-location'
import { afterWindowsClosed } from './use-window-history'

// 기록 하나로 가는 주소. 행사는 탭이 기본(메시지)이 아니면 쿼리에 둔다.
const recordTarget = (kind: RecordKind, councilId: string, id: string, tab?: EventTab) =>
  tab
    ? appPath({ type: 'record', record: kind, councilId, recordId: id, query: { tab } })
    : recordPath(kind, councilId, id)

// 화면이 부르는 이동(기능 016 '이동 부르기'). onOpenX 콜백을 주고받지 않고 화면이 주소를 쌓는다.
// overRecord는 열려 있는 기록 상세 위에서 다른 기록으로 갈 때다(뒤로가 그 상세로 돌아온다).
export const openRecord = (
  kind: RecordKind,
  councilId: string,
  id: string,
  options: { tab?: EventTab | undefined; overRecord?: boolean } = {},
) => navigate(recordTarget(kind, councilId, id, options.tab), { overRecord: options.overRecord })

// 홈의 행사 방 칩은 행사 메시지 탭으로 가고, 학생회·1:1 방은 대화 메뉴로 간다.
// overRecord는 openRecord와 같다(업무 상세의 결과물 공지처럼 기록 상세 위에서 간다).
export const openMessageRoom = (
  councilId: string,
  roomId: string,
  eventId?: string | null,
  options: { overRecord?: boolean } = {},
) =>
  navigate(
    eventId ? eventRoomPath(councilId, eventId, roomId) : recordPath('chat', councilId, roomId),
    options,
  )

// 열려 있는 행사 안에서 탭을 바꾼다(창 안의 링크). 탭은 기록을 쌓지 않아(useEventAddress) 지금 칸을 바꿔 쓰는데,
// 창이 열려 있으면 창의 칸을 먼저 거둔 뒤에 바꿔 쓴다. 먼저 바꿔 쓰면 창이 닫히며 되돌린 칸이 탭을 옛 주소로 되돌린다.
// 창을 닫는 것은 부르는 쪽이 한다.
export const openEventTab = (councilId: string, eventId: string, tab: EventTab) =>
  afterWindowsClosed(() =>
    navigate(recordTarget('events', councilId, eventId, tab === 'messages' ? undefined : tab), {
      replace: true,
    }),
  )

// 열려 있는 행사의 업무 탭을 거르기와 함께 연다(개요의 '담당자 없음'). 누른 곳에서 한 칸 쌓아 뒤로 가면 누른 곳이다.
// 쿼리는 행사 주소에 있는 업무 탭의 키만 남는다.
export const openEventTasks = (councilId: string, eventId: string, query: AppQuery) =>
  navigate(
    appPath({
      type: 'record',
      record: 'events',
      councilId,
      recordId: eventId,
      query: { ...query, tab: 'tasks' },
    }),
  )

// 메뉴 첫 화면이나 거르기가 정해진 목록으로 간다. 쿼리는 그 메뉴 목록에 있는 키만 남는다.
// replace는 지금 칸을 바꿔 쓴다(초대에서 막 들어와 첫 화면을 고를 때처럼 뒤로 돌아갈 곳이 아닐 때).
export const openMenu = (
  menu: AppMenu,
  councilId: string,
  query: AppQuery = {},
  options: { replace?: boolean } = {},
) => navigate(menuPath(menu, councilId, query), options)
