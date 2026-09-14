import type { Listed } from './meetings.ts'

export function runs(
  row: { memberId: string; isHost: boolean },
  creatorMemberId: string | null,
): boolean {
  return row.isHost || row.memberId === creatorMemberId
}

export function attendanceChip(
  stage: Listed,
  attendance: string,
): { label: string; tone: string } {
  if (stage === 'scheduled' || stage === 'cancelled') return { label: '', tone: '' }
  if (attendance === 'present') {
    return { label: stage === 'inProgress' ? '참가' : '참석', tone: 'green' }
  }
  return attendance === 'absent'
    ? { label: '불참', tone: 'gray' }
    : { label: '미참석', tone: 'gray' }
}

const GUEST_NOTE: Record<Listed, string> = {
  scheduled: '회의 정보를 확인할 수 있지만 회의를 시작하거나 설정을 변경할 수 없습니다.',
  inProgress: '회의록을 함께 작성할 수 있지만 회의를 끝내거나 안건을 넘길 수 없습니다.',
  wrapUp: '현재 내용은 진행 권한자가 수정할 수 있습니다.',
  done: '정리된 회의록을 읽고 받아 갈 수 있습니다.',
  cancelled: '취소된 회의는 기록으로만 남습니다.',
}

export function viewerBand(
  stage: Listed,
  seen: { isCreator: boolean; canRun: boolean; joined: boolean },
): { viewerTitle: string; viewerNote: string } {
  if (seen.isCreator) {
    return {
      viewerTitle: '회의 생성자 화면',
      viewerNote: '회의 수정·취소와 진행 권한 관리, 회의 시작을 할 수 있습니다.',
    }
  }
  if (seen.canRun) {
    return {
      viewerTitle: '진행 권한자 화면',
      viewerNote:
        '회의를 시작·종료하고 안건을 진행할 수 있지만 권한이나 회의 정보는 변경할 수 없습니다.',
    }
  }
  if (!seen.joined) {
    return {
      viewerTitle: '미참가자 화면',
      viewerNote: '초대되지 않은 회의는 상세만 열람할 수 있습니다.',
    }
  }
  return { viewerTitle: '일반 참가자 화면', viewerNote: GUEST_NOTE[stage] }
}

export function stateBanner(
  stage: Listed,
  canStart: boolean,
  daysLeft: number | null,
): { title: string; note: string; tone: string } {
  if (stage === 'scheduled') {
    if (!canStart) {
      return {
        title: '아직 회의가 시작되지 않았습니다',
        note: '회의가 시작되면 목록과 이 화면의 버튼이 ‘회의 참가’로 변경됩니다. 이 화면을 확인한 것은 참석으로 기록되지 않습니다.',
        tone: 'blue',
      }
    }
    const left =
      daysLeft === null || daysLeft <= 0 ? null : `현재 예정 시각까지 ${daysLeft}일 남았습니다.`
    return {
      title: '시작 전 확인',
      note: [left, '안건과 참가자를 확인한 뒤 회의를 시작하세요.']
        .filter((part): part is string => part !== null)
        .join(' '),
      tone: 'gray',
    }
  }
  if (stage === 'wrapUp') {
    return { title: '회의가 종료되어 정리 중입니다', note: '', tone: 'yellow' }
  }
  if (stage === 'cancelled') return { title: '이 회의는 취소되었습니다', note: '', tone: 'red' }
  return { title: '', note: '', tone: '' }
}

export function viewerChip(
  stage: Listed,
  mine: { attendance: string } | undefined,
): { label: string; tone: string } {
  if (stage === 'scheduled') return { label: '예정 회의', tone: 'gray' }
  if (mine === undefined) return { label: '', tone: '' }
  if (stage === 'inProgress' && mine.attendance === 'present') {
    return { label: '참석 처리됨', tone: 'green' }
  }
  return attendanceChip(stage, mine.attendance)
}
