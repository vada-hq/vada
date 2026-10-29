import type { ComponentType, ReactNode } from 'react'
import { MessageCircle, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { C1rPerson } from '../c1r-data'
import {
  ASK_BADGE,
  AVATAR_SIZE,
  AVATAR_TEXT,
  AVATAR_TONES,
  FACE_RADIUS,
  TILE_BOX,
  TILE_ICON,
  TILE_NUMBER,
  TILE_NUMBER_FOCUS,
} from './tokens'

// f2 새 부품: 이유 타일, 사람 아바타(묻기 배지), 배정 자리 원.
// 앱 Button은 테두리·작은 반경·한 줄 글이 박혀 있어 면 타일과 원 아바타에 맞지 않아 날것 button에 모양을 줬다(지시서 '풀린 규칙').

const PALETTE_SIZE = AVATAR_TONES.length
const HASH_STEP = 31
const toneOf = (name: string) => {
  let hash = 0
  for (const ch of name) hash = (hash * HASH_STEP + ch.charCodeAt(0)) % PALETTE_SIZE
  return AVATAR_TONES[hash]
}
// 아바타 글: 이름에서 성을 뺀 두 글자(한국 앱 관례: 카카오워크·잔디의 이름 원)
const initialsOf = (name: string) => (name.length > 2 ? name.slice(1) : name)

// 이유 타일: 아이콘 원(왼쪽 위) + 큰 수(오른쪽 위) + 이유 이름(왼쪽 아래). 누르면 아래 목록을 그 이유로 거른다.
// focus: 첫 타일(가장 급한 이유). 넓고 수가 크다. danger: 지남·오늘 타일만 옅은 위험 면.
export function ReasonTile({
  icon: Icon,
  label,
  count,
  focus,
  danger,
  pressed,
  onPress,
}: {
  icon: ComponentType
  label: string
  count: number
  focus: boolean
  danger: boolean
  pressed: boolean
  onPress: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onPress}
      className={cn(
        'flex min-w-0 cursor-pointer flex-col justify-between gap-2 text-left transition-colors outline-none',
        'focus-visible:ring-2 focus-visible:ring-primary-strong',
        FACE_RADIUS,
        TILE_BOX,
        focus ? 'basis-full @2xl:flex-2 @2xl:basis-0' : 'flex-1 basis-0',
        danger ? 'bg-danger-surface' : 'bg-card',
        pressed ? 'ring-2 ring-fg ring-inset' : 'shadow-xs',
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full',
            TILE_ICON,
            danger ? 'bg-card text-fg' : 'bg-muted text-fg-secondary',
          )}
        >
          <Icon aria-hidden />
        </span>
        <span className={cn('text-fg tabular-nums', focus ? TILE_NUMBER_FOCUS : TILE_NUMBER)}>{count}</span>
      </span>
      <span className="text-sm font-semibold break-keep text-fg-secondary">{label}</span>
    </button>
  )
}

function AvatarFace({ person }: { person: C1rPerson }) {
  return (
    <span className={cn('flex items-center justify-center rounded-full', AVATAR_SIZE, AVATAR_TEXT, toneOf(person.name))}>
      {initialsOf(person.name)}
    </span>
  )
}

// 사람 아바타 = 묻기. 오른쪽 아래 말풍선 배지가 '누르면 묻는다'를 말한다. 누르는 자리는 둘레 2px를 더해 44px.
export function AskAvatar({ person, label, onAsk }: { person: C1rPerson; label: string; onAsk: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onAsk}
      className="relative z-10 -m-0.5 shrink-0 cursor-pointer rounded-full p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-primary-strong"
    >
      <AvatarFace person={person} />
      <span
        aria-hidden
        className={cn(
          'absolute -right-0.5 -bottom-0.5 flex items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-card',
          ASK_BADGE,
        )}
      >
        <MessageCircle />
      </span>
    </button>
  )
}

// 배정 줄의 사람 자리: 아직 사람이 없다는 점선 원
export function EmptySeat() {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-input text-fg-muted [&_svg]:size-4',
        AVATAR_SIZE,
      )}
    >
      <UserPlus />
    </span>
  )
}

export function Face({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('overflow-hidden bg-card shadow-xs', FACE_RADIUS, className)}>{children}</div>
}
