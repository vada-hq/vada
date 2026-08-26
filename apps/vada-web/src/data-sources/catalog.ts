// specs/figma/vada-wireframe/data-sources.json 카탈로그의 소비자.
// option-sources/catalog.ts와 같은 방식이다: 계약(요청 경로·상태 문구·응답
// 조각)은 카탈로그를 단일 원본으로 읽고, 네트워크만 개발용 mock으로 대체한다.
import catalogJson from '../../../../specs/figma/vada-wireframe/data-sources.json'
import { DASHBOARD_FIXTURES, FILTERED_FIXTURES } from './fixtures'

export interface DataSourceMessages {
  loading: string
  empty: string
  error: string
}

export interface DataSourceField {
  key: string
  description: string
  optional?: boolean
  // 이 조각이 다시 같은 모양의 항목 목록일 때 그 항목의 조각(묶인 목록).
  fields?: DataSourceField[]
}

export interface DataSource {
  key: string
  shape: 'object' | 'list'
  description: string
  params: string[]
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
export type DataValue = string | number | DataRow[]
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
    if (!source.params.includes(name)) {
      throw new Error(
        `데이터 출처 '${key}'에 선언되지 않은 조회 인자 '${name}'을 넘겼습니다.`,
      )
    }
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
