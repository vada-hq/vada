import type { DepartmentSummary, MemberSummary, MembershipPermissions } from '@vada/contracts'

export type MemberGroup = { key: string; department: DepartmentSummary | null; members: MemberSummary[] }
const collator = new Intl.Collator('ko')
const byTitleThenName = (a: MemberSummary, b: MemberSummary) =>
  Number(b.title !== null) - Number(a.title !== null) || collator.compare(a.name, b.name)

// 회장단을 맨 앞에, 나머지는 가나다순으로 둔다. 고르는 칸의 순서도 같다.
export function sortDepartments(departments: DepartmentSummary[]) {
  return [...departments].sort((a, b) => Number(b.isLeadership) - Number(a.isLeadership) || collator.compare(a.name, b.name))
}

// 미배정, 회장단, 나머지 부서 순서다. 묶음 안에서는 직책이 있는 사람이 먼저이고, 그다음 이름순이다.
export function groupMembers(departments: DepartmentSummary[], members: MemberSummary[]): MemberGroup[] {
  const unassigned = members.filter(member => member.departmentId === null).sort(byTitleThenName)
  return [
    ...(unassigned.length ? [{ key: 'unassigned', department: null, members: unassigned }] : []),
    ...sortDepartments(departments).map(department => ({ key: department.id, department,
      members: members.filter(member => member.departmentId === department.id).sort(byTitleThenName) })),
  ]
}

// 확인 대화상자를 띄울지 정할 때만 쓴다. 실제 권한은 서버가 정한다.
function permissionsOf(department: DepartmentSummary | null): MembershipPermissions {
  return { manageOrganization: department?.isLeadership ?? false, approvePurchases: Boolean(department?.isLeadership || department?.handlesFinance),
    manageEvents: department !== null }
}

// 마지막 글자에 받침이 있으면 앞의 조사를 붙인다. '으로'는 ㄹ 받침 뒤에서도 '로'를 쓴다.
function withParticle(word: string, afterBatchim: string, otherwise: string, rieulTakesOtherwise = false) {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  const final = code >= 0 && code <= 11171 ? code % 28 : 0
  return word + (final !== 0 && !(rieulTakesOtherwise && final === 8) ? afterBatchim : otherwise)
}

// 권한이 바뀌는 이동만 확인한다. 권한은 없음 < 구매 승인 < 조직 관리·구매 승인 순서라, 얻거나 잃는 쪽 하나만 생긴다.
// 행사 운영(부서가 있으면 생김)은 묻지 않는다. 미배정을 부서에 넣는 일은 늘 하는 일이고, 부서 배정 자체가 권한을 주는 결정이다.
export function moveWarning(member: MemberSummary, from: DepartmentSummary | null, to: DepartmentSummary | null): string | null {
  const before = permissionsOf(from)
  const after = permissionsOf(to)
  const changed = [before.manageOrganization !== after.manageOrganization && '조직 관리', before.approvePurchases !== after.approvePurchases && '구매 승인']
    .filter((item): item is string => Boolean(item))
  if (!changed.length) return null
  const gains = (after.approvePurchases && !before.approvePurchases) || (after.manageOrganization && !before.manageOrganization)
  const sentence = `${withParticle(member.name, '을', '를')} ${withParticle(to?.name ?? '미배정', '으로', '로', true)} 옮기면 `
    + `${withParticle(changed.join('와 '), '을', '를')} 할 수 ${gains ? '있게' : '없게'} 돼요.`
  return member.title ? `${sentence} 직책은 지워져요.` : sentence
}
