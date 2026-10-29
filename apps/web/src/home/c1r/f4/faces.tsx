import { MessageCircle, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { C1rRow } from '../c1r-data'
import type { C1rProps } from '../c1r-props'
import { F4, FACE_TINTS } from './tokens'

// 얼굴로 묶기: 줄 전체(상한 밖 줄까지)를 연락할 사람 단위로 묶는다. 배지 수를 다 더하면 머리 건수와 같다.
// 차례는 그 사람의 가장 급한 줄이 처음 나온 차례다(견본 rows가 이미 급한 차례로 놓여 있다).
export type Contact = {
  key: string
  name: string
  role: string
  // 이 사람에게 걸린 줄(급한 차례). first = 가장 급한 줄(묻기에 붙일 일)
  first: C1rRow
  rows: C1rRow[]
  // null = 회장단(사람이 아니라 무리 표시)
  tint: string | null
  // 물어본 상태: 답 없는 것이 하나라도 있으면 '답 없음'
  asked: 'answered' | 'waiting' | null
}

const PRESIDENTS = '회장단'
const keyOf = (row: C1rRow) => (row.person ? row.contact : PRESIDENTS)

function askedOf(rows: C1rRow[]): Contact['asked'] {
  const asked = rows.flatMap(row => (row.asked ? [row.asked] : []))
  if (asked.length === 0) return null
  return asked.some(a => !a.answered) ? 'waiting' : 'answered'
}

export function contactsOf(rows: C1rRow[]): Contact[] {
  const groups = new Map<string, [C1rRow, ...C1rRow[]]>()
  for (const row of rows) {
    const group = groups.get(keyOf(row))
    if (group) group.push(row)
    else groups.set(keyOf(row), [row])
  }
  let people = 0
  return [...groups].map(([key, group]) => {
    const [first] = group
    const tint = first.person ? (FACE_TINTS[people++ % FACE_TINTS.length] ?? null) : null
    return {
      key,
      name: first.person?.name ?? PRESIDENTS,
      role: first.person?.role ?? '배정',
      first,
      rows: group,
      tint,
      asked: askedOf(group),
    }
  })
}

// 머리글자: 성을 뺀 이름(한국 메신저 관례). 외자 이름(두 자 이하)은 그대로.
const SURNAME_NAME_MIN = 3
const initialsOf = (name: string) => (name.length >= SURNAME_NAME_MIN ? name.slice(1) : name)

// 얼굴(머리글자 원). 회장단은 점선 원 안 무리 아이콘이다.
export function Avatar({ contact, size }: { contact: Contact; size: 'lead' | 'face' | 'row' }) {
  const box = size === 'lead' ? F4.faceLead : size === 'face' ? F4.face : F4.faceRow
  if (!contact.tint)
    return (
      <span
        aria-hidden
        className={cn(
          box,
          'flex shrink-0 items-center justify-center rounded-full border-2 border-dashed border-input bg-card text-fg-tertiary',
        )}
      >
        <Users className={size === 'row' ? 'size-4' : 'size-5'} />
      </span>
    )
  return (
    <span
      aria-hidden
      className={cn(
        box,
        contact.tint,
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        size === 'lead'
          ? 'text-base @2xl:text-lg'
          : size === 'face'
            ? 'text-xs @2xl:text-sm'
            : 'text-xs',
      )}
    >
      {initialsOf(contact.name)}
    </span>
  )
}

// 물어봄 말풍선(Messages 고정 대화의 반응 말풍선 자리). 얼굴 위에 붙는 표시이고, 누르는 자리는 줄의 물어봄 링크다.
function Bubble({ asked }: { asked: 'answered' | 'waiting' }) {
  return (
    <span
      className={cn(
        F4.bubbleRadius,
        F4.bubbleShadow,
        'absolute -top-4 left-1/2 flex -translate-x-1/2 items-center gap-1 bg-card px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-fg-secondary',
        '@2xl:left-auto @2xl:-right-9 @2xl:translate-x-0',
      )}
    >
      <MessageCircle aria-hidden className="hidden size-3 @2xl:block" />
      {asked === 'waiting' ? '답 없음' : '답 있음'}
      {/* 꼬리 */}
      <span
        aria-hidden
        className="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rotate-45 bg-card @2xl:left-2"
      />
    </span>
  )
}

function Face({
  contact,
  lead,
  onPick,
}: {
  contact: Contact
  lead: boolean
  onPick: (contact: Contact) => void
}) {
  const count = contact.rows.length
  const label = contact.tint ? `${contact.name} ${contact.role}에게 묻기` : '회장단 배정'
  return (
    <li className={cn('flex min-w-0 flex-1 justify-center @2xl:flex-none', F4.faceCol)}>
      <Button
        variant="ghost"
        touch={false}
        aria-label={`${label}, ${count}건`}
        onClick={() => onPick(contact)}
        className={cn(
          F4.rowRadius,
          'h-auto min-w-11 flex-col gap-1.5 px-1 pt-1 pb-1.5 font-normal text-fg hover:bg-card/70 hover:text-fg focus-visible:ring-primary-strong @2xl:px-3',
        )}
      >
        <span className={cn(F4.faceSlot, 'flex items-end')}>
          <span className="relative">
            <span className={cn('block rounded-full', lead && F4.faceLeadLift)}>
              <Avatar contact={contact} size={lead ? 'lead' : 'face'} />
            </span>
            {count > 1 && (
              <span
                className={cn(
                  F4.countBadge,
                  'absolute -right-1 -bottom-1 flex items-center justify-center rounded-full bg-fg font-semibold text-card ring-2 ring-muted tabular-nums',
                )}
              >
                {count}
              </span>
            )}
            {contact.asked && <Bubble asked={contact.asked} />}
          </span>
        </span>
        <span
          className={cn(
            'max-w-full text-sm whitespace-nowrap text-fg',
            lead ? 'font-bold' : 'font-medium',
          )}
        >
          {contact.name}
        </span>
        <span className="hidden text-xs whitespace-nowrap text-fg-tertiary @2xl:block">
          {contact.role}
        </span>
      </Button>
    </li>
  )
}

// 얼굴 무대: 카드 안 회색 면에 얼굴을 가운데로 모아 늘어놓는다(빈 자리가 한쪽에 몰리지 않게).
// 사람 얼굴 = 그 사람의 가장 급한 일을 붙여 묻기, 회장단 = 첫 배정 줄의 배정하기.
export function FaceStage({
  contacts,
  onAsk,
  onAssign,
}: { contacts: Contact[] } & Pick<C1rProps, 'onAsk' | 'onAssign'>) {
  const pick = (contact: Contact) => (contact.tint ? onAsk(contact.first) : onAssign(contact.first))
  return (
    <ul
      aria-label="연락할 사람"
      className={cn(
        F4.stageRadius,
        'mx-3 flex justify-center bg-muted px-1 pt-6 pb-2 @2xl:gap-2 @2xl:pt-7',
      )}
    >
      {contacts.map((contact, index) => (
        <Face key={contact.key} contact={contact} lead={index === 0} onPick={pick} />
      ))}
    </ul>
  )
}
