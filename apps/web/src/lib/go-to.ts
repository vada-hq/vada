import {
  appPath,
  menuPath,
  recordPath,
  type AppMenu,
  type AppQuery,
  type EventTab,
  type RecordKind,
} from '@vada/contracts'
import { navigate } from './app-location'

// 기록 하나로 가는 주소. 행사는 탭이 기본(개요)이 아니면 쿼리에 둔다.
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

// 메뉴 첫 화면이나 거르기가 정해진 목록으로 간다. 쿼리는 그 메뉴 목록에 있는 키만 남는다.
// replace는 지금 칸을 바꿔 쓴다(초대에서 막 들어와 첫 화면을 고를 때처럼 뒤로 돌아갈 곳이 아닐 때).
export const openMenu = (
  menu: AppMenu,
  councilId: string,
  query: AppQuery = {},
  options: { replace?: boolean } = {},
) => navigate(menuPath(menu, councilId, query), options)
