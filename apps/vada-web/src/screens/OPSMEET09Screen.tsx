import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { readObjectSourceOrNull } from '../data-sources/catalog'
import { findDataSource } from '../data-sources/definitions'
import { resolveParams } from '../spec/params'
import { targetScreenOf, paramsOf } from '../spec/types'
import { drawnTitleOf, elementByNodeId, opsMeet09 } from '../spec/screens'
import type { SummarySpec } from '../spec/types'
import {
  CancelledMeetingDetails,
  cancelledMeetingScalar,
} from './cancelled-meeting/CancelledMeetingDetails'

// 취소된 회의 상세(OPS-MEET-09).
//
// **조작 단추가 하나도 없다.** 취소는 되돌릴 수 없기 때문이다(docs/decisions/
// meeting-model.md). 되돌리는 대신 새 회의를 만들어 잇고, 이 화면의 유일한
// 단추는 그 대체 회의로 가는 문이다.
//
// 상태를 화면이 알지 않는다 — '취소'라는 말도, 띠의 제목과 본문도 서버가 준다
// (meeting.detail의 status·stateBannerTitle·stateBannerNote). 여기서 상태 이름을
// 코드에 적으면 상태가 하나 늘 때 이 화면이 조용히 틀린다.
//
// 다만 **띠의 색은 명세가 가리키는 자리가 없어** design이 그린 그대로 붉게
// 그린다. meeting.detail은 stateBannerTone을 갖는데 summary에는 그 이름을 담을
// 칸이 없다. 이 화면이 취소된 회의만 그리는 자리라 어긋나지 않을 뿐이므로,
// 띠를 여러 상태가 나눠 쓰게 되면 스키마에 자리를 내야 한다.

const NODE = {
  banner: '20:2719',
  meeting: '20:2732',
  cancellation: '20:2754',
  replacement: '20:2771',
} as const

// 경로 조각 사이의 화살표. 조각보다 하나 적다.
const BREADCRUMB_SEPARATORS = ['20:2705', '20:2710']

interface OPSMEET09ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function OPSMEET09Screen({ screenParams, onNavigate }: OPSMEET09ScreenProps) {
  const [notice, setNotice] = useState<string | null>(null)

  const banner = elementByNodeId(opsMeet09, NODE.banner).spec as SummarySpec
  const meeting = elementByNodeId(opsMeet09, NODE.meeting).spec as SummarySpec
  const cancellation = elementByNodeId(opsMeet09, NODE.cancellation).spec as SummarySpec
  const replacement = elementByNodeId(opsMeet09, NODE.replacement).spec as SummarySpec

  const meta = opsMeet09.meta
  if (meta === undefined) {
    throw new Error('OPS-MEET-09의 화면 카피가 없습니다.')
  }

  // 인자가 없으면 조용히 아무 회의나 보여주지 않는다. FIN-REQ-02·EVT-TASK-02와
  // 같은 태도다 — 명세의 구멍도 사람의 실수도 숨기지 않는다.
  const missingParam = (opsMeet09.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )

  const query = resolveParams(banner.params, { screenParams })
  // 아직 무엇을 물을지 모르는 동안에는 묻지 않는다. 인자가 비면 출처가 첫 줄을
  // 집어 오게 되어 남의 회의를 자기 것으로 읽는다.
  const detail =
    missingParam === undefined
      ? readObjectSourceOrNull(banner.dataSourceKey ?? '', query)
      : null

  // 띠의 색 이름은 명세가 가리킨 조각에서 온다. 상태가 색을 정하는데 상태는
  // 조직이 늘릴 수 있어서, 화면이 목록을 들고 있으면 늘 때마다 틀린다.
  const bannerTone =
    detail === null ? '' : cancelledMeetingScalar(detail, banner.toneField ?? '')

  if (missingParam !== undefined || detail === null) {
    return (
      <AppShell
        screenId={opsMeet09.screenId}
        activeNavigationScreenId={opsMeet09.activeNavigationScreenId}
        eyebrow={meta.eyebrow}
        title={meta.title}
        description={meta.description}
        footerNote={meta.footerNote}
        onNavigate={onNavigate}
      >
        <p role="alert" className="text-sm text-red-700">
          {missingParam !== undefined
            ? missingParam.missingNote
            : findDataSource(banner.dataSourceKey ?? '').messages.empty}
        </p>
      </AppShell>
    )
  }

  const breadcrumb = opsMeet09.breadcrumb

  // 대체 회의로 가는 문은 그 카드가 갖는다 — 단추가 카드 **안에** 그려져 있어
  // 따로 등록할 자리가 아니다(design의 20:2777 ⊂ 20:2771).
  //
  // 어느 회의로 가는지는 이 회의가 안다. 대체 회의의 id는 화면의 입력 칸에도
  // 주소에도 없고, 이 화면이 읽은 한 건의 조각이다(sourceField).
  const replacementAction = replacement.action
  function pressOpenReplacement() {
    if (replacementAction === undefined) return
    if (replacementAction.type === 'pending') {
      setNotice(replacementAction.note)
      return
    }
    onNavigate(
      targetScreenOf(replacementAction, detail ?? {}) ?? replacementAction.type,
      resolveParams(paramsOf(replacementAction), { screenParams, row: detail ?? undefined }),
    )
  }

  return (
    <AppShell
      screenId={opsMeet09.screenId}
      activeNavigationScreenId={opsMeet09.activeNavigationScreenId}
      eyebrow={meta.eyebrow}
      title={drawnTitleOf(opsMeet09, screenParams)}
      description={meta.description}
      footerNote={meta.footerNote}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={opsMeet09.screenId}
            separatorNodeIds={BREADCRUMB_SEPARATORS}
            items={breadcrumb.items.map((item) =>
              item.field === undefined
                ? (item.value ?? '')
                : cancelledMeetingScalar(detail, item.field),
            )}
          />
        )
      }
      onNavigate={onNavigate}
    >
      <CancelledMeetingDetails
        detail={detail}
        banner={banner}
        meeting={meeting}
        cancellation={cancellation}
        replacement={replacement}
        bannerTone={bannerTone}
        notice={notice}
        onOpenReplacement={pressOpenReplacement}
      />
    </AppShell>
  )
}
