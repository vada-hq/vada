import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { CLOSING_SECTION_NAV_LABEL, CLOSING_SECTIONS } from './finance-text'

type ClosingPart = keyof typeof CLOSING_SECTIONS

// 주소의 #은 바꾸지 않는다. 이 앱은 경로·검색어로 화면을 정하고 공개 링크 토큰을 # 뒤에 둔다.
function focusSection(id: string) {
  const heading = document.getElementById(id)
  heading?.scrollIntoView?.({ block: 'start' })
  heading?.focus({ preventScroll: true })
}

// 결산 탭 맨 위의 구역 길: 행사가 많으면 행사 정산 목록이 길어 기간 결산까지 멀다(GOV.UK contents list).
export function ClosingSectionLinks() {
  return (
    <nav aria-label={CLOSING_SECTION_NAV_LABEL} className="flex gap-6 break-keep">
      {Object.values(CLOSING_SECTIONS).map(({ id, label }) => (
        // 글자의 왼쪽 줄을 탭·제목과 맞춘다. 누르는 높이는 touch가 휴대폰에서 44px로 둔다.
        <Button
          key={id}
          type="button"
          variant="link"
          touch
          className="px-0"
          onClick={() => focusSection(id)}
        >
          {label}
        </Button>
      ))}
    </nav>
  )
}

// 구역 길이 가리키는 구역. 제목이 초점을 받아 화면 읽기 프로그램도 옮긴 자리를 읽는다.
export function ClosingSectionPart({ part, children }: { part: ClosingPart; children: ReactNode }) {
  const { id, label } = CLOSING_SECTIONS[part]
  return (
    <section aria-label={label} className="flex flex-col gap-3">
      <h2 id={id} tabIndex={-1} className="text-base font-semibold break-keep wrap-anywhere">
        {label}
      </h2>
      {children}
    </section>
  )
}
