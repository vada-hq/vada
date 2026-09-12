import { expect, it, vi } from 'vitest'
import shellJson from '../../../../specs/figma/vada-wireframe/shell.json'

// 작업 공간 설정은 UI를 초기화하지 않고도 읽을 수 있어야 한다.
vi.mock('../components/AppShell', () => {
  throw new Error('작업 공간 설정이 AppShell UI에 의존합니다.')
})

it('화면 컴포넌트를 불러오지 않고 명세의 행사 작업 공간을 읽는다', async () => {
  const { findWorkspace } = await import('./workspaces')

  expect(findWorkspace('event')).toEqual(
    shellJson.workspaces.find((workspace) => workspace.key === 'event'),
  )
})
