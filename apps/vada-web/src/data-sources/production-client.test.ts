import { afterEach, expect, it, vi } from 'vitest'
import { readObjectSource } from './catalog'
import { fetchOptions } from '../option-sources/catalog'
import { runMutation } from '../spec/mutations'
import { configureServer, loadSources } from './server'
import optionsJson from '../../../../specs/figma/vada-wireframe/option-sources.json'

// 일반 검사는 개발 구현을 쓰므로, 이 파일에서는 운영 구현을 연결한다.
vi.mock('#offline-client', () => import('./offline-client'))

let restore: (() => void) | undefined
afterEach(() => {
  restore?.()
  restore = undefined
})

it('운영 조회는 서버 연결이 없으면 개발용 데이터를 반환하지 않는다', () => {
  expect(() => readObjectSource('shell.organization')).toThrow('서버 연결이 설정되지 않았습니다.')
})

it('운영 원격 선택지는 서버 연결이 없으면 실패한다', async () => {
  await expect(fetchOptions('education.schools', {})).rejects.toThrow('서버 연결이 설정되지 않았습니다.')
})

it('운영 제출은 서버 연결이 없으면 성공으로 처리하지 않는다', async () => {
  await expect(runMutation('auth.signInGoogle', {})).rejects.toThrow('서버 연결이 설정되지 않았습니다.')
})

it('계약에 선언한 정적 선택지는 서버 없이도 조회한다', async () => {
  const source = optionsJson.sources.find((one) => one.type === 'static')!
  expect(await fetchOptions(source.key, {})).toEqual(source.options)
})

it('서버가 연결되면 조회·선택지·제출 모두 서버의 응답을 반환한다', async () => {
  const response = { name: '실제 조직' }
  restore = configureServer({ fetch: async () => Response.json(response) })
  await loadSources([{ key: 'shell.organization', params: {} }])
  expect(readObjectSource('shell.organization')).toEqual(response)
  restore()
  const choices = [{ value: 'school', label: '실제 학교' }]
  restore = configureServer({ fetch: async () => Response.json(choices) })
  expect(await fetchOptions('education.schools', {})).toEqual(choices)
  restore()
  const result = { url: 'https://accounts.example.test/authorize' }
  restore = configureServer({ fetch: async () => Response.json(result) })
  expect(await runMutation('auth.signInGoogle', {})).toEqual(result)
})

it('서버 실패를 개발용 성공 응답으로 대체하지 않는다', async () => {
  restore = configureServer({ fetch: async () => new Response('', { status: 500 }) })
  await expect(loadSources([{ key: 'shell.organization', params: {} }])).rejects.toThrow()
  expect(() => readObjectSource('shell.organization')).toThrow()
  await expect(fetchOptions('education.schools', {})).rejects.toThrow('500')
  await expect(runMutation('auth.signInGoogle', {})).rejects.toThrow('500')
})
