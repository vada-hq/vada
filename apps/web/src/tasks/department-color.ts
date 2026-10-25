// 보드 카드의 부서 색(DEC-94): 부서를 만든 순(팀 목록의 부서 순, id가 uuidv7라 만든 순)으로 범주 색 여덟(src/index.css)을 돌려 쓴다.
// 학생회 업무와 목록에 아직 없는 부서는 회색이다. 저장하지 않는다. 색만으로 가르지 않게 카드에는 부서 칩 이름이 늘 있다.
// Tailwind가 소스에서 클래스 이름을 찾으므로 이름을 조합하지 않고 그대로 적는다.
export type DepartmentColor = { line: string; chip: string }

const CATEGORY: DepartmentColor[] = [
  { line: 'border-l-category-1', chip: 'bg-category-1-soft text-category-1-strong' },
  { line: 'border-l-category-2', chip: 'bg-category-2-soft text-category-2-strong' },
  { line: 'border-l-category-3', chip: 'bg-category-3-soft text-category-3-strong' },
  { line: 'border-l-category-4', chip: 'bg-category-4-soft text-category-4-strong' },
  { line: 'border-l-category-5', chip: 'bg-category-5-soft text-category-5-strong' },
  { line: 'border-l-category-6', chip: 'bg-category-6-soft text-category-6-strong' },
  { line: 'border-l-category-7', chip: 'bg-category-7-soft text-category-7-strong' },
  { line: 'border-l-category-8', chip: 'bg-category-8-soft text-category-8-strong' },
]
const GRAY: DepartmentColor = { line: 'border-l-gray-400', chip: 'bg-gray-100 text-gray-600' }

export function departmentColorOf(
  departmentId: string | null,
  departments: readonly { id: string }[],
): DepartmentColor {
  const index = departments.findIndex(item => item.id === departmentId)
  if (departmentId === null || index < 0) return GRAY
  return CATEGORY[index % CATEGORY.length] ?? GRAY
}
