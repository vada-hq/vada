import type { Plugin } from 'vite'

// 소스를 바꾸지 않고, 운영 빌드가 개발용 응답 모듈에 의존하는지 검사한다.
export function forbidDevelopmentData(enabled: boolean): Plugin {
  return {
    name: 'vada-data-boundary',
    apply: 'build',
    buildEnd(error) {
      if (!enabled || error) return
      for (const id of this.getModuleIds()) {
        const path = id.split('?')[0]!.replaceAll('\\', '/')
        if (
          /\/src\/development\//i.test(path) ||
          /\/src\/(data-sources|option-sources)\/fixtures\.ts$/i.test(path)
        ) {
          this.error(`운영 빌드가 개발용 응답을 가져옵니다: ${path}`)
        }
      }
    },
  }
}
