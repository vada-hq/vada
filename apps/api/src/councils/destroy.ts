import { sql } from 'drizzle-orm'
import type { Db, Tx } from '../db/types.js'
import { idList } from '../records/clear-versions.js'

// 학생회 통째 파기(DEC-55 '30일이 지나면 학생회 데이터를 모두 파기', 기능 021 정한 것 15). 부르는 곳은 privacy council-destroy다.
// 지우는 것: 그 학생회의 모든 기록(하위 표, 판, 연결 표, 초대 코드, 명령 영수증, 신청 개인 링크)과 학생회 자신,
// 다른 학생회 소속도 로그인도 없는 운영진. 남기는 것: 로그인 계정(탈퇴해야 지운다), 그 밖의 운영진, 신청자 열람 기록(VADA의 법령상 의무 기록, DEC-72).
// 저장소 객체 지우기는 부르는 쪽이 이 거래 전에 한다. 출력은 개수뿐이고 번호와 저장소 위치는 지우는 데만 쓴다(DEC-56).

// 지우는 차례. 행은 그 칸이 지울 번호(그 학생회의 기록, 학생회 자신, 지우는 운영진) 가운데 하나인 것이다.
// 가리키는 행을 가리켜지는 행보다 먼저 지운다. 기록의 학생회·만든 사람과 판의 바꾼 사람은 거래 끝에 보는 외래 키라 순서가 없다.
// 새 표가 생기면 destroy.test.ts가 이 목록이나 아래 두 목록에 넣을 때까지 실패한다.
export const DESTROY_STEPS = [
  { table: 'calendar_feed', column: 'council_id' },
  { table: 'command_receipt', column: 'result_id' },
  { table: 'registration_link', column: 'registration_id' },
  { table: 'registration_answer', column: 'registration_id' },
  { table: 'registration_question_choice', column: 'form_id' },
  { table: 'registration_question', column: 'form_id' },
  { table: 'task_result', column: 'task_id' },
  { table: 'evidence_link', column: 'record_id' },
  { table: 'document_link', column: 'document_id' },
  { table: 'room_membership', column: 'room_id' },
  { table: 'left_room_read', column: 'room_id' },
  { table: 'meeting_attendee', column: 'meeting_id' },
  { table: 'notification', column: 'id' },
  { table: 'source', column: 'id' },
  { table: 'draft_item', column: 'id' },
  { table: 'poll_response', column: 'id' },
  { table: 'poll_option', column: 'id' },
  { table: 'decision', column: 'id' },
  { table: 'poll', column: 'id' },
  { table: 'agenda_item', column: 'id' },
  { table: 'meeting', column: 'id' },
  { table: 'document', column: 'id' },
  { table: 'approval', column: 'id' },
  { table: 'attendance', column: 'id' },
  { table: 'deposit', column: 'id' },
  { table: 'payment_line', column: 'id' },
  { table: 'evidence', column: 'id' },
  { table: 'file', column: 'id' },
  { table: 'message', column: 'id' },
  { table: 'shipment_item', column: 'shipment_id' },
  { table: 'shipment', column: 'id' },
  { table: 'line_item', column: 'id' },
  { table: 'request', column: 'id' },
  { table: 'expense', column: 'id' },
  { table: 'income', column: 'id' },
  { table: 'registration', column: 'id' },
  { table: 'registration_form', column: 'id' },
  { table: 'task', column: 'id' },
  { table: 'schedule_item', column: 'id' },
  { table: 'chat_room', column: 'id' },
  { table: 'budget_item', column: 'id' },
  { table: 'budget', column: 'id' },
  { table: 'account_closing', column: 'id' },
  { table: 'fee_payment', column: 'id' },
  { table: 'fiscal_period', column: 'id' },
  { table: 'account', column: 'id' },
  { table: 'event', column: 'id' },
  { table: 'department_membership', column: 'id' },
  { table: 'council_membership', column: 'id' },
  { table: 'department', column: 'id' },
  { table: 'cohort', column: 'id' },
  { table: 'audit_body', column: 'id' },
  { table: 'voting_body', column: 'id' },
  { table: 'invite_code', column: 'council_id' },
  { table: 'record_version', column: 'record_id' },
  { table: 'member', column: 'id' },
  { table: 'council', column: 'id' },
  { table: 'record', column: 'id' },
] as const

