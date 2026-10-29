import { cn } from '@/lib/utils'

// 얼굴 바탕·머리글자 색(범주 색 soft/strong 짝). 분홍(4)·주황(6)은 위험 빨강과 헷갈려 뺐다. 머리글자 대비는 strong on soft로 4.5:1 이상.
// 번호(tint)는 서버가 사람마다 정해 준다(같은 사람 = 같은 색).
const FACE_TINTS = [
  'bg-category-5-soft text-category-5-strong',
  'bg-category-2-soft text-category-2-strong',
  'bg-category-3-soft text-category-3-strong',
  'bg-category-7-soft text-category-7-strong',
  'bg-category-1-soft text-category-1-strong',
  'bg-category-8-soft text-category-8-strong',
] as const

// 머리글자: 성을 뺀 이름(한국 메신저 관례). 두 자 이하 이름은 그대로.
const SURNAME_NAME_MIN = 3
const initialsOf = (name: string) =>
  name.length >= SURNAME_NAME_MIN ? name.slice(1, SURNAME_NAME_MIN) : name

// 줄 안 작은 얼굴(머리글자 원, 28px). 이름 글 바로 앞에 붙어 '누구에게'를 사람 모양으로 먼저 보인다. 이름 글이 늘 옆에 있어 읽지 않는다.
export default function PersonFace({ name, tint }: { name: string; tint: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full text-face font-semibold tracking-tight',
        FACE_TINTS[Math.abs(tint) % FACE_TINTS.length],
      )}
    >
      {initialsOf(name)}
    </span>
  )
}
