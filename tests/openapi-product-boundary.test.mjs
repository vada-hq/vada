import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildOpenApi } from '../apps/spec-service/src/generate-openapi.mjs'

const generator = readFileSync(
  new URL('../apps/spec-service/src/generate-openapi.mjs', import.meta.url),
  'utf8',
)

test('공통 OpenAPI 생성기는 VADA 제품 설정을 알지 않는다', () => {
  for (const productSetting of ['vada-wireframe', 'vada.session', 'title: "vada"']) {
    assert.doesNotMatch(generator, new RegExp(productSetting.replace('.', '\\.')))
  }
})

test('제품이 문서 정보와 세션 설정을 주입한다', () => {
  const document = buildOpenApi({
    dataSources: { sources: [] },
    mutations: { mutations: [] },
    optionSources: { sources: [] },
    screens: [],
    info: { title: 'another-product', version: '1.0.0' },
    servers: [{ url: '/api' }],
    securityScheme: {
      key: 'browserSession',
      cookieName: 'another.session',
      description: '브라우저 세션',
    },
  })

  assert.equal(document.info.title, 'another-product')
  assert.deepEqual(document.security, [{ browserSession: [] }])
  assert.equal(document.components.securitySchemes.browserSession.name, 'another.session')
})
