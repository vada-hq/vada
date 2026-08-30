// specs/figma/vada-wireframe/data-sources.json 카탈로그의 소비자.
// option-sources/catalog.ts와 같은 방식이다: 계약(요청 경로·상태 문구·응답
// 조각)은 카탈로그를 단일 원본으로 읽고, 네트워크만 개발용 mock으로 대체한다.
import { fromServer } from './server'
import catalogJson from '../../../../specs/figma/vada-wireframe/data-sources.json'
import { DASHBOARD_FIXTURES, FILTERED_FIXTURES } from './fixtures'

export interface DataSourceMessages {
  loading: string
  empty: string
  /**
   * 비었다는 말 아래에 붙는 설명 문단.
   *
   * 빈 상태를 그린 프레임 셋이 제목 한 줄과 설명 한 문단을 함께 그렸는데 담을
   * 자리가 없어, 첫 화면(EVT-03A)은 **그 글을 아예 그리지 않았다.**
   */
  emptyDetail?: string
  error: string
}

export interface DataSourceField {
  key: string
  description: string
  optional?: boolean
  // 이 조각이 다시 같은 모양의 항목 목록일 때 그 항목의 조각(묶인 목록).
  fields?: DataSourceField[]
}

export interface DataSourceParam {
  key: string
  /** 부르는 쪽이 늘 넘기는가. 카탈로그가 명세를 세어 정한 것이다. */
  required: boolean
  valueType: 'string' | 'number' | 'boolean'
  description: string
}

export interface DataSource {
  key: string
  shape: 'object' | 'list'
  description: string
  params: DataSourceParam[]
  request: { method: 'GET'; path: string }
  messages: DataSourceMessages
  fields: DataSourceField[]
}

interface DataSourceCatalog {
  schemaVersion: 1
  sources: DataSource[]
}

const catalog = catalogJson as DataSourceCatalog

// 이름이 없는 채로 물으면 조용히 빈 것을 돌려주는 대신 드러낸다. 안쪽 목록은
// 조회하지 않으므로(itemList.itemsField) dataSourceKey가 없고, 그것을 여기까지
// 들고 오면 명세를 잘못 읽은 것이다.
export function findDataSource(key: string | undefined): DataSource {
  if (key === undefined) {
    throw new Error('데이터 출처 이름이 없습니다. 조회하지 않는 목록을 조회하려 했습니다.')
  }
  const source = catalog.sources.find((candidate) => candidate.key === key)
  if (!source) {
    // 조용한 대체는 화면을 빈 채로 두고 원인을 감춘다.
    throw new Error(`데이터 출처 '${key}'가 카탈로그에 없습니다.`)
  }
  return source
}

// 묶인 목록은 조각 하나가 다시 항목 목록이다(회의 목록의 행사별 묶음).
//
// **참·거짓도 값이다.** 서버가 판정을 답하는 자리가 있다 — attendance.checkInResult의
// canRetry가 그렇고, 화면은 그 값만 보고 '다시 입력'을 그릴지 정한다(drawnWhen).
// 판정을 글로 주면('예'/'아니오') 화면이 그 글을 견주게 되고, 말이 바뀌는 날
// 조용히 틀린다.
export type DataValue = string | number | boolean | DataRow[]
export type DataRow = Record<string, DataValue>

// 인자로 집어 온 한 건이 없을 때. 오류가 아니라 답이다 — 카탈로그의
// messages.empty가 무엇이라 말할지 이미 갖고 있다.
export const NOT_FOUND = Symbol('데이터 없음')

// 개발용 mock. 실제 응답이 붙기 전까지 fixtures가 대신하며, 카탈로그가 선언한
// fields와 어긋나면 조용히 비는 대신 오류로 드러난다.
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
  const served = fromServer(source.key)
  if (served !== undefined) {
    return served as DataRow | DataRow[]
  }

  // 인자로 거르는 응답은 목록으로 만들어 두고, shape가 object면 첫 줄을 집는다.
  // 한 건을 집어 오는 것도 거르는 일이라 자리를 따로 만들지 않는다.
  // findDataSource가 이미 이름을 확인했다. 그 결과가 가진 key를 쓰면 다시 좁힐 일이 없다.
  const filtered = FILTERED_FIXTURES[source.key]
  let fixture: DataRow | DataRow[] | undefined
  if (filtered === undefined) {
    fixture = DASHBOARD_FIXTURES[source.key]
  } else {
    const rows = filtered(params)
    // 인자로 거른 결과가 비면 그것은 '개발용 응답이 없다'가 아니라 **찾지 못했다**다.
    // 서버도 같은 답을 한다 — 없는 것을 물으면 없다고 한다. 두 경우를 섞으면
    // 사람이 주소를 잘못 친 것과 만드는 사람이 빠뜨린 것이 같은 오류로 보인다.
    if (source.shape === 'object' && rows.length === 0) {
      return NOT_FOUND
    }
    fixture = source.shape === 'object' ? rows[0] : rows
  }
  if (fixture === undefined) {
    throw new Error(
      `데이터 출처 '${key}'의 개발용 응답이 없습니다(인자 ${JSON.stringify(params)}).`,
    )
  }

  const rows = Array.isArray(fixture) ? fixture : [fixture]
  // 묶인 목록은 안쪽 항목까지 본다. 겉만 보면 묶음은 맞는데 그 안이 빈 응답이
  // 조용히 지나간다.
  function assertFields(row: DataRow, fields: DataSourceField[], where: string) {
    for (const field of fields) {
      const value = row[field.key]
      if (value === undefined) {
        if (field.optional === true) {
          continue
        }
        throw new Error(
          `데이터 출처 '${key}'의 ${where}에 카탈로그가 선언한 조각 '${field.key}'가 없습니다.`,
        )
      }
      if (field.fields === undefined) {
        continue
      }
      if (!Array.isArray(value)) {
        throw new Error(
          `데이터 출처 '${key}'의 조각 '${field.key}'는 항목 목록이어야 하는데 아닙니다.`,
        )
      }
      for (const nested of value) {
        assertFields(nested, field.fields, `'${field.key}'의 항목`)
      }
    }
  }
  for (const row of rows) {
    assertFields(row, source.fields, '응답')
  }

  if (Array.isArray(fixture) !== (source.shape === 'list')) {
    throw new Error(
      `데이터 출처 '${key}'는 shape가 '${source.shape}'인데 응답 모양이 다릅니다.`,
    )
  }
  return fixture
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
