import { defaultDepartmentColor, type DepartmentColorKey } from '@vada/contracts'

export type DepartmentColor = { line: string; chip: string; dot: string }
// 조직과 업무가 같은 저장색을 쓴다. Tailwind가 찾도록 클래스 이름은 조합하지 않는다.
const CATEGORY: Record<DepartmentColorKey, DepartmentColor> = {
  teal: {
    line: 'border-l-category-1',
    chip: 'bg-category-1-soft text-category-1-strong',
    dot: 'bg-category-1',
  },
  violet: {
    line: 'border-l-category-2',
    chip: 'bg-category-2-soft text-category-2-strong',
    dot: 'bg-category-2',
  },
  emerald: {
    line: 'border-l-category-3',
    chip: 'bg-category-3-soft text-category-3-strong',
    dot: 'bg-category-3',
  },
  pink: {
    line: 'border-l-category-4',
    chip: 'bg-category-4-soft text-category-4-strong',
    dot: 'bg-category-4',
  },
  sky: {
    line: 'border-l-category-5',
    chip: 'bg-category-5-soft text-category-5-strong',
    dot: 'bg-category-5',
  },
  orange: {
    line: 'border-l-category-6',
    chip: 'bg-category-6-soft text-category-6-strong',
    dot: 'bg-category-6',
  },
  indigo: {
    line: 'border-l-category-7',
    chip: 'bg-category-7-soft text-category-7-strong',
    dot: 'bg-category-7',
  },
  lime: {
    line: 'border-l-category-8',
    chip: 'bg-category-8-soft text-category-8-strong',
    dot: 'bg-category-8',
  },
}
const GRAY: DepartmentColor = {
  line: 'border-l-gray-400',
  chip: 'bg-gray-100 text-gray-600',
  dot: 'bg-gray-400',
}
export function departmentColorOf(
  departmentId: string | null,
  departments: readonly { id: string; color?: DepartmentColorKey | null }[],
): DepartmentColor {
  const department = departments.find(item => item.id === departmentId)
  return department ? CATEGORY[department.color ?? defaultDepartmentColor(department.id)] : GRAY
}
