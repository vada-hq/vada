// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import LinkDialog from './LinkDialog'
import './LinkDialog.test-support'
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const props = { open: true, links: '', busy: false, disabled: false, error: '', onLinksChange: vi.fn(), onClose: vi.fn(), onCreate: vi.fn() }
test('modal labels its input, focuses it and rejects empty or more than five links', () => {
  const view = render(<LinkDialog {...props} />)
  expect(screen.getByRole('dialog', { name: '끼룩이 · 구매요청서 초안' })).toBeTruthy()
  expect(document.activeElement).toBe(screen.getByLabelText('쿠팡 상품 링크'))
  expect(screen.getByRole('button', { name: '초안 만들기' }).hasAttribute('disabled')).toBe(true)
  view.rerender(<LinkDialog {...props} links={Array(6).fill('https://www.coupang.com/vp/products/1').join('\n')} />)
  fireEvent.submit(screen.getByRole('form', { name: '구매 초안 생성' }))
  expect(props.onCreate).not.toHaveBeenCalled()
  expect(screen.getByText('상품 링크는 최대 5개까지 입력해 주세요.')).toBeTruthy()
})
test('busy modal blocks Escape and closing; idle close restores focus to its launcher', () => {
  const launcher = document.createElement('button')
  document.body.append(launcher)
  launcher.focus()
  const onClose = vi.fn()
  const view = render(<LinkDialog {...props} busy onClose={onClose} />)
  const dialog = screen.getByRole('dialog')
  fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }))
  expect(onClose).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '닫기' }).hasAttribute('disabled')).toBe(true)
  view.rerender(<LinkDialog {...props} onClose={onClose} />)
  fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }))
  expect(onClose).toHaveBeenCalledOnce()
  view.rerender(<LinkDialog {...props} open={false} onClose={onClose} />)
  expect(document.activeElement).toBe(launcher)
  launcher.remove()
})
