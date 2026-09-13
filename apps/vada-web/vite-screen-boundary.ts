import type { Plugin } from 'vite'

// 초기 진입 파일과 정적 의존성에 실제 화면 구현이 섞이지 않도록 검사한다.
export function forbidEagerScreens(): Plugin {
  return {
    name: 'vada-screen-boundary',
    apply: 'build',
    generateBundle(_, bundle) {
      const seen = new Set<string>()
      const visit = (name: string) => {
        if (seen.has(name)) return
        seen.add(name)
        const chunk = bundle[name]
        if (chunk?.type !== 'chunk') return
        for (const [id, module] of Object.entries(chunk.modules)) {
          if (module.renderedLength > 0 && /\/src\/screens\/[^/]+Screen\.tsx$/.test(id.replaceAll('\\', '/'))) {
            this.error(`초기 묶음이 화면 구현을 가져옵니다: ${id}`)
          }
        }
        for (const dependency of chunk.imports) visit(dependency)
      }
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk' && chunk.isEntry) visit(chunk.fileName)
      }
    },
  }
}
