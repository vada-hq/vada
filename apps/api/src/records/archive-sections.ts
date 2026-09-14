import type { Db } from '../db/client.ts'
import { archiveOf } from './archive-facts.ts'
import { archiveStatusOf as statusOf } from './archive-shared.ts'
import { archiveConditionsOf, type ConditionKey } from './archive-gate.ts'

export interface SectionRow {
  key: string
  label: string
  statusLabel?: string
  statusTone?: string
  rows?: Array<{ key: string; label: string }>
}

/** 저절로 채워지는 절. 쓰는 화면이 '자동'이라 그렸다. */
const AUTO = { statusLabel: '자동', statusTone: 'gray' } as const

/**
 * 사람이 쓰는 절과 그 절을 채우는 조건. 절의 진행 상태가 발행 조건과 같은 셈에서
 * 나오게 한다 — 따로 세면 목차는 '작성 완료'인데 조건은 빨간 날이 온다.
 */
const WRITTEN_SECTIONS: Array<{ key: string; label: string; conditions: ConditionKey[] }> = [
  { key: 'onSite', label: '현장 운영', conditions: ['onSite'] },
  { key: 'retro', label: '회고', conditions: ['retroGood', 'retroIssues', 'retroImprovements'] },
  { key: 'handover', label: '인수인계', conditions: ['handover', 'nextOwner'] },
]

/**
 * 절이 어디까지 왔는가. 그림은 '작성 전'만 그렸다 — 다 쓴 절과 쓰다 만 절의 말은
 * 여기서 정했다(회의록 정리 현황이 '작성 전'·'초안 작성'으로 가르는 것과 같은 결).
 */
function progressOf(metCount: number, total: number): { statusLabel: string; statusTone: string } {
  if (metCount === 0) return { statusLabel: '작성 전', statusTone: 'orange' }
  if (metCount === total) return { statusLabel: '작성 완료', statusTone: 'green' }
  return { statusLabel: '작성 중', statusTone: 'orange' }
}

/** 발행된 문서의 목차. 회고만 세 갈래로 펴진다(REC-02 30:3615). */
const PUBLISHED_SECTIONS: SectionRow[] = [
  { key: 'overview', label: '개요' },
  { key: 'outcome', label: '성과' },
  { key: 'timeline', label: '타임라인' },
  { key: 'onSite', label: '현장 운영' },
  { key: 'evidence', label: '근거 자료' },
  {
    key: 'retro',
    label: '회고',
    rows: [
      { key: 'retroGood', label: '잘된 점' },
      { key: 'retroIssues', label: '미흡했던 점' },
      { key: 'retroImprovements', label: '개선안' },
    ],
  },
  { key: 'handover', label: '인수인계' },
]

/**
 * 목차(`record.archiveSections`). **두 화면이 같은 목록을 다르게 그린다** — 발행된
 * 문서는 회고가 세 갈래로 펴지고, 쓰는 중인 문서는 절마다 어디까지 썼는지가 붙는다.
 * 절의 차례도 그림마다 다르다(쓰는 화면은 자동 넷을 먼저 둔다).
 */
export async function archiveSections(db: Db, orgId: string, eventId: string): Promise<SectionRow[]> {
  const { row } = await archiveOf(db, orgId, eventId)
  if (statusOf(row) === 'published') return PUBLISHED_SECTIONS
  const met = new Set(
    archiveConditionsOf(row)
      .filter((condition) => condition.met !== '')
      .map((condition) => condition.key),
  )
  return [
    { key: 'overview', label: '개요', ...AUTO },
    { key: 'outcome', label: '성과', ...AUTO },
    { key: 'timeline', label: '타임라인', ...AUTO },
    { key: 'evidence', label: '근거 자료', ...AUTO },
    ...WRITTEN_SECTIONS.map((section) => ({
      key: section.key,
      label: section.label,
      ...progressOf(
        section.conditions.filter((key) => met.has(key)).length,
        section.conditions.length,
      ),
    })),
  ]
}
