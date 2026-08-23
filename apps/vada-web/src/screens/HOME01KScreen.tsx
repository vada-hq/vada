import { createContext, useContext, type ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import { DashboardSection } from "../components/DashboardSection";
import { FigmaAsset } from "../components/FigmaAsset";
import { ProgressBar } from "../components/ProgressBar";
import { StatTile } from "../components/StatTile";
import { readListSource, readObjectSource } from "../data-sources/catalog";
import { elementByNodeId, home01k, nodeIdOf } from "../spec/screens";
import type { ButtonSpec, ItemListSpec, SummarySpec } from "../spec/types";

// 홈 대시보드(HOME-01K).
//
// 명세는 무엇을 어디서 읽어 보여주는지를 갖고(summary·itemList·dataSourceKey),
// 어떻게 배치하는지는 figma.design.json이 갖는다. 그래서 이 컴포넌트가 두 단을
// 만들고 각 자리에 명세의 요소를 끼운다 — 명세에 배치를 넣으면 같은 사실이
// 두 곳에 생긴다.
//
// 사이드바와 상단 헤더는 이 화면의 요소가 아니라 모든 데스크톱 화면이 공유하는
// 앱 구조다. MY-01이 두 번째 사례가 되면서 wireframe 단위 shell.json으로
// 빠졌고(사례 2건), 그래서 이제 AppShell이 그린다.

// 아이콘·마스코트는 figma.design.json이 assetRef로 가리키는 자산이다.
// 목록 항목의 아이콘은 항목마다 되풀이되므로 첫 항목의 것을 본으로 쓴다
// (16:149와 16:183은 같은 달력 아이콘이다).
const SCREEN = "HOME-01K";

const ASSET = {
  mascot: "16:87",
  countTiles: ["16:103", "16:112", "16:124"],
  eventDate: "16:149",
  eventPlace: "16:156",
  eventLink: "16:169",
  calendarLink: "16:212",
  financeLink: "16:275",
  // 알림은 종류마다 아이콘이 다르다. 데이터의 kind가 어느 것인지 말한다.
  alertByKind: { document: "16:246", members: "16:259" } as Record<
    string,
    string
  >,
} as const;

const NODE = {
  briefing: "16:88",
  briefingNotices: "16:93",
  delayedTasksButton: "16:99",
  eventCounts: "16:101",
  events: "16:135",
  schedules: "16:206",
  calendarButton: "16:210",
  orgAlerts: "16:239",
  finance: "16:269",
  financeButton: "16:273",
  myTasksButton: "16:305",
} as const;

// 값의 색은 타일마다 다르다. design의 사실이므로 여기서 지목한다.
const COUNT_TILE_VALUE = ["text-blue-600", "text-indigo-600", "text-orange-600"];
const FINANCE_TILE_VALUE: Record<string, string> = {
  availableBudgetPercent: "text-blue-600",
  missingProofCount: "text-red-500",
};

function specOf<T>(nodeId: string): T {
  return elementByNodeId(home01k, nodeId).spec as T;
}

// action.type이 pending인 버튼은 무엇이 일어나는지 아직 정해지지 않았다.
const NavigateContext = createContext<(screenId: string) => void>(() => {});

// 버튼의 동작은 명세가 정한다. 이동 대상이 있으면 이동하고, 아직 명세되지 않은
// 화면이면 사유를 남긴다. 조용히 아무 일도 하지 않는 경로는 두지 않는다.
function useAction(spec: ButtonSpec) {
  const onNavigate = useContext(NavigateContext);
  const action = spec.action;
  if (action.type === "navigate") {
    return {
      onClick: () => onNavigate(action.targetScreenId),
      title: undefined,
    };
  }
  if (action.type === "pending") {
    return { onClick: undefined, title: action.note };
  }
  return { onClick: undefined, title: undefined };
}

// 링크형은 섹션 제목 옆(16:210·16:273), 외곽선형은 카드 안의 버튼(16:99)이다.
// 형태가 갈리는 근거는 design의 fill·stroke다 — 명세는 강조도만 말한다.
function ActionLink({
  spec,
  iconNodeId,
  variant = "link",
}: {
  spec: ButtonSpec;
  iconNodeId?: string;
  variant?: "link" | "outlined";
}) {
  const { onClick, title } = useAction(spec);
  // 16:99: 흰 배경, 테두리 #D1D5DC→gray-300, radius 3.5→4, padding 5.25/10.5→1.5/3.
  const shape =
    variant === "outlined"
      ? "rounded border border-gray-300 bg-white px-3 py-1.5 text-gray-700 hover:bg-gray-50"
      : "rounded px-2 py-1 text-gray-400 hover:bg-gray-100";

  return (
    <button
      type="button"
      data-node-id={nodeIdOf(home01k, spec)}
      title={title}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1 text-xs font-medium focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none ${shape}`}
    >
      {spec.label}
      {iconNodeId && (
        <FigmaAsset screenId={SCREEN} nodeId={iconNodeId} className="size-3" />
      )}
    </button>
  );
}

function BriefingCard() {
  const summary = specOf<SummarySpec>(NODE.briefing);
  const notices = specOf<ItemListSpec>(NODE.briefingNotices);
  const button = specOf<ButtonSpec>(NODE.delayedTasksButton);

  const briefing = readObjectSource(summary.dataSourceKey!);
  const lines = readListSource(notices.dataSourceKey);

  // 16:85: 배경 #FEF2F2 50%→bg-red-50/50, 테두리 #FFE2E2→red-100,
  // radius 14→rounded-2xl, padding 21/24.5→6/7.
  return (
    <div className="flex items-center gap-6 rounded-2xl border border-red-100 bg-red-50/50 p-6">
      {/* 16:86: 흰 원(70에 radius 35)에 그림자. 마스코트 16:87은 이미지 fill이라
          벡터로 뽑을 수 없어 PNG 자산이다. 70→size-20. */}
      <div className="size-20 shrink-0 overflow-hidden rounded-full bg-white shadow">
        <FigmaAsset
          screenId={SCREEN}
          nodeId={ASSET.mascot}
          className="size-full"
          alt="끼룩이"
        />
      </div>
      {/* 16:88: 흰 말풍선. 테두리 #E5E7EB→gray-200, radius 14→2xl, padding 14/21→4/6. */}
      <div
        data-node-id={NODE.briefing}
        className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white px-6 py-4"
      >
        {summary.eyebrow && (
          <p className="text-xs font-bold text-[#EF4444]">{summary.eyebrow}</p>
        )}
        <h2 className="pt-1 text-base font-bold text-[#0A1F44]">
          {String(briefing[summary.titleField!])}
        </h2>
        <ul data-node-id={NODE.briefingNotices} className="flex flex-col gap-1 pt-3">
          {lines.map((line) => (
            <li key={String(line.message)} className="text-sm text-gray-600">
              {String(line.message)}
            </li>
          ))}
        </ul>
      </div>
      <ActionLink spec={button} variant="outlined" />
    </div>
  );
}

function EventCountTiles() {
  const summary = specOf<SummarySpec>(NODE.eventCounts);
  const counts = readObjectSource(summary.dataSourceKey!);

  // 16:101은 3열 grid, 간격 14→gap-4.
  return (
    <div data-node-id={NODE.eventCounts} className="grid grid-cols-3 gap-4">
      {summary.items!.map((item, at) => (
        <StatTile
          key={item.label}
          label={item.label}
          value={`${counts[item.field!]}개`}
          valueClass={COUNT_TILE_VALUE[at] ?? "text-gray-900"}
          icon={
            <FigmaAsset
              screenId={SCREEN}
              nodeId={ASSET.countTiles[at]}
              className="size-9 shrink-0"
            />
          }
        />
      ))}
    </div>
  );
}

function EventList() {
  const spec = specOf<ItemListSpec>(NODE.events);
  const events = readListSource(spec.dataSourceKey);

  return (
    <DashboardSection nodeId={NODE.events} title={spec.title}>
      <ul>
        {events.map((event) => (
          <li
            key={String(event.title)}
            className="border-b border-gray-100 px-5 py-4 last:border-b-0"
          >
            <div className="flex items-center gap-2">
              <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                {String(event.status)}
              </span>
              <span className="min-w-0 flex-1 text-sm font-bold text-gray-900">
                {String(event.title)}
              </span>
              <FigmaAsset
                screenId={SCREEN}
                nodeId={ASSET.eventLink}
                className="size-3.5 shrink-0"
              />
            </div>
            <p className="flex items-center gap-1.5 pt-2 text-xs font-medium text-gray-400">
              <FigmaAsset
                screenId={SCREEN}
                nodeId={ASSET.eventDate}
                className="size-3"
              />
              <span>{String(event.date)}</span>
              <FigmaAsset
                screenId={SCREEN}
                nodeId={ASSET.eventPlace}
                className="ml-1.5 size-3"
              />
              <span>{String(event.place)}</span>
              <span className="ml-1.5">{String(event.team)}</span>
            </p>
            <div className="pt-2">
              <ProgressBar
                percent={Number(event.progressPercent)}
                ariaLabel={
                  event.delayedTaskCount === undefined
                    ? `준비 ${event.progressPercent}%`
                    : `준비 ${event.progressPercent}% · 지연 업무 ${event.delayedTaskCount}건`
                }
                label={
                  <>
                    {/* design은 준비율과 지연 알림을 색이 다른 두 줄기로 그린다. */}
                    <span className="text-gray-500">{`준비 ${event.progressPercent}%`}</span>
                    {event.delayedTaskCount === undefined ? null : (
                      <span className="text-red-500">{` · 지연 업무 ${event.delayedTaskCount}건`}</span>
                    )}
                  </>
                }
              />
            </div>
          </li>
        ))}
      </ul>
    </DashboardSection>
  );
}

function ScheduleList() {
  const spec = specOf<ItemListSpec>(NODE.schedules);
  const button = specOf<ButtonSpec>(NODE.calendarButton);
  const schedules = readListSource(spec.dataSourceKey);

  return (
    <DashboardSection
      nodeId={NODE.schedules}
      title={spec.title}
      action={<ActionLink spec={button} iconNodeId={ASSET.calendarLink} />}
    >
      <ul>
        {schedules.map((schedule) => (
          <li
            key={`${schedule.date}-${schedule.title}`}
            className="flex items-center gap-4 border-b border-gray-100 px-5 py-3 last:border-b-0"
          >
            <span className="shrink-0 font-mono text-xs font-bold text-gray-500">
              {String(schedule.date)}
            </span>
            <span className="min-w-0 flex-1 text-sm font-medium text-gray-800">
              {String(schedule.title)}
            </span>
            <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-600">
              {String(schedule.badge)}
            </span>
          </li>
        ))}
      </ul>
    </DashboardSection>
  );
}

// 데이터가 말하는 종류를 디자인의 아이콘에 잇는다. 모르는 종류는 조용히
// 아이콘 없이 넘어가는 대신 드러낸다 — 새 알림 종류가 생기면 여기서 걸린다.
function alertIconOf(kind: string): string {
  const nodeId = ASSET.alertByKind[kind];
  if (!nodeId) {
    throw new Error(`조직 알림 종류 '${kind}'에 해당하는 아이콘이 없습니다.`);
  }
  return nodeId;
}

function OrgAlertList() {
  const spec = specOf<ItemListSpec>(NODE.orgAlerts);
  const alerts = readListSource(spec.dataSourceKey);

  return (
    <DashboardSection nodeId={NODE.orgAlerts} title={spec.title}>
      <ul>
        {alerts.map((alert) => (
          <li
            key={String(alert.label)}
            className="flex items-center gap-3 border-b border-gray-100 px-5 py-3 last:border-b-0"
          >
            <FigmaAsset
              screenId={SCREEN}
              nodeId={alertIconOf(String(alert.kind))}
              className="size-6 shrink-0"
            />
            <span className="min-w-0 flex-1 text-sm font-medium text-gray-700">
              {String(alert.label)}
            </span>
            <span className="shrink-0 text-sm font-bold text-gray-900">
              {String(alert.count)}건
            </span>
          </li>
        ))}
      </ul>
    </DashboardSection>
  );
}

function FinanceSummary() {
  const summary = specOf<SummarySpec>(NODE.finance);
  const button = specOf<ButtonSpec>(NODE.financeButton);
  const finance = readObjectSource(summary.dataSourceKey!);

  const [usage, ...tiles] = summary.items!;
  const suffix = (field: string) => (field.endsWith("Percent") ? "%" : "건");

  return (
    <DashboardSection
      nodeId={NODE.finance}
      title={summary.title}
      action={<ActionLink spec={button} iconNodeId={ASSET.financeLink} />}
    >
      <div className="px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-400">{usage.label}</span>
          <span className="text-sm font-bold text-gray-900">
            {String(finance[usage.field!])}%
          </span>
        </div>
        <div className="pt-2">
          <ProgressBar percent={Number(finance[usage.field!])} fill />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-4">
          {tiles.map((tile) => (
            <StatTile
              key={tile.label}
              label={tile.label}
              value={`${finance[tile.field!]}${suffix(tile.field!)}`}
              tone="inset"
              valueClass={FINANCE_TILE_VALUE[tile.field!] ?? "text-gray-900"}
            />
          ))}
        </div>
      </div>
    </DashboardSection>
  );
}

function MyTasksCard() {
  const spec = specOf<ButtonSpec>(NODE.myTasksButton);
  const { onClick, title } = useAction(spec);

  return (
    <button
      type="button"
      data-node-id={NODE.myTasksButton}
      title={title}
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-left hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-400">{spec.label}</span>
        {spec.description && (
          <span className="block pt-0.5 text-xs font-bold text-gray-700">
            {spec.description}
          </span>
        )}
      </span>
      {spec.badge && (
        <span className="shrink-0 text-xs font-medium text-gray-400">{spec.badge}</span>
      )}
    </button>
  );
}

interface HOME01KScreenProps {
  onNavigate: (screenId: string) => void;
}

export function HOME01KScreen({ onNavigate }: HOME01KScreenProps): ReactNode {
  // 16:84: padding 21→6, 아래 35→10. 두 단 16:133은 637:308 → 728:352px.
  return (
    <NavigateContext.Provider value={onNavigate}>
      <AppShell
        screenId={home01k.screenId}
        eyebrow={home01k.meta?.eyebrow}
        title={home01k.meta?.title ?? home01k.screenId}
        description={home01k.meta?.description}
        onNavigate={onNavigate}
      >
        <div className="mx-auto flex max-w-[1152px] flex-col gap-6">
          <BriefingCard />
          <EventCountTiles />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[728fr_352fr]">
            <div className="flex flex-col gap-6">
              <EventList />
              <ScheduleList />
            </div>
            <div className="flex flex-col gap-6">
              <OrgAlertList />
              <FinanceSummary />
              <MyTasksCard />
            </div>
          </div>
        </div>
      </AppShell>
    </NavigateContext.Provider>
  );
}
