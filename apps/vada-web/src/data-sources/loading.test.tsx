import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { ScreenRouter } from '../screens/ScreenRouter'
import { ALL_SCREENS, exampleParamsOf } from '../spec/screens'
import { dataSourceKeysOf } from '../spec/screen-sources'
import { findDataSource } from './catalog'
import { setLoadingBehaviour } from './loading'

// 받아 오는 동안과 실패했을 때를 화면이 말하는가.
//
// 카탈로그는 출처마다 셋을 갖는다 — loading·error·empty. 그런데 화면이 읽는 것은
// empty뿐이었고(75곳), 나머지 290개는 **그려질 순간 자체가 없었다**: 읽기가 전부
// 동기라 기다리는 시간도 실패할 통신도 없었기 때문이다.
//
// 명세는 옳다. 진짜 서버는 늦게 답하고 가끔 실패한다. 그래서 그릇이 세 상태를
// 갖게 하고, 여기서 나머지 둘을 실제로 만들어 본다 — **코드 경로가 없으면 명세의
// 그 줄은 영원히 말뿐이다.**
//
// 개발용 응답은 기본적으로 즉시 답한다. 늦게 답하게 하면 검사 1,865개가 전부
// 기다려야 하는데, 그 비용은 이 두 상태를 증명하는 것과 아무 상관이 없다.

const restore: Array<() => void> = []

afterEach(() => {
  while (restore.length > 0) restore.pop()?.()
  cleanup()
})

function show(screenId: string) {
  render(
    <ScreenRouter
      screenId={screenId}
      screenParams={exampleParamsOf(screenId)}
      scopes={{}}
      onChangeScope={() => {}}
      onNavigate={() => {}}
    />,
  )
}

// 출처를 읽는 화면 중 대표 몇을 고른다. **모든 화면을 돌리지 않는 까닭**은 그릇이
// 하는 일이 화면마다 같기 때문이다 — 화면 수만큼 되풀이해도 새로 아는 것이 없다.
// 대신 아래에 "어느 문구가 닿을 수 있는가"를 화면이 아니라 **출처 단위로** 센다.
const SAMPLES = ['HOME-01K', 'EVT-00A', 'FIN-00', 'OPS-MEET-01A', 'MY-01']

describe('받아 오는 동안', () => {
  // **글은 이름으로 닿는다.** 기다리는 동안 눈에 보이는 것은 채워질 자리의 모양이고
  // (사람이 정했다, 2026-09-06), 명세가 적어 둔 문구는 읽어 주는 기계에게 간다.
  // 재는 것은 그대로다 — 카탈로그의 그 글이 사람에게 닿는가.
  it.each(SAMPLES)('%s: 카탈로그의 loading 문구가 닿는다', async (screenId) => {
    restore.push(setLoadingBehaviour({ delayMs: 10_000 }))
    show(screenId)

    const spec = ALL_SCREENS.find((entry) => entry.screenId === screenId)
    const first = findDataSource(dataSourceKeysOf(spec!)[0]).messages.loading
    expect(await screen.findByRole('status')).toHaveAccessibleName(
      expect.stringContaining(first) as unknown as string,
    )
  })

  it('시간이 지나면 화면이 나온다', async () => {
    restore.push(setLoadingBehaviour({ delayMs: 20 }))
    show('HOME-01K')

    expect(screen.getByRole('status')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })
})

describe('받아 오지 못했을 때', () => {
  it.each(SAMPLES)('%s: 카탈로그의 error 문구를 그린다', (screenId) => {
    const spec = ALL_SCREENS.find((entry) => entry.screenId === screenId)
    const broken = dataSourceKeysOf(spec!)[0]
    restore.push(setLoadingBehaviour({ failing: [broken] }))
    show(screenId)

    expect(screen.getByRole('alert')).toHaveTextContent(findDataSource(broken).messages.error)
  })

  // **실패는 조용하지 않다.** 화면을 그리지 않고 까닭을 말한다 — 빈 화면은
  // 고장으로 보이고, 절반만 그린 화면은 거짓을 보여 준다.
  it('실패하면 화면을 그리지 않는다', () => {
    const spec = ALL_SCREENS.find((entry) => entry.screenId === 'HOME-01K')
    restore.push(setLoadingBehaviour({ failing: [dataSourceKeysOf(spec!)[0]] }))
    show('HOME-01K')

    expect(screen.queryByRole('heading', { name: /운영 현황/ })).not.toBeInTheDocument()
  })
})

// 문구가 **닿을 수 있는가**를 출처 단위로 센다. 어느 화면도 가리키지 않는 출처의
// loading·error는 그릴 자리가 없다 — 셸이 읽는 것과 변형의 조건이 그 예외다.
it('세어 둔다 — loading·error 문구가 닿는 출처가 몇인가', () => {
  const declared = new Set<string>()
  for (const spec of ALL_SCREENS) {
    for (const key of dataSourceKeysOf(spec)) declared.add(key)
  }
  // 셸과 변형 조건이 읽는 여섯. 화면의 요소가 아니라서 여기 안 든다.
  const BY_FRAME = [
    'shell.organization',
    'shell.viewer',
    'event.workspace',
    'event.listViewer',
    'finance.overviewViewer',
  ]
  for (const key of BY_FRAME) declared.add(key)

  const all = ALL_SCREENS.flatMap((spec) => dataSourceKeysOf(spec))
  const unique = new Set(all)
  console.log(
    `\n  화면이 가리키는 출처 ${unique.size}개 · 그릇이 읽는 것 ${BY_FRAME.length}개` +
      `\n  → loading·error 문구 ${declared.size * 2}개가 닿을 수 있다\n`,
  )
  expect(declared.size).toBeGreaterThanOrEqual(145)
})
