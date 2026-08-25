// specs/figma/vada-wireframe/option-sources.json 카탈로그의 소비자.
// 계약(요청 시점, 검색 방식, 상태 문구)은 카탈로그를 단일 원본으로 읽고,
// 네트워크만 개발용 mock으로 대체한다(로딩 상태 확인용 인위 지연 포함).
import catalogJson from '../../../../specs/figma/vada-wireframe/option-sources.json'
import {
  COLLEGES,
  DEPARTMENTS,
  PARTICIPANT_AFFILIATIONS,
  PARTICIPANT_APPLY_STATUS,
  PARTICIPANT_ATTEND_STATUS,
  PARTICIPANT_PAY_STATUS,
  SCHOOLS,
} from './fixtures'

export interface Option {
  value: string
  label: string
  // 라디오 카드처럼 선택지마다 설명이 붙는 표현에서 쓴다.
  description?: string
  disabled?: boolean
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

interface RemoteSource {
  key: string
  type: 'remote'
  description: string
  params: string[]
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
  params: string[]
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

// vada-conventions 7번: mock에 인위 지연을 둬 로딩 상태를 실제로 확인한다.
const MOCK_DELAY_MS = 450

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchOptions(
  key: string,
  params: Record<string, string>,
  query?: string,
): Promise<Option[]> {
  const source = getOptionSource(key)
  if (source.type === 'static') {
    return source.options
  }

  await delay(MOCK_DELAY_MS)

  switch (key) {
    case 'education.schools': {
      const trimmed = (query ?? '').trim()
      return SCHOOLS.filter((option) => option.label.includes(trimmed))
    }
    case 'education.colleges':
      return COLLEGES[params.schoolId] ?? []
    case 'education.departments':
      return DEPARTMENTS[`${params.schoolId}:${params.collegeId}`] ?? []
    case 'event.participantAffiliations':
      return PARTICIPANT_AFFILIATIONS[params.eventId] ?? []
    case 'event.participantApplyStatus':
      return PARTICIPANT_APPLY_STATUS
    case 'event.participantPayStatus':
      return PARTICIPANT_PAY_STATUS
    case 'event.participantAttendStatus':
      return PARTICIPANT_ATTEND_STATUS
    default:
      throw new Error(`'${key}'의 mock 응답이 없습니다.`)
  }
}
