import type { ReactNode } from 'react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { C1R_DATA } from '../c1r-data'
import type { C1rProps } from '../c1r-props'
import V1 from '../v1'
import V3 from '../v3'
import type { ThemeName } from './theme'

// 스타일 타일: 한 테마의 색 견본, 글자 단계, 앱 부품, 그리고 ① v3·v1(main)을 977폭으로 한 화면에.
// /home-s5.html?component=tile&theme=base|a|b|c. 찍기는 창 1280 전체(tools/home-c1r/theme_board.py).

// 색 이름은 themes.css 1절과 같다. 묶음은 theme-frame.md 대응표 순서.
const SWATCHES: [string, string[]][] = [
  ['글자', ['fg', 'fg-secondary', 'fg-tertiary', 'fg-muted']],
  ['면', ['background', 'card', 'surface-subtle', 'muted']],
  ['선', ['border', 'border-subtle', 'input']],
  ['강조', ['primary', 'primary-foreground', 'primary-strong', 'primary-surface', 'ring']],
  ['위험', ['danger', 'danger-surface', 'danger-border', 'destructive']],
  [
    '경고·성공',
    [
      'warning',
      'warning-surface',
      'warning-border',
      'success',
      'success-surface',
      'success-border',
    ],
  ],
]

// ① 판의 넓은 폭(창 1025 - 여백 48). 고정 폭이라 Tailwind 스케일 밖이어서 style로 준다.
const C1R_WIDE = 977
const HEX = 16
const OPAQUE = 255

// 테마 값은 어떤 CSS 색 꼴로도 쓸 수 있어 캔버스에 칠해 sRGB hex로 읽는다(화면에 그려지는 값).
function readHexes(names: string[]) {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  const style = getComputedStyle(document.documentElement)
  const out: Record<string, string> = {}
  for (const name of names) {
    if (!ctx) break
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = style.getPropertyValue(`--${name}`).trim()
    ctx.fillRect(0, 0, 1, 1)
    const [r = 0, g = 0, b = 0, a = 0] = ctx.getImageData(0, 0, 1, 1).data
    const hex = [r, g, b].map(v => v.toString(HEX).padStart(2, '0')).join('')
    out[name] = `#${hex}${a < OPAQUE ? ` α${a}` : ''}`
  }
  return out
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-medium text-fg-muted">{title}</h2>
      {children}
    </section>
  )
}

