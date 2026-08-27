import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DataTable } from '../components/DataTable'
import { FigmaAsset } from '../components/FigmaAsset'
import { findDataSource, readListSource, readObjectSource } from '../data-sources/catalog'
import { elementByNodeId, org04 } from '../spec/screens'
import type { ItemListSpec, SummarySpec } from '../spec/types'

// 역할 및 권한(ORG-04). 읽기만 하는 화면이다 — 역할을 바꾸는 것은 ORG-04B다.
//
// **역할 셋은 명세가 갖는다.** 한동안 '열이 데이터에서 오는 표'라는 새 어휘를
// 만들 뻔했는데, 짝 화면(ORG-04B)이 답을 갖고 있었다: "회장단만 구성원의 기본
// 역할을 **회장단·부서장·부원으로** 변경할 수 있습니다." 바뀌는 것은 사람의
// 역할이지 역할의 집합이 아니다. 그래서 열은 고정이고 어휘가 한 줄도 안 늘었다.
//
// 칸에 그려지는 것은 '가능'·'재정부만'처럼 완성된 말이다 - 되는가 안 되는가가
// 아니라 **어떤 조건에서 되는가**까지가 답이라서, 그 말의 목록은 서버가 갖는다.

const SCREEN = 'ORG-04'

const NODE = {
  breadcrumb: '30:6251',
  banner: '30:6263',
  roles: ['30:6275', '30:6283', '30:6291'],
  matrix: '30:6299',
  matrixNote: '30:6402',
  contextRoles: '30:6405',
} as const

const ASSET = {
  breadcrumbSeparator: '30:6255',
  banner: '30:6264',
} as const

interface ORG04ScreenProps {
  onNavigate: (screenId: string) => void
}

export function ORG04Screen({ onNavigate }: ORG04ScreenProps) {
  const banner = elementByNodeId(org04, NODE.banner).spec as SummarySpec
  const matrix = elementByNodeId(org04, NODE.matrix).spec as ItemListSpec
  const contextRoles = elementByNodeId(org04, NODE.contextRoles).spec as SummarySpec

  const rows = readListSource(matrix.dataSourceKey)
  const breadcrumb = org04.breadcrumb

  return (
    <AppShell
      screenId={org04.screenId}
      activeNavigationScreenId={org04.activeNavigationScreenId}
      eyebrow={org04.meta?.eyebrow}
      title={org04.meta?.title ?? org04.screenId}
      onNavigate={onNavigate}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={[ASSET.breadcrumbSeparator]}
            items={breadcrumb.items.map((item) => item.value ?? '')}
          />
        )
      }
    >
      <div
        data-node-id={NODE.banner}
        className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4"
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.banner} className="mt-0.5 size-4" />
        <span>
          <span className="block text-xs font-bold text-blue-900">{banner.title}</span>
          <span className="block pt-1 text-xs text-blue-800">{banner.description}</span>
        </span>
      </div>

      {/* 역할 셋. 이름과 설명은 명세가 갖고 인원만 서버가 준다. */}
      <div className="grid grid-cols-1 gap-4 pt-5 lg:grid-cols-3">
        {NODE.roles.map((nodeId) => (
          <RoleCard key={nodeId} nodeId={nodeId} />
        ))}
      </div>

      <div className="pt-5">
        <DataTable
          nodeId={NODE.matrix}
          title={matrix.title}
          label={matrix.title ?? '기능 영역별 권한'}
          columns={matrix.columns ?? []}
          rows={rows}
          emptyMessage={findDataSource(matrix.dataSourceKey).messages.empty}
          fieldPresentation={{
            area: 'label',
            chair: 'status',
            head: 'status',
            member: 'status',
          }}
          footer={
            /* 각주는 표와 한 칸 안에 있다 - 표를 읽는 사람이 '—'를 만나는 자리다. */
            <p data-node-id={NODE.matrixNote} className="border-t border-gray-100 px-6 py-4 text-xs text-gray-400">
              {(elementByNodeId(org04, NODE.matrixNote).spec as SummarySpec).items![0].value}
            </p>
          }
        />
      </div>

      {/* 회의·행사에서만 생기는 역할. 표의 어느 칸에도 들어가지 않아 따로 적는다. */}
      <div
        data-node-id={NODE.contextRoles}
        className="mt-5 rounded-xl border border-gray-200 bg-white p-5"
      >
        <p className="text-xs font-bold text-gray-800">{contextRoles.title}</p>
        <div className="flex flex-col gap-3 pt-3">
          {(contextRoles.items ?? []).map((item) => (
            <span key={item.value} className="block">
              <span className="block text-xs leading-relaxed font-semibold text-gray-800">
                {item.value}
              </span>
              {/* 부연은 값과 다른 것이라 한 문장으로 합칠 수 없다 - 옅고 얇게 그린다. */}
              {item.description === undefined ? null : (
                <span className="block pt-1 text-xs leading-relaxed text-gray-600">
                  {item.description}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </AppShell>
  )
}

function RoleCard({ nodeId }: { nodeId: string }) {
  const spec = elementByNodeId(org04, nodeId).spec as SummarySpec
  const counts = readObjectSource(spec.dataSourceKey)
  const item = spec.items![0]

  return (
    <div
      data-node-id={nodeId}
      className="rounded-xl border border-gray-200 bg-white px-5 py-4"
    >
      <p className="flex items-baseline justify-between">
        <span className="text-sm font-bold text-gray-900">{spec.title}</span>
        <span className="text-xs text-gray-400">{`${String(counts[item.field!])}${item.unit ?? ''}`}</span>
      </p>
      <p className="pt-2 text-xs text-gray-500">{spec.description}</p>
    </div>
  )
}
