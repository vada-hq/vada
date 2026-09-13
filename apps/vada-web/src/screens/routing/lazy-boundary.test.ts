import { expect, it, vi } from 'vitest'

vi.mock('../EVT00AScreen', () => { throw new Error('행사 화면을 미리 가져왔습니다.') })
vi.mock('../FIN00Screen', () => { throw new Error('회계 화면을 미리 가져왔습니다.') })
vi.mock('../OPSMEET02Screen', () => { throw new Error('회의 화면을 미리 가져왔습니다.') })

it('화면 목록은 행사·회계·회의 구현을 실행하지 않고 조회할 수 있다', async () => {
  const { SCREEN_RENDERERS } = await import('./index')
  for (const id of ['SIGN-IN', 'EVT-00A', 'FIN-00', 'OPS-MEET-02']) {
    expect(SCREEN_RENDERERS.has(id)).toBe(true)
  }
})
