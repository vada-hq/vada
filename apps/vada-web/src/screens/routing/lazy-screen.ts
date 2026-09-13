import { lazy, type ComponentType } from 'react'

export class ScreenCodeError extends Error {
  constructor(cause: unknown) {
    super('화면 파일을 불러오지 못했습니다.', { cause })
    this.name = 'ScreenCodeError'
  }
}

// 등록부의 모듈 수준에서 한 번 만든다. 다시 렌더해도 컴포넌트 정체성을 유지한다.
export function lazyScreen<Props extends object>(load: () => Promise<ComponentType<Props>>) {
  return lazy(async () => {
    try {
      return { default: await load() }
    } catch (cause) {
      throw new ScreenCodeError(cause)
    }
  })
}
