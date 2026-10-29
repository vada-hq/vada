// ─────────────────────────────────────────────────────────────────────────────
// 공용 파일: 만드는 쪽(v1~v3)은 읽기만 한다.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from 'react'
import type { BuilderSample, BuilderScreen } from './builder-data'
import type { BuilderProps } from './builder-props'
import V0 from './v0'
import V1 from './v1'
import V2 from './v2'
import V3 from './v3'

// 양식 만들기 화면 시안 미리보기 껍데기: /form-builder.html?variant=v0..v3&screen=card|editor|empty&data=<견본>
// 찍기·측정은 [data-form-root] 상자(페이지 전체, 셸 자리 포함)를 본다. 안은 [data-form-content](탭 안 내용 영역)에 그린다.
// v0 = 지금 구현, v1~v3 = 시안 자리. 미리 다 등록해 두어 만드는 쪽은 자기 vN/ 폴더만 고친다.
export const BUILDER_VARIANTS = { v0: V0, v1: V1, v2: V2, v3: V3 }
export type BuilderVariant = keyof typeof BUILDER_VARIANTS

const log = (what: string, ...rest: unknown[]) => console.info(`[builder] ${what}`, ...rest)

function propsOf(screen: BuilderScreen, data: BuilderSample): BuilderProps {
  return {
    screen,
    data,
    onCreate: () => log('참여 설문 만들기'),
    onScan: () => log('QR로 출석 확인'),
    onPreview: formId => log('미리보기', formId),
    onEdit: (formId, focus) => log('고치기', formId, focus),
    onActivate: formId => log('설문 링크 활성화', formId),
    onPause: formId => log('멈추기', formId),
    onResume: formId => log('다시 받기', formId),
    onCopy: (formId, link) => log('링크 복사', formId, link),
    onSaveQr: formId => log('QR 저장', formId),
    onFill: (formId, condition) => log('채우기', formId, condition),
    onEditEvent: focus => log('행사 정보 고치기', focus),
    onBack: () => log('되돌아가기'),
    onSubmit: (values, accountId) => log('만들기·저장', values, accountId),
  }
}

// 앱 셸 자리(회색 상자). 크기는 지금 앱과 같게 둔다: 옆 메뉴 240px(768px 이상, WorkspaceFrame w-60),
// 머리글 64px(WorkspaceHeader min-h-16), 본문 여백 16px·640px 이상 24px(WorkspaceContent p-4 sm:p-6), 가운데 틀 max-w-7xl.
// 행사 머리(되돌아가기 + 탭 + 요약 줄)는 배포본 스크린샷에서 잰 높이(1280 약 172px, 390 약 208px)다.
// 휴대폰 아래 메뉴(고정)는 두지 않는다(전체 페이지 찍기에서 내용을 덮어서).
function Slot({ label, className }: { label: string; className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center rounded-md border border-dashed bg-surface-muted text-xs text-fg-muted ${className}`}
    >
      {label}
    </div>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <Slot label="옆 메뉴" className="hidden w-60 shrink-0 rounded-none md:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <Slot label="머리글 (경로 · 행사 이름)" className="h-16 shrink-0 rounded-none" />
        <div className="p-4 sm:p-6">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
            <Slot label="행사 머리 · 탭 (인원 관리)" className="h-52 md:h-43" />
            <div role="tabpanel" data-form-content className="min-w-0">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

type Props = { variant: BuilderVariant; screen: BuilderScreen; data: BuilderSample }

export default function BuilderPreview({ variant, screen, data }: Props) {
  const Variant = BUILDER_VARIANTS[variant] ?? V0
  return (
    <div
      className="min-h-dvh bg-background"
      data-form-root
      data-form-variant={variant}
      data-form-screen={screen}
      data-form-data={data.name}
    >
      <Shell>
        <Variant {...propsOf(screen, data)} />
      </Shell>
    </div>
  )
}
