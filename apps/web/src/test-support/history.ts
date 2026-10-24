import { fireEvent, screen } from '@testing-library/react'

// 상세 머리의 '⋯' > [이력 보기]로 이력 창을 열고 그 창을 돌려준다.
export async function openHistory() {
  fireEvent.keyDown(await screen.findByRole('button', { name: '더 보기' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: '이력 보기' }))
  return await screen.findByRole('dialog', { name: '이력' })
}
