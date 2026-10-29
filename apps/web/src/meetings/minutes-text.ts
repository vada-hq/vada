export const MINUTES_TEXT = {
  write: '회의록 쓰기',
  view: '회의록 보기',
  arrange: '회의록 정리',
  discussion: '논의 내용',
  mine: '내가 쓴 글',
  other: '상대 글',
  emptyDiscussion: '논의 내용 없음',
  saving: '저장 중…',
  pending: '저장 대기',
  unsaved: '내 글 저장 안 됨',
  orphan: '빠진 안건에 쓰던 글',
  saved: '자동 저장됨',
  failed: '저장하지 못했어요',
  retry: '다시 저장',
  overwrite: '내 글로 덮기',
  adopt: '상대 글 쓰기',
  agendas: '전체 안건',
  addAgenda: '안건 더하기',
  editAgenda: '안건 고치기',
  removeAgenda: '안건 빼기',
  emptyAgenda: '안건 없음',
  agendaTitle: '안건 제목',
  agendaBody: '설명',
  decisions: '결정사항',
  decisionLabel: '결정',
  followUps: '후속 업무',
  createTask: '업무 만들기',
  emptyFollowUps: '후속 업무 없음',
  refreshFailed: '업무를 만들었지만 회의를 새로 읽지 못했어요.',
  refresh: '다시 읽기',
  addDecision: '결정 추가',
  emptyDecision: '결정 없음',
  decisionContent: '결정 내용',
  rationale: '근거',
  edit: '고치기',
  remove: '빼기',
  participants: '참가 현황',
  emptyParticipants: '참가자 없음',
  save: '저장',
  close: '닫기',
  removeAgendaQuestion: '이 안건을 뺄까요?',
  removeDecisionQuestion: '이 결정을 뺄까요?',
  confirm: '회의록 확정',
  confirmAction: '확정',
  confirmQuestion: '회의록을 확정할까요?',
  confirmUnsaved: '저장하지 못한 글이 있어요. 저장한 뒤 확정해 주세요.',
  done: '완료된 회의록',
  confirmed: '회의록 확정 완료',
  confirmedDecisions: '확정된 결정',
  followUpProgress: '후속 업무 진행 현황',
  attendeeList: '참가자',
  amendReason: '고친 사유',
  remainingEntry: '쓰던 폼 글',
} as const
export const confirmSummary = (decisions: number, followUps: number, empty: number) =>
  `결정 ${decisions} · 후속 업무 ${followUps} · 비어 있는 안건 ${empty}`
export const confirmedLabel = (time: string, name?: string) =>
  `${time}${name ? ` ${name}` : ''} 확정`
export const doneDecisionCount = (count: number) => `${count}건`
export const minutesConflict = (name?: string) =>
  name ? `${name}님이 먼저 고쳤어요` : '다른 사람이 먼저 고쳤어요'
export const agendaNumber = (position: number) => `안건 ${position}`
export const decisionCount = (count: number) => `결정 ${count}`
export const followUpCount = (count: number) => `업무 ${count}`
export const agendaProgress = (index: number, count: number) => `${index + 1} / ${count}번째 안건`
export const participantCount = (count: number) => `참가자 ${count}명`
export const minutesUpdated = (time: string, name?: string) => {
  const label = new Date(time).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  })
  return `${label}${name ? ` ${name}` : ''} 수정 · ${MINUTES_TEXT.saved}`
}
