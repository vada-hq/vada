// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { snapshotHtml } from '@/test-support/snapshot-html'
import PushPanel from './PushPanel'
import type { PushState } from './push-state'
import type { PushTest } from './usePush'

// 앱 틀과 알림을 나누기 전의 겉 모양을 그대로 적어 둔 특성 시험이다(docs/features/r01-maintainability.md 조각 7).
// 나눈 뒤에도 이 스냅숏 파일은 바뀌지 않아야 한다.
afterEach(cleanup)
const noop = () => {}

type Options = {
  device?: 'ios' | 'android' | 'other'
  test?: PushTest
  enableFailed?: boolean
}

function panel(state: PushState, options: Options) {
  render(
    <PushPanel
      state={state}
      device={options.device ?? 'android'}
      test={options.test ?? { kind: 'idle' }}
      enableFailed={options.enableFailed ?? false}
      onEnable={noop}
      onTest={noop}
      onRetry={noop}
    />,
  )
  return snapshotHtml()
}

const cases: [string, PushState, Options][] = [
  ['확인하는 중', 'loading', {}],
  ['아이폰은 홈 화면 추가', 'needs-home-screen', { device: 'ios' }],
  ['지원 안 함: 아이폰', 'unsupported', { device: 'ios' }],
  ['지원 안 함: 안드로이드', 'unsupported', { device: 'android' }],
  ['서버가 꺼짐', 'server-off', {}],
  ['불러오지 못함', 'failed', {}],
  ['켜기 전', 'ask', {}],
  ['켜기 전: 켜지 못함', 'ask', { enableFailed: true }],
  ['거절: 아이폰', 'denied', { device: 'ios' }],
  ['거절: 안드로이드', 'denied', { device: 'android' }],
  ['거절: 그 밖', 'denied', { device: 'other' }],
  ['켜짐', 'on', {}],
  ['켜짐: 보내는 중', 'on', { test: { kind: 'sending' } }],
  ['켜짐: 보냄', 'on', { test: { kind: 'result', result: 'sent' } }],
  ['켜짐: 등록 끝남', 'on', { test: { kind: 'result', result: 'expired' } }],
  ['켜짐: 서버가 받지 않음', 'on', { test: { kind: 'result', result: 'rejected' } }],
  [
    '켜짐: 모르는 알림 서버',
    'on',
    { test: { kind: 'unsupported-service', host: 'push.example.test' } },
  ],
  ['켜짐: 보내지 못함', 'on', { test: { kind: 'failed' } }],
  ['켜짐: 결과 모름', 'on', { test: { kind: 'unknown' } }],
]

test.each(cases)('%s', (_name, state, options) => {
  expect(panel(state, options)).toMatchSnapshot()
})
