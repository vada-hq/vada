import { eq, inArray } from 'drizzle-orm'
import type { TaskCause, TaskResultKind, TaskResultStage, TaskStatus } from '@vada/contracts'
import { lineItem, task, taskResult } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { noticeStagesOf } from '../chat/stage.js'
import { eventStagesOf } from '../events/stage.js'
import { requestStagesOf } from '../purchases/stage.js'
import { formStagesOf } from '../registrations/stage.js'
import { autoMoveOf, isRaised, targetOf } from './lifecycle.js'

// 결과물에 일이 생기면 업무 상태를 앞으로 한 번 옮기는 한 곳(기능 015, RULE-41, DEC-82). records.ts의 createRecord·updateRecords만 부른다.
// records.ts를 import하지 않는다(순환 금지): 업무 판 쓰기는 부르는 쪽이 StatusWriter로 넘긴다.
// 한 번: 쓰기 전후의 결과물 단계를 같은 거래에서 견주어, 단계가 오른 쓰기만 그 업무의 목표를 다시 센다. 그대로이거나 내려간 쓰기는 아무것도 하지 않아
// 사람이 그 뒤에 바꾼 상태를 덮지 않는다. 결과물에 닿지 않는 쓰기와 이어진 업무가 없는 결과물은 쿼리 하나 안에서 끝난다.

export type StatusWriter = (
  tx: Tx,
  change: { taskId: string; status: TaskStatus; cause: TaskCause },
) => Promise<void>

// 쓰기 하나가 어느 기록을 만들거나 바꾸는가. 만들 때는 칸 값을, 바꿀 때는 기록 번호를 준다.
export type Touch = { kind: string; id?: string; values?: Record<string, unknown> }
// 쓰기 전의 이어진 결과물(결과물 번호 → 종류와 단계)
export type Watch = Map<string, { kind: TaskResultKind; stage: TaskResultStage }>

// 결과물 종류마다 단계 셈은 그 도메인에 있고(읽기만), 여기서는 종류에 맞춰 부르기만 한다.
const stageReaders: Record<
  TaskResultKind,
  (tx: Pick<Db, 'select'>, ids: readonly string[]) => Promise<Map<string, TaskResultStage>>
> = {
  request: requestStagesOf,
  registration_form: formStagesOf,
  message: (_tx, ids) => Promise.resolve(noticeStagesOf(ids)),
  event: eventStagesOf,
}

// 업무에 이을 수 있는 기록 종류는 결과물 종류와 이름이 같다.
export const isResultKind = (kind: string): kind is TaskResultKind => kind in stageReaders

export async function stagesOf(
  tx: Pick<Db, 'select'>,
  results: readonly { id: string; kind: TaskResultKind }[],
): Promise<Map<string, TaskResultStage>> {
  const stages = new Map<string, TaskResultStage>()
  for (const [kind, read] of Object.entries(stageReaders)) {
    const ids = results.filter(result => result.kind === kind).map(result => result.id)
    for (const [id, stage] of await read(tx, ids)) stages.set(id, stage)
  }
  return stages
}

// 이 쓰기가 닿을 수 있는 결과물 번호. 구매 요청은 요청 자신, 품목, 품목의 결재, 품목의 결제 내역이고,
// 행사는 그 행사의 완료·완료 취소 결재다. 공지(메시지)는 올리면 끝남이고 바꾸는 쓰기가 없다(DEC-90). 그 밖의 쓰기는 없다.
// 만들 때의 요청·메시지·양식·행사는 아직 연결이 없어 여기서 찾지 않고 linkResult가 단계를 넘긴다.
async function requestIdOfItem(tx: Tx, itemId: unknown) {
  const [row] = await tx
    .select({ requestId: lineItem.requestId })
    .from(lineItem)
    .where(eq(lineItem.id, String(itemId)))
  return row?.requestId ?? null
}

function approvalResultIdOf(tx: Tx, values: Record<string, unknown>) {
  if (values.targetKind === 'line_item') return requestIdOfItem(tx, values.targetId)
  return Promise.resolve(values.targetKind === 'event' ? String(values.targetId) : null)
}

async function resultIdOf(tx: Tx, touch: Touch): Promise<string | null> {
  const { kind, id, values } = touch
  if (kind === 'request') return id ?? null
  if (kind === 'line_item') return id ? requestIdOfItem(tx, id) : String(values?.requestId)
  // 결재와 결제 내역은 만들 때만 단계를 올린다(만든 뒤 바꾸지 않는다).
  if (!values) return null
  if (kind === 'approval') return approvalResultIdOf(tx, values)
  return kind === 'payment_line' ? requestIdOfItem(tx, values.lineItemId) : null
}

