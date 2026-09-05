import type { Db } from '../db/client.ts'
import { NotFound } from '../routes.ts'
import {
  isOverdue,
  NO_DEPARTMENT,
  NO_DUE,
  UNASSIGNED,
  type TaskStatus,
} from '../tasks/labels.ts'
import { day } from '../time.ts'
import {
  applicantsOf,
  currentSurvey,
  eventFacts,
  openTasksOf,
  unorganizedDocumentCount,
  unwrittenMinutesCount,
  type EventFacts,
} from './counts.ts'
import { whoCanNote } from './ending.ts'
import { STATUS, type Status } from './events.ts'

// 행사 개요 — 후속 정리 중(EVT-02D)이 읽는 셋.
//
// **EVT-02와 다른 화면이다.** 같은 갈피에서 열리지만 겹치는 것이 둘뿐이고, 여기서
// 세는 것은 '무엇이 남았는가'다 — 안 끝난 업무 · 정리 안 된 문서 · 안 쓴 회의록 ·
// 확인이 필요한 참가자.
//
// **상태의 말도, 누가 다음 단계로 넘길 수 있는지도 여기서 짓지 않는다.** 단계의
// 말과 색은 행사 목록과 같은 곳(`events.ts`)에서 오고, 권한 안내는 권한 행렬에서
// 만들어진다(`ending.ts`) — 행렬을 고치면 이 글이 저절로 따라온다.

/**
 * 단계마다의 띠.
 *
 * **명세가 문장을 정하지 않았다** — 계약이 '띠의 제목'·'띠의 본문'이라고만 적고
 * 예로 든 것은 후속 정리 중인 한 행사의 모습이다. 그래서 표가 아는 것에서만
 * 짓는다: 행사 단계 넷이 그대로 넷이 된다.
 *
 * **색은 화면이 아는 이름 중에서 고른다**(design/tones.ts의 BANNER_TONE). 모르는
 * 이름을 주면 띠가 조용히 무채색으로 그려진다. 아직 안 끝난 행사는 알림일 뿐이라
 * 파랗고, 정리할 것이 남은 단계만 노랗다.
 */
const BANNER: Record<Status, { headline: string; note: string; tone: string }> = {
  planning: {
    headline: '아직 행사가 끝나지 않았습니다',
    note: '행사가 끝나면 남은 업무와 기록을 여기서 정리합니다.',
    tone: 'blue',
  },
  inProgress: {
    headline: '아직 행사가 끝나지 않았습니다',
    note: '행사가 끝나면 남은 업무와 기록을 여기서 정리합니다.',
    tone: 'blue',
  },
  wrapUp: {
    headline: '행사가 종료되었습니다',
    note: '남은 업무와 기록을 확인한 뒤에 행사를 완료 처리할 수 있습니다.',
    tone: 'yellow',
  },
  done: {
    headline: '행사가 완료되었습니다',
    note: '더 넘어갈 운영 단계가 없습니다.',
    tone: 'green',
  },
}

async function must(db: Db, orgId: string, eventId: string): Promise<EventFacts> {
  const row = await eventFacts(db, orgId, eventId)
  if (row === null) throw new NotFound('그 행사를 찾지 못했습니다')
  return row
}

export interface WrapUpBanner {
  stateLabel: string
  stateTone: string
  permissionNote: string
  headline: string
  note: string
  tone: string
}

/**
 * 후속 정리 중인 행사의 상태 줄과 띠(EVT-02D).
 *
 * **여기서 판정하지 않는다.** 이 자리는 구성원이면 열리고(계약의 x-authorize가
 * member다), 실제로 막는 일은 완료 처리 변이가 한다 — 하는 것은 그 규칙을 말로
 * 옮기는 것뿐이다(EVT-02C·EVT-02E와 같은 자리).
 */
