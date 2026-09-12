import { describe, expect, it, vi } from 'vitest'
import screenJson from '../../../../../specs/figma/vada-wireframe/screens/OPS-MEET-02/screen.json'
import type { ListSpec, ScreenSpec } from '../../spec/types'
import type { ScopeDraft } from '../../state/scopes'

vi.mock('react', () => { throw new Error('초안 편집은 React에 의존하지 않습니다.') })
vi.mock('../../spec/screens', () => { throw new Error('초안 편집은 화면 전체 명세를 로드하지 않습니다.') })
vi.mock('../../data-sources/catalog', () => { throw new Error('초안 편집은 데이터 조회에 의존하지 않습니다.') })

const agenda = (screenJson as ScreenSpec).elements.find(
  (element) => element.spec.type === 'list' && element.spec.fieldKey === 'agendaItems',
)!.spec as ListSpec

function draft(values: ScopeDraft['values']): ScopeDraft {
  return { values: Object.freeze(values), labels: Object.freeze({ mode: '대면' }) }
}

describe('화면 없이 회의 초안을 편집한다', () => {
  it('서버의 참거짓·참가자 딱지·안건을 기존 초안 형식으로 옮긴다', async () => {
    const { draftFromRow, decodeChips } = await import('./meeting-draft')
    const result = draftFromRow({
      title: '운영 회의', isPrivate: true,
      participants: [{ memberId: 'M-01', chips: [{ label: '주최자', tone: 'blue' }] }],
      agendaItems: [{ agendaTitle: '예산 검토', duration: 0 }],
    })
    expect(result).toEqual({
      values: {
        title: '운영 회의', isPrivate: 'y', participants: 'r0',
        'participants.r0.memberId': 'M-01', 'participants.r0.chips': '주최자|blue',
        agendaItems: 'r0', 'agendaItems.r0.agendaTitle': '예산 검토', 'agendaItems.r0.duration': '0',
      },
      labels: {},
    })
    expect(decodeChips(result.values['participants.r0.chips'])).toEqual([{ label: '주최자', tone: 'blue' }])
    expect(draftFromRow({ isPrivate: false }).values.isPrivate).toBe('')
  })

  it('이미 고른 참가자를 건너뛰고 다음 후보를 추가하며 원본을 보존한다', async () => {
    const { addParticipant } = await import('./meeting-draft')
    const before = draft({
      participants: 'r0\nr2',
      'participants.r0.memberId': 'M-01',
      'participants.r2.memberId': 'M-02'
    })
    const result = addParticipant(before, 'participants', [
      { memberId: 'M-01', name: '기존', departmentNote: '기획부' },
      { memberId: 'M-03', name: '새 참가자', departmentNote: '홍보부' },
    ])!
    expect(result.values).toMatchObject({
      participants: 'r0\nr2\nr1', 'participants.r1.memberId': 'M-03',
      'participants.r1.name': '새 참가자', 'participants.r1.departmentNote': '홍보부',
      'participants.r1.chips': '', 'participants.r1.canRemove': 'true',
    })
    expect(before.values.participants).toBe('r0\nr2')
    expect(result.labels).toBe(before.labels)
    expect(addParticipant(before, 'participants', [{ memberId: 'M-01' }])).toBeNull()
    expect(addParticipant(before, 'participants', [])).toBeNull()
  })

  it('안건을 추가해도 기존 안건을 덮지 않고 명세의 초기값을 넣는다', async () => {
    const { addAgenda, isDraftFieldFilled } = await import('./meeting-draft')
    const before = draft({
      agendaItems: 'r0\nr2',
      'agendaItems.r0.agendaTitle': '첫 안건',
      'agendaItems.r2.agendaTitle': '남은 안건'
    })
    const result = addAgenda(before, agenda)
    expect(result.values.agendaItems).toBe('r0\nr2\nr1')
    expect(result.values['agendaItems.r2.agendaTitle']).toBe('남은 안건')
    for (const { spec } of agenda.itemFields ?? []) {
      if (spec.type === 'input' || spec.type === 'select') {
        expect(result.values[`agendaItems.r1.${spec.fieldKey}`]).toBe(spec.initialValue ?? '')
      }
    }
    expect(isDraftFieldFilled(result, { fieldKey: 'agendaTitle', inList: 'agendaItems' })).toBe(false)
    expect(before.values.agendaItems).toBe('r0\nr2')
  })

  it('지정한 행의 값만 지우고 비슷한 행 이름과 다른 목록을 보존한다', async () => {
    const { removeDraftRow } = await import('./meeting-draft')
    const before = draft({
      agendaItems: 'r1\nr10', 'agendaItems.r1.agendaTitle': '삭제', 'agendaItems.r1.duration': '15',
      'agendaItems.r10.agendaTitle': '유지', participants: 'r1', 'participants.r1.name': '유지',
    })
    expect(removeDraftRow(before, 'agendaItems', 'r1')).toEqual({
      values: {
        agendaItems: 'r10',
        'agendaItems.r10.agendaTitle': '유지',
        participants: 'r1',
        'participants.r1.name': '유지'
      },
      labels: before.labels,
    })
    expect(before.values['agendaItems.r1.agendaTitle']).toBe('삭제')
  })

  it('최상위 필드와 모든 안건의 필수값을 공통 판정에 연결한다', async () => {
    const { isDraftFieldFilled } = await import('./meeting-draft')
    const before = draft({
      title: '회의',
      agendaItems: 'r0\nr1',
      'agendaItems.r0.agendaTitle': '첫 안건',
      'agendaItems.r1.agendaTitle': ' '
    })
    expect(isDraftFieldFilled(before, { fieldKey: 'title', inList: null })).toBe(true)
    expect(isDraftFieldFilled(before, { fieldKey: 'place', inList: null })).toBe(false)
    expect(isDraftFieldFilled(before, { fieldKey: 'agendaTitle', inList: 'agendaItems' })).toBe(false)
  })
})
