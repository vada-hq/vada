import type { MeetingAgendaItem, MeetingDetail } from '@vada/contracts'
import type { MinutesDraft } from '../minutes-drafts'
import { meetingSample, meetingOptions } from './meeting-samples'

export function minutesSample(writable = true): MeetingDetail {
  const item = meetingSample().agenda[0]!
  const author = { ...meetingOptions.members[1]!, name: '정하늘' }
  const agenda = [
    {
      ...item,
      title: '행사장 안전 점검 결과',
      notes: '통로와 비상구 점검 완료',
      decisions: [
        {
          id: '0199d1a0-0000-7000-8000-000000000091',
          content: '비상구 앞 통로 확보',
          rationale: null,
          decidedBy: author,
          decidedAt: '2026-10-29T06:00:00Z',
          versionNo: 1,
        },
      ],
    },
    {
      ...item,
      id: '0199d1a0-0000-7000-8000-0000000000f2',
      position: 2,
      versionNo: 2,
      title: '비상 연락망 및 담당자 확정',
      body: '상황별 최초 연락 담당자와 보고 순서를 확정합니다.',
      notes:
        '응급 상황 발생 시 현장 담당자가 운영본부로 1차 연락\n운영본부에서 학생회장과 학교 안전관리팀에 동시 보고\n경기별 안전 담당자 연락처를 참가자 안내문에 포함',
      updatedBy: author,
      decisions: [
        {
          id: '0199d1a0-0000-7000-8000-000000000092',
          content:
            '비상 연락은 현장 담당자 → 운영본부 → 학생회장·학교 안전관리팀 순으로 진행합니다.',
          rationale: '담당자 간 보고 순서 합의',
          decidedBy: author,
          decidedAt: '2026-10-29T06:00:00Z',
          versionNo: 1,
        },
      ],
    },
    {
      ...item,
      id: '0199d1a0-0000-7000-8000-0000000000f3',
      position: 3,
      title: '행사 당일 안전 인력 배치',
      body: null,
    },
  ]
  return meetingSample({
    title: '체육대회 안전 관리 최종 회의',
    status: 'in_progress',
    actions: writable ? ['meeting.minutes'] : [],
    heldAt: '2026-10-29T15:00',
    endsAt: '2026-10-29T16:00',
    place: '학생회실 (A204)',
    agenda,
    agendaCount: agenda.length,
    minutesStatus: 'draft',
  })
}
export function minutesDraftSample(item: MeetingAgendaItem, conflict = false): MinutesDraft {
  return {
    text: conflict ? '현장 담당자가 먼저 응급 조치 후 운영본부에 연락' : (item.notes ?? ''),
    savedText: item.notes ?? '',
    version: conflict ? item.versionNo - 1 : item.versionNo,
    server: item,
    saving: false,
    error: null,
    conflict: conflict ? item : null,
    refreshing: false,
  }
}

type SampleValue = {
  title?: string
  body?: string | null
  content?: string
  rationale?: string | null
  notes?: string | null
}
export function doneMinutesSample(): MeetingDetail {
  const meeting = minutesSample()
  meeting.agenda[1]!.followUps = [
    {
      id: '0199d1a0-0000-7000-8000-000000000071',
      title: '비상 연락망 정리',
      status: 'todo',
      dueDate: '2026-10-31',
      assignee: meetingOptions.members[0]!,
    },
    {
      id: '0199d1a0-0000-7000-8000-000000000072',
      title: '현장 담당자 연락처 확인',
      status: 'done',
      dueDate: null,
      assignee: null,
    },
  ]
  return {
    ...meeting,
    event: meetingOptions.events[0]!,
    status: 'done',
    minutesStatus: 'confirmed',
    actions: ['meeting.amend'],
    confirmedAt: '2026-10-29T07:30:00Z',
    confirmedBy: { ...meetingOptions.members[0]!, name: '박해랑' },
  }
}
export function changeMinutesSample(
  meeting: MeetingDetail,
  suffix: string,
  value: SampleValue,
): MeetingDetail {
  const id = suffix.split('/')[2]
  if (suffix === '/agenda') {
    const item = {
      ...meeting.agenda[0]!,
      id: crypto.randomUUID(),
      title: value.title!,
      body: value.body ?? null,
      notes: null,
      decisions: [],
      followUps: [],
      position: Math.max(0, ...meeting.agenda.map(a => a.position)) + 1,
    }
    return { ...meeting, agenda: [...meeting.agenda, item], agendaCount: meeting.agenda.length + 1 }
  }
  if (suffix.startsWith('/decisions/'))
    return {
      ...meeting,
      agenda: meeting.agenda.map(a => ({
        ...a,
        decisions: suffix.endsWith('/cancel')
          ? a.decisions.filter(d => d.id !== id)
          : a.decisions.map(d =>
              d.id === id ? { ...d, ...value, versionNo: d.versionNo + 1 } : d,
            ),
      })),
    }
  if (suffix.endsWith('/cancel'))
    return {
      ...meeting,
      agenda: meeting.agenda.filter(a => a.id !== id),
      agendaCount: meeting.agenda.length - 1,
    }
  return {
    ...meeting,
    agenda: meeting.agenda.map(a => {
      if (a.id !== id) return a
      if (suffix.endsWith('/decisions'))
        return {
          ...a,
          decisions: [
            ...a.decisions,
            {
              id: crypto.randomUUID(),
              content: value.content!,
              rationale: value.rationale ?? null,
              decidedBy: meetingOptions.members[0]!,
              decidedAt: '2026-10-29T06:00:00Z',
              versionNo: 1,
            },
          ],
        }
      return { ...a, ...value, versionNo: a.versionNo + 1 }
    }),
  }
}
