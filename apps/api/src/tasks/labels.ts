import { asc, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments } from '../db/schema.ts'
import { Blocked } from '../routes.ts'
import { daysBetween, moment } from '../time.ts'

// 업무 넷이 함께 쓰는 **완성된 글과 색**.
//
// 화면 넷이 한 표를 보는데(TASK-01 · EVT-TASK-01 · EVT-TASK-02 · MY-01) 그 넷이
// 같은 사실을 저마다의 말로 옮기면 같은 업무가 화면마다 다른 상태로 보인다.
// 그래서 옮기는 규칙을 여기 한 곳에 둔다 — 표에 담긴 것은 `inProgress`이고
// '진행 중'은 여기서 붙는다.

export type TaskStatus = 'planned' | 'inProgress' | 'review' | 'done'

/**
 * 칸반의 열 넷. **명세가 고정했다** — 두 보드가 열마다 이 값을 인자로 박아 조회한다.
 */
const STATUSES: readonly TaskStatus[] = ['planned', 'inProgress', 'review', 'done']

/** 단계를 사람이 읽는 말과 색으로. **화면이 이 규칙을 알면 단계가 늘 때마다 화면을 고친다.** */
export const STATUS: Record<TaskStatus, { label: string; tone: string }> = {
  planned: { label: '예정', tone: 'gray' },
  inProgress: { label: '진행 중', tone: 'blue' },
  review: { label: '검토 중', tone: 'violet' },
  done: { label: '완료', tone: 'green' },
}

/**
 * MY-01의 갈피 셋(`my.taskTab`).
 *
 * **다른 축이 아니라 넷을 묶어 본 것이다.** 검토 중인 업무는 아직 안 끝났으므로
 * '진행 중'에 든다 — `db/schema.ts`의 `taskStatus` 주석이 정한 규칙이고, 묶는 일을
 * 화면이 하면 같은 업무가 갈피마다 다른 곳에 놓인다.
 */
const TABS: Record<string, readonly TaskStatus[]> = {
  todo: ['planned'],
  inProgress: ['inProgress', 'review'],
  done: ['done'],
}

/** 보드를 조직 전체로 볼지 내 담당만 볼지(`task.scope`). */
const SCOPES = ['all', 'mine'] as const
export type TaskScope = (typeof SCOPES)[number]

/**
 * 명세가 든 값이 아니면 **막는다.**
 *
 * 그대로 넘기면 PostgreSQL이 던져 500이 되고, 500은 안쪽 사정을 밖으로 흘리면서
 * 받는 쪽이 '내가 잘못 물었다'와 '서버가 고장났다'를 가릴 수 없게 만든다.
 * 조용히 안 거르고 전부 주는 것은 더 나쁘다 — 한 열이 보드 전체가 된다.
 *
 * **안 넘긴 것과 틀리게 넘긴 것은 다르다.** 단계는 칸반의 **열 하나를 가리키는
 * 값**이라 대신할 것이 없다 — 안 넘기면 어느 열인지 알 수 없고 넷을 다 주면
 * 보드가 한 열이 된다. 그래서 여기만 없는 것도 막는다.
 */
export function readStatus(asked: string | undefined): TaskStatus {
  if (asked !== undefined && STATUSES.includes(asked as TaskStatus)) return asked as TaskStatus
  throw new Blocked('명세에 없는 업무 단계입니다')
}

/**
 * 보는 범위. **안 넘기면 좁히지 않는다.**
 *
 * 거르개의 '전체'가 거르지 않는다는 뜻인 것과 같다(명단 조회·행사 목록이 이미 그
 * 길이다). 이 값은 화면 안의 칸에 살아서 **그릇이 미리 받을 때는 아직 없다** —
 * 그때 막으면 화면이 그려지기도 전에 통째로 오류가 된다. 틀리게 넘긴 것은 막는다.
 */
export function readScope(asked: string | undefined): TaskScope {
  const wanted = (asked ?? '').trim()
  if (wanted === '') return 'all'
  if (SCOPES.includes(wanted as TaskScope)) return wanted as TaskScope
  throw new Blocked('명세에 없는 보는 범위입니다')
}

/**
 * 고른 갈피가 어느 단계들인가. **안 넘기면 좁히지 않는다** — 갈피 셋의 합이 곧
 * 내 업무 전부라 '안 고른 것'에 뜻이 있다. 없는 갈피 이름은 막는다.
 */
