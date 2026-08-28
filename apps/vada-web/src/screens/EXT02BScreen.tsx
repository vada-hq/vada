import { FigmaAsset } from '../components/FigmaAsset'
import { MobileScreen } from '../components/MobileScreen'
import { findDataSource, readObjectSourceOrNull } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, ext02b } from '../spec/screens'
import type { SummarySpec } from '../spec/types'

// 참여 신청 완료(EXT-02B).
//
// **링크로 온 설문 응답자가 본다. 로그인한 사람이 없다**(명세의 viewer: external).
// 그래서 셸이 없고, 무엇의 결과인지는 주소가 실어 온 설문 토큰만이 안다.
//
// **나가는 단추가 하나도 없다.** 이 저장소에서 처음 나오는 막다른 화면이다 —
// 외부인에게 열린 다른 화면이 없으므로 갈 곳이 없고, 갈 곳이 없으면 단추도 없다
// (EXT-02C의 '돌아가기'와 같은 판단: docs/decisions/product-decisions.md).
//
// **'신청자: 김바다'는 로그인한 사람의 이름이 아니다.** 방금 낸 응답에서 온다.
// 그래도 화면이 EXT-02A의 초안을 읽지 않는 까닭은 둘이다 — 그 스코프는 보내면서
// 비워지고(surveyApplyDraft의 scopeEvent: complete), 링크를 다시 열었을 때도 같은
// 것이 보여야 한다. 그래서 서버가 답하는 조각이다(survey.applyResult.applicantNote).
//
// **명세가 침묵해서 이 화면이 그리지 않는 자리가 하나 있다.**
// '안내 사항' 아래의 두 줄은 survey.applyResult의 `notices[]`인데, **object 출처가
// 품은 배열을 최상위에서 목록으로 그릴 어휘가 없다** — itemList는 shape가 list인
// 출처만 받고 itemsField는 itemFields 안에서만 쓴다. OPS-MEET-06A·EVT-05B에 이어
// 세 번째 사례다.

const SCREEN = 'EXT-02B'

const NODE = {
  head: '30:7240',
  fee: '30:7251',
  notices: '30:7258',
} as const

// 어느 자리에 어떤 그림이 오는지는 명세가 아니라 design이 갖는다(components/FigmaAsset).
const ASSET = {
  done: '30:7241',
} as const

interface EXT02BScreenProps {
  screenParams: Record<string, string>
}

function scalar(row: DataRow, field: string | undefined): string {
  const value = field === undefined ? undefined : row[field]
  if (value === undefined || Array.isArray(value)) {
    return ''
  }
  return String(value)
}

export function EXT02BScreen({ screenParams }: EXT02BScreenProps) {
  const head = elementByNodeId(ext02b, NODE.head).spec as SummarySpec
  const fee = elementByNodeId(ext02b, NODE.fee).spec as SummarySpec
  const notices = elementByNodeId(ext02b, NODE.notices).spec as SummarySpec

  // 토큰이 없으면 아무 신청 결과나 대신 보여주지 않는다. 남의 신청을 자기 것으로
  // 읽게 되는 자리다.
  const missingParam = (ext02b.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )
  const result =
    missingParam === undefined
      ? readObjectSourceOrNull(
          head.dataSourceKey ?? '',
          resolveParams(head.params, { screenParams }),
        )
      : null

  if (missingParam !== undefined || result === null) {
    return (
      <MobileScreen>
        <p role="alert" className="pt-16 text-sm text-red-700">
          {missingParam !== undefined
            ? missingParam.missingNote
            : findDataSource(head.dataSourceKey ?? '').messages.empty}
        </p>
      </MobileScreen>
    )
  }

  return (
    // 머리가 없다. 그림이 그린 것은 기기 목업의 상태바뿐이고 그것은 화면이 아니다
    // (components/MobileScreen.tsx).
    <MobileScreen>
      {/* 결과의 머리 30:7240. 동그란 그림과 세 줄이 가운데로 선다.
          제목은 데이터다 — 운영진이 설문마다 '신청 완료 안내 문구'를 쓴다
          (명세의 meta.titleFrom). 그래서 화면이 글을 들지 않는다. */}
      <section data-node-id={NODE.head} className="flex flex-col items-center pt-16 text-center">
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.done} className="size-20 rounded-full" />
        <h1 className="pt-5 text-lg font-bold text-gray-900">
          {drawnTitleOf(ext02b, screenParams)}
        </h1>
        <p className="pt-1 text-sm text-gray-500">
          {scalar(result, head.descriptionField)}
        </p>
        {(head.items ?? []).map((item) => (
          <p key={item.field} className="pt-1 text-sm font-medium text-gray-700">
            {scalar(result, item.field)}
          </p>
        ))}
      </section>

      {/* 참가비 30:7251. 라벨은 명세가, 값과 보조문은 데이터가 갖는다 —
          '관리자 확인 중'은 금액이 아직 정해지지 않았다는 뜻이고, 정해진 행사에서는
          같은 자리에 금액이 온다. 화면이 그 갈래를 알지 않는다. */}
      <section
        data-node-id={NODE.fee}
        className="mt-5 rounded-xl border border-gray-200 p-5 text-center"
      >
        {(fee.items ?? []).map((item) => (
          <div key={item.field}>
            <p className="text-xs text-gray-500">{item.label}</p>
            <p className="pt-1 text-base font-semibold text-gray-900">
              {scalar(result, item.field)}
            </p>
            {item.descriptionField === undefined ? null : (
              <p className="pt-1 text-xs text-gray-400">
                {scalar(result, item.descriptionField)}
              </p>
            )}
          </div>
        ))}
      </section>

      {/* 안내 사항 30:7258. **제목만 그린다** — 그 아래 두 줄은 명세가 가리킬 말이
          없어(위의 notices[]) 이 화면이 그리지 않는다. 그리면 명세가 말하지 않은
          앎이 화면에 박힌다. */}
      <section data-node-id={NODE.notices} className="mt-5 rounded-xl bg-gray-50 p-4">
        <h2 className="text-xs font-medium text-gray-700">{notices.title}</h2>
      </section>
    </MobileScreen>
  )
}
