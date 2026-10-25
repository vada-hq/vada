import { and, asc, count, eq, gte, isNotNull, lt, sql } from 'drizzle-orm'
import { file, message, record, recordVersion } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { clearVersionKeys, idList } from '../records/clear-versions.js'
import { clockNow, updateRecords } from '../records/records.js'

// 메시지 지우기(DEC-54, DEC-88, RULE-17). 행은 남기고 본문과 붙은 사진의 이름·저장소 위치를 지금 값과 모든 판에서 비운다.
// 메시지에는 새 판(지운 사람, 사유)을 남긴다. 파일 행은 남고 판을 새로 열지 않는다(저장소 위치는 주인 칸이라 기록 모듈로 바꾸지 않는다).
// 증빙으로 복사한 사진은 증빙에 붙은 다른 파일 행이라 그대로다(DEC-45). 저장소 객체 지우기는 부르는 쪽이 이 거래 전에 한다.
// 지금 부르는 곳은 학생회 요청 명령(privacy erase-messages)이고, 쓴 사람의 지우기(조각 11)가 같은 함수를 쓴다.

// 학생회 요청으로 VADA 팀이 지울 때의 판 사유(DEC-88). 지운 사람은 비운다.
export const ERASED_BY_REQUEST = '학생회 요청으로 VADA가 지움'

// 한 학생회에서 한 운영진이 [from, until) 사이에 보낸 메시지
export type EraseScope = { councilId: string; senderId: string; from: Date; until: Date }
export type EraseCounts = {
  messages: number
  versions: number
  files: number
  objects: number
  alreadyErased: number
}
export type ErasePlan = { messageIds: string[]; storageKeys: string[]; counts: EraseCounts }

type Reader = Pick<Db, 'select'>

const scopedMessages = (db: Reader, scope: EraseScope) =>
  db
    .select({ id: message.id, deletedAt: message.deletedAt })
    .from(message)
    .innerJoin(record, eq(record.id, message.id))
    .where(
      and(
        eq(record.councilId, scope.councilId),
        eq(record.createdBy, scope.senderId),
        gte(message.sentAt, scope.from),
        lt(message.sentAt, scope.until),
      ),
    )
    .orderBy(asc(message.id))

const attachedTo = (messageIds: readonly string[]) =>
  sql`${file.attachedToId} IN ${idList(messageIds)}`

// 지울 것과 그 개수. 미리 보기와 실제 지우기가 같은 셈을 쓴다. 번호와 저장소 위치는 부르는 쪽이 지우는 데만 쓰고 출력하지 않는다(DEC-56).
export async function erasePlanOf(db: Reader, scope: EraseScope): Promise<ErasePlan> {
  const rows = await scopedMessages(db, scope)
  const messageIds = rows.filter(row => row.deletedAt === null).map(row => row.id)
  const alreadyErased = rows.length - messageIds.length
  if (!messageIds.length)
    return {
      messageIds,
      storageKeys: [],
      counts: { messages: 0, versions: 0, files: 0, objects: 0, alreadyErased },
    }
  const files = await db
    .select({ id: file.id, key: file.storageKey })
    .from(file)
    .where(and(attachedTo(messageIds), isNotNull(file.storageKey)))
  const storageKeys = files.flatMap(row => (row.key === null ? [] : [row.key]))
  const [versions] = await db
    .select({ n: count() })
    .from(recordVersion)
    .where(
      sql`${recordVersion.recordId} IN ${idList([...messageIds, ...files.map(row => row.id)])}`,
    )
  return {
    messageIds,
    storageKeys,
    counts: {
      messages: messageIds.length,
      versions: versions?.n ?? 0,
      files: files.length,
      objects: new Set(storageKeys).size,
      alreadyErased,
    },
  }
}

// 메시지들을 지운다. 이미 지운 메시지는 넘기지 않는다(새 판이 생긴다). 한 거래 안에서 부른다.
export async function eraseMessages(
  tx: Tx,
  messageIds: readonly string[],
  by: { actor: string | null; reason: string | null },
) {
  if (!messageIds.length) return
  await updateRecords(
    tx,
    messageIds.map(id => ({
      kind: 'message' as const,
      id,
      actor: by.actor,
      reason: by.reason,
      changes: { body: null, deletedAt: clockNow },
    })),
  )
  await clearVersionKeys(tx, messageIds, ['body'])
  const files = await tx.select({ id: file.id }).from(file).where(attachedTo(messageIds))
  await tx
    .update(file)
    .set({ name: null, storageKey: null })
    .where(and(attachedTo(messageIds), isNotNull(file.storageKey)))
  await clearVersionKeys(
    tx,
    files.map(row => row.id),
    ['name', 'storage_key'],
  )
}
