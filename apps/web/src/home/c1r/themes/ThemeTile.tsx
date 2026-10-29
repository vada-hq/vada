import type { ReactNode } from 'react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { C1R_DATA } from '../c1r-data'
import type { C1rProps } from '../c1r-props'
import V1 from '../v1'
import V3 from '../v3'
import { THEME_LABEL, type ThemeName } from './theme'

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

const TYPE_SAMPLES: [string, string, string][] = [
  ['xl · fg · 굵게', 'text-xl font-semibold text-fg', '확인이 필요한 운영 상황'],
  ['lg · fg · 굵게', 'text-lg font-semibold text-fg', '가을 축제 준비가 한창이에요'],
  ['base · fg', 'text-base text-fg', '체험 부스 구성안 확정이 3일 지났어요.'],
  ['sm · fg · 굵게', 'text-sm font-semibold text-fg', '동아리 지원금 신청서 제출'],
  ['sm · fg', 'text-sm text-fg', '김민준 기획부장에게 부스 전기 사용 신청을 물어봤어요.'],
  [
    'sm · fg-secondary',
    'text-sm text-fg-secondary',
    '진로 특강 현장 운영 순서표 만들기 · 내일 마감',
  ],
  ['xs · fg-tertiary', 'text-xs text-fg-tertiary', '10월 28일 물어봄 · 답 있음'],
  [
    'xs · fg-muted',
    'text-xs text-fg-muted',
    '2026 소프트웨어융합대학 체육대회 및 학과 대항 e스포츠 리그',
  ],
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

function Parts() {
  return (
    <Section title="부품">
      <div className="flex flex-wrap items-center gap-3">
        <Button>배정하기</Button>
        <Button variant="outline">전체 보기</Button>
        <Button variant="link">김민준에게 묻기</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="danger">3일 지남</Badge>
        <Badge tone="warning">결재 대기 D-3</Badge>
        <Badge tone="neutral">부서 미정</Badge>
      </div>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-border-subtle">
          <li className="flex items-center gap-3 px-4 py-3 hover:bg-surface-subtle">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-semibold text-fg">부스 전기 사용 신청</span>
              <span className="truncate text-xs text-fg-muted">박서준 총무부장 · 가을 축제</span>
            </span>
            <Badge tone="danger">오늘 마감</Badge>
          </li>
          <li className="flex items-center gap-3 bg-surface-subtle px-4 py-3">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-semibold text-fg">
                진로 특강 다과 구매 (옅은 면)
              </span>
              <span className="truncate text-xs text-fg-muted">정하늘 재정부장 · 진로 특강</span>
            </span>
            <Badge tone="neutral">결재 대기 D-3</Badge>
          </li>
        </ul>
      </Card>
      <Card className="flex flex-col gap-1 p-4">
        <h3 className="text-base font-semibold text-fg">가을 축제</h3>
        <p className="text-sm text-fg-secondary">
          10월 31일 (금) ~ 11월 1일 (토) · 업무 12건 중 8건 완료
        </p>
      </Card>
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

export default function ThemeTile({ theme }: { theme: ThemeName }) {
  return (
    <main className="flex min-h-dvh flex-col gap-8 bg-background p-6" data-theme-tile={theme}>
      <h1 className="text-xl font-semibold text-fg">{`테마 ${THEME_LABEL[theme]}`}</h1>
      <Swatches />
      <div className="grid grid-cols-2 gap-8">
        <TypeScale />
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
