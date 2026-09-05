// 사람이 쓴 글과 화면이 그리는 줄 사이(REC-02A ↔ REC-02).
//
// 쓰는 화면은 회고 셋과 인수인계를 **글 한 덩이**로 받고, 읽는 화면은 그것을 **줄과
// 묶음**으로 그린다. 표는 글을 담으므로 줄로 펴는 규칙이 어딘가에 있어야 하고,
// 그 규칙은 여기 한 곳에만 둔다 — 초안을 만드는 쪽도 같은 규칙으로 글을 쓴다.
//
// **글에 없는 구조를 지어내지 않는다.** 회고의 `causeNote`(원인)는 글이 그 구조를
// 갖고 있지 않으므로 내지 않고, 개선안의 담당 부서는 묶음 하나에 고른 부서가 있을 때만
// 붙는다. 인수인계는 글이 가진 만큼만 묶인다 — 머리글 없이 적은 글은 한 묶음이다.

/** 빈 줄이 아닌 줄 하나가 한 줄이다. 앞뒤 공백은 줄의 일부가 아니다. */
export function lines(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

export interface RetroRow {
  key: string
  label: string
  ownerLabel?: string
}

export interface RetroGroup {
  groupLabel: string
  rows: RetroRow[]
}

/** 회고의 세 묶음. 이름은 그림이 그린 것이고 차례도 그대로다(REC-02 30:3821). */
export const RETRO_GROUPS = [
  { key: 'good', field: 'retroGood', label: '잘된 점' },
  { key: 'issues', field: 'retroIssues', label: '미흡했던 점' },
  { key: 'improvements', field: 'retroImprovements', label: '다음 행사 개선안' },
] as const

export type RetroField = (typeof RETRO_GROUPS)[number]['field']

/**
 * 회고 글 셋을 묶음으로 편다.
 *
 * **빈 묶음은 오지 않는다.** 안 쓴 묶음의 머리만 그리면 사람은 거기에 무엇이 있어야
 * 했는지 모른다 — 묶음마다 줄 수가 다르다고 명세가 적었고, 0줄은 없는 것이다.
 *
 * `ownerLabel`은 개선안 묶음에만, 부서가 골라져 있을 때만 붙는다 — 그것이 표가 아는 전부다.
 */
export function retroGroups(
  texts: Record<RetroField, string | null>,
  improvementOwner: string | null,
): RetroGroup[] {
  const groups: RetroGroup[] = []
  for (const group of RETRO_GROUPS) {
    const rows = lines(texts[group.field]).map((label, index) => {
      const row: RetroRow = { key: `${group.key}-${index + 1}`, label }
      if (group.key === 'improvements' && improvementOwner !== null) row.ownerLabel = improvementOwner
      return row
    })
    if (rows.length > 0) groups.push({ groupLabel: group.label, rows })
  }
  return groups
}

export interface HandoverRow {
  key: string
  label: string
  value?: string
  tone?: string
}

export interface HandoverGroup {
  groupLabel: string
  rows: HandoverRow[]
}

/** 그림이 그린 인수인계의 세 묶음(REC-02 30:3887). 초안을 만드는 쪽이 이 머리글로 쓴다. */
export const HANDOVER_GROUPS = {
  assets: '재사용 자산',
  partners: '협력처·담당자',
  cautions: '주의사항',
} as const

/** 머리글 없이 적은 글이 드는 묶음. 없는 묶음을 지어내지 않고 '인수인계'로 둔다. */
const UNGROUPED = '인수인계'

/** 눈에 띄어야 하는 묶음. 명세가 '주의사항이 그 자리'라고 적었다. */
const CAUTION_TONE = 'orange'

/** `[재사용 자산]` — 묶음을 여는 줄. */
const HEADER = /^\[(.+)\]$/
/** 그림의 예시가 한 줄에 여러 항목을 이렇게 나눴다('… 재사용 가능 / 다과 납품: … / 강당 …'). */
const ITEM_SEPARATOR = ' / '
/** `현수막 제작: 한빛기획` — 이름과 값이 갈리는 줄. 첫 번째 것만 가른다. */
const VALUE_SEPARATOR = ': '

export function headerLine(group: string): string {
  return `[${group}]`
}

export function entryLine(label: string, value: string): string {
  return `${label}${VALUE_SEPARATOR}${value}`
}

/**
 * 인수인계 글을 묶음과 줄로 편다.
 *
 * 규칙은 셋뿐이다: `[이름]` 줄이 묶음을 열고, ` / `로도 줄이 나뉘며, 첫 `: `가
 * 이름과 값을 가른다. 머리글 앞의 줄은 '인수인계' 한 묶음이다. **줄이 없는 묶음은
 * 오지 않는다** — 초안이 머리글만 남겨 둔 자리가 그렇다.
 */
export function handoverGroups(text: string | null | undefined): HandoverGroup[] {
  const groups: HandoverGroup[] = []
  let current: HandoverGroup | null = null
  const open = (groupLabel: string) => {
    current = { groupLabel, rows: [] }
    groups.push(current)
    return current
  }

  for (const line of lines(text)) {
    const header = HEADER.exec(line)
    if (header !== null) {
      open(header[1]!.trim())
      continue
    }
    for (const piece of line.split(ITEM_SEPARATOR)) {
      const item = piece.trim()
      if (item === '') continue
      const group: HandoverGroup = current ?? open(UNGROUPED)
      const cut = item.indexOf(VALUE_SEPARATOR)
      const label = cut === -1 ? item : item.slice(0, cut).trim()
      const value = cut === -1 ? '' : item.slice(cut + VALUE_SEPARATOR.length).trim()
      const row: HandoverRow = { key: '', label: label === '' ? item : label }
      if (label !== '' && value !== '') row.value = value
      if (group.groupLabel === HANDOVER_GROUPS.cautions) row.tone = CAUTION_TONE
      group.rows.push(row)
    }
  }

  // 열쇠는 그려지는 묶음의 차례로 붙인다 — 빈 묶음을 빼고 나서 매겨야 번호가 건너뛰지 않는다.
  return groups
    .filter((group) => group.rows.length > 0)
    .map((group, groupIndex) => ({
      groupLabel: group.groupLabel,
      rows: group.rows.map((row, rowIndex) => ({ ...row, key: `g${groupIndex + 1}-${rowIndex + 1}` })),
    }))
}
