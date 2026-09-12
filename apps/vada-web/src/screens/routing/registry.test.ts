import { createElement } from 'react'
import { expect, it, vi } from 'vitest'
import { ALL_SCREENS } from '../../spec/screens'
import { SCREEN_RENDERERS } from './index'
import { createScreenRegistry } from './registry'
import type { ScreenContext, ScreenRegistration } from './types'

const context: ScreenContext = {
  screenId: '',
  screenParams: {},
  scopes: {},
  onChangeScope: () => {},
  onNavigate: () => {},
  onScopeEvent: () => {},
}

it('주소를 갖는 명세 화면이 빠짐없이 한 번씩 등록돼 있다', () => {
  expect([...SCREEN_RENDERERS.keys()].sort()).toEqual(ALL_SCREENS.map((screen) => screen.screenId).sort())
})

it('모르는 ID는 다른 화면으로 대신하지 않는다', () => {
  expect(SCREEN_RENDERERS.get('NOT-REGISTERED')).toBeUndefined()
  expect(SCREEN_RENDERERS.get('toString')).toBeUndefined()
})

const sample: ScreenRegistration = { screenIds: ['SAMPLE'], render: () => createElement('div') }
it.each([
  { where: '같은 업무', groups: [[sample, sample]] },
  { where: '서로 다른 업무', groups: [[sample], [sample]] },
  { where: '하나의 등록', groups: [[{ ...sample, screenIds: ['SAMPLE', 'SAMPLE'] }]] },
])('$where에서 ID가 중복되면 등록을 거부한다', ({ groups }) => {
  expect(() => createScreenRegistry(groups)).toThrow("화면 'SAMPLE'가 중복 등록됐습니다.")
})

it('주소 인자를 사용하는 모든 화면에 같은 값을 전달한다', () => {
  for (const spec of ALL_SCREENS.filter((screen) => screen.params?.length)) {
    const params = Object.fromEntries(spec.params!.map((param) => [param.key, `전달값:${param.key}`]))
    const render = SCREEN_RENDERERS.get(spec.screenId)!
    const props = render({ ...context, screenId: spec.screenId, screenParams: params }).props as {
      screenParams?: Record<string, string>
    }
    expect(props.screenParams, spec.screenId).toBe(params)
  }
})

it.each([
  ['FIN-00', 'FIN-00B'],
  ['EVT-00A', 'EVT-00A2'],
  ['OPS-MEET-01A', 'OPS-MEET-01C'],
  ['OPS-MEET-03A', 'OPS-MEET-03B', 'OPS-MEET-03C'],
  ['OPS-MEET-05A', 'OPS-MEET-05B'],
  ['OPS-MEET-07', 'OPS-MEET-08'],
])('%s의 변형은 같은 컴포넌트에 각 화면 ID를 전달한다', (...ids) => {
  const elements = ids.map((screenId) => SCREEN_RENDERERS.get(screenId)!({ ...context, screenId }))
  for (const [index, element] of elements.entries()) {
    expect(element.type).toBe(elements[0]!.type)
    expect((element.props as { screenId: string }).screenId).toBe(ids[index])
  }
})

it('학생회 생성에는 가입 초안과 생성 초안을 구분해 전달한다', () => {
  const spec = ALL_SCREENS.find((screen) => screen.screenId === 'ORG-02')!
  const joiningSpec = ALL_SCREENS.find((screen) => screen.screenId === 'ONB-01')!
  const joining = { values: { name: '가입자' }, labels: {} }
  const draft = { values: { name: '학생회' }, labels: {} }
  const props = SCREEN_RENDERERS.get('ORG-02')!({
    ...context,
    screenId: 'ORG-02',
    scopes: { [joiningSpec.stateScopeKey!]: joining, [spec.stateScopeKey!]: draft },
  }).props as { joining: unknown; draft: unknown }
  expect(props.joining).toBe(joining)
  expect(props.draft).toBe(draft)
})

it('화면의 이동 콜백은 대상과 주소 인자를 그대로 전달한다', () => {
  const onNavigate = vi.fn()
  const props = SCREEN_RENDERERS.get('OPS-MEET-02')!({
    ...context, screenId: 'OPS-MEET-02', onNavigate,
  }).props as { onNavigate: ScreenContext['onNavigate'] }
  props.onNavigate('OPS-MEET-03A', { meetingId: 'M-42' })
  expect(onNavigate).toHaveBeenCalledExactlyOnceWith('OPS-MEET-03A', { meetingId: 'M-42' })
})