// 학생회의 행이 없는 로그인 쪽 표(계정, 세션, 기기, 동의 기록). 학생회를 파기해도 손대지 않는다.
export const ACCOUNT_TABLES = [
  'users',
  'accounts',
  'sessions',
  'verifications',
  'push_device',
  'terms_agreement',
]
// 학생회와 이어지지만 남기는 표: 남기는 운영진의 로그인 잇기, 신청자 열람 기록(DEC-72, 1년 뒤 기한 파기가 지운다).
export const KEPT_TABLES = ['member_login', 'applicant_access_log']
// 학생회·사람과 잇지 않는 표: 불러온 쿠팡 상품 정보(공개 정보, 0029). 학생회를 지워도 남는다.
export const UNRELATED_TABLES = ['product_info']

type TableCount = { table: string; rows: number }
export type DestroyPlan = {
  // 지울 번호: 그 학생회의 기록, 학생회 자신, 지우는 운영진. 차례대로라 미리 보기와 실제 지우기를 맞대 볼 수 있다.
  ids: string[]
  storageKeys: string[]
  records: number
  tables: TableCount[]
  kept: { members: number; accessLogs: number }
}

type Reader = Pick<Db, 'execute'>
type Query = ReturnType<typeof sql>
// 드라이버마다 결과 모양이 다르다(postgres-js는 배열, PGlite는 rows).
async function rowsOf<T>(db: Reader, query: Query): Promise<T[]> {
  const result: unknown = await db.execute(query)
  return Array.isArray(result) ? (result as T[]) : (result as { rows: T[] }).rows
}

// 그 학생회에 소속(어느 기수든)이 있었던 운영진 가운데 다른 학생회 소속도 로그인도 없는 사람, 그리고 남기는 사람
async function membersOf(db: Reader, councilId: string) {
  const result = await rowsOf<{ id: string; kept: boolean }>(
    db,
    sql`SELECT m.id, (
            EXISTS (SELECT 1 FROM member_login l WHERE l.member_id = m.id)
            OR EXISTS (SELECT 1 FROM council_membership o JOIN cohort oc ON oc.id = o.cohort_id
                        WHERE o.member_id = m.id AND oc.council_id <> ${councilId}::uuid)
          ) AS kept
          FROM member m
         WHERE EXISTS (SELECT 1 FROM council_membership cm JOIN cohort c ON c.id = cm.cohort_id
                        WHERE cm.member_id = m.id AND c.council_id = ${councilId}::uuid)
         ORDER BY m.id`,
  )
  return {
    removed: result.filter(row => !row.kept).map(row => row.id),
    kept: result.filter(row => row.kept).length,
  }
}

const countOf = async (db: Reader, query: Query) =>
  Number((await rowsOf<{ n: number | string }>(db, query))[0]?.n ?? 0)

// 지울 것과 표마다의 개수. 미리 보기와 실제 지우기가 같은 셈을 쓴다.
export async function destroyPlanOf(db: Reader, councilId: string): Promise<DestroyPlan> {
  const members = await membersOf(db, councilId)
  const recordIds = (
    await rowsOf<{ id: string }>(
      db,
      sql`SELECT id FROM record WHERE council_id = ${councilId}::uuid OR id = ${councilId}::uuid ORDER BY id`,
    )
  ).map(row => row.id)
  const ids = [...recordIds, ...members.removed]
  const list = idList(ids)
  const tables: TableCount[] = []
  for (const step of DESTROY_STEPS)
    tables.push({
      table: step.table,
      rows: await countOf(
        db,
        sql`SELECT count(*) AS n FROM ${sql.identifier(step.table)} WHERE ${sql.identifier(step.column)} IN ${list}`,
      ),
    })
  const storageKeys = (
    await rowsOf<{ key: string }>(
      db,
      sql`SELECT storage_key AS key FROM file WHERE id IN ${list} AND storage_key IS NOT NULL ORDER BY storage_key`,
    )
  ).map(row => row.key)
  const accessLogs = await countOf(
    db,
    sql`SELECT count(*) AS n FROM applicant_access_log WHERE council_id = ${councilId}::uuid`,
  )
  return {
    ids,
    storageKeys,
    records: tables.find(item => item.table === 'record')?.rows ?? 0,
    tables,
    kept: { members: members.kept, accessLogs },
  }
}

// 계획의 번호를 차례대로 지운다. 한 거래 안에서 부른다. 다른 학생회의 행이 이 번호를 가리키면 외래 키가 막아 거래 전체가 되돌아간다.
export async function destroyCouncilRows(tx: Tx, plan: Pick<DestroyPlan, 'ids'>) {
  const list = idList(plan.ids)
  for (const step of DESTROY_STEPS)
    await tx.execute(
      sql`DELETE FROM ${sql.identifier(step.table)} WHERE ${sql.identifier(step.column)} IN ${list}`,
    )
}
