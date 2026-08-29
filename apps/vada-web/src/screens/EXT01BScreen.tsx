import { FigmaAsset } from '../components/FigmaAsset'
import { MobileScreen } from '../components/MobileScreen'
import { findDataSource, readObjectSourceOrNull } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { drawsElement } from '../spec/drawn-when'
import { elementByNodeId, ext01b } from '../spec/screens'
import type { ButtonSpec, SummarySpec } from '../spec/types'

// 참석 확인 결과(EXT-01B). QR로 온 참석자가 마지막으로 보는 화면이다.
//
// **한 프레임이 한 자리의 값 여섯을 나란히 그렸다.** 참석 완료 · 참가자 명단
// 불일치 · 이미 참석 처리됨 · 조건 미충족 · 체크인 시간 전·후 · 비활성화된 QR이
// 노드 대 노드로 같고 **서로 배타적**이다 — 한 사람에게 하나만 온다. 그래서
// 화면 여섯도 변형 여섯도 아니고, 화면 하나에 카드 한 장이 데이터로 그려진다.
// 명세는 그 사실을 source.alsoDrawnAt으로 든다(screen.schema.json).
//
// 맨 위의 '참석 확인 결과'(30:7397)는 **갤러리 캡션이다** — 프레임 이름의 꼬리를
// 적은 것이고 화면인 셋에는 같은 자리가 없다. 그래서 그리지 않는다. 화면에
// 그려지는 제목은 결과의 이름이고, 그것이 명세의 meta.titleFrom이다.
//
// ── 명세가 말하지 않아 여기가 알고 있는 것 ────────────────────────────────
//
// **아이콘이 결과마다 다르다.** 명세가 가리킬 수 있는 것은 톤까지이고
// (summary.toneField), 그림의 이름을 가리킬 자리가 없다 — 톤으로는 못 푼다:
// '체크인 시간 전·후'와 '비활성화된 QR'이 **둘 다 회색인데 시계와 X로 다르다.**
// 그래서 화면이 attendance.checkInResult의 iconName을 직접 읽는다. 제안된 어휘는
// summary.iconField이고, 두 번째 화면(EXT-02C)이 확인하기 전에는 만들지 않는다.
//
// 어느 그림인지는 톤과 이름을 **함께** 봐야 정해진다. 뽑아 둔 그림이 동그란
// 바탕색까지 품고 있어서 같은 X가 붉은 것과 회색인 것으로 둘이기 때문이다.
// (어떤 자리에 어떤 자산이 오는지는 명세가 아니라 design이 갖는다 — FigmaAsset.)
//
// **'다시 입력' 단추는 그림에 없다.** 이름이 명단과 다를 때 QR을 다시 찍지 않고
// 폼으로 돌아갈 수 있어야 한다고 사람이 정했다(docs/decisions/product-decisions.md).
//
// 한동안 이 단추는 **화면 코드에만** 있었다 — 요소는 자기를 그린 design 노드를
// 가져야 하는데(등록 노드 계약) 그림에 없는 단추에는 그 노드가 없어서다. 명세만
// 읽는 사람은 그 존재를 알 길이 없었고, 그것이 '명세 하나면 된다'가 새는 자리였다.
//
// 이제 명세가 든다(`addedByDecision`). 그림이 없다는 사실을 숨기지 않고 **드러내어
// 적는다** — 대조는 이 요소를 견주지 않으므로 검사가 그 수를 세고 못 박는다.
//
// **언제 그리는지도 명세가 든다**(`drawnWhen`). 다만 규칙은 데이터가 답한다:
// attendance.checkInResult의 canRetry가 참일 때만 그린다. 여섯 결과 중 명단
// 불일치 하나만 참이다.

const SCREEN = 'EXT-01B'

const NODE = {
  card: '30:7398',
} as const

