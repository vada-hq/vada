import { NOT_FOUND, type DataSource, type DataSourceField, type DataRow } from '../data-sources/definitions'
import { DASHBOARD_FIXTURES, FILTERED_FIXTURES } from './data-fixtures'

// 개발용 응답도 카탈로그의 필드와 모양을 검증한다.
export function readDevelopmentData(
  source: DataSource,
  params: Record<string, string>,
): DataRow | DataRow[] | typeof NOT_FOUND {
  const key = source.key
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
