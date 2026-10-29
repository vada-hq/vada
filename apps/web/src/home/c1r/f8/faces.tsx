import { cn } from '@/lib/utils'
import type { C1rPerson, C1rRow } from '../c1r-data'
import { FACE, FACE_TINTS } from './tokens'

// 사람마다 얼굴 색 하나. 전체 줄(접힌 줄 포함)에서 처음 나온 차례로 정해, 같은 사람은 어느 줄에서나 같은 색이다.
export type FaceTints = ReadonlyMap<string, string>

export function faceTintsOf(rows: C1rRow[]): FaceTints {
  const tints = new Map<string, string>()
  for (const row of rows) {
    if (!row.person || tints.has(row.person.name)) continue
    tints.set(row.person.name, FACE_TINTS[tints.size % FACE_TINTS.length] ?? FACE_TINTS[0])
  }
  return tints
}

// 머리글자: 성을 뺀 이름(한국 메신저 관례, f4와 같음). 두 자 이하 이름은 그대로.
const SURNAME_NAME_MIN = 3
const initialsOf = (name: string) => (name.length >= SURNAME_NAME_MIN ? name.slice(1) : name)

// 줄 안 작은 얼굴(머리글자 원). 이름 글 바로 앞에 붙어 '누구에게'를 사람 모양으로 먼저 보이게 한다.
export function Face({ person, tints }: { person: C1rPerson; tints: FaceTints }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold tracking-[-0.02em]',
        FACE,
        tints.get(person.name) ?? FACE_TINTS[0],
      )}
    >
      {initialsOf(person.name)}
    </span>
  )
}