// 결과마다의 그림. **톤과 이름을 함께 열쇠로 쓴다** — 뽑아 둔 그림이 동그란
// 바탕색까지 품고 있어 같은 X가 붉은 것(조건 미충족)과 회색인 것(비활성화된 QR)
// 둘이다. 이 표가 design의 것이라는 사실은 FigmaAsset의 주석이 이미 말한다.
const ICON: Record<string, string | undefined> = {
  'check|green': '30:7399',
  'circle-alert|yellow': '30:7408',
  'info|blue': '30:7419',
  'x|red': '30:7430',
  'clock|gray': '30:7440',
  'x|gray': '30:7450',
}

interface EXT01BScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

function scalar(row: DataRow, field: string | undefined): string {
  const value = field === undefined ? undefined : row[field]
  return value === undefined ? '' : String(value)
}

export function EXT01BScreen({ screenParams, onNavigate }: EXT01BScreenProps) {
  const card = elementByNodeId(ext01b, NODE.card).spec as SummarySpec
  // 그림이 없어 nodeId로 찾을 수 없다. 사람이 두기로 정한 요소는 하나뿐이다.
  const retry = ext01b.elements.find((element) => element.addedByDecision !== undefined)
  if (retry === undefined) {
    throw new Error("EXT-01B에 '다시 입력' 요소가 없습니다.")
  }
  const retrySpec = retry.spec as ButtonSpec
  const retryAction = retrySpec.action
  if (retryAction.type !== 'navigate' || !('targetScreenId' in retryAction)) {
    throw new Error("'다시 입력'은 갈 곳이 하나인 이동이어야 합니다.")
  }

  // 어느 QR로 낸 결과인지 모르면 보여 줄 결과도 없다. 인자가 비면 아무 결과나
  // 대신 집어 오지 않는다 — 그러면 남의 참석 결과가 열린다.
  const missingParam = (ext01b.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )
  if (missingParam !== undefined) {
    return (
      <MobileScreen>
        <p role="alert" className="py-8 text-sm text-red-700">
          {missingParam.missingNote}
        </p>
      </MobileScreen>
    )
  }

  const result = readObjectSourceOrNull(
    card.dataSourceKey,
    resolveParams(card.params, { screenParams }),
  )

  if (result === null) {
    return (
      <MobileScreen>
        <p role="status" className="py-8 text-sm text-gray-600">
          {findDataSource(card.dataSourceKey).messages.empty}
        </p>
      </MobileScreen>
    )
  }

  const drawing = `${scalar(result, 'iconName')}|${scalar(result, card.toneField)}`
  const iconNodeId = ICON[drawing]
  if (iconNodeId === undefined) {
    // 조용히 그림 없는 카드를 그리지 않는다. 결과가 하나 늘면 여기서 드러난다.
    throw new Error(`참석 확인 결과의 그림을 찾지 못했습니다: ${drawing}`)
  }

  return (
    <MobileScreen>
      <div className="flex flex-col gap-6 py-6">
        <section
          data-node-id={NODE.card}
          className="flex flex-col items-center rounded-xl border border-gray-200 px-6 py-5"
        >
          <FigmaAsset screenId={SCREEN} nodeId={iconNodeId} className="size-14" />
          <div className="pt-3 text-center">
            <h1 className="text-sm font-semibold text-gray-900">
              {scalar(result, card.titleField)}
            </h1>
            <p className="pt-1 text-xs text-gray-500">
              {scalar(result, card.descriptionField)}
            </p>
          </div>
        </section>

        {/* 그림에 없는 단추다(위 주석). 카드 **밖**에 둔다 — 안에 두면 카드의
            글이 늘어 대조가 카드를 다른 칸으로 본다. */}
        {!drawsElement(retry, { screenParams }) ? null : (
          <button
            type="button"
            onClick={() =>
              onNavigate(
                retryAction.targetScreenId,
                resolveParams(retryAction.params, { screenParams }),
              )
            }
            className="w-full rounded-xl border border-gray-300 bg-white py-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            {retrySpec.label}
          </button>
        )}
      </div>
    </MobileScreen>
  )
}
