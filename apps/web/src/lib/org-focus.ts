// 조직 화면을 열 때 한 부서로 스크롤·초점을 옮기라는 화면 상태(주소에 남기지 않는다). 홈 ①의 '부장 정하기'가 쓴다.
// 재정 역할 부서는 옛 값 'finance'로도 연다(홈 '재정 담당 없음').
export const departmentFocus = (departmentId: string) => ({ department: departmentId })

export function focusedDepartmentOf(state: unknown): string | undefined {
  if (typeof state !== 'object' || state === null || !('department' in state)) return undefined
  return typeof state.department === 'string' ? state.department : undefined
}
