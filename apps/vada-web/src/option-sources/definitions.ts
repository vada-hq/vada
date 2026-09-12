// 출처 명세와 타입. 서버 연결과 개발용 응답에 의존하지 않는다.
import catalogJson from '../../../../specs/figma/vada-wireframe/option-sources.json'

export interface Option {
  value: string
  label: string
  // 라디오 카드처럼 선택지마다 설명이 붙는 표현에서 쓴다.
  description?: string
  disabled?: boolean
  /**
   * 아무것도 고르지 않았을 때 열려 있는 것.
   *
   * **판정은 서버가 한다.** 화면이 '아직 안 끝난 첫째'를 골라 열면 그 규칙이
   * 화면에 박히고, 규칙이 바뀔 때마다 화면을 고쳐야 한다. select.initialValue는
   * 명세가 아는 값일 때의 자리이고, 이것은 그 값이 데이터일 때의 자리다.
   */
  initiallySelected?: boolean
}

export interface SourceMessages {
  idle: string
  loading: string
  empty: string
  error: string
}

export type SearchContract =
  | { mode: 'remote'; queryParam: string; minLength: number; debounceMs: number }
  | { mode: 'client' }

export interface OptionSourceParam {
  key: string
  /** 부르는 쪽이 늘 넘기는가. 카탈로그가 명세를 세어 정한 것이다. */
  required: boolean
  valueType: 'string' | 'number' | 'boolean'
  description: string
}

export interface RemoteSource {
  key: string
  type: 'remote'
  description: string
  params: OptionSourceParam[]
  request: {
    method: 'GET'
    path: string
    loadOn: 'search' | 'open'
    search?: SearchContract
  }
  messages: SourceMessages
}

interface StaticSource {
  key: string
  type: 'static'
  description: string
  params: OptionSourceParam[]
  options: Option[]
}

export type OptionSource = RemoteSource | StaticSource

// 카탈로그 드리프트가 조용한 오동작(예: 검색이 영구 idle) 대신 명확한 오류로
// 드러나게 하는 최소 런타임 가드다. 깊은 검증은 검증 CLI가 담당한다.
export function asOptionSourcesCatalog(json: unknown): { sources: OptionSource[] } {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error('선택지 카탈로그는 객체여야 합니다.')
  }
  const sources = (json as Record<string, unknown>).sources
  if (!Array.isArray(sources)) {
    throw new Error('선택지 카탈로그에 sources 배열이 필요합니다.')
  }
  for (const source of sources as OptionSource[]) {
    if (typeof source?.key !== 'string' || source.key.length === 0) {
      throw new Error('카탈로그 출처에 key가 필요합니다.')
    }
    if (source.type === 'remote') {
      if (!source.request) {
        throw new Error(`'${source.key}'는 remote이므로 request가 필요합니다.`)
      }
      if (
        source.request.loadOn === 'search' &&
        source.request.search?.mode !== 'remote'
      ) {
        throw new Error(
          `'${source.key}'는 loadOn: search이므로 원격 검색 계약(search.mode: remote)이 필요합니다.`,
        )
      }
    } else if (source.type === 'static') {
      if (!Array.isArray(source.options)) {
        throw new Error(`'${source.key}'는 static이므로 options가 필요합니다.`)
      }
    } else {
      throw new Error(`'${(source as { key: string }).key}'의 type이 올바르지 않습니다.`)
    }
  }
  return { sources: sources as OptionSource[] }
}

const sourceByKey = new Map<string, OptionSource>(
  asOptionSourcesCatalog(catalogJson).sources.map((source) => [source.key, source]),
)

export function getOptionSource(key: string): OptionSource {
  const source = sourceByKey.get(key)
  if (!source) {
    throw new Error(`선택지 출처 '${key}'가 카탈로그에 없습니다.`)
  }
  return source
}