export function readTab(asked: string | undefined): readonly TaskStatus[] {
  const wanted = (asked ?? '').trim()
  if (wanted === '') return STATUSES
  const found = TABS[wanted]
  if (found === undefined) throw new Blocked('명세에 없는 업무 갈피입니다')
  return found
}

/** 갈피의 이름들. 건수를 세는 자리가 이 차례로 답한다. */
export const TAB_KEYS = Object.keys(TABS)

export function statusesOfTab(tab: string): readonly TaskStatus[] {
  return TABS[tab] ?? []
}

/**
 * 담당자가 없다는 사실.
 *
 * **한 말로 둔다.** 보드와 상세가 다른 말을 쓰면 같은 업무가 화면마다 다른 상태로
 * 읽힌다 — 여기 있는 것은 '비어 있다'가 아니라 '배정해야 한다'는 알림이다.
 */
export const UNASSIGNED = '담당자 없음 · 배정 필요'

/**
 * 먼저 봐야 하는 카드의 색.
 *
 * **부서 색 팔레트에 없는 색이라야 한다.** 화면이 `tone !== departmentTone`으로
 * 그 카드를 가리므로(TASK-01·EVT-TASK-01), 부서가 붉으면 그 부서의 미배정 업무가
 * 조용해진다.
 */
export const WARNING_TONE = 'red'

/**
 * 부서 색.
 *
 * **표에 색 열이 없다.** 이 저장소가 그렇게 정했다 — 색 이름은 표현이라 열이
 * 아니고 읽을 때 만든다(`db/schema.ts` 머리 · `docs/adding-a-flow.md`).
 * 명세가 '색도 조직 데이터가 갖는다'고 적은 것은 **색이 부서를 따라다닌다**는
 * 뜻이고, 부서는 조직이 만드는 것이므로 조직의 부서 차례에서 고른다.
 *
 * 차례는 조직도가 그리는 그 차례다(sortOrder → 이름). 부서를 끌어 옮기면 색도
 * 함께 옮겨 가지만, 이 색의 쓸모는 **한 보드에서 두 부서가 갈려 보이는 것**이므로
 * 그것을 먼저 지킨다. 색을 붙박고 싶어지는 날 열이 생기고, 그때 고칠 자리는 여기뿐이다.
 */
const PALETTE = ['teal', 'pink', 'emerald', 'violet'] as const

/** 부서가 없는 업무의 색. 팔레트의 색이 아니라 '색이 없다'는 뜻이다. */
export const NO_DEPARTMENT_TONE = 'gray'
export const NO_DEPARTMENT = '부서 미정'

export async function departmentTones(db: Db, orgId: string): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: departments.id })
    .from(departments)
    .where(eq(departments.orgId, orgId))
    .orderBy(asc(departments.sortOrder), asc(departments.name))
  return new Map(rows.map((row, index) => [row.id, PALETTE[index % PALETTE.length]!]))
}

/** 기한이 없다는 사실. 빈 글을 주면 화면이 그 자리에 무엇이든 그린다. */
export const NO_DUE = '기한 미정'

/**
 * 기한이 지났는가.
 *
 * **끝난 업무는 지나도 지연이 아니다** — 이미 한 일을 다시 재촉하지 않는다.
 * 날짜로 센다: '지났다'는 스물네 시간이 아니라 **하루 뒤의 날짜**이고, 그 날짜는
 * 시간대가 정한다(`time.ts`가 그것을 든다).
 */
export function isOverdue(due: Date | null, status: TaskStatus, now: Date): boolean {
  return due !== null && status !== 'done' && daysBetween(due, now) > 0
}

/** `2026-07-18` — 보드와 상세가 쓰는 꼴. */
export function dueDay(due: Date | null): string {
  return due === null ? NO_DUE : moment(due).slice(0, 10)
}

/** `07.19` — MY-01의 좁은 자리. */
export function dueShort(due: Date | null): string {
  return due === null ? NO_DUE : moment(due).slice(5, 10).replace('-', '.')
}

/**
 * 주의 표시.
 *
 * **없으면 오지 않는다**(명세가 optional로 적었다). 둘이 겹치면 지연이 먼저다 —
 * 늦은 것이 검토를 기다리는 것보다 급하고, 카드에 붙는 딱지는 하나다.
 */
export function alertOf(
  due: Date | null,
  status: TaskStatus,
  now: Date,
): { alert: string; alertTone: string } | null {
  if (isOverdue(due, status, now)) return { alert: '지연', alertTone: 'red' }
  if (status === 'review') return { alert: '검토 필요', alertTone: 'yellow' }
  return null
}
