import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EVT05Screen } from './EVT05Screen'
import { createEmptyScopeDraft, type ScopeDraft } from '../state/scopes'
import * as sources from '../data-sources/catalog'
import * as mutations from '../spec/mutations'

afterEach(() => vi.restoreAllMocks())

function drawEditor(initialDraft?: ScopeDraft, screenParams: Record<string, string> = { eventId: 'E-01' }) {
  const changed = vi.fn()
  const onNavigate = vi.fn()
  function Editor() {
    const [draft, setDraft] = useState(() => initialDraft ?? createEmptyScopeDraft())
    return (
      <EVT05Screen
        screenParams={screenParams}
        draft={draft}
        onChangeDraft={(next) => { changed(next); setDraft(next) }}
        onNavigate={onNavigate}
      />
    )
  }
  render(<Editor />)
  return { changed, onNavigate }
}

function allowActivation() {
  const read = sources.readObjectSource
  vi.spyOn(sources, 'readObjectSource').mockImplementation((key, params) =>
    key === 'event.surveyActivation'
      ? { canActivate: true, blockedNote: '', unmetCount: 0, unmetCountNote: '미충족 0개' }
      : read(key, params),
  )
}

it('읽어 온 초안에서 날짜·선택·체크를 편집해도 다른 필드와 선택 라벨이 유지된다', () => {
  const { changed } = drawEditor()
  expect(screen.getByRole('radio', { name: '선착순' })).toBeChecked()
  expect(screen.getByLabelText('학생회비 납부 여부 대조')).toBeChecked()
  fireEvent.change(screen.getByLabelText('신청 마감 일시'), { target: { value: '2026-10-01T18:00' } })
  fireEvent.click(screen.getByRole('radio', { name: '관리자 승인' }))
  fireEvent.click(screen.getByLabelText('정원 초과 시 대기 신청 운영'))
  fireEvent.click(screen.getByLabelText('학생회비 납부 여부 대조'))
  expect(changed).toHaveBeenLastCalledWith({
    values: { applyMethod: 'approval', duesCheck: null, waitlist: 'y', applyEnd: '2026-10-01T18:00' },
    labels: { applyMethod: '관리자 승인' },
  })
  fireEvent.change(screen.getByLabelText('신청 마감 일시'), { target: { value: '' } })
  expect(changed.mock.lastCall![0].values.applyEnd).toBeNull()
  expect(screen.getByRole('radio', { name: '관리자 승인' })).toBeChecked()
})

it('이미 쓰던 초안은 서버 초기값으로 덮어쓰지 않는다', () => {
  const { changed } = drawEditor({
    values: { completionNote: '쓰던 안내', applyMethod: 'approval', duesCheck: null },
    labels: { applyMethod: '관리자 승인' },
  })
  expect(screen.getByLabelText('신청 완료 안내 문구')).toHaveValue('쓰던 안내')
  expect(screen.getByRole('radio', { name: '관리자 승인' })).toBeChecked()
  expect(screen.getByLabelText('학생회비 납부 여부 대조')).not.toBeChecked()
  expect(changed).not.toHaveBeenCalled()
})

it('문항 삭제 후 입력과 문항 종류를 바꿔도 삭제·잠금 상태와 입력 포커스가 유지된다', () => {
  const run = vi.spyOn(mutations, 'runMutation').mockResolvedValue({})
  const { changed } = drawEditor()
  expect(screen.queryByRole('button', { name: '이름 문항 삭제' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '단과대학 문항 삭제' }))
  const note = screen.getByLabelText('신청 완료 안내 문구')
  note.focus()
  fireEvent.change(note, { target: { value: '변경한 안내' } })
  expect(screen.getByLabelText('신청 완료 안내 문구')).toBe(note)
  expect(note).toHaveFocus()
  fireEvent.click(screen.getByRole('radio', { name: '객관식' }))
  expect(note).toHaveValue('변경한 안내')
  expect(screen.queryByRole('button', { name: '단과대학 문항 삭제' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '이름 문항 삭제' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '학부·학과 문항 삭제' })).toBeInTheDocument()
  expect(changed.mock.lastCall![0].labels.newQuestionType).toBe('객관식')
  expect(run).not.toHaveBeenCalled()
})

it('행사 인자가 없으면 설문 데이터를 조회하지 않는다', () => {
  const read = vi.spyOn(sources, 'readObjectSource')
  drawEditor(undefined, {})
  expect(screen.getByRole('alert')).toHaveTextContent('어떤 행사의 참여 설문인지')
  expect(screen.queryByText('설문 링크 활성화 조건')).not.toBeInTheDocument()
  expect(read.mock.calls.filter(([key]) => key?.startsWith('event.'))).toEqual([])
})

it('서버가 활성화를 막으면 그 이유만 표시하고 제출하지 않는다', () => {
  const run = vi.spyOn(mutations, 'runMutation').mockResolvedValue({})
  drawEditor()
  fireEvent.click(screen.getByRole('button', { name: '설문 링크 활성화' }))
  expect(screen.getByRole('alert')).toHaveTextContent('아직 채우지 않은 활성화 조건이 2개 있습니다')
  expect(run).not.toHaveBeenCalled()
})

it('활성화가 허용되면 편집한 초안과 행사 인자를 공통 제출 처리에 넘긴다', async () => {
  allowActivation()
  const run = vi.spyOn(mutations, 'runMutation').mockResolvedValue({})
  const { onNavigate } = drawEditor()
  fireEvent.change(screen.getByLabelText('신청 완료 안내 문구'), { target: { value: '제출할 안내' } })
  fireEvent.click(screen.getByRole('button', { name: '설문 링크 활성화' }))
  await waitFor(() => expect(run).toHaveBeenCalledWith(
    'event.survey.activate',
    expect.objectContaining({ completionNote: '제출할 안내', applyMethod: 'firstCome' }),
    { eventId: 'E-01' },
  ))
  await waitFor(() => expect(screen.getByRole('button', { name: '설문 링크 활성화' })).toBeInTheDocument())
  expect(onNavigate).not.toHaveBeenCalled()
})

it('활성화 요청이 실패하면 서버 오류를 표시하고 편집 내용을 유지한다', async () => {
  allowActivation()
  vi.spyOn(mutations, 'runMutation').mockRejectedValue(
    new mutations.Refused('event.survey.activate', 409, '이미 활성화된 설문입니다'),
  )
  drawEditor()
  fireEvent.change(screen.getByLabelText('신청 완료 안내 문구'), { target: { value: '보존할 안내' } })
  fireEvent.click(screen.getByRole('button', { name: '설문 링크 활성화' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('이미 활성화된 설문입니다')
  expect(screen.getByLabelText('신청 완료 안내 문구')).toHaveValue('보존할 안내')
})
