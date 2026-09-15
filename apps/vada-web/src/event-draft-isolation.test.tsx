import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { readObjectSource } from './data-sources/catalog'
import { configureServer } from './data-sources/server'

let restoreServer: (() => void) | undefined

afterEach(() => {
  restoreServer?.()
  restoreServer = undefined
  window.history.replaceState(null, '', '/')
})

function changeHash(hash: string) {
  act(() => {
    window.history.replaceState(null, '', hash)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
}

describe('행사 기본 정보 초안', () => {
  it('행사 A 편집을 취소한 뒤 행사 B를 열면 행사 B의 값을 보여준다', async () => {
    restoreServer = configureServer(null)
    const originalTitle = String(
      readObjectSource('event.basicsDraft', { eventId: 'E-01' }).title,
    )
    const expectedTitle = String(
      readObjectSource('event.basicsDraft', { eventId: 'E-03' }).title,
    )
    window.history.replaceState(null, '', '/#/EVT-02B?eventId=E-01')

    render(<App />)
    const titleInput = await screen.findByLabelText<HTMLInputElement>('행사명')
    fireEvent.change(titleInput, { target: { value: 'CANCELED-EVENT-A-EDIT' } })
    fireEvent.click(screen.getByRole('button', { name: /^취소$/ }))

    changeHash('#/EVT-02B?eventId=E-03')

    const nextTitle = await screen.findByLabelText<HTMLInputElement>('행사명')
    expect(nextTitle.value).toBe(expectedTitle)

    changeHash('#/EVT-02B?eventId=E-01')
    await waitFor(() => expect(screen.getByLabelText('행사명')).toHaveValue(originalTitle))
  })
})