const TOUCHING_KINDS: ReadonlySet<string> = new Set([
  'request',
  'line_item',
  'approval',
  'payment_line',
])

// 쓰기 전: 이 쓰기가 닿는 이어진 결과물과 그 단계를 읽는다.
export async function watchBefore(tx: Tx, touches: readonly Touch[]): Promise<Watch> {
  const watch: Watch = new Map()
  const ids = new Set<string>()
  for (const touch of touches) {
    if (!TOUCHING_KINDS.has(touch.kind)) continue
    const id = await resultIdOf(tx, touch)
    if (id) ids.add(id)
  }
  if (!ids.size) return watch
  const linked = await tx
    .select({ id: taskResult.resultId, kind: taskResult.resultKind })
    .from(taskResult)
    .where(inArray(taskResult.resultId, [...ids]))
  const stages = await stagesOf(tx, linked as { id: string; kind: TaskResultKind }[])
  for (const { id, kind } of linked)
    watch.set(id, { kind: kind as TaskResultKind, stage: stages.get(id) ?? 'none' })
  return watch
}

// 만드는 거래에서 결과물과 업무를 잇는다. 그때 단계가 오른 것으로 본다(없음 → 지금 단계).
export async function linkResult(
  tx: Tx,
  link: { taskId: string; resultId: string; kind: TaskResultKind },
): Promise<Watch> {
  await tx
    .insert(taskResult)
    .values({ taskId: link.taskId, resultId: link.resultId, resultKind: link.kind })
  return new Map([[link.resultId, { kind: link.kind, stage: 'none' }]])
}

// 어떤 쓰기가 단계를 올렸을 때 업무 상태에 남기는 까닭 코드
// 옮긴 상태에 맞춘다: 끝남으로 옮기면 끝난 까닭, 진행 중으로 옮기면 낸 까닭(다른 결과물이 아직 남은 경우도 같다).
const CAUSE_OF_KIND: Record<Exclude<TaskResultKind, 'request'>, TaskCause> = {
  registration_form: 'form_created',
  message: 'notice_posted',
  event: 'event_completed',
}
function causeOf(kind: TaskResultKind, status: TaskStatus): TaskCause {
  if (kind === 'request') return status === 'done' ? 'request_finished' : 'request_submitted'
  return CAUSE_OF_KIND[kind]
}

async function lockedTask(tx: Tx, taskId: string) {
  const [row] = await tx
    .select({ status: task.status, cancelledAt: task.cancelledAt })
    .from(task)
    .where(eq(task.id, taskId))
    .for('no key update')
  return row
}

// 쓰기 뒤: 단계가 오른 결과물의 업무마다 목표를 다시 세고, 목표가 지금보다 앞이면 옮긴다. 취소한 업무는 옮기지 않는다.
export async function syncAfter(tx: Tx, before: Watch, write: StatusWriter) {
  if (!before.size) return
  const entries = [...before].map(([id, value]) => ({ id, kind: value.kind }))
  const after = await stagesOf(tx, entries)
  const raised = entries.filter(({ id }) =>
    isRaised(before.get(id)!.stage, after.get(id) ?? 'excluded'),
  )
  if (!raised.length) return
  const links = await tx
    .select({ taskId: taskResult.taskId, id: taskResult.resultId })
    .from(taskResult)
    .where(
      inArray(
        taskResult.resultId,
        raised.map(result => result.id),
      ),
    )
  for (const taskId of new Set(links.map(link => link.taskId))) {
    const row = await lockedTask(tx, taskId)
    if (!row || row.cancelledAt) continue
    const all = await tx
      .select({ id: taskResult.resultId, kind: taskResult.resultKind })
      .from(taskResult)
      .where(eq(taskResult.taskId, taskId))
    const stages = await stagesOf(tx, all as { id: string; kind: TaskResultKind }[])
    const target = targetOf(all.map(result => stages.get(result.id) ?? 'none'))
    const status = target && autoMoveOf(row.status as TaskStatus, target)
    const first = raised.find(result => links.some(l => l.taskId === taskId && l.id === result.id))!
    if (status) await write(tx, { taskId, status, cause: causeOf(first.kind, status) })
  }
}
