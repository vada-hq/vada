// 출처 명세와 타입. 서버 연결과 개발용 응답에 의존하지 않는다.
import catalogJson from '../../../../specs/figma/vada-wireframe/data-sources.json'

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
