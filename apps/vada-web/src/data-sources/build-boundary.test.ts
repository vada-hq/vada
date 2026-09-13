import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { forbidDevelopmentData } from '../../vite-data-boundary'

// 실제 번들러가 정적·동적 import를 따라간 뒤 의존성 위반을 발견하는지 검사한다.
function bundle(development: boolean, dynamic = false, shipping = true) {
  const entry = '\0boundary-entry'
  const dependency = fileURLToPath(new URL(
    development ? '../development/boundary-probe.ts' : './boundary-probe.ts',
    import.meta.url,
  ))
  return build({
    configFile: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'boundary-example',
        resolveId(id) {
          if (id === entry) return entry
          if (id === 'boundary-data') return dependency
        },
        load(id) {
          if (id === dependency) return 'export const value = 42'
          if (id === entry) return dynamic
            ? "import('boundary-data').then(data => console.log(data.value))"
            : "import { value } from 'boundary-data'; console.log(value)"
        },
      },
      forbidDevelopmentData(shipping),
    ],
    build: { write: false, rolldownOptions: { input: entry } },
  })
}

it.each([false, true])('운영 빌드가 개발 모듈을 가져오면 실패한다 (동적 import: %s)', async (dynamic) => {
  await expect(bundle(true, dynamic)).rejects.toThrow('운영 빌드가 개발용 응답을 가져옵니다')
})

it('운영 모듈만 사용하는 빌드는 통과한다', async () => {
  await expect(bundle(false)).resolves.toBeDefined()
})

it('개발용 빌드는 개발 모듈을 사용할 수 있다', async () => {
  await expect(bundle(true, false, false)).resolves.toBeDefined()
})