export async function wrapUpBanner(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<WrapUpBanner> {
  const row = await must(db, orgId, eventId)
  const status = row.status as Status
  return {
    stateLabel: STATUS[status].label,
    stateTone: STATUS[status].tone,
    // 행렬이 '행사 완료 처리'를 한 줄로 적었다. 역할 이름은 여기 없다.
    permissionNote: whoCanNote('event.complete', '행사 완료 처리'),
    ...BANNER[status],
  }
}

/**
 * 타일마다의 주의 색.
 *
 * **남은 것이 없으면 초록이다.** 그것이 이 화면이 묻는 것이기 때문이다 — 무엇이
 * 남았는지가 아니라 **정리가 끝났는지**를 본다. 남은 것이 있을 때의 색은 갈래마다
 * 다르다: 업무가 가장 급하고(빨강) 문서·회의록이 그다음이다.
 */
const ATTENTION = {
  unfinishedTasks: 'red',
  unorganizedDocs: 'orange',
  unwrittenMinutes: 'yellow',
  needsCheck: 'yellow',
} as const

const SETTLED_TONE = 'green'

function toneOf(kind: keyof typeof ATTENTION, left: number): string {
  return left === 0 ? SETTLED_TONE : ATTENTION[kind]
}

export interface WrapUpCounts {
  unfinishedTasks: string
  unfinishedTasksTone: string
  unorganizedDocs: string
  unorganizedDocsTone: string
  unwrittenMinutes: string
  unwrittenMinutesTone: string
  needsCheck: string
  needsCheckTone: string
}

/**
 * 후속 정리 현황 타일 넷(EVT-02D).
 *
 * **0도 말한다.** 세지 않은 것과 없는 것을 사람이 가릴 수 있어야 하고, 타일이
 * 넷이라는 것은 명세가 정했다 — 빠뜨리면 화면에 빈 자리가 생긴다.
 */
export async function wrapUpCounts(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<WrapUpCounts> {
  await must(db, orgId, eventId)
  const tasks = (await openTasksOf(db, orgId, eventId)).length
  const docs = await unorganizedDocumentCount(db, orgId, eventId)
  const minutes = await unwrittenMinutesCount(db, orgId, eventId)
  const survey = await currentSurvey(db, orgId, eventId)
  const applicants = await applicantsOf(db, orgId, survey)

  return {
    unfinishedTasks: `${tasks}건`,
    unfinishedTasksTone: toneOf('unfinishedTasks', tasks),
    unorganizedDocs: `${docs}건`,
    unorganizedDocsTone: toneOf('unorganizedDocs', docs),
    unwrittenMinutes: `${minutes}건`,
    unwrittenMinutesTone: toneOf('unwrittenMinutes', minutes),
    // 개요와 같은 근거로 센다 — 학생 명단과 어긋난 신청(`counts.ts`가 그 규칙을 든다).
    needsCheck: `${applicants.needsCheck}명`,
    needsCheckTone: toneOf('needsCheck', applicants.needsCheck),
  }
}

export interface WrapUpRemainingRow {
  id: string
  title: string
  detail: string
  tone: string
}

/** 급한 줄의 색. 화면의 아이콘 표가 아는 둘뿐이다(EVT-02D의 remainingByTone). */
const OVERDUE_TONE = 'red'
const PLAIN_TONE = 'gray'

/**
 * 아직 남은 항목 하나하나(EVT-02D).
 *
 * **줄마다 그 원본으로 간다.** 명세가 이 목록의 갈 곳을 업무 보드 하나로 고정했고
 * (`itemAction.targetScreenId`), 그래서 여기 오는 것은 안 끝난 업무다 — 문서와
 * 회의록의 수는 위의 타일이 세고 각자의 화면으로 데려간다.
 *
 * **비어 있는 것은 말로 온다.** 부서·담당·기한이 없다는 사실을 업무 보드가 쓰는
 * 그 말로 적는다 — 같은 업무가 화면마다 다른 말로 비어 있으면 안 된다.
 */
export async function wrapUpRemaining(
  db: Db,
  orgId: string,
  eventId: string,
  time: { now: () => Date },
): Promise<WrapUpRemainingRow[]> {
  await must(db, orgId, eventId)
  const now = time.now()
  return (await openTasksOf(db, orgId, eventId)).map((task) => {
    const late = isOverdue(task.dueDate, task.status as TaskStatus, now)
    return {
      id: task.id,
      title: task.title,
      detail: [
        task.department ?? NO_DEPARTMENT,
        task.assignee ?? UNASSIGNED,
        task.dueDate === null ? NO_DUE : `${day(task.dueDate).slice(6)}까지`,
        ...(late ? ['지연'] : []),
      ].join(' · '),
      tone: late ? OVERDUE_TONE : PLAIN_TONE,
    }
  })
}
