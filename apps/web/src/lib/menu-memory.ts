import type { AppMenu, AppQuery } from '@vada/contracts'

// 메뉴마다 마지막으로 보던 쿼리(탭, 거르기). 기록 상세가 열린 동안에도 그 뒤의 목록이 보던 보기를 지키고,
// 상세를 놓을 때(기록을 잃음) 그 보기로 돌아가게 한다. 학생회와 메뉴마다 따로 둔다. 바로 들어온 주소는 기억이 없어 기본값이다.
const queries = new Map<string, AppQuery>()
const keyOf = (menu: AppMenu, councilId: string) => `${menu}/${councilId.toLowerCase()}`

export const rememberQuery = (menu: AppMenu, councilId: string, query: AppQuery) => {
  queries.set(keyOf(menu, councilId), query)
}
export const recalledQuery = (menu: AppMenu, councilId: string): AppQuery | undefined =>
  queries.get(keyOf(menu, councilId))

// 부서 거르기 칩의 이름. 내 부서가 아니고 목록에도 없는 부서는 이름을 알려 준 쪽(홈)이 둔다.
const departmentNames = new Map<string, string>()
export const rememberDepartment = (id: string, name: string) => {
  departmentNames.set(id.toLowerCase(), name)
}
export const recalledDepartment = (id: string) => departmentNames.get(id.toLowerCase())
