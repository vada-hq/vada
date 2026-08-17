// specs/figma/vada-wireframe/option-sources.json 카탈로그의 소비자.
// 계약(요청 시점, 검색 방식, 상태 문구)은 카탈로그를 단일 원본으로 읽고,
// 네트워크만 개발용 mock으로 대체한다(로딩 상태 확인용 인위 지연 포함).
import catalogJson from '../../../../specs/figma/vada-wireframe/option-sources.json'
import { COLLEGES, DEPARTMENTS, SCHOOLS } from './fixtures'

export interface Option {
  value: string
  label: string
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

const sourceByKey = new Map<string, OptionSource>(
  (catalogJson as unknown as { sources: OptionSource[] }).sources.map(
    (source) => [source.key, source],
  ),
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
    default:
      throw new Error(`'${key}'의 mock 응답이 없습니다.`)
  }
}
