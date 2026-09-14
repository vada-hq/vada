/** 서버에서 데이터를 받아 오는 데 필요한 최소 의존성. */
export interface Server {
  baseUrl?: string
  fetch: typeof globalThis.fetch
}

/** 어느 출처를 어떤 인자로 부르는가. */
export interface SourceCall {
  key: string
  params: Record<string, string>
}

/** 아직 서버에 연결하지 않은 출처를 읽으려 한 경우다. */
export class NotBuiltYet extends Error {
  readonly key: string

  constructor(key: string) {
    super(`데이터 출처 '${key}'는 아직 서버에 붙지 않았습니다.`)
    this.name = 'NotBuiltYet'
    this.key = key
  }
}

/** 출처 하나를 받지 못한 이유다. */
export interface SourceFailure {
  key: string
  status?: number
  message?: string
}

/** 한 번의 로딩에서 실패한 출처들을 함께 전달한다. */
export class SourcesFailed extends Error {
  readonly keys: readonly string[]
  readonly failures: readonly SourceFailure[]

  constructor(failures: readonly SourceFailure[]) {
    super(`데이터 출처를 받지 못했습니다: ${failures.map((one) => one.key).join(', ')}`)
    this.name = 'SourcesFailed'
    this.failures = failures
    this.keys = failures.map((one) => one.key)
  }

  get onlyForbidden(): boolean {
    return this.failures.length > 0 && this.failures.every((one) => one.status === 403)
  }
}

/** 경로 인자를 채우고 남은 값은 쿼리 문자열로 만든다. */
export function urlOf(path: string, params: Record<string, string>): string {
  const left = { ...params }
  const filled = path.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const value = left[name] ?? ''
    delete left[name]
    return encodeURIComponent(value)
  })
  const query = new URLSearchParams(
    Object.entries(left).filter(([, value]) => value !== ''),
  ).toString()
  return query === '' ? filled : `${filled}?${query}`
}
