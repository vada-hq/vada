import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { OPSMEET02Screen } from './OPSMEET02Screen'
import { createEmptyScopeDraft } from '../state/scopes'
import type { ScopeDraft } from '../state/scopes'
import * as mutations from '../spec/mutations'

afterEach(() => vi.restoreAllMocks())

function drawEditor(initialDraft?: ScopeDraft) {
  const onNavigate = vi.fn()
  const onScopeEvent = vi.fn()
  function Editor() {
    const [draft, setDraft] = useState(() => initialDraft ?? createEmptyScopeDraft())
    return (
      <OPSMEET02Screen
        screenParams={{ meetingId: 'MTG-05' }}
        draft={draft}
        onChangeDraft={setDraft}
        onNavigate={onNavigate}
        onScopeEvent={onScopeEvent}
      />
    )
  }
  render(<Editor />)
  return { onNavigate, onScopeEvent }
}

it('참가자를 넣고 빼도 다른 입력과 비공개 설정이 유지된다', () => {
  drawEditor()
  fireEvent.click(screen.getByRole('checkbox', { name: '비공개 회의' }))
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '이윤슬' } })
  fireEvent.click(screen.getByRole('button', { name: '참가자 추가' }))
  expect(screen.getByText('선택됨 5명')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /이윤슬 참가자에서 빼기/ }))
  expect(screen.getByText('선택됨 4명')).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: '비공개 회의' })).toBeChecked()
  expect(screen.getByRole('textbox', { name: '회의명*' })).toHaveValue('체육대회 안전 관리 최종 회의')
})

it('중간 안건을 삭제하고 추가해도 남은 안건은 유지되고 빈 필수값은 제출을 막는다', () => {
  const run = vi.spyOn(mutations, 'runMutation').mockResolvedValue({})
  drawEditor()
  const titles = screen.getAllByRole('textbox', { name: '안건명*' }) as HTMLInputElement[]
  const lastTitle = titles[2].value
  fireEvent.change(titles[0], { target: { value: '고친 첫 안건' } })
  fireEvent.click(screen.getByRole('button', { name: '안건 2 삭제' }))
  fireEvent.click(screen.getByRole('button', { name: '안건 추가' }))
  const next = screen.getAllByRole('textbox', { name: '안건명*' })
  expect(next).toHaveLength(3)
  expect(next[0]).toHaveValue('고친 첫 안건')
  expect(next[1]).toHaveValue(lastTitle)
  expect(next[2]).toHaveValue('')
  fireEvent.click(screen.getByRole('button', { name: '회의 만들기' }))
  expect(screen.getByRole('alert')).toHaveTextContent('아직 채우지 않은 칸이 있습니다')
  expect(run).not.toHaveBeenCalled()
})

it.each([
  ['회의 만들기', 'meeting.create'],
  ['임시 저장', 'meeting.saveDraft'],
])('%s 버튼이 편집한 초안을 공통 저장 처리로 넘긴다', async (label, mutationKey) => {
  const run = vi.spyOn(mutations, 'runMutation').mockResolvedValue({ meetingId: 'MTG-SAVED' })
  drawEditor({
    values: {
      title: '쓰던 회의명',
      meetingType: 'event',
      linkedEventId: 'EVT-01',
      departmentId: 'D-01',
      purpose: '운영 점검',
      date: '2026-09-12',
      startTime: '18:00',
      endTime: '19:00',
      mode: 'offline',
      place: '회의실',
      agendaItems: 'r0',
      'agendaItems.r0.agendaTitle': '예산 검토',
      'agendaItems.r0.agendaNote': '집행 현황',
      'agendaItems.r0.duration': '15',
    },
    labels: {},
  })
  fireEvent.change(screen.getByRole('textbox', { name: '회의명*' }), { target: { value: '고친 회의명' } })
  fireEvent.click(screen.getByRole('button', { name: label }))
  expect(screen.queryByRole('alert')?.textContent ?? '').toBe('')
  await waitFor(() => expect(run).toHaveBeenCalledWith(
    mutationKey,
    expect.objectContaining({ title: '고친 회의명', agendaItems: 'r0' }),
    expect.any(Object),
  ))
})
