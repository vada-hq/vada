import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { forbidEagerScreens } from '../../../vite-screen-boundary'

function bundle(dynamic: boolean, viaShared: boolean) {
  const entry = '\0screen-entry'
  const shared = '\0shared-module'
  const screen = fileURLToPath(new URL('../SampleScreen.tsx', import.meta.url))
  const code = dynamic
    ? "import('screen').then(module => console.log(module.value))"
    : "import { value } from 'screen'; console.log(value)"
  return build({
    configFile: false,
    logLevel: 'silent',
    plugins: [{
      name: 'screen-example',
      resolveId(id) {
        if (id === entry) return entry
        if (id === 'screen') return screen
        if (id === 'shared') return shared
      },
      load(id) {
        if (id === entry) return viaShared ? "import 'shared'" : code
        if (id === shared) return code
        if (id === screen) return "console.log('screen implementation loaded'); export const value = 42"
      },
    }, forbidEagerScreens()],
    build: { write: false, rolldownOptions: { input: entry } },
  })
}

it.each([false, true])('화면을 정적으로 가져오는 운영 묶음을 거부한다 (공통 모듈 경유: %s)', async (shared) => {
  await expect(bundle(false, shared)).rejects.toThrow('초기 묶음이 화면 구현을 가져옵니다')
})

it('동적 import로 분리한 화면은 초기 묶음과 구분한다', async () => {
  await expect(bundle(true, true)).resolves.toBeDefined()
})
