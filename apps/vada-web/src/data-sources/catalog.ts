// 데이터 조회. definitions.ts의 명세에 따라 서버 캐시 또는 개발용 응답을 읽는다.
import { fromServer } from './server'
import { findDataSource, NOT_FOUND, type DataRow } from './definitions'
import { offlineClient } from '#offline-client'

export { NOT_FOUND } from './definitions'

// 조회 인자와 서버 우선 원칙은 운영·개발에서 동일하게 적용한다.
export function readDataSource(
  key: string | undefined,
  params: Record<string, string> = {},
): DataRow | DataRow[] | typeof NOT_FOUND {
  const source = findDataSource(key)

  // 넘긴 인자는 카탈로그가 선언한 것이어야 한다. 이름이 틀리면 조용히
  // 안 걸러지는 대신 여기서 드러난다.
  for (const name of Object.keys(params)) {
    if (!source.params.some((param) => param.key === name)) {
      throw new Error(
        `데이터 출처 '${key}'에 선언되지 않은 조회 인자 '${name}'을 넘겼습니다.`,
      )
    }
  }

  // **없이 부르면 전부가 온다.** 열쇠를 빠뜨린 조회는 거르지 않은 목록을 받고,
  // 화면은 그것이 걸러진 것인 줄 안다 — 남의 것이 섞여 그려진다.
  //
  // 카탈로그가 어느 인자가 열쇠인지 알고 있으므로 여기서 막는다. 서버가 붙기 전에
  // 이 자리가 유일하게 그 계약을 지키는 곳이다.
  for (const param of source.params) {
    if (param.required && params[param.key] === undefined) {
      throw new Error(
        `데이터 출처 '${key}'는 조회 인자 '${param.key}'를 반드시 받습니다(${param.description}).`,
      )
    }
  }

  // **서버가 켜져 있으면 서버가 답한다.** 개발용 응답은 서버가 없을 때의 대역이지
  // 서버 대신이 아니다 — 켜졌는데도 개발용 응답을 주면 계약이 틀린 것을 못 본다.
  // **인자까지 넘긴다.** 같은 출처를 다른 인자로 두 번 부르면 다른 답이 온다 —
  // key로만 찾으면 뒤엣것이 앞엣것을 덮고 화면은 남의 행사를 그린다.
  const served = fromServer(source.key, params)
  if (served !== undefined) {
    return served as DataRow | DataRow[]
  }

  return offlineClient.read(source, params)
}

export function readObjectSource(
  key: string | undefined,
  params: Record<string, string> = {},
): DataRow {
  const value = readDataSource(key, params)
  if (value === NOT_FOUND) {
    // 없을 수 있는 자리라면 부르는 쪽이 readObjectSourceOrNull을 쓴다.
    throw new Error(`데이터 출처 '${key}'에서 찾지 못했습니다(인자 ${JSON.stringify(params)}).`)
  }
  if (Array.isArray(value)) {
    throw new Error(`데이터 출처 '${key}'는 목록입니다.`)
  }
  return value
}

// 인자가 가리키는 한 건이 없을 수 있는 자리. 상세 화면이 그렇다 — 주소로 아무
// 값이나 들어올 수 있고, 그때 화면은 터지는 대신 못 찾았다고 말해야 한다.
export function readObjectSourceOrNull(
  key: string | undefined,
  params: Record<string, string> = {},
): DataRow | null {
  const value = readDataSource(key, params)
  if (value === NOT_FOUND) {
    return null
  }
  if (Array.isArray(value)) {
    throw new Error(`데이터 출처 '${key}'는 목록입니다.`)
  }
  return value
}

export function readListSource(
  key: string | undefined,
  params: Record<string, string> = {},
): DataRow[] {
  const value = readDataSource(key, params)
  if (value === NOT_FOUND) {
    throw new Error(`데이터 출처 '${key}'는 목록입니다.`)
  }
  if (!Array.isArray(value)) {
    throw new Error(`데이터 출처 '${key}'는 목록이 아닙니다.`)
  }
  return value
}

/**
 * 한 건을 조회하고 그 안의 조각을 항목으로 받는다(itemList의 dataSourceKey +
 * itemsField).
 *
 * **따로 조회하지 않는 것이 이 어휘의 뜻이다.** 그 줄들은 그 한 건의 일부다 —
 * 안내 사항은 그 신청 결과의 것이고, 정리 현황은 그 회의록의 것이다. 목록으로
 * 따로 두면 같은 것을 두 번 묻게 되고, 두 답이 어긋날 자리가 생긴다.
 *
 * 화면마다 손으로 꺼내던 것을 여기로 모은다. 같은 말이 세 곳에 있으면 하나가
 * 늦게 고쳐진다.
 */
export function readFieldRows(
  key: string | undefined,
  field: string | undefined,
  params: Record<string, string> = {},
): DataRow[] {
  const row = readObjectSource(key, params)
  if (field === undefined) {
    throw new Error(`데이터 출처 '${key}'에서 어느 조각을 항목으로 받을지 말하지 않았습니다.`)
  }
  const value = row[field]
  if (!Array.isArray(value)) {
    throw new Error(`데이터 출처 '${key}'의 조각 '${field}'는 항목 목록이어야 합니다.`)
  }
  return value as DataRow[]
}