function Swatches() {
  const [hex] = useState(() => readHexes(SWATCHES.flatMap(([, names]) => names)))
  return (
    <Section title="색">
      <div className="flex flex-col gap-3">
        {SWATCHES.map(([group, names]) => (
          <div key={group} className="flex items-start gap-3">
            <span className="w-16 shrink-0 pt-1 text-xs text-fg-tertiary">{group}</span>
            <div className="grid flex-1 grid-cols-6 gap-3">
              {names.map(name => (
                <div key={name} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-8 shrink-0 rounded-md border border-border"
                    style={{ background: `var(--${name})` }}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-xs font-medium text-fg">{name}</span>
                    <span className="text-xs text-fg-muted tabular-nums">{hex[name]}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// 역할 = benchmarks.md 갈래별 '글자 단계'. 테마가 text-xs~2xl을 이 역할 크기로 채운다.
const TYPE_SAMPLES: [string, string, string][] = [
  ['페이지 제목 · xl', 'text-xl font-bold text-fg', '회장단 홈'],
  ['구획 제목 · lg', 'text-lg font-semibold text-fg', '확인이 필요한 운영 상황'],
  ['줄 제목 · base', 'text-base font-semibold text-fg', '체험 부스 구성안 확정'],
  ['본문 · sm', 'text-sm text-fg', '김민준 기획부장에게 부스 전기 사용 신청을 물어봤어요.'],
  ['보조 1 · sm', 'text-sm text-fg-secondary', '진로 특강 현장 운영 순서표 만들기 · 내일 마감'],
  ['메타 · xs', 'text-xs text-fg-muted', '10월 28일 물어봄 · 답 있음 · 가을 축제'],
  ['숫자 · 2xl', 'text-2xl font-semibold text-fg tabular-nums', '1,240,000원'],
]

function TypeScale() {
  return (
    <Section title="글자">
      <div className="flex flex-col gap-2">
        {TYPE_SAMPLES.map(([label, className, text]) => (
          <div key={label} className="flex items-baseline gap-3">
            <span className="w-28 shrink-0 text-xs text-fg-muted">{label}</span>
            <span className={className}>{text}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}

// 초점 블록(막힌 일): 갈래마다 강조 방식이 달라 면·왼쪽 띠를 테마 값(--focus-*)으로 받는다.
const FOCUS_STYLE = {
  background: 'var(--focus-surface)',
  borderLeftColor: 'var(--focus-stripe)',
  borderLeftWidth: 'var(--focus-stripe-width)',
}

function Focus() {
  return (
    <Card className="flex flex-col gap-3 p-4" style={FOCUS_STYLE}>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-danger">3일 지남 · 막힌 일</span>
        <h3 className="text-base font-semibold text-fg">체험 부스 구성안 확정</h3>
        <p className="text-xs text-fg-muted">김민준 기획부장 · 가을 축제 · 10월 26일 (월) 마감</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button>김민준에게 묻기</Button>
        <Button variant="outline">업무 보기</Button>
      </div>
    </Card>
  )
}

function Budget() {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-xs text-fg-muted">가을 축제 남은 예산</span>
      <span className="text-2xl font-semibold text-fg tabular-nums">1,240,000원</span>
      <span className="text-xs text-fg-secondary tabular-nums">
        예산 3,000,000원 중 1,760,000원 사용
      </span>
    </Card>
  )
}

// 목록 3줄: 지남·임박·정상. 임박 줄이 선택된 줄(옅은 강조 면).
const LIST_ROWS: { title: string; meta: string; chip: ReactNode; selected?: boolean }[] = [
  {
    title: '동아리 지원금 신청서 제출',
    meta: '이서연 담당자 · 10월 27일 (화) 마감',
    chip: <Badge tone="danger">2일 지남</Badge>,
  },
  {
    title: '진로 특강 현장 운영 순서표 만들기',
    meta: '김민준 기획부장 · 진로 특강',
    chip: <Badge tone="warning">내일 마감</Badge>,
    selected: true,
  },
  {
    title: '신입생 환영회 장소 예약',
    meta: '최유나 홍보부장 · 신입생 환영회',
    chip: <Badge tone="success">완료</Badge>,
  },
]

function List() {
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-border-subtle">
        {LIST_ROWS.map(row => (
          <li
            key={row.title}
            aria-current={row.selected || undefined}
            className={cn(
              'flex items-center gap-3 px-4 py-3',
              row.selected ? 'bg-primary-surface' : 'hover:bg-surface-subtle',
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-semibold text-fg">{row.title}</span>
              <span className="truncate text-xs text-fg-muted">{row.meta}</span>
            </span>
            {row.chip}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Parts() {
  return (
    <Section title="부품">
      <div className="flex flex-wrap items-center gap-3">
        <Button>배정하기</Button>
        <Button variant="outline">전체 보기</Button>
        <Button variant="link">이서연에게 묻기</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="danger">3일 지남</Badge>
        <Badge tone="warning">결재 대기 D-3</Badge>
        <Badge tone="success">완료</Badge>
        <Badge tone="neutral">부서 미정</Badge>
      </div>
      <List />
      <Field label="업무 이름" required>
        <Input defaultValue="체험 부스 구성안 확정" />
      </Field>
    </Section>
  )
}

const log = (what: string) => () => console.info('[tile]', what)
const C1R_PROPS: C1rProps = {
  data: C1R_DATA.main,
  onOpen: log('일 보기'),
  onAsk: log('묻기'),
  onOpenAsked: log('물은 대화'),
  onAssign: log('배정하기'),
  onSeeAll: log('전체 보기'),
}

// 타일 구성은 세 테마가 같다(benchmarks.md 2.1). 테마 이름은 화면에 쓰지 않는다(대표가 이름에 끌리지 않게).
export default function ThemeTile({ theme }: { theme: ThemeName }) {
  return (
    <main className="flex min-h-dvh flex-col gap-8 bg-background p-6" data-theme-tile={theme}>
      <h1 className="text-xl font-bold text-fg">회장단 홈</h1>
      <Swatches />
      <div className="grid grid-cols-2 gap-8">
        <div className="flex flex-col gap-6">
          <TypeScale />
          <Section title="초점 블록 · 숫자">
            <Focus />
            <Budget />
          </Section>
        </div>
        <Parts />
      </div>
      <Section title="① 확인이 필요한 운영 상황">
        <div className="flex flex-col gap-6">
          {[V3, V1].map((Variant, i) => (
            <div key={i} className="@container" style={{ width: C1R_WIDE }}>
              <Variant {...C1R_PROPS} />
            </div>
          ))}
        </div>
      </Section>
    </main>
  )
}
