import { useState } from "react";
import { AppShell } from "../components/AppShell";
import { FigmaAsset } from "../components/FigmaAsset";
import { readListSource, readObjectSource } from "../data-sources/catalog";
import { getOptionSource } from "../option-sources/catalog";
import { elementByNodeId, my01 } from "../spec/screens";
import type {
  InputSpec,
  ItemListSpec,
  SelectSpec,
  SummarySpec,
} from "../spec/types";

// 내 업무(MY-01).
//
// 배치는 figma.design.json이 갖고 명세는 무엇을 어디서 읽는지를 갖는다
// (HOME-01K와 같은 방식). 그래서 여기서 자리를 만들고 명세의 요소를 끼운다.
//
// 탭은 select다 — 명세에서 '하나를 고르는 값'이고, 탭 모양이냐 카드 모양이냐는
// 시각이라 design이 갖는다. 다만 구현이 design을 자동으로 읽지는 않으므로
// ORG-02의 라디오 카드(ChoiceGroup)와 달리 여기서는 탭 줄로 그린다.

const SCREEN = "MY-01";

const NODE = {
  alerts: "16:401",
  tab: "16:422",
  search: "16:441",
  tasks: "16:448",
} as const;

// 아이콘은 figma.design.json이 assetRef로 가리키는 자산이다. 상태별 아이콘은
// 요약 항목의 field로 찾는다 — 순서가 아니라 무엇을 가리키는지로 묶는다.
// 목록 항목의 아이콘은 항목마다 되풀이되므로 첫 항목의 것을 본으로 쓴다.
const ASSET = {
  alertByField: {
    delayedCount: "16:403",
    todoCount: "16:410",
    reviewCount: "16:416",
  } as Record<string, string>,
  search: "16:443",
  linkedDocument: "16:476",
  itemChevron: "16:486",
} as const;

interface MY01ScreenProps {
  onNavigate: (screenId: string) => void;
}

export function MY01Screen({ onNavigate }: MY01ScreenProps) {
  const alerts = elementByNodeId(my01, NODE.alerts).spec as SummarySpec;
  const tab = elementByNodeId(my01, NODE.tab).spec as SelectSpec;
  const search = elementByNodeId(my01, NODE.search).spec as InputSpec;
  const tasks = elementByNodeId(my01, NODE.tasks).spec as ItemListSpec;

  const [tabValue, setTabValue] = useState(tab.initialValue ?? "");
  const [query, setQuery] = useState(search.initialValue ?? "");

  const alertRow = readObjectSource(alerts.dataSourceKey ?? "");

  const tabSource = getOptionSource(tab.optionsSource.key);
  const tabOptions = tabSource.type === "static" ? tabSource.options : [];
  const tabCounts = tab.optionCounts
    ? readObjectSource(tab.optionCounts.dataSourceKey)
    : null;

  // 값이 바뀌면 서버에 다시 묻는다. 받아온 것을 화면에서 거르지 않는다
  // (itemList.params가 그렇게 선언한다).
  const byFieldKey: Record<string, string> = {
    [tab.fieldKey]: tabValue,
    [search.fieldKey]: query,
  };
  const taskParams = Object.fromEntries(
    // 인자는 화면 필드를 가리키거나(fieldKey) 명세가 정한 고정값이다(value).
    Object.entries(tasks.params ?? {}).map(([name, argument]) => [
      name,
      argument.value ?? byFieldKey[argument.fieldKey ?? ""] ?? "",
    ]),
  );
  const rows = readListSource(tasks.dataSourceKey, taskParams);
  const emptyMessage = "해당하는 업무가 없습니다";

  return (
    <AppShell
      screenId={my01.screenId}
      eyebrow={my01.meta?.eyebrow}
      title={my01.meta?.title ?? my01.screenId}
      description={my01.meta?.description}
      onNavigate={onNavigate}
    >
      <div data-testid="my01-alerts" className="flex flex-wrap gap-2 pb-4">
        {(alerts.items ?? []).map((item) => (
          <span
            key={item.label}
            className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700"
          >
            {item.field && ASSET.alertByField[item.field] ? (
              <FigmaAsset
                screenId={SCREEN}
                nodeId={ASSET.alertByField[item.field]}
                className="size-3.5"
              />
            ) : null}
            <span>{item.label}</span>
            <span className="font-semibold text-gray-900">
              {`${item.field ? alertRow[item.field] : (item.value ?? '')}${item.unit ?? ''}`}
            </span>
          </span>
        ))}
      </div>

      <div
        role="tablist"
        aria-label={tab.label ?? "업무 단계"}
        className="flex gap-1 border-b border-gray-200"
      >
        {tabOptions.map((option) => {
          const value = String(option.value);
          const selected = value === tabValue;
          const count = tabCounts === null ? null : tabCounts[value];
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTabValue(value)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                selected
                  ? "border-blue-600 font-medium text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {option.label}
              {count === null || count === undefined ? null : (
                <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 py-4">
        <label htmlFor="my01-search" className="sr-only">
          {search.label}
        </label>
        <FigmaAsset
          screenId={SCREEN}
          nodeId={ASSET.search}
          className="size-4"
        />
        <input
          id="my01-search"
          type={search.inputType}
          value={query}
          placeholder={search.placeholder ?? search.label}
          onChange={(event) => setQuery(event.target.value)}
          className="w-64 rounded border border-gray-300 px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        />
      </div>

      <section>
        {tasks.title === undefined ? null : (
          <h2 className="pb-2 text-sm font-semibold text-red-600">
            {tasks.title}
          </h2>
        )}
        {rows.length === 0 ? (
          <p className="rounded border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
            {emptyMessage}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li key={String(row.title)}>
                <TaskCard
                  row={row}
                  itemAction={tasks.itemAction}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}

interface TaskCardProps {
  row: Record<string, string | number>;
  itemAction: ItemListSpec["itemAction"];
  onNavigate: (screenId: string) => void;
}

// 항목을 누르면 어디로 가는지는 명세가, 어느 항목인지는 데이터가 말한다.
// 아직 명세되지 않은 화면(pending)은 조용히 아무 일도 안 하는 대신 사유를 보인다.
function TaskCard({ row, itemAction, onNavigate }: TaskCardProps) {
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="rounded border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => {
          if (itemAction === undefined) {
            return;
          }
          if (itemAction.type === "navigate") {
            onNavigate(itemAction.targetScreenId);
            return;
          }
          setNote(itemAction.note);
        }}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-900">
              {String(row.title)}
            </span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              {String(row.department)}
            </span>
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
              {String(row.status)}
            </span>
          </span>
          <span className="block pt-1 text-xs text-gray-500">
            다음 행동 {String(row.nextAction)}
          </span>
          <span className="block pt-1 text-xs text-gray-500">
            {String(row.context)} · {String(row.date)}
            {row.linkedDocument === undefined ? null : (
              <>
                {" · "}
                <FigmaAsset
                  screenId={SCREEN}
                  nodeId={ASSET.linkedDocument}
                  className="inline size-3"
                />
                {` 연결 문서 ${String(row.linkedDocument)}`}
              </>
            )}
          </span>
        </span>
        <FigmaAsset
          screenId={SCREEN}
          nodeId={ASSET.itemChevron}
          className="size-4 shrink-0"
        />
      </button>
      {note === null ? null : (
        <p className="border-t border-gray-200 px-4 py-2 text-xs text-gray-500">
          {note}
        </p>
      )}
    </div>
  );
}
