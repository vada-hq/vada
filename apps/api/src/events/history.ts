import { inArray } from 'drizzle-orm'
import { koreanOf, type EventChange, type EventVersion } from '@vada/contracts'
import { member } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { versionsOf } from '../records/versions.js'

type Reader = Pick<Db, 'select'>

// 판에 담긴 행사 줄의 칸 값(to_jsonb라 칸 이름이 표의 이름이다).
type Snapshot = {
  name: string
  starts_at: string | null
  ends_at: string | null
  place: string | null
  owner_id: string | null
}

const koreanOrNull = (value: string | null) => (value ? koreanOf(new Date(value)) : null)
const personOf = (id: string | null, names: Map<string, string>) =>
  id ? { id, name: names.get(id) ?? null } : null

function changesBetween(before: Snapshot, after: Snapshot, names: Map<string, string>) {
  const changes: EventChange[] = []
  if (before.name !== after.name) changes.push({ field: 'name', from: before.name, to: after.name })
  // 같은 순간이 다른 글자로 올 수 있어 한국 시각으로 바꿔 견준다.
  for (const [field, key] of [
    ['startsAt', 'starts_at'],
    ['endsAt', 'ends_at'],
  ] as const) {
    const [from, to] = [koreanOrNull(before[key]), koreanOrNull(after[key])]
    if (from !== to) changes.push({ field, from, to })
  }
  if (before.place !== after.place)
    changes.push({ field: 'place', from: before.place, to: after.place })
  if (before.owner_id !== after.owner_id)
    changes.push({
      field: 'owner',
      from: personOf(before.owner_id, names),
      to: personOf(after.owner_id, names),
    })
  return changes
}

// 행사 하나의 판 전체를 오래된 것부터. 판 1은 '만듦'이고, 그다음부터는 앞 판과 달라진 칸이다. 책임자는 지금 이름으로 보인다.
export async function eventHistoryOf(db: Reader, eventId: string): Promise<EventVersion[]> {
  const rows = await versionsOf(db, eventId)
  const snapshots = rows.map(row => row.data as Snapshot)
  const ids = [...new Set(snapshots.flatMap(item => (item.owner_id ? [item.owner_id] : [])))]
  const people = ids.length
    ? await db
        .select({ id: member.id, name: member.name })
        .from(member)
        .where(inArray(member.id, ids))
    : []
  const names = new Map(people.map(person => [person.id, person.name]))
  return rows.map((row, index) => {
    const before = snapshots[index - 1]
    return {
      versionNo: row.versionNo,
      at: row.at,
      by: row.by,
      changes: before ? changesBetween(before, snapshots[index]!, names) : [{ field: 'created' }],
    }
  })
}
